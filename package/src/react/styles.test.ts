import { describe, expect, it } from "vitest"

import { styles } from "./styles"

function block(selector: string): string {
  const open = styles.indexOf(`${selector} {`)
  expect(open).toBeGreaterThanOrEqual(0)
  return styles.slice(open, styles.indexOf("\n}", open))
}

/**
 * The panel lives in a shadow root, so no host selector reaches it, but
 * inheritance and custom properties still cross the boundary. These pin the
 * properties that the host would otherwise get to decide.
 */
describe("panel styles", () => {
  it("resets what inheritance carries across the shadow boundary", () => {
    const host = block(":host")
    for (const prop of ["all: initial", "color-scheme: dark", "direction: ltr", "letter-spacing: normal", "text-transform: none", "visibility: visible", "pointer-events: auto"]) {
      expect(host).toContain(prop)
    }
  })

  it("declares its own colour-scheme and direction on the panel root", () => {
    const root = block(".pm-root")
    expect(root).toContain("color-scheme: dark")
    expect(root).toContain("direction: ltr")
  })

  it("fills form fields opaquely", () => {
    expect(styles).toContain("--pm-field:")
    expect(block(".pm-text, .pm-number, .pm-textarea, .pm-trigger")).toContain("background: var(--pm-field)")
  })

  it("draws its own dropdown instead of a native <select>", () => {
    expect(styles).not.toContain(".pm-select")
    expect(block(".pm-popover")).toContain("position: fixed")
    expect(block(".pm-popover")).toContain("background: var(--pm-raise)")
  })

  it("never resolves colours against whichever scheme won", () => {
    expect(styles).not.toContain("color: initial")
    expect(styles).not.toMatch(/\brem\b/)
  })

  it("keeps its form reset at class specificity so component rules win", () => {
    expect(styles).toContain(".pm-root :where(button, input, textarea) {")
  })
})
