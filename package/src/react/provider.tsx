"use client"

import * as React from "react"

import {
  type CompiledMachine,
  type Machine,
  type PartialSnapshot,
  type Snapshot,
  has,
  isDev,
  isValidFieldValue,
  ScenarioError,
  suggest,
} from "../core/index"
import { type Env, type FieldValues, type MachineCursors, type Primitive } from "../core/index"
import {
  clearStorage,
  fromSearch,
  mergeSearch,
  readStorage,
  resolve,
  writeStorage,
} from "../core/index"

export interface ScenarioApi {
  /** Change free fields. Refuses keys a machine owns. */
  set(patch: Record<string, Primitive>): void
  /** Move a machine. Refuses a move the transitions do not allow. */
  go(machineId: string, stateId: string): void
  /** Is that move legal from where this machine currently is? */
  can(machineId: string, stateId: string): boolean
  movesFrom(machineId: string): ReadonlyArray<string>
  /** Back to the config's defaults, and forget what was stored. */
  reset(): void

  snapshot: Snapshot
  machine: CompiledMachine
  /** The provider's localStorage key, for anything needing to namespace beside it. */
  storageKey: string
  env: Env
  navigate(to: string): void
  hydrated: boolean
  /** Whether the controls are allowed to mount in this build. */
  enabled: boolean

  open: boolean
  setOpen(open: boolean): void
}

/** Context and the API in one object, so `p.step` and `p.set` read alike. */
export type Scenario<Ctx = Record<string, unknown>> = ScenarioApi & Ctx

const Ctx = React.createContext<Scenario | null>(null)

/* Hydration, as an external store rather than a `useState` + `useEffect` flag.
   `getServerSnapshot` returns false and `getSnapshot` returns true, and React
   swaps between them exactly once, when hydration finishes. That is the
   question, answered by the mechanism built for it.

   The alternative is reading localStorage in an effect and calling setState,
   which works and is a cascading render on every single load. */
const noSubscribe = () => () => {}
const onClient = () => true
const onServer = () => false

export function useHydrated(): boolean {
  return React.useSyncExternalStore(noSubscribe, onClient, onServer)
}

export interface ScenarioProviderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  machine: Machine<any, any, any> | CompiledMachine
  /**
   * localStorage key. Required, and worth versioning: bump it whenever a field
   * changes MEANING rather than merely changing value, because every browser
   * that has opened this prototype is holding the old shape and will happily
   * render it under the new reading.
   */
  storageKey: string
  /** Current route, for `when` predicates. */
  path?: string | null
  /** Router push, for declared actions. Without it, `navigate` is a no-op. */
  navigate?: (to: string) => void
  /** Anything else `when` predicates should see. */
  env?: Record<string, unknown>
  /**
   * Whether the CONTROLS mount. Defaults to "not a production build".
   *
   * Context is always provided regardless. Consumers read it in every build,
   * and a deployed review build should still honour a scenario query string.
   * Production builds resolve to a stub panel through the "production" export
   * condition, so the panel's bytes never ship.
   */
  enabled?: boolean
  /**
   * Keep the address bar in step with the scenario, using `replaceState` so
   * history is never polluted. Off by default: the query string is read once
   * and then removed, so a reload shows what you last clicked, not the link.
   */
  syncUrl?: boolean
  /** Follow scenario changes saved by other tabs on the same storageKey. Off by default. */
  syncTabs?: boolean
  children?: React.ReactNode
}

const liveKeys = new Map<string, number>()

export function ScenarioProvider(props: ScenarioProviderProps) {
  return useProvider(props)
}

/* A layout effect in the browser, so a pinned scenario's attributes are on its wrapper
   before paint; a plain effect on the server, where React 18 warns. */
const useClientLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

/* The provider's body, shared by <ScenarioProvider> and <PinnedScenario>. With
   `pinned`, the scenario starts from those values and nothing else: no
   storage, no URL, no other tabs, no attributes on <html>. Several can
   then sit on one page, each in its own state, without one overwriting what
   another saved or mirrored. */
