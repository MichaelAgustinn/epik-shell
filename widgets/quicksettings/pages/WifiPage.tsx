import AstalNetwork from "gi://AstalNetwork"
import { setQsPage } from "../QSWindow"
import { Gtk } from "ags/gtk4"
import { createBinding, createState, For, With } from "ags"
import { execAsync } from "ags/process"

export default function WifiPage() {
  const network = AstalNetwork.get_default()
  const wifi = createBinding(network, "wifi")
  const filterSsid = (aps: AstalNetwork.AccessPoint[]) => {
    return aps.filter((ap) => !!ap.ssid).sort((a, b) => b.strength - a.strength)
  }

  // bssid jaringan yang kolom passwordnya sedang terbuka ("" = tidak ada)
  const [selected, setSelected] = createState("")

  const isSaved = async (ssid: string) => {
    try {
      const out = await execAsync([
        "nmcli",
        "-t",
        "-f",
        "NAME,TYPE",
        "connection",
        "show",
      ])
      return out.split("\n").some((line) => {
        const [name, type] = line.split(":")
        return name === ssid && type === "802-11-wireless"
      })
    } catch {
      return false
    }
  }

  return (
    <box
      $type="named"
      name={"wifi"}
      cssClasses={["wifi-page", "qs-page"]}
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
        <label label={"Wi-Fi"} hexpand xalign={0} />
      </box>
      <Gtk.Separator />
      <box visible={wifi(Boolean)}>
        <With value={wifi}>
          {(wifi) =>
            wifi && (
              <Gtk.ScrolledWindow vexpand hexpand>
                <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                  <For each={createBinding(wifi, "accessPoints")(filterSsid)}>
                    {(ap: AstalNetwork.AccessPoint) => {
                      let entry: Gtk.PasswordEntry
                      const [error, setError] = createState("")
                      const [busy, setBusy] = createState(false)
                      const [saved, setSaved] = createState(false)

                      const refreshSaved = async () =>
                        setSaved(await isSaved(ap.ssid))
                      refreshSaved()

                      const connect = async (password?: string) => {
                        setBusy(true)
                        setError("")
                        try {
                          const cmd = [
                            "nmcli",
                            "device",
                            "wifi",
                            "connect",
                            ap.bssid,
                          ]
                          if (password) cmd.push("password", password)
                          await execAsync(cmd)
                          if (entry) entry.set_text("")
                          setSelected("")
                          refreshSaved()
                          return true
                        } catch (e) {
                          setError(
                            password
                              ? "Password salah atau gagal tersambung"
                              : "Gagal tersambung",
                          )
                          return false
                        } finally {
                          setBusy(false)
                        }
                      }

                      const submit = () => {
                        const pw = entry?.get_text() ?? ""
                        if (pw.length < 8) {
                          setError("Password minimal 8 karakter")
                          return
                        }
                        connect(pw)
                      }

                      const forget = async () => {
                        try {
                          await execAsync([
                            "nmcli",
                            "connection",
                            "delete",
                            "id",
                            ap.ssid,
                          ])
                          setSelected("")
                        } catch (e) {
                          console.error(`Gagal melupakan ${ap.ssid}: ${e}`)
                        } finally {
                          refreshSaved()
                        }
                      }

                      return (
                        <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                          <box spacing={4}>
                            <button
                              hexpand
                              cssClasses={createBinding(
                                wifi,
                                "activeAccessPoint",
                              ).as((activeAp) => {
                                const classes = ["button"]
                                activeAp == ap && classes.push("active")
                                return classes
                              })}
                              onClicked={async () => {
                                if (selected.peek() === ap.bssid) {
                                  setSelected("")
                                  return
                                }
                                setError("")
                                // jaringan terbuka: langsung sambung
                                if (!ap.requiresPassword) {
                                  setSelected("")
                                  connect()
                                  return
                                }
                                // jaringan tersimpan: coba tanpa password dulu
                                if (await isSaved(ap.ssid)) {
                                  const ok = await connect()
                                  if (!ok) setSelected(ap.bssid)
                                  return
                                }
                                setSelected(ap.bssid)
                                entry?.grab_focus()
                              }}
                            >
                              <box spacing={6}>
                                <image iconName={ap.iconName} />
                                <label label={ap.ssid} hexpand xalign={0} />
                                <image
                                  iconName="system-lock-screen-symbolic"
                                  visible={ap.requiresPassword}
                                />
                              </box>
                            </button>
                            <button
                              iconName="user-trash-symbolic"
                              tooltipText="Lupakan jaringan"
                              valign={Gtk.Align.CENTER}
                              visible={saved}
                              onClicked={forget}
                            />
                          </box>
                          <Gtk.Revealer
                            revealChild={selected.as((s) => s === ap.bssid)}
                            transitionType={
                              Gtk.RevealerTransitionType.SLIDE_DOWN
                            }
                          >
                            <box
                              orientation={Gtk.Orientation.VERTICAL}
                              spacing={4}
                              cssClasses={["wifi-password"]}
                            >
                              <box spacing={6}>
                                <Gtk.PasswordEntry
                                  hexpand
                                  showPeekIcon
                                  placeholderText="Password"
                                  $={(self) => {
                                    entry = self
                                  }}
                                  onActivate={submit}
                                />
                                <button
                                  label={busy.as((b) =>
                                    b ? "..." : "Sambung",
                                  )}
                                  sensitive={busy.as((b) => !b)}
                                  onClicked={submit}
                                />
                              </box>
                              <label
                                cssClasses={["error"]}
                                xalign={0}
                                label={error}
                                visible={error.as((e) => !!e)}
                              />
                            </box>
                          </Gtk.Revealer>
                        </box>
                      )
                    }}
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
