import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { defineMachine } from "../core/machine"
import { ScenarioPanel } from "./panel"
import { ScenarioProvider, type Scenario } from "./provider"
import { placeList, typeahead } from "./select"
import { sanitizeTools } from "./tools"
import { panelRoot, ui } from "./test-utils"
import { useScenario } from "./use-scenario"

const ladder = defineMachine({
  machines: {
    review: {
      label: "Review",
      initial: "draft",
      states: {
        draft: { label: "Draft" },
        submitted: { label: "Submitted" },
        triaged: { label: "Triaged" },
        approved: { label: "Approved" },
        rejected: { label: "Rejected" },
        appealed: { label: "Appealed" },
        closed: { label: "Closed" },
      },
      transitions: {
        draft: ["submitted"],
        submitted: ["triaged", "draft"],
        triaged: ["approved", "rejected"],
        approved: ["closed"],
        rejected: ["appealed", "closed"],
        appealed: ["triaged"],
        closed: [],
      },
    },
  },
  fields: {
    locale: {
      type: "enum",
      label: "Locale",
      default: "en",
      options: ["en", "de", "fr", "es", "it", "pt", "nl", "sv", "pl", "ja", "ar", "he"],
    },
    tier: { type: "enum", label: "Tier", default: "free", options: ["free", "pro"], control: "select" },
    name: { type: "string", label: "Name", default: "Ada", presets: "stress" },
    count: { type: "number", label: "Count", default: 3, min: 0, max: 100, presets: [0, 1, { label: "Lots", value: 99 }] },
    seen: { type: "date", label: "Seen", default: null },
  },
})

let handle: Scenario | null = null
function Grab() {
  handle = useScenario()
  return null
}

async function open(panel: Partial<React.ComponentProps<typeof ScenarioPanel>> = { tools: false }, children: React.ReactNode = null) {
  const user = userEvent.setup()
  const view = render(
    <ScenarioProvider machine={ladder} storageKey="iso-v1" enabled>
      <Grab />
      {children}
      <ScenarioPanel {...panel} />
    </ScenarioProvider>
  )
  await user.click(ui.getByRole("button", { name: /open prototype controls/i }))
  return { user, view }
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, "", "/")
  document.documentElement.removeAttribute("dir")
  document.documentElement.style.removeProperty("font-size")
  handle = null
})

describe("the isolated layer", () => {
  it("renders into a shadow root on <body>, not where it sits in the tree", async () => {
    const { view } = await open()
    const host = document.querySelector("prototype-machine")!
    expect(host.parentElement).toBe(document.body)
    expect(host.shadowRoot).toBeTruthy()
    expect(view.container.querySelector(".pm-panel")).toBe(null)
    expect(panelRoot().querySelector("style[data-prototype-machine]")).toBeTruthy()
    /* Nothing leaks into the host document's <head>. */
    expect(document.head.querySelector("style[data-prototype-machine]")).toBe(null)
  })

  it("pins its own host element with inline !important, so page rules cannot move it", async () => {
    await open()
    const style = document.querySelector("prototype-machine")!.getAttribute("style")!
    expect(style).toContain("position: fixed !important")
    expect(style).toContain("transform: none !important")
    expect(style).toContain("z-index: 2147483000 !important")
  })

  it("removes the host on unmount", async () => {
    const { view } = await open()
    view.unmount()
    expect(document.querySelector("prototype-machine")).toBe(null)
  })

  it("puts the host back if the page clears <body>", async () => {
    await open()
    const host = document.querySelector("prototype-machine")!
    await act(async () => {
      host.remove()
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(document.querySelector("prototype-machine")).toBe(host)
  })

  it("keeps the panel's keystrokes and clicks away from the host's listeners", async () => {
    const onKey = vi.fn()
    const onDown = vi.fn()
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    try {
      await open()
      const input = ui.getByRole("textbox", { name: "Name" })
      fireEvent.keyDown(input, { key: "k" })
      fireEvent.pointerDown(input)
      expect(onKey).not.toHaveBeenCalled()
      expect(onDown).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onDown)
    }
  })

  it("does not close when clicked inside, and closes when clicked outside", async () => {
    const { user } = await open(undefined, <button type="button">outside</button>)
    await user.click(ui.getByRole("button", { name: /Name presets/ }))
    expect(ui.getByRole("dialog")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "outside" }))
    expect(ui.queryByRole("dialog")).toBe(null)
  })

  it("closes on Escape from inside the panel", async () => {
    await open()
    fireEvent.keyDown(ui.getByRole("textbox", { name: "Name" }), { key: "Escape" })
    expect(ui.queryByRole("dialog")).toBe(null)
  })
})