function useProvider(
  {
    machine,
    storageKey,
    path = null,
    navigate,
    env: extraEnv,
    enabled,
    syncUrl = false,
    syncTabs = false,
    children,
  }: ScenarioProviderProps,
  pinned?: PartialSnapshot,
): React.ReactElement {
  const m = machine as CompiledMachine
  const hydrated = useHydrated()

  const [edits, setEditsState] = React.useState<PartialSnapshot>({})
  /* The latest edit layer, readable synchronously. Two calls in one handler
     each build on the previous one instead of on the last render's state. */
  const editsRef = React.useRef<PartialSnapshot>(edits)
  const initialEdits = React.useRef(edits)
  const setEdits = React.useCallback((next: PartialSnapshot) => {
    editsRef.current = next
    setEditsState(next)
  }, [])
  const [open, setOpen] = React.useState(false)

  /* Server and first client render both produce the config's defaults, so the
     markup matches and nothing has to be suppressed. Storage and the URL are
     layered on from the render AFTER hydration: a read, not a write.

     A query string that names any scenario key is the whole scenario: the
     storage layer is skipped, so this browser's leftovers cannot leak in. */
  const [urlVersion, setUrlVersion] = React.useState(0)
  const layers = React.useMemo<ReadonlyArray<PartialSnapshot>>(() => {
    if (pinned) return [pinned]
    if (!hydrated) return []
    const search = window.location.search
    if (hasScenarioParams(m, search)) return [fromSearch(m, search)]
    return [readStorage(m, storageKey)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, hydrated, m, storageKey, urlVersion])

  /* A scenario that arrived by URL is persisted straight away, so it survives
     the query being stripped or the tab being reloaded. */
  React.useEffect(() => {
    if (!hydrated || pinned) return
    const search = window.location.search
    if (!hasScenarioParams(m, search)) return
    writeStorage(m, storageKey, resolve(m, layers))
    if (!syncUrl) {
      const url = window.location.pathname + mergeSearch(m, search, null) + window.location.hash
      window.history.replaceState(window.history.state, "", url)
    }
  }, [hydrated, pinned, m, storageKey, layers, syncUrl])

  /* Back/forward with a different query: take it as the new scenario. */
  React.useEffect(() => {
    if (!syncUrl) return
    const onPop = () => {
      setEdits({})
      initialEdits.current = editsRef.current
      setUrlVersion((v) => v + 1)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [syncUrl, setEdits])

  const layersRef = React.useRef(layers)
  layersRef.current = layers

  const snapshot = React.useMemo(() => resolve(m, [...layers, edits]), [m, layers, edits])

  /* Only writes once something was actually edited, batched so a slider drag
     or typing does not hit storage on every event, and flushed on pagehide. */
  const pending = React.useRef<(() => void) | null>(null)
  React.useEffect(() => {
    if (!hydrated || pinned || edits === initialEdits.current) return
    const write = () => {
      pending.current = null
      writeStorage(m, storageKey, snapshot)
    }
    pending.current = write
    const timer = window.setTimeout(write, 150)
    return () => window.clearTimeout(timer)
  }, [hydrated, pinned, m, storageKey, snapshot, edits])

  React.useEffect(() => {
    if (!isDev || pinned) return
    const count = (liveKeys.get(storageKey) ?? 0) + 1
    liveKeys.set(storageKey, count)
    if (count > 1) {
      console.warn(`[prototype-machine] Two providers share the storageKey "${storageKey}". They will overwrite each other's saved scenario; give each its own key.`)
    }
    return () => {
      const left = (liveKeys.get(storageKey) ?? 1) - 1
      if (left <= 0) liveKeys.delete(storageKey)
      else liveKeys.set(storageKey, left)
    }
  }, [storageKey, pinned])

  /* Another tab saved a scenario under the same key: follow it. */
  React.useEffect(() => {
    if (!syncTabs) return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      setEdits({})
      initialEdits.current = editsRef.current
      setUrlVersion((v) => v + 1)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [syncTabs, storageKey, setEdits])

  React.useEffect(() => {
    const flush = () => pending.current?.()
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [])

  /* Address bar sync: one replaceState per frame at most, only our keys. */
  React.useEffect(() => {
    if (!syncUrl || !hydrated) return
    const frame = window.requestAnimationFrame(() => {
      const next = mergeSearch(m, window.location.search, snapshot)
      if (next === window.location.search) return
      window.history.replaceState(window.history.state, "", window.location.pathname + next + window.location.hash)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [syncUrl, hydrated, m, snapshot])

  const context = React.useMemo(() => m.contextOf(snapshot), [m, snapshot])

  /* Fields that mirror themselves onto the DOM, for CSS that reads attributes
     rather than props: the generalisation of a hand-rolled density toggle. */
  /* A pinned scenario mirrors onto its own wrapper instead, so two on one
     page can each be compact or dark. CSS that reads `[data-density]` matches
     the wrapper; CSS pinned to `:root[data-density]` does not. */
  const pinnedRef = React.useRef<HTMLDivElement>(null)
  const bindsDom = Object.values(m.config.fields).some((def) => "dom" in def && def.dom)
  useClientLayoutEffect(() => {
    if (typeof document === "undefined") return
    if (pinned && !pinnedRef.current) return
    /* What the page had before, so unmounting puts it back rather than
       deleting an attribute the product's own markup set (a server-rendered
       `data-theme`, a `dir` from the locale). */
    const applied: Array<[Element, string, string | null]> = []
    for (const [id, def] of Object.entries(m.config.fields)) {
      const binding = "dom" in def ? def.dom : undefined
      if (!binding) continue
      const el = pinned ? pinnedRef.current : binding.target === "body" ? document.body : document.documentElement
      if (!el) continue
      const before = el.getAttribute(binding.attribute)
      try {
        el.setAttribute(binding.attribute, String(context[id]))
      } catch {
        if (isDev) console.warn(`[prototype-machine] "${binding.attribute}" is not a valid attribute name for field "${id}".`)
        continue
      }
      applied.push([el, binding.attribute, before])
    }
    return () => {
      for (const [el, attribute, before] of applied.reverse()) {
        if (before === null) el.removeAttribute(attribute)
        else el.setAttribute(attribute, before)
      }
    }
  }, [m, context, pinned])

  const env = React.useMemo<Env>(() => ({ path, ...extraEnv }), [path, extraEnv])

  /* Every mutation writes the FULL next edit layer rather than a patch, so
     nothing calls setState from inside another setState's updater, which
     React is free to run twice. */
  const api = React.useMemo<Scenario>(() => {
    const go = (machineId: string, stateId: string) => {
      const def = has(m.config.machines, machineId) ? m.config.machines[machineId] : undefined
      if (!def) {
        if (isDev) console.warn(
            `[prototype-machine] No machine called "${machineId}".${suggest(machineId, Object.keys(m.config.machines))}`
          )
        return
      }
      if (!has(def.states, stateId)) {
        if (isDev) {
          console.warn(
            `[prototype-machine] "${machineId}" has no state "${stateId}".${suggest(stateId, Object.keys(def.states))} Known: ${Object.keys(def.states).join(", ")}.`
          )
        }
        return
      }
      const current = editsRef.current
      const live = resolve(m, [...layersRef.current, current])
      const from = live.machines[machineId] ?? def.initial
      /* Staying put is legal and changes nothing, so it writes nothing: no
         render, no storage write, no address bar update. */
      if (from === stateId) return
      if (!m.can(machineId, from, stateId)) {
        if (isDev) {
          console.warn(
            `[prototype-machine] "${machineId}" cannot go ${from} -> ${stateId}. Legal from here: ${m.movesFrom(machineId, from).join(", ") || "nothing"}.`
          )
        }
        return
      }
      setEdits({
        machines: { ...current.machines, [machineId]: stateId },
        fields: { ...current.fields },
      })
    }

    const set = (patch: Record<string, Primitive>) => {
      const fields: Record<string, Primitive> = {}
      for (const [key, value] of Object.entries(patch)) {
        const owner = has(m.ownerOf, key) ? m.ownerOf[key] : undefined
        if (owner) {
          if (isDev) {
            console.warn(
              `[prototype-machine] "${key}" is written by the "${owner}" machine, not set directly. Use go("${owner}", …). Refusing this is what stops half-written tuples existing.`
            )
          }
          continue
        }
        if (!has(m.config.fields, key)) {
          if (isDev) console.warn(
              `[prototype-machine] "${key}" is not a declared field.${suggest(key, Object.keys(m.config.fields))}`
            )
          continue
        }
        if (!isValidFieldValue(m.config.fields[key], value)) {
          if (isDev) {
            const def = m.config.fields[key]
            const range =
              def.type === "number"
                ? ` Expected a number${def.min !== undefined ? ` >= ${def.min}` : ""}${def.max !== undefined ? ` <= ${def.max}` : ""}.`
                : ` Expected a ${def.type} value.`
            console.warn(`[prototype-machine] Refusing ${JSON.stringify(value)} for "${key}".${range}`)
          }
          continue
        }
        fields[key] = value
      }
      const current = editsRef.current
      /* A slider dragged within one step, or a pill clicked twice, sets what
         is already set. Dropping those keeps the whole app from re-rendering
         on every pointer move. */
      const live = resolve(m, [...layersRef.current, current])
      for (const key of Object.keys(fields)) {
        if (Object.is(live.fields[key], fields[key])) delete fields[key]
      }
      if (!Object.keys(fields).length) return
      setEdits({
        machines: { ...current.machines },
        fields: { ...current.fields, ...fields },
      })
    }

    return {
      ...context,
      set,
      go,
      can: (machineId: string, stateId: string) => {
        const def = m.config.machines[machineId]
        if (!def) return false
        return m.can(machineId, snapshot.machines[machineId] ?? def.initial, stateId)
      },
      movesFrom: (machineId: string) => {
        const def = m.config.machines[machineId]
        if (!def) return []
        return m.movesFrom(machineId, snapshot.machines[machineId] ?? def.initial)
      },
      /* Reset clears the session's edits AND the stored scenario, so it means
         the same thing on this load and the next one. */
      reset: () => {
        /* A pinned scenario goes back to the values it was pinned to. */
        if (pinned) {
          setEdits({})
          return
        }
        clearStorage(storageKey)
        const fresh = m.initial()
        setEdits({ machines: { ...fresh.machines }, fields: { ...fresh.fields } })
      },
      snapshot,
      machine: m,
      storageKey,
      env,
      navigate: (to: string) => {
        if (navigate) navigate(to)
        else if (isDev) {
          console.warn(
            `[prototype-machine] An action asked to navigate to "${to}", but <ScenarioProvider> was given no \`navigate\` prop.`
          )
        }
      },
      hydrated,
      /* A panel inside a pinned scenario would drive one of many. */
      enabled: pinned ? false : (enabled ?? isDev),
      open,
      setOpen,
    }
  }, [
    context, m, snapshot, storageKey, setEdits,
    env, navigate, hydrated, enabled, open, pinned,
  ])

  const store = React.useState(createStore)[0]
  React.useLayoutEffect(() => {
    store.publish(context)
  }, [store, context])
  if (!store.ready) store.seed(context)

  return (
    <StoreCtx.Provider value={store}>
      <Ctx.Provider value={api}>
        {pinned && bindsDom ? (
          <div ref={pinnedRef} data-pinned-scenario="" style={{ display: "contents" }}>
            {children}
          </div>
        ) : (
          children
        )}
      </Ctx.Provider>
    </StoreCtx.Provider>
  )
}

export interface PinnedScenarioProps<M, F, D> {
  machine: Machine<M, F, D>
  /**
   * Where this scenario starts: machine states and field values, flat,
   * the way `useScenario()` reads them. Anything left out is at its default.
   * Keys a machine assigns cannot be pinned; pin the machine instead.
   */
  values?: Partial<MachineCursors<M> & FieldValues<F>>
  /** Current route, for `when` predicates. */
  path?: string | null
  /** Router push, for declared actions. */
  navigate?: (to: string) => void
  /** Anything else `when` predicates should see. */
  env?: Record<string, unknown>
  children?: React.ReactNode
}

/**
 * A scenario pinned to one set of values, for showing a screen in a state
 * without the panel: in a canvas frame, beside the same screen in another state.
 *
 * ```tsx
 * <PinnedScenario machine={scenario} values={{ journey: "keyMade", data: "empty" }}>
 *   <Overview />
 * </PinnedScenario>
 * ```
 *
 * It reads no storage and no URL and writes neither, so any number can sit on
 * one page. `go` and `set` still work inside it, for clicking through the
 * product, and `reset` goes back to `values`. Fields that mirror onto the DOM
 * set their attribute on a `display: contents` wrapper around the children,
 * not on `<html>`.
 */
export function PinnedScenario<M, F, D>({ machine, values, ...rest }: PinnedScenarioProps<M, F, D>) {
  const m = machine as unknown as CompiledMachine
  /* Keyed by content, so `values={{ data: state }}` written inline does not
     re-pin on every render, and a real change starts it afresh. */
  const key = JSON.stringify(values ?? {})
  const pinned = React.useMemo(() => pin(m, values as Record<string, unknown> | undefined), [m, key])
  return <PinnedProvider key={key} machine={m} pinned={pinned} {...rest} />
}

function PinnedProvider({
  pinned,
  ...props
}: Omit<ScenarioProviderProps, "storageKey"> & { pinned: PartialSnapshot }) {
  return useProvider({ ...props, storageKey: "" }, pinned)
}

/* Flat values into a snapshot, refusing anything that would show a screen in
   a state other than the one its label claims. A canvas labels each frame by
   what it was pinned to, so a pin that silently fell back to the default
   would be a lie with a caption. */
function pin(m: CompiledMachine, values: Record<string, unknown> | undefined): PartialSnapshot {
  const machines: Record<string, string> = {}
  const fields: Record<string, Primitive> = {}
  for (const [key, value] of Object.entries(values ?? {})) {
    if (has(m.config.machines, key)) {
      const states = Object.keys(m.config.machines[key].states)
      if (typeof value !== "string" || !states.includes(value)) {
        throw new ScenarioError(
          `<PinnedScenario> pins "${key}" to ${JSON.stringify(value)}, which is not one of its states.${
            typeof value === "string" ? suggest(value, states) : ""
          } Known: ${states.join(", ")}.`,
        )
      }
      machines[key] = value
      continue
    }
    if (has(m.config.fields, key)) {
      if (!isValidFieldValue(m.config.fields[key], value)) {
        throw new ScenarioError(`<PinnedScenario> pins "${key}" to ${JSON.stringify(value)}, which that field would refuse to hold.`)
      }
      fields[key] = value
      continue
    }
    if (has(m.ownerOf, key)) {
      throw new ScenarioError(
        `<PinnedScenario> cannot pin "${key}": the "${m.ownerOf[key]}" machine writes it. Pin "${m.ownerOf[key]}" to the state that assigns the value you want.`,
      )
    }
    throw new ScenarioError(
      `<PinnedScenario> pins "${key}", which is not a machine or a field.${suggest(key, [
        ...Object.keys(m.config.machines),
        ...Object.keys(m.config.fields),
      ])}`,
    )
  }
  return {
    ...(Object.keys(machines).length ? { machines } : {}),
    ...(Object.keys(fields).length ? { fields } : {}),
  }
}

export { Ctx as ScenarioContext }

export interface ScenarioStore {
  ready: boolean
  get(): Record<string, unknown>
  subscribe(listener: () => void): () => void
  seed(value: Record<string, unknown>): void
  publish(value: Record<string, unknown>): void
}

/* A stable store beside the context, so a selector hook re-renders only when
   the value it picked actually changes. */
function createStore(): ScenarioStore {
  let current: Record<string, unknown> = {}
  const listeners = new Set<() => void>()
  return {
    ready: false,
    get: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    seed(value) {
      current = value
      this.ready = true
    },
    publish(value) {
      if (value === current) return
      current = value
      for (const listener of listeners) listener()
    },
  }
}

export const StoreCtx = React.createContext<ScenarioStore | null>(null)

function hasScenarioParams(m: CompiledMachine, search: string): boolean {
  const params = new URLSearchParams(search)
  return Object.keys(m.params).some((key) => params.has(key))
}
