import { Gtk } from "ags/gtk4"
import AstalBrightness from "gi://AstalBrightness?version=0.1"

export default function BrightnessBox() {
  const brightness = AstalBrightness.get_default()

  return (
    <box
      cssClasses={["qs-box", "brightness-box"]}
      valign={Gtk.Align.CENTER}
      spacing={10}
    >
      <image
        iconName={"display-brightness-symbolic"}
        valign={Gtk.Align.CENTER}
      />
      <slider
        onChangeValue={(self) => {
          brightness.screen.brightness = self.value
        }}
        min={0.1}
        value={brightness.screen.brightness}
        hexpand
      />
    </box>
  )
}
