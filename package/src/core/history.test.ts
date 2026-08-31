import { describe, expect, it } from "vitest"

import { aim } from "./machine.test"
import {
  at,
  canRedo,
  canUndo,
  describe as describeMove,
  initHistory,
  push,
  redo,
  undo,
} from "./history"
import { type Snapshot } from "./machine"

const base = aim.initial()
const withJourney = (state: string): Snapshot => ({
  machines: { ...base.machines, journey: state },
  fields: { ...base.fields },
})

describe("history", () => {
  it("starts with one entry and nothing to undo", () => {
    const h = initHistory(base)
    expect(h.entries).toHaveLength(1)
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
  })

  it("steps back and forward", () => {
    let h = initHistory(base)
    h = push(h, { snapshot: withJourney("keyMade"), label: "Get connected → Key made" })
    expect(canUndo(h)).toBe(true)

    h = undo(h)
    expect(at(h).snapshot.machines.journey).toBe("firstRun")
    expect(canRedo(h)).toBe(true)

    h = redo(h)
    expect(at(h).snapshot.machines.journey).toBe("keyMade")
  })

  it("drops a push that changes nothing, so undo is never a no-op", () => {
    let h = initHistory(base)
    h = push(h, { snapshot: { ...base }, label: null })
    expect(h.entries).toHaveLength(1)
  })

  it("discards the forward branch once you move somewhere else", () => {
    let h = initHistory(base)
    h = push(h, { snapshot: withJourney("keyMade"), label: "a" })
    h = push(h, { snapshot: withJourney("requestIn"), label: "b" })
    h = undo(h)
    h = push(h, { snapshot: withJourney("parked"), label: "c" })

    expect(h.entries.map((e) => e.label)).toEqual([null, "a", "c"])
    expect(canRedo(h)).toBe(false)
  })

  it("caps at the limit, dropping the oldest", () => {
    let h = initHistory(base)
    for (let i = 0; i < 10; i += 1) {
      h = push(h, { snapshot: withJourney(i % 2 ? "keyMade" : "parked"), label: `${i}` }, 3)
    }
    expect(h.entries).toHaveLength(3)
    expect(h.index).toBe(2)
    expect(h.entries.map((e) => e.label)).toEqual(["7", "8", "9"])
  })
})

describe("describing a move", () => {
  it("names the machine and the state it landed in", () => {
    expect(describeMove(aim, base, withJourney("keyMade"))).toBe("Get connected → Key made")
  })

  it("names a field by its label and shown value", () => {
    const next: Snapshot = { machines: { ...base.machines }, fields: { ...base.fields, hasEvents: false } }
    expect(describeMove(aim, base, next)).toBe("Guardrail events → None")
  })

  it("returns null when nothing moved", () => {
    expect(describeMove(aim, base, { ...base })).toBe(null)
  })

  it("summarises once more than three things move at once", () => {
    const next: Snapshot = {
      machines: { journey: "keyMade", role: "admin", data: "error" },
      fields: { ...base.fields, hasEvents: false },
    }
    expect(describeMove(aim, base, next)).toMatch(/\+1 more$/)
  })
})
