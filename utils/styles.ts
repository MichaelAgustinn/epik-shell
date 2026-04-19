import options from "../options"
import { bash, gsettings } from "."
import { Opt } from "./option"
import GLib from "gi://GLib?version=2.0"
import { readFile, writeFileAsync } from "ags/file"
import app from "ags/gtk4/app"
import AstalHyprland from "gi://AstalHyprland?version=0.1"
import { Gdk } from "ags/gtk4"
import Gio from "gi://Gio?version=2.0"

const { theme, window, bar } = options

type ShorthandProperty = {
  top: number
  right: number
  bottom?: number
  left?: number
}

type Theme = {
  background: string
  foreground: string
  accent: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
}

function cssColorToHex(color: string) {
  const rgba = new Gdk.RGBA()

  if (!rgba.parse(color)) return "rgb(000000)"

  const r = Math.round(rgba.red * 255)
  const g = Math.round(rgba.green * 255)
  const b = Math.round(rgba.blue * 255)

  return `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

async function initGtk(colors: Theme, reset = false) {
  const targetDir = `${GLib.get_home_dir()}/.themes/colors.css`
  const defineColor = (key: string, value: string, alpha = 1.0) =>
    `@define-color ${key} alpha(${value}, ${alpha});`

  const gtkVar = [
    defineColor("window_bg_color", colors.background, window.opacity.peek()),
    defineColor("view_fg_color", colors.foreground, 1),
    defineColor("view_bg_color", colors.background, window.opacity.peek()),
    defineColor("sidebar_bg_color", colors.background, window.opacity.peek()),
    defineColor("sidebar_fg_color", colors.foreground, 1),
    defineColor("headerbar_bg_color", colors.background, window.opacity.peek()),
    defineColor("popover_bg_color", colors.background, window.opacity.peek()),
  ]

  // generate colors.css in $HOME/.themes/
  await writeFileAsync(targetDir, gtkVar.join("\n"))
    .then(() => {
      if (reset) {
        gsettings.reset("gtk-theme")
      }

      gsettings.set_string(
        "gtk-theme",
        `adw-gtk3${theme.peek() === "light" ? "" : "-dark"}`,
      )
      gsettings.set_string("color-scheme", `prefer-${theme.peek()}`)
    })
    .catch(console.error)
}

function shorthand(
  value: number | number[],
  length: number,
): ShorthandProperty {
  if (typeof value === "number") {
    return length <= 2
      ? { top: value, right: value }
      : { top: value, right: value, bottom: value, left: value }
  }

  const [top, right = top, bottom = top, left = right] = value
  return length <= 2 ? { top, right } : { top, right, bottom, left }
}

function applyOffsets(
  short: ShorthandProperty,
  element: typeof bar | typeof window,
  hyprland = false,
) {
  const borderWidth = hyprland ? 0 : element.border_width.peek()
  const shadowHOffset = element.shadow.offset.peek()[0]
  const shadowVOffset = element.shadow.offset.peek()[1]

  short.top += borderWidth + (shadowVOffset <= 0 ? Math.abs(shadowVOffset) : 0)
  short.right += borderWidth + (shadowHOffset > 0 ? shadowHOffset : 0)
  short.bottom! += borderWidth + (shadowVOffset > 0 ? shadowVOffset : 0)
  short.left! +=
    borderWidth + (shadowHOffset <= 0 ? Math.abs(shadowHOffset) : 0)

  return short
}

type DefineVarOptions = {
  key?: string
  type?: "string" | "number" | "number_only" | "number_or_array"
  slice?: number
  arrayLength?: number
}

function defineVar(opt: Opt | string, varOptions: DefineVarOptions = {}) {
  const { key, type = "string", slice = 2, arrayLength = 4 } = varOptions
  const value = opt instanceof Opt ? opt.peek() : opt

  if (typeof opt === "string" && !key) {
    throw new Error("Key is required when opt is a string")
  }

  const typeChecks: Record<string, any> = {
    number_only: (val: any) => typeof val === "number",
    number: (val: any) => typeof val === "number",
    string: (val: any) => typeof val === "string" || typeof val === "boolean",
    number_or_array: (val: any) =>
      typeof val === "number" || Array.isArray(val),
  }

  if (!typeChecks[type](value)) {
    throw new Error(
      `Invalid value,${opt instanceof Opt ? " " + opt.id : ""} needs ${type.split("_").join(" ")}`,
    )
  }

  let modifiedVal: Record<string, number> | string | unknown
  switch (type) {
    case "number":
      modifiedVal = `${value}px`
      break
    case "number_or_array":
      let short: any = shorthand(value as number | number[], arrayLength)

      if (opt instanceof Opt && opt.id.startsWith("window.margin")) {
        short = applyOffsets(short, window)
      }
      if (opt instanceof Opt && opt.id.startsWith("bar.margin")) {
        const barPos = options.bar.position.peek()
        short.bottom = barPos == "top" ? 0 : short.bottom
        short.top = barPos == "bottom" ? 0 : short.top
        const oldVal = { ...short }
        short = applyOffsets(short, bar)
        if (oldVal.bottom == 0 && barPos == "bottom") {
          short.bottom = 0
        }
        if (oldVal.top == 0 && barPos == "top") {
          short.top = 0
        }
      }
      modifiedVal = Object.keys(short)
        .map((key) => `${short[key]}px`)
        .join(" ")
      break
    default:
      modifiedVal = value
      break
  }

  const finalKey =
    key ??
    (opt instanceof Opt
      ? opt.id.split(".").slice(-slice).join("-").replace(/_/g, "-")
      : "var")
  return `$${finalKey}: ${modifiedVal};`
}

async function initScss(colors: Theme) {
  const targetDir = `${GLib.get_tmp_dir()}/_variables.scss`
  const scss = `${GLib.get_tmp_dir()}/styles.scss`
  const css = `${GLib.get_tmp_dir()}/styles.css`

  const scssVar = [
    defineVar(colors.background, {
      key: "background",
      type: "string",
      slice: 1,
    }),
    defineVar(colors.foreground, {
      key: "foreground",
      type: "string",
      slice: 1,
    }),
    defineVar(colors.accent, { key: "accent", type: "string", slice: 1 }),
    defineVar(colors.red, { key: "red", type: "string", slice: 1 }),
    defineVar(colors.green, { key: "green", type: "string", slice: 1 }),
    defineVar(colors.yellow, { key: "yellow", type: "string", slice: 1 }),
    defineVar(colors.blue, { key: "blue", type: "string", slice: 1 }),
    defineVar(colors.magenta, { key: "magenta", type: "string", slice: 1 }),
    defineVar(colors.cyan, { key: "cyan", type: "string", slice: 1 }),
    defineVar(colors.white, { key: "white", type: "string", slice: 1 }),

    defineVar(window.opacity, { type: "number_only" }),
    defineVar(window.border_radius, { type: "number_or_array" }),
    defineVar(window.margin, { type: "number_or_array" }),
    defineVar(window.padding, { type: "number_or_array" }),
    defineVar(window.dock_padding, { type: "number_or_array" }),
    defineVar(window.desktop_clock_padding, { type: "number_or_array" }),
    defineVar(window.border_width, { type: "number" }),
    defineVar(window.border_color),

    defineVar(window.shadow.offset, {
      type: "number_or_array",
      slice: 3,
      arrayLength: 2,
    }),
    defineVar(window.shadow.blur, { type: "number", slice: 3 }),
    defineVar(window.shadow.spread, { type: "number", slice: 3 }),
    defineVar(window.shadow.color, { type: "string", slice: 3 }),
    defineVar(window.shadow.opacity, { type: "number_only", slice: 3 }),

    defineVar(options.bar.separator),
    defineVar(bar.border_radius, { type: "number_or_array" }),
    defineVar(bar.bg_color),
    defineVar(bar.opacity, { type: "number_only" }),
    defineVar(bar.margin, { type: "number_or_array" }),
    defineVar(bar.padding, { type: "number_or_array" }),
    defineVar(bar.border_width, { type: "number" }),
    defineVar(bar.border_color),

    defineVar(bar.shadow.offset, {
      type: "number_or_array",
      slice: 3,
      arrayLength: 2,
    }),
    defineVar(bar.shadow.blur, { type: "number", slice: 3 }),
    defineVar(bar.shadow.spread, { type: "number", slice: 3 }),
    defineVar(bar.shadow.color, { type: "string", slice: 3 }),
    defineVar(bar.shadow.opacity, { type: "number_only", slice: 3 }),

    defineVar(bar.button.bg_color, { type: "string", slice: 3 }),
    defineVar(bar.button.fg_color, { type: "string", slice: 3 }),
    defineVar(bar.button.opacity, { type: "number_only", slice: 3 }),
    defineVar(bar.button.padding, { type: "number_or_array", slice: 3 }),
    defineVar(bar.button.border_radius, { type: "number_or_array", slice: 3 }),
    defineVar(bar.button.border_width, { type: "number", slice: 3 }),
    defineVar(bar.button.border_color, { type: "string", slice: 3 }),
    defineVar(bar.button.shadow.offset, {
      type: "number_or_array",
      slice: 4,
      arrayLength: 2,
    }),
    defineVar(bar.button.shadow.blur, { type: "number", slice: 4 }),
    defineVar(bar.button.shadow.spread, { type: "number", slice: 4 }),
    defineVar(bar.button.shadow.color, { type: "string", slice: 4 }),
    defineVar(bar.button.shadow.opacity, { type: "number_only", slice: 4 }),
  ]

  await writeFileAsync(targetDir, scssVar.join("\n")).catch(console.error)
  await writeFileAsync(
    `${SRC}/styles/variables.scss`,
    `@forward '${targetDir}'`,
  )

  const fd = await bash(`fd ".scss" ${SRC}`)
  const files = fd.split(/\s+/)
  const imports = [...files].map((f) =>
    f.includes("variables") ? `` : `@use '${f}';`,
  )
  await writeFileAsync(scss, imports.join("\n"))
  await bash(`sass ${scss} ${css}`)
  app.apply_css(css, true)
}

export async function initHyprlandTheme(colors: Theme) {
  const generateConfig = (keyword: string, value: any) => `${keyword} ${value}`
  const margin: Record<string, number> = applyOffsets(
    shorthand(window.margin.peek(), 4),
    window,
    true,
  )
  const fgColor = `rgb(${colors.foreground.replace("#", "")})`
  const shadowOffset: Record<string, number> = shorthand(
    window.shadow.offset.peek(),
    2,
  )

  function alphaToHex(a: number) {
    return Math.round(a * 255)
      .toString(16)
      .padStart(2, "0")
  }

  const shadowColor = (color: string) => {
    const shadowOpacity = alphaToHex(window.shadow.opacity.peek())
    if (color.startsWith("#")) {
      return `rgba(${color.replace("#", "")}${shadowOpacity})`
    } else if (color.startsWith("$")) {
      const key = color.replace("$", "") as
        | "background"
        | "foreground"
        | "accent"
        | "red"
      const getColor = colors[key]
      return `rgba(${getColor.replace("#", "")}${shadowOpacity})`
    } else {
      return `rgba(${cssColorToHex(color)}${shadowOpacity})`
    }
  }

  const config = [
    generateConfig("general:border_size", window.border_width.peek()),
    generateConfig(
      "general:gaps_out",
      Object.keys(margin)
        .map((key) => margin[key])
        .join(","),
    ),
    generateConfig("general:col.active_border", fgColor),
    generateConfig("decoration:rounding", window.border_radius.peek()),
    generateConfig(
      "decoration:shadow:offset",
      Object.keys(shadowOffset)
        .map((key) => shadowOffset[key] - window.border_width.peek())
        .join(", "),
    ),
    generateConfig(
      "decoration:shadow:color",
      shadowColor(window.shadow.color.peek()),
    ),
    generateConfig("decoration:shadow:range", window.shadow.blur.peek()),
  ]

  const hl = AstalHyprland.get_default()
  const cmd = config.map((c) => `keyword ${c}`).join("; ")
  return new Promise((resolve, reject) => {
    hl.message_async(`[[BATCH]]/${cmd};"`, (_, res) => {
      try {
        resolve(hl.message_finish(res))
      } catch (error) {
        reject(error)
      }
    })
  })
}

