import { describe, expect, it } from "vitest"

import { styles } from "./styles"

/**
 * The panel mounts into someone else's cascade, so anything it leaves to
 * inheritance is a property the host gets to decide. These pin the two that the
 * browser hands to native form controls — which is how a dark panel ended up
 * drawing a light <select> popup in a light-themed product.
 */
describe("panel styles", () => {
  it("declares its own colour-scheme rather than inheriting the host's", () => {
    const open = styles.indexOf(".pm-root {")
    const root = styles.slice(open, styles.indexOf("\n}", open))
    expect(root).toContain("color-scheme: dark")
  })

  it("fills form fields opaquely, because a <select> hands its background to the popup", () => {
    expect(styles).toContain("--pm-field:")
    const open = styles.indexOf(".pm-select, .pm-text, .pm-number {")
    expect(styles.slice(open, styles.indexOf("\n}", open))).toContain("background: var(--pm-field)")
  })

  it("states option colours instead of resolving `initial` against whichever scheme won", () => {
    expect(styles).not.toContain("color: initial")
    const open = styles.indexOf(".pm-select option")
    const block = styles.slice(open, styles.indexOf("\n}", open))
    expect(block).toContain("background-color: var(--pm-field)")
    expect(block).toContain("color: var(--pm-fg)")
  })
})
