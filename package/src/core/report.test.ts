import { describe, expect, it } from "vitest"

import { aim } from "./machine.test"
import { toMarkdown } from "./report"

describe("the agent report", () => {
  const snapshot = {
    machines: { journey: "keyMade", role: "admin", data: "error" },
    fields: { hasEvents: false, chosenTool: "opencode" },
  }

  const md = toMarkdown(aim, snapshot, {
    path: "/guardrails",
    href: "http://localhost:3000/guardrails",
  })

  it("names every machine's current state", () => {
    expect(md).toContain("- Get connected: **Key made**")
    expect(md).toContain("- Role: **Admin**")
    expect(md).toContain("- Data state: **error**")
  })

  it("shows a boolean by its labels rather than true/false", () => {
    expect(md).toContain("- Guardrail events: **None**")
  })

  it("leaves hidden fields out of the readable list", () => {
    expect(md).not.toContain("- chosenTool")
  })

  it("spells out the tuple, because that is what the code branches on", () => {
    expect(md).toContain('step: 2, keyIssued: true, firstRequestAt: null')
  })

  it("includes derived values", () => {
    expect(md).toContain("Derived: hasTraffic: false")
  })

  it("ends with a reproducible link", () => {
    expect(md).toContain("Route: /guardrails")
    expect(md).toContain(
      "Link: http://localhost:3000/guardrails?journey=keyMade&role=admin&state=error&hasEvents=0"
    )
  })
})
