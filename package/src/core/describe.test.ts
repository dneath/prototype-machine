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
