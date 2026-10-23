import { type BoundFunctions, type queries, within } from "@testing-library/react"

/* The panel renders into a shadow root, which `screen` does not search. These
   are the same queries, scoped to that root. Test-only: no entry imports it. */

export function panelRoot(): ShadowRoot {
  const host = document.querySelector('prototype-machine[data-pm-layer="panel"]')
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
  return !!document.querySelector('prototype-machine[data-pm-layer="panel"]')?.shadowRoot
}

/** The state switcher's shadow root. */
export function switcherRoot(): ShadowRoot {
  const host = document.querySelector('prototype-machine[data-pm-layer="switcher"]')
  if (!host || !host.shadowRoot) throw new Error("The switcher's host element is not mounted.")
  return host.shadowRoot
}

/** `screen`, inside the state switcher. */
export const bar: Queries = new Proxy({} as Queries, {
  get(_target, key) {
    const queries = within(switcherRoot() as unknown as HTMLElement) as unknown as Record<PropertyKey, unknown>
    return queries[key]
  },
})

export function switcherMounted(): boolean {
  return !!document.querySelector('prototype-machine[data-pm-layer="switcher"]')?.shadowRoot
}

/** The canvas's shadow root: its axis names and its bar. */
export function canvasRoot(): ShadowRoot {
  const host = document.querySelector('prototype-machine[data-pm-layer="canvas"]')
  if (!host || !host.shadowRoot) throw new Error("The canvas's host element is not mounted.")
  return host.shadowRoot
}

/** `screen`, inside the canvas's shadow root. */
export const chrome: Queries = new Proxy({} as Queries, {
  get(_target, key) {
    const queries = within(canvasRoot() as unknown as HTMLElement) as unknown as Record<PropertyKey, unknown>
    return queries[key]
  },
})

export function canvasMounted(): boolean {
  return !!document.querySelector('prototype-machine[data-pm-layer="canvas"]')?.shadowRoot
}
