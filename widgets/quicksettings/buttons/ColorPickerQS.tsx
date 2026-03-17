import { notifySend } from "../../../utils"
import { WINDOW_NAME } from "../QSWindow"
import QSButton from "../QSButton"
import { execAsync } from "ags/process"
import app from "ags/gtk4/app"
import { timeout } from "ags/time"
import AstalNotifd from "gi://AstalNotifd?version=0.1"

export default function ColorPickerQS() {
  return (
    <QSButton
      onClicked={() => {
        const wlCopy = (color: string) =>
          execAsync(["wl-copy", color]).catch(console.error)

        app.toggle_window(WINDOW_NAME)
        timeout(200, () => {
          execAsync("hyprpicker")
            .then((color) => {
              if (!color) return

              wlCopy(color)
              const notif = new AstalNotifd.Notification({
                appName: "Hyprpicker",
                summary: "Color picker",
                body: `${color} copied to clipboard`,
              })
              notifySend(notif)
            })
            .catch(console.error)
        })
      }}
      iconName={"color-select-symbolic"}
      label={"Color Picker"}
    />
  )
}
