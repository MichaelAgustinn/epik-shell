import { Accessor, createState } from "ags"
import { cacheDir, ensureDirectory, ensureFile, notifySend } from "."
import GLib from "gi://GLib?version=2.0"
import { monitorFile, readFile, readFileAsync, writeFile } from "ags/file"
import Gio from "gi://Gio?version=2.0"
import AstalNotifd from "gi://AstalNotifd"

ensureFile(`${cacheDir}/options.json`)

function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a === "object" && typeof b === "object" && a && b) {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

function getNestedValue(obj: Record<string, any>, keyPath: string) {
  const keys = keyPath.split(".")
  let current = obj

  for (const key of keys) {
    if (current && Object.prototype.hasOwnProperty.call(current, key)) {
      current = current[key]
    } else {
      return undefined
    }
  }

  return current
}

function setNestedValue<T>(
  obj: Record<string, any>,
  keyPath: string,
  value: T,
) {
  const keys = keyPath.split(".")
  let current = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]

    if (!current[key]) {
      current[key] = {}
    }

    current = current[key]
  }

  current[keys[keys.length - 1]] = value
}

type Callback = () => void
type DisposeFn = () => void

export class Opt<T = unknown> extends Accessor<T> {
  constructor(initial: T, { cached = false }: { cached?: boolean }) {
    super(
      () => this.currentValue,
      (callback: Callback): DisposeFn => {
        this.subscribers.add(callback)
        return () => this.subscribers.delete(callback)
      },
    )
    this.defaultValue = initial
    this.currentValue = initial
    this.cached = cached
  }

  subscribers = new Set<Callback>()
  defaultValue: T
  currentValue: T
  id = ""
  cached = false

  set(newValue: T): void {
    const value: T =
      typeof newValue === "function" ? newValue(this.currentValue) : newValue

    // isEqual also treats structurally equal arrays/objects as unchanged,
    // so subscribers are not re-triggered on every config reload.
    if (!isEqual(this.currentValue, value)) {
      this.currentValue = value
      Array.from(this.subscribers).forEach((cb) => cb())
    }

    if (this.cached) {
      readFileAsync(`${cacheDir}/options.json`)
        .then((content) => {
          let cache: Record<string, any>
          try {
            cache = JSON.parse(content)
          } catch (error) {
            cache = {}
          }
          cache[this.id] = value
          writeFile(`${cacheDir}/options.json`, JSON.stringify(cache, null, 2))
        })
        .catch(console.error)
    }
  }

  init(configFile: string) {
    const dir = this.cached ? `${cacheDir}/options.json` : configFile

    if (GLib.file_test(dir, GLib.FileTest.EXISTS)) {
      let config: Record<string, any>
      try {
        config = JSON.parse(readFile(dir))
      } catch {
        config = {}
      }
      const configV = this.cached
        ? config[this.id]
        : getNestedValue(config, this.id)
      if (configV !== undefined) {
        this.set(configV)
      }
    }
  }
}

export const opt = <T>(initial: T, opts = {}) => new Opt(initial, opts)

function getOptions(object: Record<string, any>, path = ""): Opt[] {
  return Object.keys(object).flatMap((key) => {
    const obj = object[key]
    const id = path ? path + "." + key : key

    if (obj instanceof Opt) {
      obj.id = id
      return obj
    }

    if (typeof obj === "object" && obj !== null) return getOptions(obj, id)

    return []
  })
}

function transformObject(obj: Record<string, any>, initial?: boolean) {
  if (obj instanceof Opt) {
    if (obj.cached) {
      return
    } else {
      if (initial) {
        return obj.currentValue
      } else {
        return obj()
      }
    }
  }

  if (typeof obj !== "object" || obj === null) return

  const newObj: Record<string, any> = {}

  Object.keys(obj).forEach((key) => {
    newObj[key] = transformObject(obj[key], initial)
  })

  const length = Object.keys(JSON.parse(JSON.stringify(newObj))).length

  return length > 0 ? newObj : undefined
}

function deepMerge(target: Record<string, any>, source: Record<string, any>) {
  if (typeof target !== "object" || target === null) {
    return source
  }

  if (typeof source !== "object" || source === null) {
    return source
  }

  const result: Record<string, any> = Array.isArray(target) ? [] : { ...target }

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (Array.isArray(source[key])) {
        result[key] = [...source[key]]
      } else if (typeof source[key] === "object" && source[key] !== null) {
        result[key] = deepMerge(target[key], source[key])
      } else {
        result[key] = source[key]
      }
    }
  }

  return result
}

export function mkOptions<T extends object>(configFile: string, object: T) {
  const allOpts = getOptions(object)

  for (const o of allOpts) {
    o.init(configFile)
  }

  ensureDirectory(configFile.split("/").slice(0, -1).join("/"))
  const [configVar, configVarSet] = createState(transformObject(object))

  if (GLib.file_test(configFile, GLib.FileTest.EXISTS)) {
    let configData: object
    try {
      configData = JSON.parse(readFile(configFile) || "{}")
    } catch {
      configData = {}
    }
    configVarSet(deepMerge(configVar.peek(), configData))
  }

  /**
   * Applies `newConfig` (the config file already merged on top of the
   * defaults) to the options.
   *
   * It compares against each option's *current* value rather than against
   * a previous snapshot. That way:
   *  - a key present in the file and already applied is left alone,
   *  - a key removed from the file falls back to its default (the merged
   *    config carries the default value), so no separate reset branch is
   *    needed and nothing is reset by mistake.
   */
  function updateConfig(newConfig: Record<string, any>, path = "") {
    for (const key in newConfig) {
      const fullPath = path ? `${path}.${key}` : key
      const value = newConfig[key]
      const conf = allOpts.find((c) => c.id === fullPath)

      if (conf) {
        // cached options live in options.json, not in the config file
        if (conf.cached) continue
        if (value === undefined) continue

        if (!isEqual(conf.currentValue, value)) {
          print(`${fullPath} updated`)
          const newC = configVar.peek()
          setNestedValue(newC, fullPath, value)
          configVarSet(newC)
          conf.set(value)
        }
        continue
      }

      // not an option itself, so it is a group of options: recurse
      if (isPlainObject(value)) {
        updateConfig(value, fullPath)
      }
    }
  }

  const defaultConfig = transformObject(object, true) ?? {}
  let timeout: number | null = null
  let lastContent: string | null = null

  monitorFile(configFile, (_, event) => {
    if (
      event !== Gio.FileMonitorEvent.CHANGED &&
      event !== Gio.FileMonitorEvent.CREATED &&
      event !== Gio.FileMonitorEvent.CHANGES_DONE_HINT &&
      event !== Gio.FileMonitorEvent.MOVED_IN
    )
      return

    if (timeout !== null) {
      GLib.source_remove(timeout)
      timeout = null
    }

    timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
      const content = readFile(configFile) || ""

      if (content === lastContent) {
        timeout = null
        return GLib.SOURCE_REMOVE
      }
      lastContent = content

      try {
        const parsed = JSON.parse(content || "{}")
        updateConfig(deepMerge(defaultConfig, parsed))
      } catch {
        notifySend(
          new AstalNotifd.Notification({
            appName: "Epik Shell",
            summary: "Config File",
            body: "Failed to parse the config file",
          }),
        )
      }

      timeout = null
      return GLib.SOURCE_REMOVE
    })
  })

  return Object.assign(object, {
    configFile,
    handler(deps: string[], callback: () => void) {
      for (const o of allOpts) {
        if (deps.some((i) => o.id.startsWith(i))) o.subscribe(callback)
      }
    },
  })
}
