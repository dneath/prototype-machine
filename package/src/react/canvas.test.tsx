import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import * as production from "../production"
import { sample } from "../core/machine.test"
import { statesOf } from "../core/states"
import { STATE_PARAM } from "./bench-state"
import { StateCanvas } from "./canvas"
import { type CanvasFrames, FRAME_PARAM, resolveFrames, stressFrames } from "./canvas-state"
import { PinnedScenario } from "./provider"
import { canvasMounted, canvasRoot, chrome } from "./test-utils"
import { useScenario } from "./use-scenario"

/* A component with a real component's branches, fed at its props. */
function AuditLog({ rows, loading, error }: { rows?: readonly string[]; loading?: boolean; error?: string }) {
  if (loading) return <p data-testid="body">Loading audit events</p>
  if (error) return <p data-testid="body">{error}</p>
  if (!rows?.length) return <p data-testid="body">No audit events in this range</p>
  return (
    <ul data-testid="body">
      {rows.map((r) => (
        <li key={r}>
          <button type="button">{r}</button>
        </li>
      ))}
    </ul>
  )
}

const FIXTURES = {
  loading: { loading: true },
  empty: { rows: [] },
  typical: { rows: ["j.rivera rotated key ak-7f2c", "m.chen invited t.ito"] },
  error: { error: "The audit service did not answer" },
} as const

const STATES = {
  loading: "Loading",
  empty: { label: "Empty", note: "A new tenant" },
  typical: "Typical",
  error: "Error",
}

const MISSING = { partial: { label: "Partly loaded", note: "The design streams rows in" } }

const FRAMES = {
  desktop: { label: "Desktop", width: 960 },
  phone: { label: "Phone", width: 375, note: "An iPhone SE" },
}

let calls: Array<[string, string]> = []

function Canvas(props: Partial<React.ComponentProps<typeof StateCanvas>> = {}) {
  return (
    <StateCanvas states={STATES} missing={MISSING} frames={FRAMES} label="Audit log" enabled {...props}>
      {(state, frame) => {
        calls.push([state, frame])
        return <AuditLog {...FIXTURES[state as keyof typeof FIXTURES]} />
      }}
    </StateCanvas>
  )
}

const frames = () => [...document.querySelectorAll<HTMLElement>("[data-state-canvas-frame]")]
const viewport = () => document.querySelector<HTMLElement>("[data-state-canvas-viewport]")!
const world = () => document.querySelector<HTMLElement>("[data-state-canvas]")!
const zoomText = () => canvasRoot().querySelector(".pm-canvas-zoom")!.textContent
const search = () => new URLSearchParams(window.location.search)
/* An axis name. jsdom lays nothing out, so every name counts as off screen
   and is hidden, and a hidden element has no accessible name to query by. */
const axis = (kind: "state" | "frame", id: string) =>
  canvasRoot().querySelector<HTMLButtonElement>(`.pm-axis[data-${kind}="${id}"]`)!

/* Where the world is, read back from its transform. */
const cameraOf = () => {
  const [x, y, z] = world().style.transform.match(/-?[\d.]+/g)!.map(Number)
  return { x, y, z }
}
const nextFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

