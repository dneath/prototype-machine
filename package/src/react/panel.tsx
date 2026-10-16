"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { changedCount, summarize, toDefaults, warn } from "../core/index"
import { type PanelSection, sectionsOf } from "../core/index"
import { type ActionApi, type ActionDef } from "../core/index"
import { FieldRow, MachineRow, Pill, Row } from "./controls"
import { CheckIcon, ChevronIcon, CloseIcon, CopyIcon, NodesIcon, PinIcon, ResetIcon, SearchIcon } from "./icons"
import { useDrag } from "./drag"
import { edgeVars, useEdgeInsets } from "./edges"
import { TOP_Z_INDEX, deepActiveElement, eventWithin, useShadowLayer } from "./shadow"
import {
  DEFAULT_TOOLS,
  type PageTools,
  TEXT_SCALES,
  sanitizeTools,
  toolsChanged,
  usePageTools,
} from "./tools"
import { useScenario } from "./use-scenario"

export type PanelPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left"

export interface ScenarioPanelProps {
  /** Which corner. Default bottom-right. */
  position?: PanelPosition
  /** Heading. Default "Prototype controls". */
  title?: string
  /**
   * Stacking order of the panel's layer. Default 2147483000, above anything a
   * product puts on the page: the controls have to stay reachable while the
   * modal, toast or overlay they are driving is open.
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
  /**
   * Keep the corners clear of bars fixed to the top or bottom edge of the
   * page, such as a header or a footer. Default true.
   */
  avoidBars?: boolean
  /**
   * The Page section: text direction, text size and motion for the whole
   * host page. Default true.
   */
  tools?: boolean
  /**
   * Rendered at the foot of the panel. It renders inside the panel's isolated
   * root, where the host's stylesheets do not reach. Build it from the
   * exported `Row` and `Pill` so it matches the rest of the panel.
   */
  children?: React.ReactNode
}

/** Collapsed-state key for the Page section; cannot collide with a group name
 *  a config could declare, since those are non-empty user strings. */
const PAGE_GROUP = "\u0000page"

/**
 * The controls.
 *
 * Mount it once, as a sibling of your app inside <ScenarioProvider>. It renders
 * into its own shadow root on <body>, so the product's CSS cannot restyle it
 * and its stacking cannot bury it. It collapses to a single button so it does
 * not photobomb a review, and it disappears entirely in production builds.
 */
