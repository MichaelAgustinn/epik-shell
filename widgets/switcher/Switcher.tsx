import { Astal, Gdk, Gtk } from "ags/gtk4"
import app from "ags/gtk4/app"
import AstalHyprland from "gi://AstalHyprland"
import AstalApps from "gi://AstalApps"
import { createRoot, createState, For } from "ags"

const hyprland = AstalHyprland.get_default()
const apps = new AstalApps.Apps()

const [items, setItems] = createState<AstalHyprland.Client[]>([])
const [selected, setSelected] = createState("")
let index = 0

const isOpen = () => !!app.get_window("switcher")?.visible

const addr = (c: AstalHyprland.Client) =>
  c.address.startsWith("0x") ? c.address : `0x${c.address}`

const iconFor = (c: AstalHyprland.Client) => {
  const cls = c.class.toLowerCase()
  const found = apps.list.find((a) =>
    a.entry.split(".desktop")[0].toLowerCase().includes(cls),
  )
  return found?.iconName || cls || "application-x-executable"
}

function select(i: number) {
  const list = items.peek()
  if (list.length === 0) return
  index = (i + list.length) % list.length
  setSelected(list[index].address)
}

function open() {
  const wsId = hyprland.focusedWorkspace?.id
  const list = hyprland
    .get_clients()
    .filter((c) => c.workspace?.id === wsId)
    .sort((a, b) => a.address.localeCompare(b.address))
  if (list.length < 2) return false
  setItems(list)
  const cur = list.findIndex(
    (c) => c.address === hyprland.focusedClient?.address,
  )
  index = cur < 0 ? 0 : cur
  app.get_window("switcher")?.show()
  return true
}

export function switcherNext() {
  if (!isOpen() && !open()) return
  select(index + 1)
}

export function switcherPrev() {
  if (!isOpen() && !open()) return
  select(index - 1)
}

export function switcherCancel() {
  app.get_window("switcher")?.hide()
}

export function switcherConfirm() {
  const target = items.peek()[index]
  app.get_window("switcher")?.hide()
  if (!target) return
  hyprland.message(
    `dispatch hl.dsp.focus({ window = "address:${addr(target)}" })`,
  )
  hyprland.message(`dispatch hl.dsp.window.alter_zorder({ mode = "top" })`)
}

export default function Switcher() {
  return createRoot(() => (
    <window
      application={app}
      name="switcher"
      namespace="switcher"
      visible={false}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
      $={(self) => {
        const keys = new Gtk.EventControllerKey()
        keys.connect("key-released", (_, keyval) => {
          if (keyval === Gdk.KEY_Alt_L || keyval === Gdk.KEY_Alt_R) {
            switcherConfirm()
          }
        })
        keys.connect("key-pressed", (_, keyval) => {
          if (keyval === Gdk.KEY_Escape) switcherCancel()
          else if (keyval === Gdk.KEY_Return) switcherConfirm()
          else if (keyval === Gdk.KEY_Right) select(index + 1)
          else if (keyval === Gdk.KEY_Left) select(index - 1)
          return false
        })
        self.add_controller(keys)
      }}
    >
      <box
        cssClasses={["switcher-container", "window-content"]}
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
      >
        <box spacing={8} halign={Gtk.Align.CENTER}>
          <For each={items}>
            {(c: AstalHyprland.Client) => (
              <button
                cssClasses={selected((s) =>
                  s === c.address
                    ? ["switcher-item", "selected"]
                    : ["switcher-item"],
                )}
                onClicked={() => {
                  select(items.peek().findIndex((x) => x.address === c.address))
                  switcherConfirm()
                }}
              >
                <image iconName={iconFor(c)} pixelSize={56} />
              </button>
            )}
          </For>
        </box>
        <label
          cssClasses={["switcher-title"]}
          maxWidthChars={40}
          ellipsize={3}
          label={selected((s) => {
            const c = items.peek().find((x) => x.address === s)
            return c ? c.title || c.class : ""
          })}
        />
      </box>
    </window>
  ))
}
