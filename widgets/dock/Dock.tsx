import AstalHyprland from "gi://AstalHyprland"
import DockApps from "./DockApps"
import options from "../../options"
import { createBinding, createEffect, createState, onCleanup } from "ags"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import app from "ags/gtk4/app"
import { sendBatch } from "../../utils/hyprland"
import Adw from "gi://Adw?version=1"
import { idle } from "ags/time"

const hyprland = AstalHyprland.get_default()
const { TOP, BOTTOM } = Astal.WindowAnchor
const { dock } = options

const [cursorInDock, setCursorInDock] = createState(false)
const updateVisibility = () => {
	return (
		hyprland.get_workspace(hyprland.get_focused_workspace().id)?.get_clients()
			.length <= 0
	)
}

const getAnchor = () => (dock.position.peek() == "top" ? TOP : BOTTOM)

const [widthVar, setWidthVar] = createState(0)
const [heightVar, setHeightVar] = createState(4)
const getSize = (win: Gtk.Window) => win.get_child()!.get_preferred_size()[0]
const getHoverHeight = () => {
	const pos = dock.position.peek() == "top" ? 0 : 2
	const hyprlandGapsOut = hyprland
		.message("getoption general:gaps_out")
		.split("\n")[0]
		.split("custom type: ")[1]
		.split(" ")
		.map((e) => parseInt(e))
	return hyprlandGapsOut.length >= 3 ? hyprlandGapsOut[pos] : hyprlandGapsOut[0]
}

// transparent window to detect hover
export function DockHover({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
	createEffect(() => {
		createBinding(hyprland, "focusedWorkspace")()
		createBinding(hyprland, "clients")()

		if (updateVisibility()) {
			app.get_window("dock")?.show()
			app.get_window("dock-hover")?.hide()
		}
		if (!updateVisibility() && !cursorInDock.peek()) {
			app.get_window("dock")?.hide()
			app.get_window("dock-hover")?.show()
		}
	})
	let win: Astal.Window

	const unsubscribe = dock.position.subscribe(() => {
		win.anchor = getAnchor()
	})
	onCleanup(() => {
		win.destroy()
		unsubscribe()
	})

	return (
		<window
			visible={!updateVisibility()}
			name={"dock-hover"}
			namespace={"dock-hover"}
			gdkmonitor={gdkmonitor}
			$={(self) => {
				win = self
				app.connect("window-toggled", (_, win) => {
					if (win.name == "dock" && win.visible) {
						self.visible = false
					}
				})
			}}
			layer={Astal.Layer.TOP}
			anchor={getAnchor()}
			application={app}
		>
			<Gtk.EventControllerMotion
				// on enter isn't responsive
				onMotion={(source) => {
					idle(() => {
						source.widget.hide()
						app.get_window("dock")?.show()
					})

				}}
			/>
			<Adw.Clamp maximumSize={400}>
				<box
					$={(self) => {
						createEffect(() => {
							self.widthRequest = widthVar()
						})

					}}
					cssClasses={["dock-padding"]}
					heightRequest={heightVar}
				>
					{/* I dont know why window/box not visible when there's no child/background-color */}
					{/* So I give this child and set it to transparent so I can detect hover */}
					<label
						css={`color: transparent; font-size: 0.01px`}
						label={"hehe"}
					/>
				</box>
			</Adw.Clamp>
		</window>
	)
}

type DockProps = JSX.IntrinsicElements["window"] & {
	gdkmonitor: Gdk.Monitor
}

export function Dock({ gdkmonitor, ...props }: DockProps) {
	let win: Astal.Window
	const unsubscribe = dock.position.subscribe(() => {
		win.anchor = getAnchor()
		sendBatch([
			`layerrule animation slide ${dock.position.peek()}, match:namespace dock`,
			`layerrule animation slide ${dock.position.peek()}, match:namespace dock-hover`,
		])
	})
	onCleanup(() => {
		win.destroy()
		unsubscribe()
	})
	return (
		<window
			visible={updateVisibility()}
			name="dock"
			namespace="dock"
			layer={Astal.Layer.TOP}
			anchor={getAnchor()}
			$={(self) => {
				win = self
				self.connect("notify::visible", (win, _) => {
					const size = getSize(win)
					if (widthVar.peek() != size?.width) {
						setWidthVar(size!.width)
					}
				})

				const size = getSize(self)
				setWidthVar(size!.width)
				setHeightVar(getHoverHeight())
				hyprland.connect("config-reloaded", () => {
					setHeightVar(getHoverHeight())
				})
			}}
			application={app}
			{...props}
		>
			<Gtk.EventControllerMotion
				onEnter={() => {
					setCursorInDock(true)
				}}
				onLeave={(source) => {
					setCursorInDock(false)
					if (!updateVisibility()) {
						source.widget.hide()
						app.get_window("dock-hover")?.show()
					}
				}}
			/>
			<box>
				<box hexpand />
				<DockApps />
				<box hexpand />
			</box>
		</window>
	)
}
