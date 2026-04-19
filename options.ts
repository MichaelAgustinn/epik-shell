import { mkOptions, opt } from "./utils/option"
import { gsettings } from "./utils"
import GLib from "gi://GLib?version=2.0"
import { execAsync } from "ags/process"

const options = mkOptions(
  `${GLib.get_user_config_dir()}/epik-shell/config.json`,
  {
    dock: {
      position: opt("bottom"),
      pinned: opt(["firefox", "Alacritty", "org.gnome.Nautilus", "localsend"]),
    },
    bar: {
      position: opt("top"),
      separator: opt(true),
      bg_color: opt("$background"),
      opacity: opt(1),
      border_radius: opt(6),
      margin: opt(10),
      padding: opt(3),
      border_width: opt(2),
      border_color: opt("$foreground"),
      shadow: {
        offset: opt([6, 6]),
        blur: opt(0),
        spread: opt(0),
        color: opt("$foreground"),
        opacity: opt(1),
      },
      button: {
        bg_color: opt("$background"),
        fg_color: opt("$foreground"),
        opacity: opt(1),
        border_radius: opt(8),
        border_width: opt(0),
        border_color: opt("$foreground"),
        padding: opt([0, 3]),
        shadow: {
          offset: opt([0, 0]),
          blur: opt(0),
          spread: opt(0),
          color: opt("$foreground"),
          opacity: opt(1),
        },
      },
    },
    desktop_clock: {
      position: opt<
        | "top_left"
        | "top"
        | "top_right"
        | "left"
        | "center"
        | "right"
        | "bottom_left"
        | "bottom"
        | "bottom_right"
      >("top_left"),
    },
    window: {
      opacity: opt(1),
      border_radius: opt(6),
      margin: opt(10),
      padding: opt(10),
      dock_padding: opt(4),
      desktop_clock_padding: opt(4),
      border_width: opt(2),
      border_color: opt("$foreground"),
      shadow: {
        offset: opt([6, 6]),
        blur: opt(0),
        spread: opt(0),
        color: opt("$foreground"),
        opacity: opt(1),
      },
    },
    colorscheme: opt("gruvbox", { cached: true }),
    alacritty: {
      dark: opt(
        `${GLib.get_user_config_dir()}/alacritty/tokyonight_night.toml`,
      ),
      light: opt(`${GLib.get_user_config_dir()}/alacritty/tokyonight_day.toml`),
    },
    theme: opt<"light" | "dark">(
      gsettings.get_string("color-scheme") == "prefer-light" ? "light" : "dark",
      { cached: true },
    ),
    wallpaper: {
      folder: opt(GLib.get_home_dir(), { cached: true }),
      current: opt(
        await execAsync("awww query")
          .then((out) => out.split("image:")[1].trim())
          .catch(() => ""),
        { cached: true },
      ),
    },
  },
)

export default options