export function ScenarioPanel({
  position = "bottom-right",
  title = "Prototype controls",
  zIndex = TOP_Z_INDEX,
  draggable = true,
  inset,
  nonce,
  enabled,
  avoidBars = true,
  tools: showTools = true,
  children,
}: ScenarioPanelProps) {
  const p = useScenario()
  const active = enabled ?? p.enabled
  const layer = useShadowLayer(active, zIndex, nonce, "panel")
  const edges = edgeVars(useEdgeInsets(active && avoidBars))

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
  const [copied, setCopied] = React.useState(false)

  usePageTools(ui.tools, active && showTools, layer?.host ?? null)

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
     always forgets. Both read the event's composed path: inside a shadow root
     the document only ever sees the host element as the target. */
  const open = p.open
  const setOpen = p.setOpen
  const pinned = ui.pinned
  const host = layer?.host ?? null
  React.useEffect(() => {
    if (!active || !open || !host || typeof document === "undefined") return

    /* Keys pressed inside the panel stop at its host and are handled by the
       panel's own onKeyDown. This catches the one other case worth having:
       nothing is focused at all. An Escape meant for the host's own dialog
       or input is not ours to take. */
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return
      const focused = deepActiveElement()
      if (focused && focused !== document.body && !host!.contains(focused) && focused !== host) return
      event.preventDefault()
      restoreFocus.current = true
      setOpen(false)
    }
    function onPointerDown(event: PointerEvent) {
      if (pinned) return
      if (eventWithin(event, host)) return
      setOpen(false)
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [active, open, setOpen, pinned, host])

  /* Non-modal: focus moves in so the keyboard can reach the controls, but
     nothing is trapped: the prototype beside it stays usable. */
  const focusOnOpen = React.useRef(false)
  React.useEffect(() => {
    if (!p.open || !focusOnOpen.current) return
    focusOnOpen.current = false
    const panel = panelRef.current
    if (!panel) return
    const first = panel.querySelector<HTMLElement>(
      ".pm-filter input, .pm-rows button, .pm-rows input, .pm-rows textarea",
    )
    ;(first ?? panel).focus()
  }, [p.open, layer])

  React.useEffect(() => {
    if (p.open || !restoreFocus.current) return
    restoreFocus.current = false
    launcherRef.current?.focus()
  }, [p.open])

  React.useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  /* Production builds drop it entirely. A prototype gets deployed for review,
     and a reviewer who finds a role switcher assumes it is a feature. Nothing
     renders on the server or before the layer exists, so hydration never
     sees panel markup it has to match. */
  if (!active || !layer) return null

  const changed = changedCount(p.machine, p.snapshot)
  const pageChanged = showTools ? toolsChanged(ui.tools) : 0

  if (!p.open) {
    return createPortal(
      <>
        <button
          ref={launcherRef}
          type="button"
          className={`pm-root${corner} pm-launcher${dragClass}`}
          style={{ zIndex: 1, ...edges, ...offset }}
          onClick={() => {
            focusOnOpen.current = true
            p.setOpen(true)
          }}
          aria-label={`Open ${title.toLowerCase()}${changed + pageChanged ? `, ${changed + pageChanged} changed` : ""}`}
          aria-describedby={draggable ? hintId : undefined}
          {...(draggable ? drag.handleProps : {})}
        >
          <NodesIcon size={20} />
          {changed + pageChanged ? <span className="pm-launcher-dot" aria-hidden="true" /> : null}
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
            style={{ zIndex: 0, ...edges }}
          />
        ) : null}
      </>,
      layer.mount,
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

  const toggleGroup = (g: string) =>
    setUi((u) => ({
      ...u,
      collapsed: u.collapsed.includes(g) ? u.collapsed.filter((x) => x !== g) : [...u.collapsed, g],
    }))
  const setTools = (patch: Partial<PageTools>) => setUi((u) => ({ ...u, tools: { ...u.tools, ...patch } }))

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
            onClick={() => {
              try {
                action.run(actionApi)
              } catch (error) {
                warn(`action "${action.id}" threw: ${String(error)}`)
              }
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    ) : null

  const copy = () => {
    const page = ui.tools
    const extra =
      showTools && toolsChanged(page)
        ? `\nPage: direction ${page.dir}, text ${Math.round(page.text * 100)}%, motion ${page.motion}`
        : ""
    /* The summary for a person, then the config change for an agent, so one
       paste works in a bug report and in a prompt. */
    const defaults = toDefaults(p.machine, p.snapshot)
    const text = summarize(p.machine, p.snapshot) + extra + (defaults ? `\n\n${defaults}` : "")
    void copyText(text, layer.host).then((ok) => {
      if (ok) setCopied(true)
    })
  }

  return createPortal(
    <>
    <div
      ref={panelRef}
      className={`pm-root${corner} pm-panel${dragClass}`}
      style={{ zIndex: 1, ...edges, ...offset }}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return
        event.preventDefault()
        restoreFocus.current = true
        setOpen(false)
      }}
    >
      {/* The header is the drag handle; its buttons are excluded by the
          handle's own target test. Double-click returns it to its corner. */}
      <div className="pm-head" {...(draggable ? drag.handleProps : {})}>
        <span className="pm-title">{title}</span>
        <div className="pm-head-actions">
          <button
            type="button"
            className="pm-icon-button"
            aria-label={copied ? "Copied the scenario" : "Copy the scenario as text"}
            title={copied ? "Copied" : "Copy scenario"}
            onClick={copy}
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          </button>
          <button
            type="button"
            className="pm-icon-button"
            disabled={!changed}
            aria-label={changed ? `Reset the scenario, ${changed} changed` : "Reset the scenario (nothing changed)"}
            title={changed ? `Reset ${changed} changed` : "Nothing to reset"}
            onClick={() => p.reset()}
          >
            <ResetIcon size={14} />
            {changed ? <span className="pm-count" aria-hidden="true">{changed}</span> : null}
          </button>
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
      <span className="pm-sr" role="status" aria-live="polite">
        {copied ? "Scenario copied" : ""}
      </span>

      {filtering ? (
        <label className="pm-filter">
          <SearchIcon size={14} />
          <input
            type="search"
            value={filter}
            placeholder="Filter"
            aria-label="Filter controls"
            autoComplete="off"
            spellCheck={false}
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
            onToggle={() => toggleGroup(section.group as string)}
          >
            {rowsOf(section)}
            {actionsOf(section.actions)}
          </PanelGroup>
        ))}

        {query && !sections.length ? <p className="pm-empty">Nothing matches.</p> : null}

        {children}

        {ungrouped ? actionsOf(ungrouped.actions) : null}

        {showTools && !query ? (
          <PanelGroup
            group="Page"
            collapsed={ui.collapsed.includes(PAGE_GROUP)}
            onToggle={() => toggleGroup(PAGE_GROUP)}
          >
            <Row
              label="Direction"
              onReset={ui.tools.dir !== DEFAULT_TOOLS.dir ? () => setTools({ dir: DEFAULT_TOOLS.dir }) : undefined}
            >
              <Pill active={ui.tools.dir === "auto"} title="Whatever the page sets" onClick={() => setTools({ dir: "auto" })}>
                Auto
              </Pill>
              <Pill active={ui.tools.dir === "ltr"} onClick={() => setTools({ dir: "ltr" })}>
                LTR
              </Pill>
              <Pill active={ui.tools.dir === "rtl"} title="Sets dir=rtl on <html>" onClick={() => setTools({ dir: "rtl" })}>
                RTL
              </Pill>
            </Row>
            <Row
              label="Text size"
              onReset={ui.tools.text !== DEFAULT_TOOLS.text ? () => setTools({ text: DEFAULT_TOOLS.text }) : undefined}
            >
              {TEXT_SCALES.map((scale) => (
                <Pill
                  key={scale}
                  active={ui.tools.text === scale}
                  title="Scales the root font size, as a browser text-size setting would"
                  onClick={() => setTools({ text: scale })}
                >
                  {`${Math.round(scale * 100)}%`}
                </Pill>
              ))}
            </Row>
            <Row
              label="Motion"
              onReset={ui.tools.motion !== DEFAULT_TOOLS.motion ? () => setTools({ motion: DEFAULT_TOOLS.motion }) : undefined}
            >
              <Pill active={ui.tools.motion === "normal"} onClick={() => setTools({ motion: "normal" })}>
                Normal
              </Pill>
              <Pill
                active={ui.tools.motion === "slow"}
                title="CSS and Web Animations at a tenth of their speed"
                onClick={() => setTools({ motion: "slow" })}
              >
                Slow ×10
              </Pill>
              <Pill
                active={ui.tools.motion === "paused"}
                title="Pauses CSS animations and Web Animations, and turns transitions off"
                onClick={() => setTools({ motion: "paused" })}
              >
                Paused
              </Pill>
            </Row>
          </PanelGroup>
        ) : null}
      </div>
      </PanelBoundary>
    </div>
    {drag.snapPreview ? (
      <div
        aria-hidden="true"
        className={`pm-root pm-${drag.snapPreview} pm-snap-preview pm-snap-panel`}
        style={{ zIndex: 0, ...edges }}
      />
    ) : null}
    </>,
    layer.mount,
  )
}

/* The clipboard API where the page is allowed it; a hidden textarea and
   execCommand where it is not (an http:// review build, an iframe without the
   clipboard permission). The textarea goes in <body>, not the shadow root,
   because a selection inside a shadow root is not reliably copyable. */
async function copyText(text: string, returnFocusTo: HTMLElement): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* Fall through to the old way. */
  }
  try {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none"
    document.body.appendChild(area)
    const before = deepActiveElement()
    area.select()
    const ok = typeof document.execCommand === "function" && document.execCommand("copy")
    area.remove()
    if (before instanceof HTMLElement) before.focus()
    else returnFocusTo.focus()
    return ok
  } catch {
    return false
  }
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
  tools: PageTools
}

const EMPTY_UI: PanelUi = { loaded: false, open: false, pinned: false, collapsed: [], tools: DEFAULT_TOOLS }

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
          tools: sanitizeTools(parsed.tools),
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
      const { open, pinned, collapsed, tools } = ui
      window.localStorage.setItem(uiKey(storageKey), JSON.stringify({ open, pinned, collapsed, tools }))
    } catch {
      /* Not worth failing a prototype over. */
    }
  }, [ui, storageKey])
  return [ui, setUi]
}
