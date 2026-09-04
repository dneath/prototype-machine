"use client"

import * as React from "react"

import { type PanelSection, sectionsOf } from "../core/sections"
import { type ActionApi, type ActionDef } from "../core/schema"
import { FieldRow, MachineRow } from "./controls"
import { CloseIcon, NodesIcon } from "./icons"
import { useDrag } from "./drag"
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
     always forgets. */
  React.useEffect(() => {
    if (!active || !p.open || typeof document === "undefined") return

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
  }, [active, p, p.open])

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
          aria-label={`Open ${title.toLowerCase()}${draggable ? ", or drag to move it" : ""}`}
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
      </>
    )
  }

  const sections = sectionsOf(p.machine.config, p.env)
  const ungrouped = sections.find((s) => s.group === null)
  const grouped = sections.filter((s) => s.group !== null)
  const actionApi: ActionApi = {
    set: p.set,
    go: p.go,
    reset: p.reset,
    navigate: p.navigate,
    get: () => p.machine.contextOf(p.snapshot),
  }

  const rowsOf = (section: PanelSection) => (
    <>
      {section.machines.map(([id, def]) => (
        <MachineRow key={id} id={id} def={def} scenario={p} />
      ))}
      {section.fields.map(([id, def]) => (
        <FieldRow key={id} id={id} def={def} scenario={p} />
      ))}
    </>
  )

  const actionsOf = (actions: ReadonlyArray<ActionDef>) =>
    actions.length ? (
      <div className="pm-actions">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="pm-action"
            title={action.title}
            onClick={() => action.run(actionApi)}
          >
            {action.label}
            {action.description ? (
              <span className="pm-action-description">{action.description}</span>
            ) : null}
          </button>
        ))}
      </div>
    ) : null

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
        {/* Ungrouped controls first, flat, exactly as a config with no
            `group` has always rendered. Then each named section in the order
            its group was first seen, with the section's own actions after its
            rows. Ungrouped actions stay at the foot, below `children`. */}
        {ungrouped ? rowsOf(ungrouped) : null}

        {grouped.map((section) => (
          <PanelGroup key={section.group} group={section.group as string}>
            {rowsOf(section)}
            {actionsOf(section.actions)}
          </PanelGroup>
        ))}

        {children}

        {ungrouped ? actionsOf(ungrouped.actions) : null}
      </div>
    </div>
    {drag.snapPreview ? (
      <div
        aria-hidden="true"
        className={`pm-root pm-${drag.snapPreview} pm-snap-preview pm-snap-panel`}
        style={{ zIndex: zIndex - 1 }}
      />
    ) : null}
    </>
  )
}

function PanelGroup({ group, children }: { group: string; children: React.ReactNode }) {
  const id = React.useId()
  return (
    <section className="pm-section" aria-labelledby={id}>
      <h3 className="pm-section-title" id={id}>
        {group}
      </h3>
      {children}
    </section>
  )
}
