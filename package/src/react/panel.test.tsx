import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { defineMachine } from "../core/machine"
import { aim } from "../core/machine.test"
import { ScenarioPanel } from "./panel"
import { ScenarioProvider } from "./provider"
import { useScenario } from "./use-scenario"

function Readout() {
  const p = useScenario(aim)
  return (
    <div>
      <span data-testid="journey">{p.journey}</span>
      <span data-testid="step">{String(p.step)}</span>
      <span data-testid="keyIssued">{String(p.keyIssued)}</span>
      <span data-testid="hasTraffic">{String(p.hasTraffic)}</span>
    </div>
  )
}

function mount(props: Partial<React.ComponentProps<typeof ScenarioProvider>> = {}) {
  return render(
    <ScenarioProvider machine={aim} storageKey="panel-test-v1" enabled {...props}>
      <Readout />
      <ScenarioPanel />
    </ScenarioProvider>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, "", "/")
})

describe("the panel", () => {
  it("starts collapsed and opens", async () => {
    const user = userEvent.setup()
    mount()
    const launcher = screen.getByRole("button", { name: /open prototype controls/i })
    await user.click(launcher)
    expect(screen.getByRole("dialog", { name: "Prototype controls" })).toBeTruthy()
  })

  it("does not render at all when disabled", () => {
    mount({ enabled: false })
    expect(screen.queryByRole("button", { name: /open prototype controls/i })).toBe(null)
  })

  it("still provides context when the controls are off", () => {
    mount({ enabled: false })
    expect(screen.getByTestId("journey").textContent).toBe("firstRun")
  })

  it("moves a machine and writes its whole tuple", async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    await user.click(screen.getByRole("button", { name: "Key made" }))

    expect(screen.getByTestId("journey").textContent).toBe("keyMade")
    expect(screen.getByTestId("step").textContent).toBe("2")
    expect(screen.getByTestId("keyIssued").textContent).toBe("true")
  })

  it("disables a pill for a move the journey does not allow", async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    // firstRun -> active is not declared.
    const active = screen.getByRole("button", { name: "Active" })
    expect(active.getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByRole("button", { name: "Key made" }).getAttribute("aria-disabled")).toBe(null)
    /* Still focusable, and says why through its description. */
    expect(active.hasAttribute("disabled")).toBe(false)
    const why = document.getElementById(active.getAttribute("aria-describedby") ?? "")
    expect(why?.textContent).toMatch(/Not reachable from First run\. From here: /)
    await user.click(active)
    expect(screen.getByRole("button", { name: "Active" }).getAttribute("aria-pressed")).toBe("false")
  })

  it("closes on Escape", async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null))
  })

  it("lets a URL beat what this browser had stored", () => {
    window.localStorage.setItem(
      "panel-test-v1",
      JSON.stringify({ machines: { journey: "parked" }, fields: {} })
    )
    window.history.replaceState({}, "", "/?journey=keyMade")
    mount()
    expect(screen.getByTestId("journey").textContent).toBe("keyMade")
  })

  it("persists across a remount", async () => {
    const user = userEvent.setup()
    const first = mount()
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    await user.click(screen.getByRole("button", { name: "Key made" }))
    first.unmount()

    mount()
    expect(screen.getByTestId("journey").textContent).toBe("keyMade")
  })

  it("refuses a direct write to a key a machine owns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    function Rogue() {
      const p = useScenario(aim)
      return (
        <button type="button" onClick={() => p.set({ keyIssued: true } as never)}>
          cheat
        </button>
      )
    }
    const user = userEvent.setup()
    render(
      <ScenarioProvider machine={aim} storageKey="panel-test-v1" enabled>
        <Readout />
        <Rogue />
      </ScenarioProvider>
    )
    await user.click(screen.getByRole("button", { name: "cheat" }))

    expect(screen.getByTestId("keyIssued").textContent).toBe("false")
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('written by the "journey" machine'))
    warn.mockRestore()
  })
})

/* Two groups, and one action grouped while another stays loose. */
const grouped = defineMachine({
  machines: {
    account: {
      label: "Account",
      group: "Who",
      initial: "fresh",
      states: { fresh: { label: "Fresh" }, team: { label: "Team" } },
    },
    theme: {
      label: "Theme",
      initial: "light",
      states: { light: { label: "Light" }, dark: { label: "Dark" } },
    },
  },
  fields: {
    unread: {
      type: "number",
      label: "Unread",
      default: 0,
      group: "Inbox",
    },
    trial: { type: "boolean", label: "Trial expired", default: false, group: "Who" },
  },
  actions: [
    {
      id: "restart",
      label: "Restart",
      group: "Who",
      run: (api) => api.reset(),
    },
    { id: "copy", label: "Seed data", run: () => {} },
  ],
})

