import ScreenRecord from "./utils/screenrecord"

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
    default:
      res("not ok")
      break
  }
}
