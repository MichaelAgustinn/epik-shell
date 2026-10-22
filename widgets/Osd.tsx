import { Astal, Gtk } from "ags/gtk4"
import { createState } from "ags"
import options from "../options"
import { calculateAnchor } from "./common/PopupWindow"
import Brightness from "gi://AstalBrightness"
import AstalWp from "gi://AstalWp?version=0.1"
import { timeout } from "ags/time"

const { osd } = options

export default function Osd() {
  const brightness = Brightness.get_default()
  const audio = AstalWp.get_default()?.audio

  const [icon, setIcon] = createState("audio-volume-high-symbolic")
  const [title, setTitle] = createState("Volume")
  const [percent, setPercent] = createState(0)
  let count = 0

  function hideWindow(win: Astal.Window) {
    timeout(1500, () => {
      count--
      if (count === 0) {
        win.set_visible(false)
      }
    })
  }

  return (
    <window
      name={"osd"}
      namespace={"osd"}
      anchor={osd.position((l) => calculateAnchor(l))}
      layer={Astal.Layer.OVERLAY}
      $={(win) => {
        brightness.screen.connect("notify", (obj) => {
          win.set_visible(true)
          count++
          setIcon("display-brightness-symbolic")
          setTitle("Brightness")
          setPercent(obj.brightness)
          hideWindow(win)
        })

        audio.defaultSpeaker.connect("notify", (obj) => {
          win.set_visible(true)
          count++
          setIcon(obj.volumeIcon)
          setTitle(obj.mute ? "Muted" : "Volume")
          setPercent(obj.volume)
          hideWindow(win)
        })
      }}
    >
      <box
        cssClasses={["osd-container", "window-content"]}
        spacing={8}
        valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
        orientation={osd.orientation.as((v) =>
          v == "vertical"
            ? Gtk.Orientation.VERTICAL
            : Gtk.Orientation.HORIZONTAL,
        )}
      >
        <image iconName={icon} pixelSize={28} />
        <box
          spacing={8}
          valign={Gtk.Align.CENTER}
          orientation={osd.orientation.as((v) =>
            v == "vertical"
              ? Gtk.Orientation.VERTICAL
              : Gtk.Orientation.HORIZONTAL,
          )}
        >
          <label
            cssClasses={["osd-title"]}
            xalign={0}
            label={title}
            visible={osd.orientation((v) => v != "vertical")}
          />
          <Gtk.LevelBar
            cssClasses={["osd-bar"]}
            widthRequest={osd.orientation((v) => (v == "vertical" ? 10 : 90))}
            heightRequest={osd.orientation((v) => (v == "vertical" ? 90 : -1))}
            inverted={osd.orientation((v) => v == "vertical")}
            orientation={osd.orientation.as((v) =>
              v == "vertical"
                ? Gtk.Orientation.VERTICAL
                : Gtk.Orientation.HORIZONTAL,
            )}
            value={percent}
            vexpand={false}
            hexpand={false}
          />
        </box>
        <label
          cssClasses={["osd-percent"]}
          widthChars={4}
          label={percent((p) => `${Math.round(p * 100)}%`)}
        />
      </box>
    </window>
  )
}
