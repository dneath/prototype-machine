"use client"

import * as React from "react"

import { visible } from "../core/machine"
import { type ActionApi } from "../core/schema"
import { FieldRow, MachineRow } from "./controls"
import { CloseIcon, DiagramIcon, NodesIcon } from "./icons"
import { ScenarioDiagram } from "./diagram"
import { useDrag } from "./drag"
import { formatBinding, useHotkey } from "./hotkeys"
import { useScenario } from "./use-scenario"
import { injectStyles } from "./styles"

export type PanelPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left"

export interface ScenarioPanelProps {
  /** Which corner. Default bottom-right. */
  position?: PanelPosition
  /** Heading. Default "Prototype controls". */
  title?: string
  /**
   * Stacking order. Default 690 — high enough to clear an app's overlays, low
   * enough to sit under anything that must never be covered (a classification
   * banner, a cookie wall you are legally obliged to show).
   */
  zIndex?: number
  /** Toggle the panel. Default "mod+.". Pass null to unbind. */
  hotkey?: string | null
  /**
   * Open the state diagram. Unbound by default — the panel already owns one
   * global key and a dev tool should not quietly claim a second.
   */
  diagramHotkey?: string | null
  /**
   * Let the panel be dragged anywhere. `position` stays the corner it starts
   * in. Default true.
   */
  draggable?: boolean
  /**
   * A CSS custom property to set on the document element while the controls are
   * mounted, so the host can push its own corner UI clear of them.
   * `{ name: "--toast-inset-bottom", value: "4.5rem" }`.
   */
  inset?: { name: string; value: string }
  /** Override the dev-only default. */
  enabled?: boolean
  /** Rendered at the foot of the panel — a theme switch, a link, whatever. */
  children?: React.ReactNode
}

/**
 * The controls.
 *
 * Mount it once, as a sibling of your app inside <ScenarioProvider>. It
 * collapses to a single button so it does not photobomb a review, and it
 * disappears entirely in production builds.
 */
