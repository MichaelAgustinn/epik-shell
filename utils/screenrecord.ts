import GLib from "gi://GLib?version=2.0"
import { bash, ensureDirectory, notifySend, now, sh } from "."
import { getter, register } from "ags/gobject"
import GObject from "gi://GObject?version=2.0"
import { interval, Timer } from "ags/time"
import AstalNotifd from "gi://AstalNotifd?version=0.1"

const HOME = GLib.get_home_dir()

@register({ GTypeName: "Screenrecord" })
export default class ScreenRecord extends GObject.Object {
  static instance: ScreenRecord

  static get_default() {
    if (!this.instance) this.instance = new ScreenRecord()
    return this.instance
  }

  #recordings = `${HOME}/Videos/Screencasting`
  #screenshots = `${HOME}/Pictures/Screenshots`
  #file = ""
  #interval?: Timer
  #recording = false
  #timer = 0

  @getter(Boolean)
  get recording() {
    return this.#recording
  }

  @getter(Number)
  get timer() {
    return this.#timer
  }

  async start() {
    if (this.#recording) return

    ensureDirectory(this.#recordings)
    this.#file = `${this.#recordings}/${now()}.mp4`
    sh(
      `wf-recorder -g "${await sh("slurp")}" -f ${this.#file} --pixel-format yuv420p`,
    )

    this.#recording = true
    this.notify("recording")

    this.#timer = 0
    this.#interval = interval(1000, () => {
      this.notify("timer")
      this.#timer++
    })
  }

  async stop() {
    if (!this.#recording) return

    await bash("killall -INT wf-recorder")
    this.#recording = false
    this.notify("recording")
    this.#interval?.cancel()

    const notif = new AstalNotifd.Notification({
      appIcon: "folder-videos-symbolic",
      appName: "Screen Recorder",
      summary: "Screen recording saved",
      body: `Available in ${this.#recordings}`,
    })
    const actions = [
      {
        label: "Show in Files",
        action: () => sh(`xdg-open ${this.#recordings}`),
      },
      {
        label: "View",
        action: () => sh(`xdg-open ${this.#file}`),
      },
    ]
    actions.forEach((action, index) => {
      const notifdAction = new AstalNotifd.Action({
        id: index.toString(),
        label: action.label,
      })
      notifdAction.connect("invoked", action.action)
      notif.add_action(notifdAction)
    })
    await notifySend(notif).catch(console.error)
  }

  async screenshot(full = false) {
    const file = `${this.#screenshots}/${now()}.png`

    ensureDirectory(this.#screenshots)
    if (full) {
      await sh(`wayshot -f ${file}`)
    } else {
      const size = await sh("slurp -b#00000066 -w 0")
      if (!size) return

      await sh(`wayshot -f ${file} -s "${size}"`)
    }

    bash(`wl-copy < ${file}`)

    const notif = new AstalNotifd.Notification({
      image: file,
      appName: "Screenshot",
      summary: "Screenshot saved",
      body: `Available in ${this.#screenshots}`,
    })
    const actions = [
      {
        label: "Show in Files",
        action: () => sh(`xdg-open ${this.#screenshots}`),
      },
      {
        label: "View",
        action: () => sh(`xdg-open ${file}`),
      },
      {
        label: "Edit",
        action: () => sh(`swappy -f ${file}`),
      },
    ]
    actions.forEach((action, index) => {
      const notifdAction = new AstalNotifd.Action({
        id: index.toString(),
        label: action.label,
      })
      notifdAction.connect("invoked", action.action)
      notif.add_action(notifdAction)
    })
    await notifySend(notif).catch(console.error)
  }
}
