"use client"

import * as React from "react"

import { warn } from "../core/index"
import { type PanelSection, sectionsOf } from "../core/index"
import { type ActionApi, type ActionDef } from "../core/index"
import { FieldRow, MachineRow } from "./controls"
import { ChevronIcon, CloseIcon, NodesIcon, PinIcon, SearchIcon } from "./icons"
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
  /** Nonce for the injected <style>, for a strict Content-Security-Policy. */
  nonce?: string
  /** Override the dev-only default. */
  enabled?: boolean
  /** Rendered at the foot of the panel — a theme switch, whatever. */
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
  nonce,
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
  const hintId = React.useId()
  const [ui, setUi] = usePanelUi(p.storageKey, active)
  const [filter, setFilter] = React.useState("")

  /* Pinned and open survive a reload, so a reviewer comparing states is not
     sent back to a closed launcher every time the page refreshes. */
  const setOpenRaw = p.setOpen
  const restored = React.useRef(false)
  React.useEffect(() => {
    if (!active || restored.current || !ui.loaded) return
    restored.current = true
    if (ui.open) setOpenRaw(true)
  }, [active, ui.loaded, ui.open, setOpenRaw])
  React.useEffect(() => {
    if (!restored.current) return
    setUi((u) => (u.open === p.open ? u : { ...u, open: p.open }))
  }, [p.open, setUi])

  React.useInsertionEffect(() => {
    if (active) injectStyles(nonce)
  }, [active, nonce])

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
  const open = p.open
  const setOpen = p.setOpen
  const pinned = ui.pinned
  React.useEffect(() => {
    if (!active || !open || typeof document === "undefined") return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return
      /* Only when the panel owns focus, or nothing does. An Escape meant for
         the host's own dialog is not ours to take. */
      const focused = document.activeElement
      const inside = !!(focused && panelRef.current?.contains(focused))
      if (!inside && focused && focused !== document.body) return
      event.preventDefault()
      restoreFocus.current = true
      setOpen(false)
    }
    function onPointerDown(event: PointerEvent) {
      if (pinned || !panelRef.current) return
      if (event.target instanceof Node && panelRef.current.contains(event.target)) return
      setOpen(false)
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [active, open, setOpen, pinned])

  /* Non-modal: focus moves in so the keyboard can reach the controls, but
     nothing is trapped — the prototype beside it stays usable. */
  const focusOnOpen = React.useRef(false)
  React.useEffect(() => {
    if (!p.open || !focusOnOpen.current) return
    focusOnOpen.current = false
    const panel = panelRef.current
    if (!panel) return
    const first = panel.querySelector<HTMLElement>(
      ".pm-rows button, .pm-rows input, .pm-rows select, .pm-filter input",
    )
    ;(first ?? panel).focus()
  }, [p.open])

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
          onClick={() => {
            focusOnOpen.current = true
            p.setOpen(true)
          }}
          aria-label={`Open ${title.toLowerCase()}`}
          aria-describedby={draggable ? hintId : undefined}
          {...(draggable ? drag.handleProps : {})}
        >
          <NodesIcon size={20} />
        </button>
        {draggable ? (
          <span id={hintId} className="pm-root pm-sr">
            Drag, or use the arrow keys, to move it.
          </span>
        ) : null}
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

  const all = sectionsOf(p.machine.config, p.env)
  const rowCount = all.reduce((n, s) => n + s.machines.length + s.fields.length, 0)
  const filtering = rowCount > FILTER_THRESHOLD
  const query = filtering ? filter.trim().toLowerCase() : ""
  const matches = (id: string, label: string | undefined, group: string | null) =>
    !query ||
    id.toLowerCase().includes(query) ||
    (label ?? "").toLowerCase().includes(query) ||
    (group ?? "").toLowerCase().includes(query)
  const sections = all
    .map((s) => ({
      ...s,
      machines: s.machines.filter(([id, d]) => matches(id, d.label, s.group)),
      fields: s.fields.filter(([id, d]) => matches(id, d.label, s.group)),
      actions: s.actions.filter((a) => matches(a.id, a.label, s.group)),
    }))
    .filter((s) => !query || s.machines.length || s.fields.length || s.actions.length)
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
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin, so a click outside closes it" : "Pin open"}
            title={pinned ? "Unpin" : "Pin open"}
            onClick={() => setUi((u) => ({ ...u, pinned: !u.pinned }))}
          >
            <PinIcon size={14} />
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

      {filtering ? (
        <label className="pm-filter">
          <SearchIcon size={14} />
          <input
            type="search"
            value={filter}
            placeholder="Filter"
            aria-label="Filter controls"
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      ) : null}
      <PanelBoundary>
      <div className="pm-rows">
        {/* Ungrouped controls first, flat, exactly as a config with no
            `group` has always rendered. Then each named section in the order
            its group was first seen, with the section's own actions after its
            rows. Ungrouped actions stay at the foot, below `children`. */}
        {ungrouped ? rowsOf(ungrouped) : null}

        {grouped.map((section) => (
          <PanelGroup
            key={section.group}
            group={section.group as string}
            collapsed={!query && ui.collapsed.includes(section.group as string)}
            onToggle={() =>
              setUi((u) => {
                const g = section.group as string
                return {
                  ...u,
                  collapsed: u.collapsed.includes(g)
                    ? u.collapsed.filter((x) => x !== g)
                    : [...u.collapsed, g],
                }
              })
            }
          >
            {rowsOf(section)}
            {actionsOf(section.actions)}
          </PanelGroup>
        ))}

        {query && !sections.length ? <p className="pm-empty">Nothing matches.</p> : null}

        {children}

        {ungrouped ? actionsOf(ungrouped.actions) : null}
      </div>
      </PanelBoundary>
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

/* A control that throws while rendering takes down the panel, not the
   prototype it sits beside. */
class PanelBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    warn(`a panel control failed to render: ${error.message}`)
  }
  render() {
    if (this.state.error) {
      return (
        <p className="pm-error" role="alert">
          The controls failed to render: {this.state.error.message}
        </p>
      )
    }
    return this.props.children
  }
}

