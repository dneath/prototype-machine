"use client"

import * as React from "react"

import { injectStyles } from "./styles"

/* The panel's own corner of the document.
 *
 * Rendered where <ScenarioPanel> sits in the tree, the panel inherited the
 * host's cascade, its stacking contexts and its transforms: a `select` rule in
 * a reset restyled the dropdowns, a `transform` on a layout wrapper turned
 * `position: fixed` into "fixed to that wrapper", and a modal at z-index 1300
 * sat on top of the controls you needed to drive it.
 *
 * So the panel portals into a shadow root on an element appended to <body>.
 * The host's selectors cannot reach inside it; `:host` in the stylesheet resets
 * what inheritance still carries across; the element's own inline style, which
 * beats any stylesheet rule aimed at it, keeps the host's `* {}` and
 * `body > * {}` rules from moving or hiding it. */

export const HOST_TAG = "prototype-machine"

/** The highest stacking order a 32-bit browser honours, minus room for the
 *  panel's own layers above the host element. */
export const TOP_Z_INDEX = 2147483000

/* Events from inside the panel stop at the host element.
 *
 * Inside a shadow root, an event's target is retargeted to the host element
 * by the time it reaches the document. So a host hotkey handler that checks
 * "is the target an input?" sees our host element, not the input being typed
 * in, and fires its shortcut on every keystroke. A modal library listening
 * for "pointerdown outside the dialog" sees a click outside and closes the
 * dialog you were trying to inspect. A scroll lock sees a wheel event outside
 * its allowed area and swallows it. None of that is the host's business, so
 * the events never reach it. Capture-phase listeners on the document still
 * run first, which is where the panel's own click-outside lives. */
const CONTAINED_EVENTS = [
  "keydown", "keyup", "keypress",
  "pointerdown", "pointerup", "mousedown", "mouseup",
  "click", "dblclick", "contextmenu", "auxclick",
  "touchstart", "touchend", "touchmove", "wheel",
  "focusin", "focusout",
  "input", "beforeinput", "compositionstart", "compositionend",
  "copy", "cut", "paste",
] as const

function hostStyle(zIndex: number): string {
  /* !important inline: no stylesheet rule can outrank it. */
  return [
    "all: initial !important",
    "display: block !important",
    "position: fixed !important",
    "top: 0 !important",
    "left: 0 !important",
    "width: 0 !important",
    "height: 0 !important",
    "margin: 0 !important",
    "padding: 0 !important",
    "border: 0 !important",
    "overflow: visible !important",
    "transform: none !important",
    "filter: none !important",
    "contain: none !important",
    "opacity: 1 !important",
    "visibility: visible !important",
    "pointer-events: auto !important",
    `z-index: ${zIndex} !important`,
    `--pm-z: ${zIndex}`,
  ].join("; ")
}

/* A layout effect in the browser, so the host exists before paint; a plain
   effect on the server, where React 18 warns about layout effects. */
const useClientLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

export interface ShadowLayer {
  /** The element on <body>. Everything inside it is the panel's. */
  host: HTMLElement
  /** Where React portals the panel. Inside the shadow root when there is one. */
  mount: HTMLElement
  /** The shadow root, or null in the fallback. */
  root: ShadowRoot | null
}

/**
 * Create the panel's host element, shadow root and stylesheet while `active`,
 * and take them away again when it is not. Client-only: on the server and on
 * the first client render it returns null, so the markup always matches.
 */
export function useShadowLayer(
  active: boolean,
  zIndex: number,
  nonce?: string,
  /** Which tool owns this layer, as `data-pm-layer`. The panel and a state
   *  switcher each get their own host, so a test can tell them apart. */
  kind: "panel" | "switcher" = "panel",
): ShadowLayer | null {
  const [layer, setLayer] = React.useState<ShadowLayer | null>(null)

  useClientLayoutEffect(() => {
    if (!active || typeof document === "undefined" || !document.body) return
    const host = document.createElement(HOST_TAG)
    host.setAttribute("data-prototype-machine", "")
    host.setAttribute("data-pm-layer", kind)
    /* Not part of the product, and not something a translation extension or
       a screenshot-diff tool should rewrite. */
    host.setAttribute("translate", "no")
    host.setAttribute("style", hostStyle(zIndex))

    let root: ShadowRoot | null = null
    try {
      root = typeof host.attachShadow === "function" ? host.attachShadow({ mode: "open" }) : null
    } catch {
      root = null
    }
    const mount = document.createElement("div")
    mount.setAttribute("data-pm-mount", "")
    if (root) {
      injectStyles(nonce, root)
      root.appendChild(mount)
    } else {
      injectStyles(nonce)
      host.appendChild(mount)
    }

    const stop = (event: Event) => event.stopPropagation()
    for (const type of CONTAINED_EVENTS) host.addEventListener(type, stop)

    document.body.appendChild(host)

    /* An app that rewrites <body> wholesale (a client-side router swapping
       layouts, a test harness clearing the page) takes the host with it. Put
       it back rather than leaving a panel that silently stopped existing. */
    const observer =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            if (!host.isConnected && document.body) document.body.appendChild(host)
          })
        : null
    observer?.observe(document.body, { childList: true })

    setLayer({ host, mount, root })
    return () => {
      observer?.disconnect()
      for (const type of CONTAINED_EVENTS) host.removeEventListener(type, stop)
      host.remove()
      setLayer(null)
    }
  }, [active, nonce, kind])

  /* Restacking does not need a new host. */
  useClientLayoutEffect(() => {
    layer?.host.setAttribute("style", hostStyle(zIndex))
  }, [layer, zIndex])

  return layer
}

/** Whether an event passed through `el`, seen through any shadow boundary. */
export function eventWithin(event: Event, el: Element | null | undefined): boolean {
  if (!el) return false
  const path = typeof event.composedPath === "function" ? event.composedPath() : []
  if (path.length) return path.includes(el)
  return event.target instanceof Node && el.contains(event.target)
}

/** The focused element, looking through shadow roots rather than stopping at
 *  their hosts the way `document.activeElement` does. */
export function deepActiveElement(doc: Document = document): Element | null {
  let el: Element | null = doc.activeElement
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement
  return el
}
