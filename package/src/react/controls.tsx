"use client"

import * as React from "react"

import { optionsOf } from "../core/machine"
import { SELECT_THRESHOLD, type AnyField, type MachineDef } from "../core/schema"
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

export function Pill({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="pm-pill"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
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

  const body =
    entries.length > SELECT_THRESHOLD ? (
      <select
        className="pm-select"
        value={current}
        onChange={(e) => scenario.go(id, e.target.value)}
        aria-label={def.label ?? id}
      >
        {entries.map(([stateId, state]) => (
          <option key={stateId} value={stateId} disabled={!scenario.can(id, stateId)}>
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
            title={
              legal
                ? state.note
                : `Not reachable from "${def.states[current]?.label ?? current}".`
            }
            onClick={() => scenario.go(id, stateId)}
          >
            {state.label ?? stateId}
          </Pill>
        )
      })
    )

  return <Row label={def.label ?? id}>{body}</Row>
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
              />
              <span className="pm-number-value">{n}</span>
            </div>
          </Row>
        )
      }
      return (
        <Row label={label}>
          <input
            className="pm-number"
            type="number"
            min={def.min}
            max={def.max}
            step={def.step ?? 1}
            value={n}
            onChange={(e) => {
              const next = Number(e.target.value)
              if (Number.isFinite(next)) scenario.set({ [id]: next })
            }}
            aria-label={label}
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
