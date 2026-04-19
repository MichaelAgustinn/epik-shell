import AstalNotifd from "gi://AstalNotifd"
import PopupWindow from "../common/PopupWindow"
import Notification from "./Notification"
import options from "../../options"
import { Gtk } from "ags/gtk4"
import { createBinding, createComputed, For, With } from "ags"
import Adw from "gi://Adw?version=1"

export const WINDOW_NAME = "notifications"
const notifd = AstalNotifd.get_default()
const notifications = createBinding(notifd, "notifications")
const { bar } = options

function NotifsScrolledWindow() {
  return (
    <Gtk.ScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
      <box orientation={Gtk.Orientation.VERTICAL} hexpand={false} spacing={8}>
        <For each={notifications}>{(e) => <Notification n={e} />}</For>
        <box
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.CENTER}
          cssClasses={["not-found"]}
          orientation={Gtk.Orientation.VERTICAL}
          vexpand
          visible={notifications((n) => n.length === 0)}
        >
          <image
            iconName="notification-disabled-symbolic"
            iconSize={Gtk.IconSize.LARGE}
          />
          <label label="Your inbox is empty" />
        </box>
      </box>
    </Gtk.ScrolledWindow>
  )
}

function DNDButton() {
  const dnd = createBinding(notifd, "dontDisturb")
  return (
    <button
      tooltipText={"Do Not Disturb"}
      onClicked={() => {
        notifd.set_dont_disturb(!notifd.get_dont_disturb())
      }}
      cssClasses={dnd((dnd) => {
        const classes = ["dnd"]
        dnd && classes.push("active")
        return classes
      })}
      label={"DND"}
    />
  )
}

function ClearButton() {
  return (
    <button
      cssClasses={["clear"]}
      onClicked={() => {
        notifd.notifications.forEach((n) => n.dismiss())
      }}
      sensitive={notifications((n) => n.length > 0)}
    >
      <image iconName={"user-trash-full-symbolic"} />
    </button>
  )
}

export default function NotificationWindow() {
  const layout = createComputed(() => {
    return `${bar.position()}_center`
  })
  const width = options.window.padding((val) => (val + 15) * 2 + 400)
  return (
    <With value={layout}>
      {(l) => (
        <PopupWindow name={WINDOW_NAME} layout={l}>
          <Adw.Clamp maximumSize={width()}>
            <box
              cssClasses={["window-content", "notifications-container"]}
              orientation={Gtk.Orientation.VERTICAL}
              vexpand={false}
              widthRequest={width()}
            >
              <box cssClasses={["window-header"]}>
                <label label={"Notifications"} hexpand xalign={0} />
                <DNDButton />
                <ClearButton />
              </box>
              <Gtk.Separator />
              <NotifsScrolledWindow />
            </box>
          </Adw.Clamp>
        </PopupWindow>
      )}
    </With>
  )
}
