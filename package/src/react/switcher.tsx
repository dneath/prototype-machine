"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { has, isDev, visible, warn } from "../core/index"
import { BenchBody, type BenchStates, type StateBenchProps, labelOf, noteOf, cssLength, useBench } from "./bench-state"
import { unreachableReason } from "./controls"
import { EyeOffIcon } from "./icons"
import { TOP_Z_INDEX, useShadowLayer } from "./shadow"
import { useScenario } from "./use-scenario"

/* The state switcher: one bar of states, centred on an edge of the viewport.
 *
 * It sits over the thing being judged, so it is deliberately outside the
 * design system: the panel's dark slab and system font, in its own shadow
 * root, never the product's tokens. Switching is instant, with no transition,
 * and keeps the page's scroll position. It never renders conditionally on
 * the viewport's width: on a narrow screen it scrolls sideways instead.
 *
 * It binds no key on the page. With focus inside the bar, the arrow keys,
 * Home and End step through the states; outside it, every key belongs to the
 * product. */

export interface SwitcherOption {
  id: string
  label: string
  note?: string
  /** Listed, focusable, but not choosable. */
  disabled?: boolean
  /** Why it is disabled, read out and shown as a tooltip. */
  reason?: string
}

export interface SwitcherBarProps {
  options: ReadonlyArray<SwitcherOption>
  value: string | null
  onSelect(id: string): void
  label: string
  placement: "bottom" | "top"
  offset?: number | string
  zIndex: number
  nonce?: string
  active: boolean
  onHide(): void
}

const STEP_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"])

/* A plain effect on the server, where React 18 warns about layout effects. */
const useClientLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

/* By attribute value rather than a selector, so a state id never has to be
   escaped into CSS. */
function stateButton(nav: HTMLElement, id: string): HTMLElement | undefined {
  for (const el of nav.querySelectorAll<HTMLElement>("[data-state]")) {
    if (el.getAttribute("data-state") === id) return el
  }
  return undefined
}

/** The bar itself. Shared by `StateBench` and `StateSwitcher`. */
export function SwitcherBar({
  options,
  value,
  onSelect,
  label,
  placement,
  offset,
  zIndex,
  nonce,
  active,
  onHide,
}: SwitcherBarProps) {
  const layer = useShadowLayer(active, zIndex, nonce, "switcher")
  const navRef = React.useRef<HTMLElement>(null)
  const reasonBase = React.useId()

  /* Keep the active state in view on a narrow screen. The bar's own scroll,
     by hand: scrollIntoView could move the page. */
  useClientLayoutEffect(() => {
    const nav = navRef.current
    if (!nav || value === null) return
    const el = stateButton(nav, value)
    if (!el) return
    const left = el.offsetLeft
    const right = left + el.offsetWidth
    if (left < nav.scrollLeft) nav.scrollLeft = Math.max(0, left - 4)
    else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth + 4
  }, [value, layer])

  if (!active || !layer) return null

  const focusState = (id: string) => {
    if (navRef.current) stateButton(navRef.current, id)?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!STEP_KEYS.has(event.key)) return
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const choosable = options.filter((o) => !o.disabled)
    if (!choosable.length) return
    const focused = (event.target as HTMLElement).closest?.("[data-state]")?.getAttribute("data-state") ?? value
    const order = options.map((o) => o.id)
    const from = order.indexOf(focused ?? "")
    let next: SwitcherOption | undefined
    if (event.key === "Home") next = choosable[0]
    else if (event.key === "End") next = choosable[choosable.length - 1]
    else {
      const dir = event.key === "ArrowRight" ? 1 : -1
      for (let i = 1; i <= options.length; i++) {
        const candidate = options[(from + dir * i + options.length * 2) % options.length]
        if (!candidate.disabled) {
          next = candidate
          break
        }
      }
    }
    if (!next) return
    event.preventDefault()
    if (next.id !== value) onSelect(next.id)
    focusState(next.id)
  }

  const edge = cssLength(offset)
  const style: React.CSSProperties = { zIndex: 1 }
  if (edge !== undefined) style[placement] = edge

  return createPortal(
    <nav
      ref={navRef}
      className={`pm-root pm-switcher pm-switcher-${placement}`}
      aria-label={label}
      style={style}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => {
        const reasonId = `${reasonBase}-${index}`
        const why = option.disabled ? option.reason : undefined
        return (
          <React.Fragment key={option.id}>
            <button
              type="button"
              className="pm-switch"
              data-state={option.id}
              aria-pressed={option.id === value}
              aria-disabled={option.disabled ? true : undefined}
              aria-describedby={why ? reasonId : undefined}
              title={why ?? option.note}
              onClick={() => {
                if (!option.disabled && option.id !== value) onSelect(option.id)
              }}
            >
              {option.label}
            </button>
            {why ? (
              <span id={reasonId} className="pm-sr">
                {why}
              </span>
            ) : null}
          </React.Fragment>
        )
      })}
      <span className="pm-switch-sep" aria-hidden="true" />
      <button
        type="button"
        className="pm-switch-hide"
        aria-label={`Hide ${label.toLowerCase()}`}
        title="Hide until the page reloads"
        onClick={onHide}
      >
        <EyeOffIcon size={14} />
      </button>
    </nav>,
    layer.mount,
  )
}