describe("the dropdown", () => {
  it("replaces native selects entirely", async () => {
    await open()
    expect(panelRoot().querySelector("select")).toBe(null)
    expect(ui.getByRole("button", { name: "Locale: en" }).getAttribute("aria-haspopup")).toBe("listbox")
  })

  it("opens, moves with the keyboard, and chooses with Enter", async () => {
    const { user } = await open()
    await user.click(ui.getByRole("button", { name: "Tier: free" }))
    const list = ui.getByRole("listbox", { name: "Tier" })
    expect(ui.getAllByRole("option").map((o) => o.textContent)).toEqual(["free", "pro"])
    fireEvent.keyDown(list, { key: "ArrowDown" })
    fireEvent.keyDown(list, { key: "Enter" })
    expect(handle!.snapshot.fields.tier).toBe("pro")
    expect(ui.queryByRole("listbox")).toBe(null)
  })

  it("chooses with a click", async () => {
    const { user } = await open()
    await user.click(ui.getByRole("button", { name: "Tier: free" }))
    await user.click(ui.getByRole("option", { name: "pro" }))
    expect(handle!.snapshot.fields.tier).toBe("pro")
  })

  it("closes on Escape without closing the panel", async () => {
    const { user } = await open()
    await user.click(ui.getByRole("button", { name: "Tier: free" }))
    fireEvent.keyDown(ui.getByRole("listbox"), { key: "Escape" })
    expect(ui.queryByRole("listbox")).toBe(null)
    expect(ui.getByRole("dialog")).toBeTruthy()
  })

  it("closes on a click elsewhere in the panel", async () => {
    const { user } = await open()
    await user.click(ui.getByRole("button", { name: "Tier: free" }))
    await user.click(ui.getByRole("textbox", { name: "Name" }))
    expect(ui.queryByRole("listbox")).toBe(null)
  })

  it("opens from the keyboard with ArrowDown", async () => {
    await open()
    fireEvent.keyDown(ui.getByRole("button", { name: "Tier: free" }), { key: "ArrowDown" })
    expect(ui.getByRole("listbox")).toBeTruthy()
  })

  it("grows a filter past ten options", async () => {
    const { user } = await open()
    await user.click(ui.getByRole("button", { name: "Locale: en" }))
    const search = ui.getByRole("combobox", { name: "Filter Locale" })
    fireEvent.change(search, { target: { value: "j" } })
    expect(ui.getAllByRole("option").map((o) => o.textContent)).toEqual(["ja"])
    fireEvent.keyDown(search, { key: "Enter" })
    expect(handle!.snapshot.fields.locale).toBe("ja")
  })

  it("jumps by typing", async () => {
    const { user } = await open()
    await user.click(ui.getByRole("button", { name: "Locale: en" }))
    const search = ui.getByRole("combobox", { name: "Filter Locale" })
    fireEvent.change(search, { target: { value: "" } })
    /* With a filter, typing filters; type-to-jump is the plain list's. */
    expect(typeahead([{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }, { value: "c", label: "Bravo" }], "b", 0)).toBe(1)
    expect(typeahead([{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }, { value: "c", label: "Bravo" }], "bb", 1)).toBe(2)
    expect(typeahead([{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }], "br", 0)).toBe(-1)
  })

  it("shows a machine's illegal moves as unavailable options, with the reason", async () => {
    const { user } = await open()
    await user.click(ui.getByRole("button", { name: "Review: Draft" }))
    const closed = ui.getByRole("option", { name: /Closed/ })
    expect(closed.getAttribute("aria-disabled")).toBe("true")
    expect(closed.getAttribute("title")).toMatch(/Not reachable from Draft\. From here: Submitted\./)
    await user.click(closed)
    expect(handle!.snapshot.machines.review).toBe("draft")
    await user.click(ui.getByRole("option", { name: "Submitted" }))
    expect(handle!.snapshot.machines.review).toBe("submitted")
  })
})

describe("placing the list", () => {
  const viewport = { width: 1000, height: 800 }
  it("goes below when it fits", () => {
    const p = placeList({ top: 100, bottom: 128, left: 700, width: 256 }, viewport, 200)
    expect(p.side).toBe("below")
    expect(p.top).toBe(132)
    expect(p.maxHeight).toBe(280)
  })
  it("flips above near the bottom edge", () => {
    const p = placeList({ top: 700, bottom: 728, left: 700, width: 256 }, viewport, 200)
    expect(p.side).toBe("above")
    expect(p.bottom).toBe(104)
  })
  it("stays inside the viewport horizontally", () => {
    const p = placeList({ top: 100, bottom: 128, left: 900, width: 256 }, viewport, 200)
    expect(p.left + p.width).toBeLessThanOrEqual(992)
  })
})

