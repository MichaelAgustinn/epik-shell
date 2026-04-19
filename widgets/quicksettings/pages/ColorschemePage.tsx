import { setQsPage } from "../QSWindow"
import { Gtk } from "ags/gtk4"
import { createBinding, createComputed, createState, For, With } from "ags"
import { monitorFile } from "ags/file"
import { exec } from "ags/process"
import GLib from "gi://GLib?version=2.0"
import options from "../../../options"

export default function ColorschemePage() {
  const defaultThemesPath = `${SRC}/themes`
  const userThemesPath = `${GLib.get_user_config_dir()}/epik-shell/themes`

  function getThemes(path: string) {
    const result = exec(`ls -1 ${path}`)
    return result.split("\n").map((v) => v.replace(".json", ""))
  }

  const [defaultThemes, setDefaultThemes] = createState(
    getThemes(defaultThemesPath),
  )
  const [userThemes, setUserThemes] = createState(getThemes(userThemesPath))

  monitorFile(defaultThemesPath, () => {
    setDefaultThemes(getThemes(defaultThemesPath))
  })

  monitorFile(userThemesPath, () => {
    setUserThemes(getThemes(userThemesPath))
  })

  const themes = createComputed(() => {
    const colorscheme = options.colorscheme()
    const uThemes = userThemes()
    const dThemes = defaultThemes()

    const merged = Array.from(new Set([...uThemes, ...dThemes]))

    merged.sort((a, b) => a.localeCompare(b))

    const index = merged.indexOf(colorscheme)
    if (index > -1) {
      merged.splice(index, 1)
      merged.unshift(colorscheme)
    }

    return merged
  })

  return (
    <box
      $type="named"
      name={"colorscheme"}
      cssClasses={["colorscheme-page", "qs-page"]}
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
        <label label={"Colorschemes"} hexpand xalign={0} />
      </box>
      <Gtk.Separator />
      <box>
        <Gtk.ScrolledWindow vexpand hexpand>
          <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
            <For each={themes}>
              {(theme) => (
                <button
                  cssClasses={options.colorscheme.as((activeTheme) => {
                    const classes = ["button"]
                    const active = theme == activeTheme
                    active && classes.push("active")
                    return classes
                  })}
                  onClicked={() => {
                    options.colorscheme.set(theme)
                  }}
                >
                  <box>
                    <label label={theme} />
                  </box>
                </button>
              )}
            </For>
          </box>
        </Gtk.ScrolledWindow>
      </box>
    </box>
  )
}