export function ScenarioPanel({
  position = "bottom-right",
  title = "Prototype controls",
  zIndex = 690,
  hotkey = "mod+.",
  diagramHotkey = null,
  draggable = true,
  inset,
  enabled,
  children,
}: ScenarioPanelProps) {
  const p = useScenario()
  const active = enabled ?? p.enabled

  const panelRef = React.useRef<HTMLDivElement>(null)
  const launcherRef = React.useRef<HTMLButtonElement>(null)
  /* Whichever of the two is mounted right now is the thing being positioned. */
  const movingRef = (p.open ? panelRef : launcherRef) as React.RefObject<HTMLElement | null>
  /* So closing returns focus where it came from rather than to <body>, which
     is where a keyboard user would otherwise have to start over. */
  const restoreFocus = React.useRef(false)

  injectStyles()

  useHotkey(hotkey, () => p.setOpen(!p.open), active)
  useHotkey(diagramHotkey, () => p.setDiagramOpen(!p.diagramOpen), active)

  const drag = useDrag({
    storageKey: p.storageKey,
    enabled: active && draggable,
    elementRef: movingRef,
  })

  /* Three ways the panel can be positioned, and only one of them is inline.
     A corner placement is rendered by the SAME `pm-<corner>` class as the
     default, which is why a snapped panel stays put through a resize with no
     JavaScript. A free placement has to cancel that class's anchors, or the
     two compete and the panel jumps. */
  const anchored =
    drag.placement === null
      ? position
      : drag.placement.kind === "corner"
        ? drag.placement.corner
        : null

  const offset =
    drag.placement && drag.placement.kind === "free"
      ? {
          top: drag.placement.y,
          left: drag.placement.x,
          right: "auto" as const,
          bottom: "auto" as const,
        }
      : null

  const corner = anchored ? ` pm-${anchored}` : ""
  const dragClass =
    (drag.dragging ? " pm-dragging" : "") + (drag.settling ? " pm-settling" : "")

  React.useEffect(() => {
    if (!active || !inset || typeof document === "undefined") return
    const root = document.documentElement
    root.style.setProperty(inset.name, inset.value)
    return () => {
      root.style.removeProperty(inset.name)
    }
  }, [active, inset])

  /* Escape and click-outside, which the hand-rolled version of this panel
     always forgets. The diagram owns both while it is open: a click on a node
     in the overlay is not a click "outside the panel" in any sense the
     reviewer means. */
  React.useEffect(() => {
    if (!active || !p.open || p.diagramOpen || typeof document === "undefined") return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault()
        restoreFocus.current = true
        p.setOpen(false)
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!panelRef.current) return
      if (event.target instanceof Node && panelRef.current.contains(event.target)) return
      p.setOpen(false)
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [active, p, p.open, p.diagramOpen])

  React.useEffect(() => {
    if (p.open || !restoreFocus.current) return
    restoreFocus.current = false
    launcherRef.current?.focus()
  }, [p.open])

  /* Production builds drop it entirely. A prototype gets deployed for review,
     and a reviewer who finds a role switcher assumes it is a feature. */
  if (!active) return null

  if (!p.open) {
    return (
      <>
        <button
          ref={launcherRef}
          type="button"
          className={`pm-root${corner} pm-launcher${dragClass}`}
          style={{ zIndex, ...offset }}
          onClick={() => p.setOpen(true)}
          aria-label={`Open ${title.toLowerCase()}${hotkey ? ` (${formatBinding(hotkey)})` : ""}${draggable ? ", or drag to move it" : ""}`}
          {...(draggable ? drag.handleProps : {})}
        >
          <NodesIcon size={20} />
        </button>
        {drag.snapPreview ? (
          <div
            aria-hidden="true"
            className={`pm-root pm-${drag.snapPreview} pm-snap-preview pm-snap-launcher`}
            style={{ zIndex: zIndex - 1 }}
          />
        ) : null}
        {p.diagramOpen ? <ScenarioDiagram zIndex={zIndex + 1} /> : null}
      </>
    )
  }

  const { machines, fields, actions } = p.machine.config
  const actionApi: ActionApi = {
    set: p.set,
    go: p.go,
    reset: p.reset,
    navigate: p.navigate,
    get: () => p.machine.contextOf(p.snapshot),
  }

  return (
    <>
    <div
      ref={panelRef}
      className={`pm-root${corner} pm-panel${dragClass}`}
      style={{ zIndex, ...offset }}
      role="dialog"
      aria-label={title}
    >
      {/* The header is the drag handle; its buttons are excluded by the
          handle's own target test. Double-click returns it to its corner. */}
      <div className="pm-head" {...(draggable ? drag.handleProps : {})}>
        <span className="pm-title">{title}</span>
        <div className="pm-head-actions">
          <button
            type="button"
            className="pm-icon-button"
            onClick={() => p.setDiagramOpen(true)}
            aria-label="Show the state diagram"
            title={`Draw this scenario's state space${diagramHotkey ? ` (${formatBinding(diagramHotkey)})` : ""}`}
          >
            <DiagramIcon size={14} />
          </button>
          <button
            type="button"
            className="pm-icon-button"
            onClick={() => {
              restoreFocus.current = true
              p.setOpen(false)
            }}
            aria-label={`Close ${title.toLowerCase()}`}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </div>

      <div className="pm-rows">
        {Object.entries(machines).map(([id, def]) =>
          visible(def, p.env) ? <MachineRow key={id} id={id} def={def} scenario={p} /> : null
        )}

        {Object.entries(fields).map(([id, def]) =>
          visible(def, p.env) ? <FieldRow key={id} id={id} def={def} scenario={p} /> : null
        )}

        {children}

        {actions.length ? (
          <div className="pm-actions">
            {actions.map((action) =>
              visible(action, p.env) ? (
                <button
                  key={action.id}
                  type="button"
                  className="pm-action"
                  title={action.title}
                  onClick={() => action.run(actionApi)}
                >
                  {action.label}
                </button>
              ) : null
            )}
          </div>
        ) : null}
      </div>
    </div>
    {drag.snapPreview ? (
      <div
        aria-hidden="true"
        className={`pm-root pm-${drag.snapPreview} pm-snap-preview pm-snap-panel`}
        style={{ zIndex: zIndex - 1 }}
      />
    ) : null}
    {p.diagramOpen ? <ScenarioDiagram zIndex={zIndex + 1} /> : null}
    </>
  )
}
