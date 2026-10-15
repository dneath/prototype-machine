"use client"

import * as React from "react"

import { ScenarioError, suggest, warn } from "../core/index"

/* A component bench: one component, every state it can be in, on a scratch
 * page.
 *
 * The state on screen lives in one search parameter, `__state` by default.
 * The URL is the source of truth, so every state is a link: a reload keeps it,
 * a teammate can open it, and a test can loop over it. The double underscore
 * keeps it clear of any parameter the app's own layout reads.
 *
 * Nothing in this file draws the switcher. The production entry renders the
 * bench without one, so the switcher's code is not shipped. */

/** The default search parameter for a bench. */
export const STATE_PARAM = "__state"

/** A bench state's label and tooltip. A bare string is the label. */
export interface BenchStateDef {
  label?: string
  /** Explains the state to whoever is clicking. Rendered as a tooltip. */
  note?: string
}

export type BenchStates = Record<string, string | BenchStateDef>

export interface StateBenchProps<T extends BenchStates> {
  /**
   * Every state the component can be in, in the order the switcher lists
   * them. Each key is the URL value: `?__state=empty`. Name them the way the
   * product talks about them.
   */
  states: T
  /**
   * States the design shows but the code cannot reach. The switcher lists
   * them, disabled, and the bench never renders them. Add the branch to the
   * component, then move the entry into `states`.
   */
  missing?: BenchStates
  /** The state shown when the URL names none. Defaults to the first. */
  initial?: keyof T & string
  /** The search parameter. Default `"__state"`. */
  param?: string
  /** As wide as the component is in production. A number is pixels. Default: the page's width. */
  width?: number | string
  /** The switcher's accessible name. Default `"States"`. */
  label?: string
  /** Where the switcher sits. Default `"bottom"`. Use `"top"` when the component sits at the bottom of the viewport. */
  placement?: "bottom" | "top"
  /** Distance from that edge. A number is pixels; a string is any CSS length, such as `"calc(var(--header-h) + 8px)"`. */
  offset?: number | string
  /** Stacking order of the switcher. Default 2147483000. */
  zIndex?: number
  /** Nonce for the injected <style>, for a strict Content-Security-Policy. */
  nonce?: string
  /** Whether the switcher mounts. Defaults to "not a production build". The state still renders either way. */
  enabled?: boolean
  /** Keep the switcher clear of bars fixed to the page's top or bottom edge. Default true. Ignored when `offset` is set. */
  avoidBars?: boolean
  /** Renders the real component in one state. Called for the active state only. */
  children: (state: keyof T & string) => React.ReactNode
}

/* Our own writes do not fire `popstate`, so they announce themselves. */
const URL_CHANGE = "prototype-machine:urlchange"

function subscribe(listener: () => void): () => void {
  window.addEventListener("popstate", listener)
  window.addEventListener(URL_CHANGE, listener)
  return () => {
    window.removeEventListener("popstate", listener)
    window.removeEventListener(URL_CHANGE, listener)
  }
}

/* `undefined` on the server and while hydrating: the URL is not known yet, and
   guessing renders the wrong state's fixtures for a frame. */
const onServer = (): string | null | undefined => undefined

export interface StateParamOptions {
  /** The state shown when the URL names none. */
  initial: string
  /** The search parameter. Default `"__state"`. */
  param?: string
  /** Ids that are known but cannot be shown. A URL naming one gets a warning that says so. */
  missing?: ReadonlyArray<string>
}

/**
 * Which of `ids` the URL names, and a way to change it.
 *
 * Returns `null` until the URL can be read (on the server and while
 * hydrating). Writes use `replaceState`, so stepping through states does not
 * fill the history, and keep every other parameter and the hash.
 */