// 1. Define config file for dark and light mode
// 2. Copy that config file to .config/alacritty/colors.toml
// 3. Alacritty config import that file, so it auto update
async function updateAlacritty() {
  const files = {
    dark: options.alacritty.dark.peek(),
    light: options.alacritty.light.peek(),
  }

  const file = Gio.File.new_for_path(files[theme.peek()])
  const configDir = GLib.get_user_config_dir()
  const destination = Gio.File.new_for_path(
    `${configDir}/alacritty/colors.toml`,
  )
  return new Promise((resolve, reject) => {
    file.copy_async(
      destination,
      Gio.FileCopyFlags.OVERWRITE,
      1,
      null,
      null,
      (_, res) => {
        try {
          resolve(file.copy_finish(res))
        } catch (error) {
          reject(error)
        }
      },
    )
  })
}

function loadThemeColors(scheme: string, theme: string): Theme {
  const paths = [
    `${SRC}/themes/${scheme}.json`,
    `${GLib.get_user_config_dir()}/epik-shell/themes/${scheme}.json`,
    `${SRC}/themes/tokyonight.json`,
  ]

  for (const path of paths) {
    try {
      return JSON.parse(readFile(path))[theme]
    } catch {
      // try next path
    }
  }

  throw new Error("Failed to load any theme file")
}

export default async function () {
  options.handler(["theme", "colorscheme", "bar", "window"], async () => {
    const colors = loadThemeColors(options.colorscheme.peek(), theme.peek())
    await initGtk(colors, false).catch(console.error)
    await initScss(colors).catch(console.error)
    await initHyprlandTheme(colors).catch(console.error)
    await updateAlacritty()
  })

  const hyprland = AstalHyprland.get_default()
  hyprland.connect("config-reloaded", async () => {
    const colors = loadThemeColors(options.colorscheme.peek(), theme.peek())
    await initHyprlandTheme(colors).catch(console.error)
  })

  const colors = loadThemeColors(options.colorscheme.peek(), theme.peek())
  await initGtk(colors).catch(console.error)
  await initScss(colors).catch(console.error)
  await initHyprlandTheme(colors).catch(console.error)
  await updateAlacritty()
}