function PanelGroup({
  group,
  collapsed,
  onToggle,
  children,
}: {
  group: string
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const id = React.useId()
  return (
    <div
      className="pm-section"
      role="group"
      aria-labelledby={id}
      data-collapsed={collapsed ? "true" : undefined}
    >
      <button
        type="button"
        className="pm-section-title"
        id={id}
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        {group}
        <span className="pm-chevron">
          <ChevronIcon size={12} />
        </span>
      </button>
      {collapsed ? null : children}
    </div>
  )
}

/* Past this many rows a filter box earns its space. */
const FILTER_THRESHOLD = 8

interface PanelUi {
  loaded: boolean
  open: boolean
  pinned: boolean
  collapsed: string[]
}

const EMPTY_UI: PanelUi = { loaded: false, open: false, pinned: false, collapsed: [] }

function uiKey(storageKey: string) {
  return `${storageKey}:pm-panel-ui`
}

function usePanelUi(
  storageKey: string,
  active: boolean,
): [PanelUi, (update: (u: PanelUi) => PanelUi) => void] {
  const [ui, setUiState] = React.useState<PanelUi>(EMPTY_UI)
  React.useEffect(() => {
    if (!active) return
    let next: PanelUi = { ...EMPTY_UI, loaded: true }
    try {
      const raw = window.localStorage.getItem(uiKey(storageKey))
      const parsed = raw ? (JSON.parse(raw) as Partial<PanelUi>) : null
      if (parsed && typeof parsed === "object") {
        next = {
          loaded: true,
          open: parsed.open === true,
          pinned: parsed.pinned === true,
          collapsed: Array.isArray(parsed.collapsed)
            ? parsed.collapsed.filter((g): g is string => typeof g === "string")
            : [],
        }
      }
    } catch {
      /* Storage off or garbage: start from nothing. */
    }
    setUiState(next)
  }, [active, storageKey])
  const setUi = React.useCallback(
    (update: (u: PanelUi) => PanelUi) => {
      setUiState((u) => update(u))
    },
    [],
  )
  React.useEffect(() => {
    if (!ui.loaded) return
    try {
      const { open, pinned, collapsed } = ui
      window.localStorage.setItem(uiKey(storageKey), JSON.stringify({ open, pinned, collapsed }))
    } catch {
      /* Not worth failing a prototype over. */
    }
  }, [ui, storageKey])
  return [ui, setUi]
}
