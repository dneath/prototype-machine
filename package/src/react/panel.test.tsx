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
    expect(screen.getByRole("button", { name: "Active" }).hasAttribute("disabled")).toBe(true)
    expect(screen.getByRole("button", { name: "Key made" }).hasAttribute("disabled")).toBe(false)
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

/* A config that uses every new key: two groups, a description on each kind of
   control, and one action grouped while another stays loose. */
const grouped = defineMachine({
  machines: {
    account: {
      label: "Account",
      group: "Who",
      description: "New, first project, or a whole team.",
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
      description: "How many the badge shows.",
    },
    trial: { type: "boolean", label: "Trial expired", default: false, group: "Who" },
  },
  actions: [
    {
      id: "restart",
      label: "Restart",
      group: "Who",
      description: "Resets and returns to sign in.",
      run: (api) => api.reset(),
    },
    { id: "copy", label: "Copy link", run: () => {} },
  ],
})

async function openGrouped() {
  const user = userEvent.setup()
  render(
    <ScenarioProvider machine={grouped} storageKey="panel-group-test-v1" enabled>
      <ScenarioPanel />
    </ScenarioProvider>
  )
  await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
  return screen.getByRole("dialog")
}

describe("groups and descriptions", () => {
  it("renders group headings, in first-seen order", async () => {
    await openGrouped()
    const headings = screen.getAllByRole("heading")
    expect(headings.map((h) => h.textContent)).toEqual(["Who", "Inbox"])
    expect(headings.every((h) => h.classList.contains("pm-section-title"))).toBe(true)
  })

  it("puts the row for each grouped control inside its section, and ungrouped rows before any section", async () => {
    const dialog = await openGrouped()
    const who = screen.getByRole("region", { name: "Who" })
    const inbox = screen.getByRole("region", { name: "Inbox" })
    expect(who.contains(screen.getByRole("group", { name: "Account" }))).toBe(true)
    expect(who.contains(screen.getByRole("group", { name: "Trial expired" }))).toBe(true)
    expect(inbox.contains(screen.getByRole("group", { name: "Unread" }))).toBe(true)

    const theme = screen.getByRole("group", { name: "Theme" })
    expect(who.contains(theme)).toBe(false)
    /* Ungrouped rows come first in document order. */
    expect(theme.compareDocumentPosition(who) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dialog.querySelectorAll(".pm-section")).toHaveLength(2)
  })

  it("shows a description as visible text, not only as a title", async () => {
    await openGrouped()
    const text = screen.getByText("New, first project, or a whole team.")
    expect(text.tagName).toBe("P")
    expect(text.classList.contains("pm-description")).toBe(true)
    const group = screen.getByRole("group", { name: "Account" })
    expect(group.getAttribute("aria-describedby")).toBe(text.id)
    expect(screen.getByText("How many the badge shows.").classList.contains("pm-description")).toBe(true)
  })

  it("renders a grouped action inside its section and an ungrouped one in the foot", async () => {
    const dialog = await openGrouped()
    const who = screen.getByRole("region", { name: "Who" })
    const restart = screen.getByRole("button", { name: /restart/i })
    const copy = screen.getByRole("button", { name: "Copy link" })
    expect(who.contains(restart)).toBe(true)
    expect(who.contains(copy)).toBe(false)
    expect(dialog.querySelectorAll(".pm-section").length).toBeGreaterThan(0)
    /* The foot is the last `.pm-actions` in the panel, outside every section. */
    const foot = copy.closest(".pm-actions")
    expect(foot?.closest(".pm-section")).toBe(null)
    expect(restart.querySelector(".pm-action-description")?.textContent).toBe(
      "Resets and returns to sign in."
    )
  })

  it("renders no headings and no sections for a config without groups", async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    const dialog = screen.getByRole("dialog")
    expect(screen.queryAllByRole("heading")).toEqual([])
    expect(dialog.querySelectorAll(".pm-section")).toHaveLength(0)
    expect(dialog.querySelectorAll(".pm-description")).toHaveLength(0)
  })
})