beforeEach(() => {
  calls = []
  window.localStorage.clear()
  window.history.replaceState({}, "", "/states/audit-log/canvas")
  /* Reduced motion: a camera move lands in one frame instead of flying. */
  window.matchMedia = ((query: string) => ({ matches: query.includes("reduce"), media: query })) as never
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("StateCanvas", () => {
  it("renders every state in every frame, a row per state, in declaration order", () => {
    render(<Canvas />)
    expect(frames().map((f) => `${f.dataset.state}/${f.dataset.frame}`)).toEqual([
      "loading/desktop", "loading/phone",
      "empty/desktop", "empty/phone",
      "typical/desktop", "typical/phone",
      "error/desktop", "error/phone",
    ])
    expect(screen.getAllByTestId("body")).toHaveLength(8)
  })

  it("names each frame for a screen reader", () => {
    render(<Canvas />)
    expect(screen.getByRole("group", { name: "Empty, Phone" })).toBeTruthy()
  })

  it("lists a missing state with a placeholder and never renders it", () => {
    render(<Canvas />)
    const placeholder = document.querySelector<HTMLElement>("[data-state-canvas-missing]")!
    expect(placeholder.dataset.state).toBe("partial")
    expect(placeholder.textContent).toBe("Not in the code yetThe design streams rows in")
    expect(calls.some(([state]) => state === "partial")).toBe(false)
  })

  it("sets a frame's width, and nothing else that would restyle the component", () => {
    render(<Canvas />)
    const phone = frames().find((f) => f.dataset.frame === "phone")!
    expect(phone.style.width).toBe("375px")
    expect(phone.style.contain).toBe("layout")
    expect(phone.style.font).toBe("")
    expect(phone.style.color).toBe("")
  })

  it("defaults to one frame as wide as `width`", () => {
    render(<Canvas frames={undefined} width={720} />)
    expect(frames().map((f) => f.style.width)).toEqual(Array(4).fill("720px"))
    expect(axis("frame", "default").textContent).toBe("720px")
  })

  it("puts a frame's direction and attributes on its container", () => {
    const themed: CanvasFrames = {
      dark: { label: "Dark", dir: "rtl", attrs: { "data-theme": "dark", class: "dark" }, background: "#0b0b0b" },
    }
    render(<Canvas frames={themed} />)
    const frame = frames()[0]
    expect(frame.getAttribute("dir")).toBe("rtl")
    expect(frame.getAttribute("data-theme")).toBe("dark")
    expect(frame.className).toBe("dark")
    expect(frame.style.background).toBe("rgb(11, 11, 11)")
  })

  it("squeezes a frame with a hatched sibling that takes its share of the row", () => {
    render(<Canvas frames={{ squeezed: { label: "Squeezed", width: 600, squeeze: 240 } }} />)
    const frame = frames()[0]
    expect(frame.style.display).toBe("flex")
    const sibling = frame.querySelector<HTMLElement>("[data-state-canvas-sibling]")!
    expect(sibling.style.width).toBe("240px")
    expect(sibling.getAttribute("aria-hidden")).toBe("true")
    expect(frame.querySelector("[data-state-canvas-squeezed]")!.contains(screen.getAllByTestId("body")[0])).toBe(true)
  })

  it("hands the child both ids, so a frame can pin a scenario", () => {
    const data = statesOf(sample, "data")
    const role = statesOf(sample, "role")
    function Probe() {
      const p = useScenario(sample)
      return <span data-testid="probe">{`${p.data}/${p.role}`}</span>
    }
    render(
      <StateCanvas states={data} frames={role} enabled>
        {(state, frame) => (
          <PinnedScenario machine={sample} values={{ data: state, role: frame }}>
            <Probe />
          </PinnedScenario>
        )}
      </StateCanvas>,
    )
    expect(screen.getAllByTestId("probe").map((p) => p.textContent)).toEqual([
      "real/user", "real/admin", "loading/user", "loading/admin",
      "empty/user", "empty/admin", "error/user", "error/admin",
    ])
  })

  it("throws on a config no canvas could show honestly", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Canvas states={{}} />)).toThrow(/<StateCanvas> was given no states/)
    expect(() => render(<Canvas missing={{ empty: "Empty" }} />)).toThrow(/both a state and missing/)
    expect(() => render(<Canvas frames={{}} />)).toThrow(/no frames/)
    expect(() => render(<Canvas frames={{ half: { width: "50%" } }} />)).toThrow(/a percentage has nothing to be a percentage of/)
  })

  it("renders the frames on the server, hidden until the camera is placed", () => {
    const html = renderToString(<Canvas />)
    expect(html).toContain("data-state-canvas-frame")
    expect(html).toContain("visibility:hidden")
  })
})

