import { setQsPage } from "../QSWindow"
import { Gtk } from "ags/gtk4"
import { createBinding, For, With } from "ags"
import AstalBluetooth from "gi://AstalBluetooth?version=0.1"

export default function BluetoothPage() {
  const bluetooth = AstalBluetooth.get_default()
  const adapter = createBinding(bluetooth, "adapter")
  const bluetoothList = createBinding(bluetooth, "devices")

  return (
    <box
      $type="named"
      name={"bluetooth"}
      cssClasses={["bluetooth-page", "qs-page"]}
      orientation={Gtk.Orientation.VERTICAL}
      spacing={6}
    >
      <box hexpand={false} cssClasses={["header"]} spacing={6}>
        <button
          onClicked={() => {
            setQsPage("main")
          }}
          iconName={"go-previous-symbolic"}
        />
        <label label={"Bluetooth"} hexpand xalign={0} />
        <With value={adapter}>
          {(a) => (
            <Gtk.Spinner
              $={(self) => {
                a.connect("notify::discovering", () => {
                  if (a.discovering) {
                    self.start()
                  } else {
                    self.stop()
                  }
                })
              }}
            />
          )}
        </With>
      </box>
      <Gtk.Separator />
      <box>
        <With value={adapter}>
          {(adapter) =>
            adapter && (
              <Gtk.ScrolledWindow vexpand hexpand>
                <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                  <For
                    each={bluetoothList((bluetooth) =>
                      bluetooth.filter((bt) => !!bt.name),
                    )}
                  >
                    {(bt: AstalBluetooth.Device) => (
                      <button
                        cssClasses={createBinding(bt, "connected").as(
                          (connected) => {
                            const classes = ["button"]
                            connected && classes.push("active")
                            return classes
                          },
                        )}
                        onClicked={() => {
                          try {
                            bt.pair()
                          } catch (error) {
                            try {
                              bt.connect_device(null)
                            } catch (error) {
                              // pass
                            }
                          }
                        }}
                      >
                        <box>
                          <image iconName={bt.icon + "-symbolic"} />
                          <label label={createBinding(bt, "name")} />
                        </box>
                      </button>
                    )}
                  </For>
                </box>
              </Gtk.ScrolledWindow>
            )
          }
        </With>
      </box>
    </box>
  )
}
