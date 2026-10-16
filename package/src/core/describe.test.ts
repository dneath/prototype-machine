import { describe as outline, suggest } from "./index"
import { defineMachine, type Machine } from "./machine"
import { expectTypeOf } from "vitest"
import type { StateOf, TypedMoves } from "./schema"

const m = defineMachine({
  machines: {
    journey: {
      label: "Journey",
      initial: "first",
      states: { first: { label: "First" }, second: { label: "Second" } },
      transitions: { first: ["second"] },
    },
  },
  fields: { seats: { type: "number", label: "Seats", default: 1, min: 0, max: 5 } },
})

describe("suggest", () => {
  it("offers a close match", () => {
    expect(suggest("jurney", ["journey", "role"])).toBe(' Did you mean "journey"?')
  })
  it("stays quiet when nothing is close", () => {
    expect(suggest("zzz", ["journey"])).toBe("")
  })
})

describe("describe()", () => {
  it("outlines machines, moves, dead ends and fields", () => {
    const text = outline(m)
    expect(text).toContain("Journey (journey), starts at first")
    expect(text).toContain("  first -> second")
    expect(text).toContain("  second -> (dead end)")
    expect(text).toContain("  seats: number = 1")
  })
})

describe("types", () => {
  it("narrows state ids and field patches", () => {
    type M = typeof m extends Machine<infer X, any, any> ? X : never
    type F = typeof m extends Machine<any, infer Y, any> ? Y : never
    expectTypeOf<StateOf<M, "journey">>().toEqualTypeOf<"first" | "second">()
    expectTypeOf<Parameters<TypedMoves<M, F>["set"]>[0]>().toEqualTypeOf<Partial<{ seats: number }>>()
  })
})

import { changedCount, summarize, toDefaults } from "./index"

describe("summarize()", () => {
  it("lists every control, marks what changed, and ends with the query", () => {
    const snap = { machines: { journey: "second" }, fields: { seats: 3 } }
    const text = summarize(m, snap)
    expect(text).toContain('Journey: second "Second"  (default first)')
    expect(text).toContain("Seats: 3  (default 1)")
    expect(text).toContain("Query: ?journey=second&seats=3")
    expect(changedCount(m, snap)).toBe(2)
  })
  it("says so when everything is at its default", () => {
    expect(summarize(m, m.initial())).toContain("Query: (all defaults)")
    expect(changedCount(m, m.initial())).toBe(0)
  })
  it("falls back to the id when a machine has no label", () => {
    const bare = defineMachine({ machines: { data: { initial: "a", states: { a: {}, b: {} } } } })
    expect(outline(bare)).toContain("data (data), starts at a")
  })
})

describe("toDefaults()", () => {
  it("names each changed default, with its old value, as an instruction", () => {
    const text = toDefaults(m, { machines: { journey: "second" }, fields: { seats: 3 } })
    expect(text.split("\n")).toEqual([
      "To make this the starting scenario, change these in the defineMachine config:",
      '- machines.journey.initial: "second" (was "first")',
      "- fields.seats.default: 3 (was 1)",
    ])
  })
  it("writes a long string in full, not shortened", () => {
    const long = defineMachine({ fields: { title: { type: "string", label: "Title", default: "" } } })
    const value = "x".repeat(300)
    expect(toDefaults(long, { machines: {}, fields: { title: value } })).toContain(JSON.stringify(value))
  })
  it("is empty when nothing differs", () => {
    expect(toDefaults(m, m.initial())).toBe("")
  })
})