/**
 * A scratch page for one component: the real component in every state it can
 * be in, a container as wide as it is in production, and a switcher that sets
 * `?__state=`. Fixtures come in through `children`, at the data boundary.
 *
 * ```tsx
 * <StateBench width={960} states={{ loading: "Loading", empty: "Empty", typical: "Typical" }}>
 *   {(state) => <AuditLog {...fixtures[state]} />}
 * </StateBench>
 * ```
 */
export function StateBench<T extends BenchStates>(props: StateBenchProps<T>) {
  const { states, missing, width, label = "States", placement = "bottom", offset, zIndex = TOP_Z_INDEX, nonce, enabled, children } = props
  const { ids, missingIds, state, setState } = useBench(props)
  const [hidden, setHidden] = React.useState(false)
  const active = (enabled ?? isDev) && !hidden

  const options: SwitcherOption[] = [
    ...ids.map((id) => ({ id, label: labelOf(id, states[id]), note: noteOf(states[id]) })),
    ...missingIds.map((id) => {
      const note = noteOf(missing?.[id])
      return {
        id,
        label: labelOf(id, missing?.[id]),
        disabled: true,
        reason: `Not in the code yet${note ? `: ${note}` : ""}.`,
      }
    }),
  ]

  return (
    <>
      <BenchBody state={state} width={width} reserve={active ? placement : null}>
        {state === null ? null : children(state)}
      </BenchBody>
      <SwitcherBar
        options={options}
        value={state}
        onSelect={(id) => setState(id as keyof T & string)}
        label={label}
        placement={placement}
        offset={offset}
        zIndex={zIndex}
        nonce={nonce}
        active={active}
        onHide={() => setHidden(true)}
      />
    </>
  )
}

export interface StateSwitcherProps {
  /** The id of the machine whose states the bar lists. */
  machine: string
  /** Accessible name. Defaults to the machine's label. */
  label?: string
  /** Default `"bottom"`. */
  placement?: "bottom" | "top"
  /** Distance from that edge. A number is pixels; a string is any CSS length. */
  offset?: number | string
  zIndex?: number
  nonce?: string
  /** Override the provider's `enabled`. */
  enabled?: boolean
}

const warned = new Set<string>()

/**
 * One machine's states as a bar at the edge of the viewport, beside (or
 * instead of) the panel. A journey's illegal moves are listed but disabled,
 * with the reason, exactly as in the panel. Pair it with `syncUrl` on the
 * provider so every state is a link.
 */
export function StateSwitcher({
  machine: id,
  label,
  placement = "bottom",
  offset,
  zIndex = TOP_Z_INDEX,
  nonce,
  enabled,
}: StateSwitcherProps) {
  const p = useScenario()
  const [hidden, setHidden] = React.useState(false)
  const def = has(p.machine.config.machines, id) ? p.machine.config.machines[id] : undefined
  if (!def && !warned.has(id)) {
    warned.add(id)
    warn(`<StateSwitcher machine="${id}"> names no machine. Known: ${Object.keys(p.machine.config.machines).join(", ") || "none"}.`)
  }
  const shown = !!def && visible({ when: def.when }, p.env)
  const active = (enabled ?? p.enabled) && shown && !hidden

  const current = def ? (p.snapshot.machines[id] ?? def.initial) : null
  const reason = def && current !== null ? unreachableReason(def, current, p.movesFrom(id)) : undefined
  const options: SwitcherOption[] = def
    ? Object.entries(def.states).map(([stateId, state]) => ({
        id: stateId,
        label: state.label ?? stateId,
        note: state.note,
        disabled: !p.can(id, stateId),
        reason,
      }))
    : []

  return (
    <SwitcherBar
      options={options}
      value={current}
      onSelect={(stateId) => p.go(id, stateId)}
      label={label ?? def?.label ?? id}
      placement={placement}
      offset={offset}
      zIndex={zIndex}
      nonce={nonce}
      active={active}
      onHide={() => setHidden(true)}
    />
  )
}
