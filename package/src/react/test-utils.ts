import { type BoundFunctions, type queries, within } from "@testing-library/react"

/* The panel renders into a shadow root, which `screen` does not search. These
   are the same queries, scoped to that root. Test-only: no entry imports it. */

export function panelRoot(): ShadowRoot {
  const host = document.querySelector("prototype-machine")
  if (!host || !host.shadowRoot) throw new Error("The panel's host element is not mounted.")
  return host.shadowRoot
}

type Queries = BoundFunctions<typeof queries>

/** `screen`, inside the panel. Re-resolves the root on every call, because a
 *  remount creates a new host. */
export const ui: Queries = new Proxy({} as Queries, {
  get(_target, key) {
    const queries = within(panelRoot() as unknown as HTMLElement) as unknown as Record<PropertyKey, unknown>
    return queries[key]
  },
})

/** `ui`, but tolerant of the host not existing yet (for `queryBy*`). */
export function panelMounted(): boolean {
  return !!document.querySelector("prototype-machine")?.shadowRoot
}