describe("the canvas's axes", () => {
  it("names every state down the side and every frame along the top, in its own shadow root", () => {
    render(<Canvas />)
    const states = canvasRoot().querySelector('[role="group"][aria-label="States"]')!
    const columns = canvasRoot().querySelector('[role="group"][aria-label="Frames"]')!
    expect([...states.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      "Loading", "Empty", "Typical", "Error", "Partly loadedNot in the code yet",
    ])
    expect([...columns.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Desktop", "Phone"])
    expect(axis("frame", "phone").getAttribute("title")).toBe("An iPhone SE")
  })

  it("makes a state the focus with one click, a frame with another, and lets go of each", async () => {
    const user = userEvent.setup()
    render(<Canvas />)
    await user.click(axis("state", "error"))
    expect(search().get(STATE_PARAM)).toBe("error")
    expect(search().has(FRAME_PARAM)).toBe(false)
    await user.click(axis("frame", "phone"))
    expect(search().get(STATE_PARAM)).toBe("error")
    expect(search().get(FRAME_PARAM)).toBe("phone")
    expect(axis("state", "error").getAttribute("aria-pressed")).toBe("true")
    expect(axis("frame", "phone").getAttribute("aria-pressed")).toBe("true")
    await user.click(axis("state", "error"))
    expect(search().has(STATE_PARAM)).toBe(false)
    expect(search().get(FRAME_PARAM)).toBe("phone")
  })

  it("clears the focus from the URL when told to fit everything", async () => {
    window.history.replaceState({}, "", "/states/audit-log/canvas?tenant=4&__state=empty&__frame=phone#top")
    const user = userEvent.setup()
    render(<Canvas />)
    await user.click(chrome.getByRole("button", { name: "Fit" }))
    expect(window.location.search).toBe("?tenant=4")
    expect(window.location.hash).toBe("#top")
  })

  it("says so when a link names a state or frame it does not have", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    window.history.replaceState({}, "", "/states/audit-log/canvas?__state=emty&__frame=phon")
    render(<Canvas />)
    const said = spy.mock.calls.flat().join(" ")
    expect(said).toMatch(/__state=emty is not a state of this canvas\. Did you mean "empty"\?/)
    expect(said).toMatch(/__frame=phon is not a frame of this canvas\. Did you mean "phone"\?/)
  })
})

describe("the camera", () => {
  it("zooms with the bar, and goes back to 100% from the readout", async () => {
    const user = userEvent.setup()
    render(<Canvas />)
    await nextFrame()
    expect(zoomText()).toBe("100%")
    await user.click(chrome.getByRole("button", { name: "Zoom in" }))
    await nextFrame()
    expect(zoomText()).toBe("150%")
    expect(world().style.transform).toContain("scale(1.5)")
    await user.click(chrome.getByRole("button", { name: /^Zoom 150%/ }))
    await nextFrame()
    expect(zoomText()).toBe("100%")
  })

  it("takes keys only while the canvas itself has focus", async () => {
    render(<Canvas />)
    await nextFrame()
    const before = world().style.transform
    for (const key of ["+", "ArrowRight", "1", "0"]) {
      fireEvent.keyDown(document.body, { key })
      fireEvent.keyDown(screen.getAllByRole("button", { name: /j\.rivera/ })[0], { key })
    }
    await nextFrame()
    expect(world().style.transform).toBe(before)

    viewport().focus()
    fireEvent.keyDown(viewport(), { key: "+" })
    await nextFrame()
    expect(zoomText()).toBe("150%")
    const zoomed = cameraOf()
    fireEvent.keyDown(viewport(), { key: "ArrowRight" })
    await nextFrame()
    expect(cameraOf()).toEqual({ ...zoomed, x: zoomed.x - 80 })
    fireEvent.keyDown(viewport(), { key: "=", ctrlKey: true })
    await nextFrame()
    expect(zoomText()).toBe("150%")
  })

  it("remembers where it was left, per page, and a link beats the memory", async () => {
    const view = render(<Canvas />)
    await nextFrame()
    const start = cameraOf()
    viewport().focus()
    fireEvent.keyDown(viewport(), { key: "ArrowDown" })
    await nextFrame()
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)))
    const key = "prototype-machine:canvas:/states/audit-log/canvas:Audit log"
    /* Stored exactly; drawn on whole pixels at 100%. */
    const stored = JSON.parse(window.localStorage.getItem(key)!)
    expect(stored).toMatchObject({ v: 1, z: 1 })
    expect([Math.round(stored.x), Math.round(stored.y)]).toEqual([start.x, start.y - 80])
    view.unmount()

    render(<Canvas />)
    await nextFrame()
    expect(cameraOf()).toEqual({ x: start.x, y: start.y - 80, z: 1 })
  })

  it("ignores a stored camera that is not one", async () => {
    window.localStorage.setItem("prototype-machine:canvas:/states/audit-log/canvas:Audit log", '{"v":1,"x":"far","z":0}')
    render(<Canvas />)
    await nextFrame()
    expect(cameraOf().z).toBe(1)
    expect(Number.isFinite(cameraOf().x)).toBe(true)
  })

  it("is a labelled region whose keys are described", () => {
    render(<Canvas />)
    const region = screen.getByRole("region", { name: "Audit log" })
    expect(region.getAttribute("aria-roledescription")).toBe("canvas")
    expect(document.getElementById(region.getAttribute("aria-describedby")!)!.textContent).toMatch(/1 fits every frame/)
  })
})

