import { describe, expect, it } from "vitest"

import { compile, defineMachine } from "./machine"
import { aim } from "./machine.test"
import { sectionsOf } from "./sections"

const env = { path: null }

const machine = (group?: string, extra: Record<string, unknown> = {}) => ({
  initial: "a",
  states: { a: {}, b: {} },
  ...(group ? { group } : {}),
  ...extra,
})

const field = (group?: string, extra: Record<string, unknown> = {}) =>
  ({ type: "boolean", default: false, ...(group ? { group } : {}), ...extra }) as const

const action = (id: string, group?: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: id,
  run: () => {},
  ...(group ? { group } : {}),
  ...extra,
})

/** `[group, ids in order]` per section, which is all the tests care about. */
function shape(sections: ReturnType<typeof sectionsOf>) {
  return sections.map((s) => [
    s.group,
    [
      ...s.machines.map(([id]) => id),
      ...s.fields.map(([id]) => id),
      ...s.actions.map((a) => a.id),
    ],
  ])
}

describe("sectionsOf", () => {
  it("yields one null section holding everything, in declaration order, when nothing is grouped", () => {
    const sections = sectionsOf(aim.config, env)
    expect(sections).toHaveLength(1)
    expect(sections[0].group).toBe(null)
    expect(sections[0].machines.map(([id]) => id)).toEqual(["journey", "role", "data"])
    /* `chosenTool` is hidden, so it is out of the panel here as everywhere. */
    expect(sections[0].fields.map(([id]) => id)).toEqual(["hasEvents"])
    expect(sections[0].actions).toEqual([])
  })

  it("orders sections by where each group is first seen across machines, fields and actions", () => {
    const m = compile({
      machines: {
        one: machine("Later"),
        two: machine("Earlier"),
      },
      fields: {
        three: field("Fields only"),
        four: field("Later"),
      },
      actions: [action("five", "Actions only"), action("six", "Earlier")],
    })
    expect(shape(sectionsOf(m.config, env))).toEqual([
      ["Later", ["one", "four"]],
      ["Earlier", ["two", "six"]],
      ["Fields only", ["three"]],
      ["Actions only", ["five"]],
    ])
  })

  it("puts the null section first even when the first declared control is grouped", () => {
    const m = compile({
      machines: { grouped: machine("Group"), loose: machine() },
      fields: { free: field() },
      actions: [action("foot")],
    })
    expect(shape(sectionsOf(m.config, env))).toEqual([
      [null, ["loose", "free", "foot"]],
      ["Group", ["grouped"]],
    ])
  })

  it("respects hidden and when", () => {
    const m = compile({
      machines: {
        shown: machine("Group"),
        hidden: machine("Group", { hidden: true }),
        elsewhere: machine("Group", { when: (e: { path: string | null }) => e.path === "/other" }),
      },
      fields: {
        secret: field(undefined, { hidden: true }),
        here: field(undefined, { when: (e: { path: string | null }) => e.path === "/here" }),
      },
      actions: [action("gone", "Group", { when: () => false })],
    })
    expect(shape(sectionsOf(m.config, { path: "/here" }))).toEqual([
      [null, ["here"]],
      ["Group", ["shown"]],
    ])
  })

  it("drops sections that end up empty", () => {
    const m = compile({
      machines: { a: machine("Only hidden", { hidden: true }) },
      fields: { b: field("Kept") },
    })
    expect(shape(sectionsOf(m.config, env))).toEqual([["Kept", ["b"]]])
  })

  it("returns nothing at all for a config with nothing visible", () => {
    const m = compile({ fields: { a: field(undefined, { hidden: true }) } })
    expect(sectionsOf(m.config, env)).toEqual([])
  })

  it("works on a defineMachine result as well as a compiled one", () => {
    const m = defineMachine({
      fields: { a: { type: "string", default: "", group: "Text" } },
    })
    expect(shape(sectionsOf(m.config, env))).toEqual([["Text", ["a"]]])
  })
})
