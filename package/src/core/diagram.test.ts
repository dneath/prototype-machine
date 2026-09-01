import { describe, expect, it } from "vitest"

import { defineMachine } from "./machine"
import { type Figure, layout } from "./diagram"

const render = (f: Figure | null) =>
  f ? f.rows.map((r) => r.map((c) => c.ch).join("").trimEnd()).join("\n") : ""

const m = defineMachine({
  machines: {
    journey: {
      label: "Get connected",
      initial: "firstRun",
      states: {
        parked: { label: "Parked" },
        firstRun: { label: "First run" },
        keyMade: { label: "Key made" },
        active: { label: "Active" },
      },
      transitions: {
        parked: ["firstRun"],
        firstRun: ["keyMade", "parked"],
        keyMade: ["active", "firstRun"],
        active: ["parked"],
      },
    },
    data: {
      label: "Data state",
      initial: "real",
      states: { real: {}, loading: {}, empty: {}, error: {} },
    },
    oneWay: {
      initial: "start",
      states: { start: {}, done: {}, stranded: {} },
      transitions: { start: ["done"], done: [] },
    },
  },
})

describe("layout", () => {
  it("returns null for a machine that does not exist", () => {
    expect(layout(m, "nope", "x")).toBe(null)
  })

  it("draws a declared journey as a ranked graph", () => {
    const f = layout(m, "journey", "firstRun") as Figure
    expect(f.mode).toBe("journey")
    const text = render(f)
    /* The title sits ON the top rule, bracketed, as in the reference figures. */
    expect(text.split("\n")[0]).toContain("[ GET CONNECTED ]")
    for (const label of ["Parked", "First run", "Key made", "Active"]) {
      expect(text).toContain(label)
    }
    /* An arrowhead means an edge was actually routed, not just listed. */
    expect(text).toContain("▼")
  })

  it("draws a transition-less machine flat, with no arrows at all", () => {
    const f = layout(m, "data", "real") as Figure
    expect(f.mode).toBe("switch")
    const text = render(f)
    /* Drawing n*(n-1) arrows would say something untrue about a view control. */
    expect(text).not.toContain("▼")
    expect(text).not.toContain("╎")
    expect(f.caption).toContain("no transitions declared")
  })

  it("gives every forward edge out of a node one shared trunk", () => {
    /* Drawn independently, two edges fight over the cell under the node and the
       second overwrites the first with a corner pointing the wrong way. */
    const f = layout(m, "journey", "firstRun") as Figure
    const text = render(f)
    expect(text).toMatch(/[┴┼]/)
    expect(text).not.toContain("┌┘")
  })

  it("lists back edges instead of routing them", () => {
    const f = layout(m, "journey", "firstRun") as Figure
    /* parked -> firstRun runs against the rank order. */
    expect(render(f)).toContain("↩")
  })

  it("marks what is legal from here, and dims what is not", () => {
    const f = layout(m, "journey", "firstRun") as Figure
    const kindOf = (id: string) =>
      f.rows.flat().find((c) => c.nodeId === id)?.kind
    expect(kindOf("firstRun")).toBe("accent")
    expect(kindOf("keyMade")).toBe("text")
    /* Drawn, so the shape stays visible — but dead. */
    expect(kindOf("active")).toBe("dead")
  })

  it("names the legal moves in the caption", () => {
    const f = layout(m, "journey", "firstRun") as Figure
    expect(f.caption).toContain("Key made")
    expect(f.caption).toContain("Parked")
  })

  it("says so when a state is a dead end", () => {
    const f = layout(m, "oneWay", "done") as Figure
    expect(f.caption).toContain("dead end")
  })

  it("still draws a state nothing can reach", () => {
    /* The initial state of a one-way journey is legitimately unreachable, and
       so is a state someone forgot to wire up — both need to be visible. */
    expect(render(layout(m, "oneWay", "start"))).toContain("stranded")
  })

  it("tags node cells so they can be clicked, and edge cells so they can animate", () => {
    const cells = (layout(m, "journey", "firstRun") as Figure).rows.flat()
    expect(cells.some((c) => c.nodeId === "keyMade")).toBe(true)
    expect(cells.some((c) => c.edgeId?.startsWith("firstRun->"))).toBe(true)
  })

  it("keeps every row the same width, or the grid stops lining up", () => {
    for (const id of ["journey", "data", "oneWay"]) {
      const f = layout(m, id, "start") ?? (layout(m, id, "real") as Figure)
      const widths = new Set(f.rows.map((r) => r.length))
      expect(widths.size).toBe(1)
    }
  })
})