describe("the canvas bar", () => {
  it("doubles the page's text size and puts it back", async () => {
    const user = userEvent.setup()
    render(<Canvas />)
    const toggle = chrome.getByRole("button", { name: "Text 200%" })
    await user.click(toggle)
    expect(toggle.getAttribute("aria-pressed")).toBe("true")
    expect(document.documentElement.style.fontSize).toBe("32px")
    await user.click(toggle)
    expect(document.documentElement.style.fontSize).toBe("")
  })

  it("is a labelled group", () => {
    render(<Canvas />)
    expect(chrome.getByRole("group", { name: "Audit log canvas" })).toBeTruthy()
  })
})

describe("a canvas that is not enabled, and the production canvas", () => {
  it("renders every frame flat, with no camera and no chrome", () => {
    render(<Canvas enabled={false} />)
    expect(frames()).toHaveLength(8)
    expect(document.querySelector("[data-state-canvas-viewport]")).toBe(null)
    expect(canvasMounted()).toBe(false)
  })

  it("ships no camera in production", () => {
    render(
      <production.StateCanvas states={STATES} frames={FRAMES}>
        {(state) => <AuditLog {...FIXTURES[state as keyof typeof FIXTURES]} />}
      </production.StateCanvas>,
    )
    expect(frames()).toHaveLength(8)
    expect(canvasMounted()).toBe(false)
  })
})

describe("frames", () => {
  it("expands \"stress\" into the shipped width, a phone, a squeeze, a wide container and right to left", () => {
    const resolved = resolveFrames("stress", 880)
    expect(resolved.map((f) => [f.id, f.label, f.width])).toEqual([
      ["shipped", "880px", "880px"],
      ["narrow", "320px", "320px"],
      ["squeezed", "Squeezed", "880px"],
      ["wide", "1440px", "1440px"],
      ["rtl", "Right to left", "880px"],
    ])
    expect(resolved.find((f) => f.id === "squeezed")!.squeeze).toBe("352px")
    expect(resolved.find((f) => f.id === "rtl")!.dir).toBe("rtl")
  })

  it("has no phone frame for a component narrower than a phone, and grows the wide one with a wide component", () => {
    expect(Object.keys(stressFrames(280))).not.toContain("narrow")
    expect(stressFrames(1200).wide.width).toBe(1800)
  })

  it("works from a CSS length", () => {
    const frames = stressFrames("48rem")
    expect(frames.squeezed.squeeze).toBe("calc(48rem * 0.4)")
    expect(frames.wide.width).toBe("max(1440px, calc(48rem * 1.5))")
  })
})