export function useStateParam<S extends string>(
  ids: ReadonlyArray<S>,
  { initial, param = STATE_PARAM, missing = [] }: StateParamOptions & { initial: S },
): [S | null, (next: S) => void] {
  const read = React.useCallback(
    () => new URLSearchParams(window.location.search).get(param),
    [param],
  )
  const raw = React.useSyncExternalStore(subscribe, read, onServer)

  const known = raw !== undefined && raw !== null && (ids as ReadonlyArray<string>).includes(raw)

  React.useEffect(() => {
    if (raw === undefined || raw === null || known) return
    if (missing.includes(raw)) {
      warn(`?${param}=${raw} is listed as missing: the code cannot reach it yet. Showing "${initial}".`)
    } else {
      warn(`?${param}=${raw} is not a state of this bench.${suggest(raw, ids)} Showing "${initial}". Known: ${ids.join(", ")}.`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, known, param, initial])

  const set = React.useCallback(
    (next: S) => {
      const url = new URL(window.location.href)
      /* Always explicit, even for the initial state, so a link keeps meaning
         the same thing after `initial` changes. */
      url.searchParams.set(param, next)
      const target = url.pathname + url.search + url.hash
      if (target === window.location.pathname + window.location.search + window.location.hash) return
      window.history.replaceState(window.history.state, "", target)
      window.dispatchEvent(new Event(URL_CHANGE))
    },
    [param],
  )

  const state = raw === undefined ? null : known ? (raw as S) : initial
  return [state, set]
}

export function labelOf(id: string, def: string | BenchStateDef | undefined): string {
  if (typeof def === "string") return def
  return def?.label ?? id
}

export function noteOf(def: string | BenchStateDef | undefined): string | undefined {
  return typeof def === "string" ? undefined : def?.note
}

/** Validate a bench's config and read its state from the URL. Shared by the
 *  development and production benches. */
export function useBench<T extends BenchStates>(props: StateBenchProps<T>) {
  const ids = Object.keys(props.states) as Array<keyof T & string>
  const missingIds = Object.keys(props.missing ?? {})
  if (ids.length === 0) {
    throw new ScenarioError("<StateBench> was given no states.")
  }
  const initial = (props.initial ?? ids[0]) as keyof T & string
  if (!ids.includes(initial)) {
    throw new ScenarioError(
      `<StateBench> starts in "${initial}", which is not one of its states (${ids.join(", ")}).${suggest(initial, ids)}`,
    )
  }
  for (const id of missingIds) {
    if ((ids as string[]).includes(id)) {
      throw new ScenarioError(
        `"${id}" is both a state and missing. A state the code can render is not missing; remove it from \`missing\`.`,
      )
    }
  }
  for (const [id, def] of [...Object.entries(props.states), ...Object.entries(props.missing ?? {})]) {
    if (labelOf(id, def).trim() === "") {
      throw new ScenarioError(`<StateBench> state "${id}" has an empty label.`)
    }
  }
  const [state, setState] = useStateParam(ids, {
    initial,
    param: props.param,
    missing: missingIds,
  })
  return { ids, missingIds, initial, state, setState }
}

function cssLength(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === "number" ? `${value}px` : value
}

export { cssLength }

/**
 * The page's part of a bench: one container as wide as the component is in
 * production, and the component in it. No fonts, colours or spacing of its
 * own, so the component looks the way the app makes it look.
 *
 * Each state mounts fresh (keyed by its id), so a seeded cache or a held
 * request belongs to the state that set it up.
 */
export function BenchBody({
  state,
  width,
  reserve,
  extra = 0,
  children,
}: {
  state: string | null
  width?: number | string
  /** Room for the switcher, so it never covers the end of a long component. */
  reserve?: "top" | "bottom" | null
  /** Extra room, in px, when the switcher sits above a bar fixed to that edge. */
  extra?: number
  children: React.ReactNode
}) {
  const w = cssLength(width)
  const spacer = <div aria-hidden="true" data-state-bench-spacer="" style={{ height: 88 + extra }} />
  return (
    <>
      {reserve === "top" ? spacer : null}
      <div
        data-state-bench=""
        data-state={state ?? undefined}
        style={w ? { width: w, maxWidth: "100%" } : undefined}
      >
        {state === null ? null : <React.Fragment key={state}>{children}</React.Fragment>}
      </div>
      {reserve === "bottom" ? spacer : null}
    </>
  )
}
