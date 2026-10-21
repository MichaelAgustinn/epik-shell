import ScreenRecord from "./utils/screenrecord"
import {
  switcherNext,
  switcherPrev,
  switcherConfirm,
  switcherCancel,
} from "./widgets/switcher/Switcher"

export default function requestHandler(
  request: string[],
  res: (response: any) => void,
): void {
  const screenRecord = ScreenRecord.get_default()
  switch (request.join(" ")) {
    case "screen-record":
      res("ok")
      screenRecord.start()
      break
    case "screenshot":
      res("ok")
      screenRecord.screenshot(true).catch(console.error)
      break
    case "screenshot-select":
      res("ok")
      screenRecord.screenshot().catch(console.error)
      break
    case "switcher next":
      res("ok")
      switcherNext()
      break
    case "switcher prev":
      res("ok")
      switcherPrev()
      break
    case "switcher confirm":
      res("ok")
      switcherConfirm()
      break
    case "switcher cancel":
      res("ok")
      switcherCancel()
      break
    default:
      res("not ok")
      break
  }
}