describe("presets", () => {
  it("offers the stress set as a dropdown and writes the chosen value", async () => {
    const { user } = await open()
    await user.click(ui.getByRole("button", { name: "Name presets: Presets…" }))
    await user.click(ui.getByRole("option", { name: "RTL" }))
    expect(String(handle!.snapshot.fields.name)).toMatch(/[؀-ۿ]/)
  })

  it("offers a short list as pills, labelled", async () => {
    const { user } = await open()
    const group = ui.getByRole("group", { name: "Count presets" })
    expect([...group.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["0", "1", "Lots"])
    await user.click(ui.getByRole("button", { name: "Lots" }))
    expect(handle!.snapshot.fields.count).toBe(99)
  })

  it("lets a date be set back to null", async () => {
    const { user } = await open()
    act(() => handle!.set({ seen: "2026-01-02T03:04:00.000Z" }))
    await user.click(ui.getByRole("button", { name: "Not set" }))
    expect(handle!.snapshot.fields.seen).toBe(null)
  })
})

describe("reset", () => {
  it("shows a per-field reset only once the field has changed", async () => {
    const { user } = await open()
    expect(ui.queryByRole("button", { name: "Reset Count to its default" })).toBe(null)
    await user.click(ui.getByRole("button", { name: "Lots" }))
    await user.click(ui.getByRole("button", { name: "Reset Count to its default" }))
    expect(handle!.snapshot.fields.count).toBe(3)
  })

  it("counts changes on the header reset and clears them", async () => {
    const { user } = await open()
    expect((ui.getByRole("button", { name: /Reset the scenario/ }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(ui.getByRole("button", { name: "Lots" }))
    const reset = ui.getByRole("button", { name: /Reset the scenario, 1 changed/ })
    await user.click(reset)
    expect(handle!.snapshot.fields.count).toBe(3)
  })

  it("copies the scenario as text", async () => {
    const { user } = await open()
    /* After setup(), which installs its own clipboard stub. */
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    await user.click(ui.getByRole("button", { name: "Lots" }))
    await user.click(ui.getByRole("button", { name: "Copy the scenario as text" }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Count: 99  (default 3)"))
    expect(await ui.findByRole("button", { name: "Copied the scenario" })).toBeTruthy()
  })
})

describe("page tools", () => {
  it("sets direction on <html> and puts the page's own back", async () => {
    document.documentElement.setAttribute("dir", "ltr")
    const { user, view } = await open({})
    await user.click(ui.getByRole("button", { name: "RTL" }))
    expect(document.documentElement.getAttribute("dir")).toBe("rtl")
    await user.click(ui.getByRole("button", { name: "Page" }))
    view.unmount()
    expect(document.documentElement.getAttribute("dir")).toBe("ltr")
  })

  it("scales the root font size from the page's own, and restores it", async () => {
    const { user } = await open({})
    await user.click(ui.getByRole("button", { name: "200%" }))
    expect(document.documentElement.style.getPropertyValue("font-size")).toBe("32px")
    await user.click(ui.getByRole("button", { name: "Reset Text size to its default" }))
    expect(document.documentElement.style.getPropertyValue("font-size")).toBe("")
  })

  it("adds a freeze stylesheet while paused, and removes it", async () => {
    const { user } = await open({})
    await user.click(ui.getByRole("button", { name: "Paused" }))
    expect(document.head.querySelector("style[data-prototype-machine-motion]")).toBeTruthy()
    await user.click(ui.getByRole("button", { name: "Normal" }))
    expect(document.head.querySelector("style[data-prototype-machine-motion]")).toBe(null)
  })

  it("remembers the tools across a reload, and sanitises what it reads", () => {
    expect(sanitizeTools({ dir: "rtl", text: 1.5, motion: "slow" })).toEqual({ dir: "rtl", text: 1.5, motion: "slow" })
    expect(sanitizeTools({ dir: "sideways", text: 9, motion: 1 })).toEqual({ dir: "auto", text: 1, motion: "normal" })
    expect(sanitizeTools(null)).toEqual({ dir: "auto", text: 1, motion: "normal" })
  })

  it("can be left out", async () => {
    await open({ tools: false })
    expect(ui.queryByRole("button", { name: "Page" })).toBe(null)
  })
})
