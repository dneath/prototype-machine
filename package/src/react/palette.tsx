"use client"

import * as React from "react"

import { visible } from "../core/machine"
import { type ActionApi } from "../core/schema"
import { useScenario } from "./use-scenario"
import { injectStyles } from "./styles"

/* Every scenario this prototype can be in, one keystroke away.
 *
 * The panel is for exploring the space; the palette is for arriving. During a
 * live demo "let me show you the error state" should not be four clicks and a
 * scroll, and it should not require the panel to be open and covering the
 * thing you are demonstrating.
 *
 * Unreachable states are listed and disabled rather than filtered out. Someone
 * typing "active" and getting nothing back concludes the feature is broken;
 * getting back "Active — not reachable from Parked" tells them the truth about
 * the journey they modelled. */

interface Item {
  id: string
  group: string
  label: string
  note?: string
  disabled?: boolean
  run: () => void
}

export function ScenarioPalette({ zIndex = 691 }: { zIndex?: number }) {
  const p = useScenario()
  const [query, setQuery] = React.useState("")
  const [cursor, setCursor] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const openerFocus = React.useRef<Element | null>(null)

  injectStyles()

  React.useEffect(() => {
    openerFocus.current = typeof document !== "undefined" ? document.activeElement : null
    inputRef.current?.focus()
    return () => {
      const el = openerFocus.current
      if (el instanceof HTMLElement) el.focus()
    }
  }, [])

  const items = React.useMemo<Item[]>(() => {
    const out: Item[] = []
    const { machines, actions } = p.machine.config

    for (const [machineId, def] of Object.entries(machines)) {
      if (!visible(def, p.env)) continue
      const group = def.label ?? machineId
      const current = p.snapshot.machines[machineId] ?? def.initial
      for (const [stateId, state] of Object.entries(def.states)) {
        const legal = p.can(machineId, stateId)
        out.push({
          id: `${machineId}:${stateId}`,
          group,
          label: state.label ?? stateId,
          note: legal
            ? current === stateId
              ? "current"
              : state.note
            : `not reachable from ${def.states[current]?.label ?? current}`,
          disabled: !legal,
          run: () => {
            p.go(machineId, stateId)
            p.setPaletteOpen(false)
          },
        })
      }
    }

    const actionApi: ActionApi = {
      set: p.set,
      go: p.go,
      reset: p.reset,
      navigate: p.navigate,
      get: () => p.machine.contextOf(p.snapshot),
    }
    for (const action of actions) {
      if (!visible(action, p.env)) continue
      out.push({
        id: `action:${action.id}`,
        group: "Actions",
        label: action.label,
        note: action.title,
        run: () => {
          action.run(actionApi)
          p.setPaletteOpen(false)
        },
      })
    }

    return out
  }, [p])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      `${item.group} ${item.label}`.toLowerCase().includes(q)
    )
  }, [items, query])

  /* Land on something selectable. A list whose first row is an illegal move
     would otherwise open with Enter doing nothing. */
  const firstEnabled = React.useMemo(
    () => filtered.findIndex((item) => !item.disabled),
    [filtered]
  )
  const index = clamp(cursor, filtered)
  const effective = filtered[index]?.disabled ? firstEnabled : index

  React.useEffect(() => setCursor(0), [query])

  function move(delta: number) {
    if (!filtered.length) return
    let next = effective
    for (let i = 0; i < filtered.length; i += 1) {
      next = (next + delta + filtered.length) % filtered.length
      if (!filtered[next]?.disabled) break
    }
    setCursor(next)
    listRef.current
      ?.querySelector(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }

  return (
    <div
      className="pm-root pm-palette-backdrop"
      style={{ zIndex, inset: 0 }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) p.setPaletteOpen(false)
      }}
    >
      <div className="pm-palette" role="dialog" aria-label="Scenario palette" aria-modal="true">
        <input
          ref={inputRef}
          className="pm-palette-input"
          type="text"
          value={query}
          placeholder="Jump to a scenario…"
          aria-label="Jump to a scenario"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              p.setPaletteOpen(false)
            } else if (event.key === "ArrowDown") {
              event.preventDefault()
              move(1)
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              move(-1)
            } else if (event.key === "Enter") {
              event.preventDefault()
              const item = filtered[effective]
              if (item && !item.disabled) item.run()
            }
          }}
        />

        {filtered.length ? (
          <ul className="pm-palette-list" ref={listRef}>
            {filtered.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="pm-palette-item"
                  data-index={i}
                  data-active={i === effective}
                  disabled={item.disabled}
                  onPointerMove={() => !item.disabled && setCursor(i)}
                  onClick={item.run}
                >
                  <span className="pm-palette-group">{item.group}</span>
                  <span>{item.label}</span>
                  {item.note ? <span className="pm-palette-note">{item.note}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="pm-palette-empty">Nothing matches “{query}”.</div>
        )}
      </div>
    </div>
  )
}

function clamp(value: number, list: ReadonlyArray<unknown>): number {
  if (!list.length) return 0
  return Math.min(Math.max(value, 0), list.length - 1)
}
