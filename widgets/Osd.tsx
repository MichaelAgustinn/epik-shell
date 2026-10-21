import { Astal, Gtk } from "ags/gtk4"
import app from "ags/gtk4/app"
import AstalWp from "gi://AstalWp"
import GLib from "gi://GLib?version=2.0"
import { createRoot, createState } from "ags"

const [icon, setIcon] = createState("audio-volume-high-symbolic")
const [title, setTitle] = createState("Volume")
const [percent, setPercent] = createState(0)

let hideId = 0
let ready = false

function show(iconName: string, name: string, pct: number) {
  if (!ready) return
  setIcon(iconName)
  setTitle(name)
  setPercent(pct)
  app.get_window("osd")?.show()
  if (hideId) GLib.source_remove(hideId)
  hideId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
    app.get_window("osd")?.hide()
    hideId = 0
    return GLib.SOURCE_REMOVE
  })
}

/* ---------- Volume ---------- */
function volumeIcon(volume: number, mute: boolean) {
  if (mute || volume <= 0) return "audio-volume-muted-symbolic"
  if (volume < 0.34) return "audio-volume-low-symbolic"
  if (volume < 0.67) return "audio-volume-medium-symbolic"
  return "audio-volume-high-symbolic"
}

function hookVolume() {
  const audio = AstalWp.get_default()?.audio
  if (!audio) return

  let current: AstalWp.Endpoint | null = null
  let ids: number[] = []

  const report = () => {
    if (!current) return
    const v = current.volume
    show(
      volumeIcon(v, current.mute),
      current.mute ? "Muted" : "Volume",
      Math.round(v * 100),
    )
  }

  const watch = () => {
    if (current) ids.forEach((id) => current!.disconnect(id))
    current = audio.defaultSpeaker
    ids = current
      ? [
          current.connect("notify::volume", report),
          current.connect("notify::mute", report),
        ]
      : []
  }

  watch()
  audio.connect("notify::default-speaker", watch)
}

/* ---------- Brightness ---------- */
function readNumber(path: string): number | null {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    if (!ok) return null
    return parseInt(new TextDecoder().decode(bytes).trim())
  } catch {
    return null
  }
}

function hookBrightness() {
  const base = "/sys/class/backlight"
  let device: string | null = null
  try {
    const dir = GLib.Dir.open(base, 0)
    device = dir.read_name()
  } catch {
    return
  }
  if (!device) return

  const max = readNumber(`${base}/${device}/max_brightness`)
  if (!max) return

  let last = readNumber(`${base}/${device}/brightness`)
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
    const now = readNumber(`${base}/${device}/brightness`)
    if (now !== null && now !== last) {
      last = now
      show(
        "display-brightness-symbolic",
        "Brightness",
        Math.round((now / max) * 100),
      )
    }
    return GLib.SOURCE_CONTINUE
  })
}

export default function Osd() {
  return createRoot(() => {
    hookVolume()
    hookBrightness()
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      ready = true
      return GLib.SOURCE_REMOVE
    })

    return (
      <window
        application={app}
        name="osd"
        namespace="osd"
        visible={false}
        layer={Astal.Layer.OVERLAY}
        exclusivity={Astal.Exclusivity.IGNORE}
        keymode={Astal.Keymode.NONE}
        anchor={Astal.WindowAnchor.BOTTOM}
      >
        <box cssClasses={["osd-box"]} spacing={12}>
          <image iconName={icon} pixelSize={28} />
          <box
            orientation={Gtk.Orientation.VERTICAL}
            spacing={4}
            valign={Gtk.Align.CENTER}
          >
            <label cssClasses={["osd-title"]} xalign={0} label={title} />
            <Gtk.ProgressBar
              cssClasses={["osd-bar"]}
              hexpand
              fraction={percent((p) => Math.min(Math.max(p, 0), 100) / 100)}
            />
          </box>
          <label
            cssClasses={["osd-percent"]}
            widthChars={4}
            xalign={1}
            label={percent((p) => `${p}%`)}
          />
        </box>
      </window>
    )
  })
}