async function openGrouped(props: Partial<React.ComponentProps<typeof ScenarioPanel>> = {}) {
  const user = userEvent.setup()
  render(
    <ScenarioProvider machine={grouped} storageKey="panel-group-test-v1" enabled>
      <ScenarioPanel {...props} />
    </ScenarioProvider>
  )
  await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
  return screen.getByRole("dialog")
}

describe("groups", () => {
  it("renders section titles, in first-seen order", async () => {
    await openGrouped()
    const titles = [...document.querySelectorAll(".pm-section-title")]
    expect(titles.map((h) => h.textContent)).toEqual(["Who", "Inbox"])
  })

  it("puts the row for each grouped control inside its section, and ungrouped rows before any section", async () => {
    const dialog = await openGrouped()
    const who = screen.getByRole("group", { name: "Who" })
    const inbox = screen.getByRole("group", { name: "Inbox" })
    expect(who.contains(screen.getByRole("group", { name: "Account" }))).toBe(true)
    expect(who.contains(screen.getByRole("group", { name: "Trial expired" }))).toBe(true)
    expect(inbox.contains(screen.getByRole("group", { name: "Unread" }))).toBe(true)

    const theme = screen.getByRole("group", { name: "Theme" })
    expect(who.contains(theme)).toBe(false)
    expect(theme.compareDocumentPosition(who) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dialog.querySelectorAll(".pm-section")).toHaveLength(2)
  })

  it("renders a section as a title and its controls, and nothing else", async () => {
    await openGrouped()
    const who = screen.getByRole("group", { name: "Who" })
    const kids = [...who.children].map((c) => c.className)
    expect(kids[0]).toBe("pm-section-title")
    expect(kids.slice(1).every((c) => c === "pm-row" || c === "pm-actions")).toBe(true)
    expect(who.querySelectorAll("p")).toHaveLength(0)
    const restart = screen.getByRole("button", { name: "Restart" })
    expect(restart.textContent).toBe("Restart")
  })

  it("collapses a section and remembers it", async () => {
    const user = userEvent.setup()
    await openGrouped()
    await user.click(screen.getByRole("button", { name: "Who" }))
    expect(screen.queryByRole("group", { name: "Account" })).toBe(null)
    expect(screen.getByRole("button", { name: "Who" }).getAttribute("aria-expanded")).toBe("false")
    const saved = JSON.parse(localStorage.getItem("panel-group-test-v1:pm-panel-ui") ?? "{}")
    expect(saved.collapsed).toEqual(["Who"])
  })

  it("renders a grouped action inside its section and an ungrouped one outside", async () => {
    await openGrouped()
    const who = screen.getByRole("group", { name: "Who" })
    const restart = screen.getByRole("button", { name: "Restart" })
    const copy = screen.getByRole("button", { name: "Seed data" })
    expect(who.contains(restart)).toBe(true)
    expect(who.contains(copy)).toBe(false)
    expect(copy.closest(".pm-actions")?.closest(".pm-section")).toBe(null)
  })

  it("renders no sections for a config without groups", async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    const dialog = screen.getByRole("dialog")
    expect(dialog.querySelectorAll(".pm-section")).toHaveLength(0)
    expect(dialog.querySelectorAll("p")).toHaveLength(0)
  })
})

describe("panel behaviour", () => {
  it("moves focus into the panel on open", async () => {
    await openGrouped()
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true)
  })

  it("stays open on an outside click once pinned", async () => {
    const user = userEvent.setup()
    await openGrouped()
    await user.click(screen.getByRole("button", { name: "Pin open" }))
    await user.click(document.body)
    expect(screen.getByRole("dialog")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: /unpin/i }))
    await user.click(document.body)
    expect(screen.queryByRole("dialog")).toBe(null)
  })

  it("shows a filter past eight rows and narrows by label", async () => {
    const user = userEvent.setup()
    const fields = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`f${i}`, { type: "boolean" as const, label: `Flag ${i}`, default: false }]),
    )
    const many = defineMachine({ machines: {}, fields })
    render(
      <ScenarioProvider machine={many} storageKey="panel-many-v1" enabled>
        <ScenarioPanel />
      </ScenarioProvider>
    )
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    await user.type(screen.getByRole("searchbox", { name: "Filter controls" }), "Flag 3")
    expect(screen.getAllByRole("group").map((g) => g.getAttribute("aria-labelledby") && g.textContent)).toHaveLength(1)
    expect(screen.getByRole("group", { name: "Flag 3" })).toBeTruthy()
  })
})
