import { Accessor, createState } from "ags"
import { Astal, Gtk } from "ags/gtk4"
import { interval } from "ags/time"
import GLib from "gi://GLib?version=2.0"
import options from "../options"
import { calculateAnchor } from "./common/PopupWindow"

const [cpu, setCpu] = createState(0)
const [ram, setRam] = createState(0)
const [ramText, setRamText] = createState("RAM")
const [uptime, setUptime] = createState("")

const decoder = new TextDecoder()
const readFile = (path: string): string | null => {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    return ok ? decoder.decode(bytes) : null
  } catch {
    return null
  }
}

let prevTotal = 0
let prevIdle = 0
function readCpu() {
  const line = readFile("/proc/stat")?.split("\n")[0]
  if (!line) return
  const n = line.trim().split(/\s+/).slice(1).map(Number)
  const idle = n[3] + (n[4] || 0)
  const total = n.reduce((a, b) => a + b, 0)
  const dt = total - prevTotal
  const di = idle - prevIdle
  if (prevTotal > 0 && dt > 0) setCpu(Math.round(((dt - di) / dt) * 100))
  prevTotal = total
  prevIdle = idle
}

function readRam() {
  const txt = readFile("/proc/meminfo")
  if (!txt) return
  const get = (key: string) => {
    const m = txt.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"))
    return m ? parseInt(m[1]) : 0
  }
  const total = get("MemTotal")
  const used = total - get("MemAvailable")
  if (!total) return
  setRam(Math.round((used / total) * 100))
  setRamText(`RAM · ${(used / 1048576).toFixed(1)} GB`)
}

function readUptime() {
  const s = parseFloat(readFile("/proc/uptime")?.split(" ")[0] ?? "0")
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  setUptime(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`)
}

function tick() {
  readCpu()
  readRam()
  readUptime()
}

function UnitBox({
  label,
  value,
}: {
  label: Accessor<string> | string
  value: Accessor<string>
}) {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} cssClasses={["unit"]}>
      <label
        cssClasses={["unit-value"]}
        label={value}
        halign={Gtk.Align.CENTER}
      />
      <label cssClasses={["box-label"]} label={label} />
    </box>
  )
}

export default function SysMonitor() {
  interval(2000, () => {
    tick()
  })

  return (
    <window
      $={(self) => {
        self.set_default_size(1, 1)
        self.can_target = false
        self.focusable = false
      }}
      visible
      layer={Astal.Layer.BOTTOM}
      keymode={Astal.Keymode.NONE}
      name={"sysmonitor"}
      namespace={"sysmonitor"}
      anchor={options.system_monitor.position(
        (p) => calculateAnchor(p) ?? Astal.Layer.TOP,
      )}
    >
      <box cssClasses={["sysmon-container"]} spacing={20}>
        <UnitBox label="CPU" value={cpu((v) => `${v}%`)} />
        <UnitBox label={ramText} value={ram((v) => `${v}%`)} />
        <UnitBox label="Uptime" value={uptime} />
      </box>
    </window>
  )
}
