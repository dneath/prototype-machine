"use client"

import * as React from "react"

import { optionsOf } from "../core/index"
import { SELECT_THRESHOLD, type AnyField, type MachineDef } from "../core/index"
import { type Scenario } from "./provider"

export function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const id = React.useId()
  return (
    <div className="pm-row">
      <span className="pm-label" id={id}>
        {label}
      </span>
      <div className="pm-options" role="group" aria-labelledby={id}>
        {children}
      </div>
    </div>
  )
}

/**
 * A pill. An unavailable one stays focusable and says why: `aria-disabled`
 * keeps it in the tab order, and the reason is read out through a visually
 * hidden description, with the same text as a tooltip for the pointer.
 */
export function Pill({
  active,
  disabled,
  onClick,
  title,
  reason,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
  /** Why it is unavailable. Only used when `disabled`. */
  reason?: string
  children: React.ReactNode
}) {
  const id = React.useId()
  const why = disabled ? reason : undefined
  return (
    <>
      <button
        type="button"
        className="pm-pill"
        onClick={() => {
          if (!disabled) onClick()
        }}
        aria-disabled={disabled ? true : undefined}
        aria-describedby={why ? id : undefined}
        title={why ?? title}
        aria-pressed={active}
      >
        {children}
      </button>
      {why ? (
        <span id={id} className="pm-sr">
          {why}
        </span>
      ) : null}
    </>
  )
}

/**
 * A machine's states, as pills.
 *
 * An illegal move renders present but disabled rather than hidden. The shape of
 * the journey is part of what the panel is showing — a reviewer needs to see
 * that "Active" exists and is two rungs away, not have it vanish and reappear.
 */
export function MachineRow({
  id,
  def,
  scenario,
}: {
  id: string
  def: MachineDef
  scenario: Scenario
}) {
  const current = scenario.snapshot.machines[id] ?? def.initial
  const entries = Object.entries(def.states)
  const here = def.states[current]?.label ?? current
  const moves = scenario.movesFrom(id)
  const reason = moves.length
    ? `Not reachable from ${here}. From here: ${moves
        .map((s) => def.states[s]?.label ?? s)
        .join(", ")}.`
    : `Not reachable from ${here}, which has no moves out.`

  const body =
    entries.length > SELECT_THRESHOLD ? (
      <select
        className="pm-select"
        value={current}
        onChange={(e) => scenario.go(id, e.target.value)}
        aria-label={def.label ?? id}
      >
        {entries.map(([stateId, state]) => (
          <option
            key={stateId}
            value={stateId}
            disabled={!scenario.can(id, stateId)}
            title={scenario.can(id, stateId) ? state.note : reason}
          >
            {state.label ?? stateId}
          </option>
        ))}
      </select>
    ) : (
      entries.map(([stateId, state]) => {
        const legal = scenario.can(id, stateId)
        return (
          <Pill
            key={stateId}
            active={current === stateId}
            disabled={!legal}
            title={state.note}
            reason={reason}
            onClick={() => scenario.go(id, stateId)}
          >
            {state.label ?? stateId}
          </Pill>
        )
      })
    )

  return (
    <Row label={def.label ?? id}>
      {body}
    </Row>
  )
}

/** A free field, in whichever control its type and size call for. */
export function FieldRow({
  id,
  def,
  scenario,
}: {
  id: string
  def: AnyField
  scenario: Scenario
}) {
  const label = def.label ?? id
  const value = scenario.snapshot.fields[id] ?? def.default

  switch (def.type) {
    case "boolean":
      return (
        <Row label={label}>
          <Pill active={value === true} onClick={() => scenario.set({ [id]: true })}>
            {def.trueLabel ?? "On"}
          </Pill>
          <Pill active={value === false} onClick={() => scenario.set({ [id]: false })}>
            {def.falseLabel ?? "Off"}
          </Pill>
        </Row>
      )

    case "enum": {
      const options = optionsOf(def)
      if (def.control === "select" || (def.control !== "pills" && options.length > SELECT_THRESHOLD)) {
        return (
          <Row label={label}>
            <select
              className="pm-select"
              value={String(value)}
              onChange={(e) => scenario.set({ [id]: e.target.value })}
              aria-label={label}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label ?? o.value}
                </option>
              ))}
            </select>
          </Row>
        )
      }
      return (
        <Row label={label}>
          {options.map((o) => (
            <Pill
              key={o.value}
              active={value === o.value}
              title={o.note}
              onClick={() => scenario.set({ [id]: o.value })}
            >
              {o.label ?? o.value}
            </Pill>
          ))}
        </Row>
      )
    }

    case "number": {
      const n = typeof value === "number" ? value : def.default
      if (def.control === "range") {
        return (
          <Row label={label}>
            <div className="pm-number-row">
              <input
                className="pm-range"
                type="range"
                min={def.min}
                max={def.max}
                step={def.step ?? 1}
                value={n}
                onChange={(e) => scenario.set({ [id]: Number(e.target.value) })}
                aria-label={label}
                aria-valuetext={String(n)}
              />
              <span className="pm-number-value" aria-hidden="true">
                {n}
              </span>
            </div>
          </Row>
        )
      }
      return (
        <Row label={label}>
          <NumberInput
            value={n}
            min={def.min}
            max={def.max}
            step={def.step ?? 1}
            label={label}
            onCommit={(next) => scenario.set({ [id]: next })}
          />
        </Row>
      )
    }

    case "string":
      return (
        <Row label={label}>
          <input
            className="pm-text"
            type="text"
            value={String(value ?? "")}
            placeholder={def.placeholder}
            onChange={(e) => scenario.set({ [id]: e.target.value })}
            aria-label={label}
          />
        </Row>
      )

    case "date":
      return (
        <Row label={label}>
          <input
            className="pm-text"
            type="datetime-local"
            value={toLocalInput(value)}
            onChange={(e) =>
              scenario.set({
                [id]: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
            aria-label={label}
          />
        </Row>
      )
  }
}

/* `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time; scenarios store ISO
   in UTC, because that is what a timestamp in fixture data looks like. */
function toLocalInput(value: unknown): string {
  if (typeof value !== "string" || !value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/* A draft while typing, so clearing the box to retype does not flash the
   prototype to 0 on the way. Commits valid input as it arrives; blur puts back
   whatever is actually set. */
function NumberInput({
  value,
  min,
  max,
  step,
  label,
  onCommit,
}: {
  value: number
  min?: number
  max?: number
  step: number
  label: string
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  return (
    <input
      className="pm-number"
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        if (raw.trim() === "") return
        const next = Number(raw)
        if (!Number.isFinite(next)) return
        if (min !== undefined && next < min) return
        if (max !== undefined && next > max) return
        onCommit(next)
      }}
      onBlur={() => setDraft(null)}
      aria-label={label}
    />
  )
}
