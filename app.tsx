import windows from "./windows"
import initStyles from "./utils/styles"
import app from "ags/gtk4/app"
import initHyprland from "./utils/hyprland"
import requestHandler from "./request"

await initStyles()

app.start({
  icons: `${SRC}/assets/icons`,
  requestHandler(req, res) {
    requestHandler(req, res)
  },
  main() {
    windows()
    initHyprland()
  },
})
