"use client"

import * as React from "react"

import { type Cell, type Figure, layout } from "../core/diagram"
import { visible } from "../core/machine"
import { type DockMode, useDock } from "./dock"
import { useScenario } from "./use-scenario"
import { injectStyles } from "./styles"

/* The scenario space, drawn.
 *
 * The panel tells you where you are. It does not tell you what the space looks
 * like — how long the journey is, which moves exist, which are dead from here.
 * That shape is the thing a reviewer needs and the thing a row of pills cannot
 * show, so it gets its own surface rather than being squeezed into 288px.
 *
 * It reads as a technical figure rather than as product UI, for the same
 * reason the panel does: something you would paste into a review, obviously
 * not part of the thing being reviewed. */

const REVEAL_MS = 18
const TYPE_MS = 14

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/**
 * Reveal `total` things one at a time.
 *
 * The motion is CSS-free because it is a character count, not a property, so
 * `prefers-reduced-motion` has to be honoured here rather than in the
 * stylesheet — it jumps straight to the final frame.
 */
function useReveal(total: number, key: string, step: number): number {
  const [shown, setShown] = React.useState(total)

  React.useEffect(() => {
    if (total === 0) return
    if (prefersReducedMotion()) {
      setShown(total)
      return
    }
    setShown(0)
    let n = 0
    const id = window.setInterval(() => {
      n += 1
      setShown(n)
      if (n >= total) window.clearInterval(id)
    }, step)
    return () => window.clearInterval(id)
  }, [total, key, step])

  return shown
}

/** Runs of same-kind cells, so a row is a handful of spans rather than 80. */
function runsOf(cells: Cell[]): Array<{ text: string; kind: string; nodeId?: string }> {
  const runs: Array<{ text: string; kind: string; nodeId?: string }> = []
  for (const c of cells) {
    const last = runs[runs.length - 1]
    if (last && last.kind === c.kind && last.nodeId === c.nodeId) last.text += c.ch
    else runs.push({ text: c.ch, kind: c.kind, nodeId: c.nodeId })
  }
  return runs
}

function FigureView({
  figure,
  onPick,
  canPick,
  reasonFor,
}: {
  figure: Figure
  onPick(stateId: string): void
  canPick(stateId: string): boolean
  reasonFor(stateId: string): string
}) {
  /* What moved, and therefore what animates. Comparing against the previous
     render is enough: a figure only changes when its machine does. */
  const previous = React.useRef<string | null>(null)
  const currentNode = figure.rows
    .flat()
    .find((c) => c.kind === "accent" && c.nodeId)?.nodeId

  const travelled =
    previous.current && currentNode && previous.current !== currentNode
      ? { from: previous.current, to: currentNode }
      : null

  React.useEffect(() => {
    previous.current = currentNode ?? null
  }, [currentNode])

  const edgeIds = travelled
    ? new Set([`${travelled.from}->*`, `${travelled.from}->${travelled.to}`])
    : null

  const edgeCells = edgeIds
    ? figure.rows.flat().filter((c) => c.edgeId && edgeIds.has(c.edgeId)).length
    : 0

  const revealKey = `${figure.machineId}:${currentNode ?? ""}`
  const shownEdge = useReveal(edgeCells, revealKey, REVEAL_MS)
  const arriving = travelled ? (currentNode as string) : null
  const arrivingLength = arriving
    ? figure.rows.flat().filter((c) => c.nodeId === arriving && c.kind === "accent").length
    : 0
  const shownLabel = useReveal(arrivingLength, revealKey, TYPE_MS)

  /* Counters walked across the grid in reading order, so "reveal the first N"
     means the same thing the eye expects. */
  let edgeSeen = 0
  let labelSeen = 0

  const painted = figure.rows.map((row) =>
    row.map((c): Cell => {
      if (edgeIds && c.edgeId && edgeIds.has(c.edgeId)) {
        edgeSeen += 1
        if (edgeSeen > shownEdge) return { ...c, ch: " " }
        return { ...c, kind: "accent" }
      }
      if (arriving && c.nodeId === arriving && c.kind === "accent") {
        labelSeen += 1
        if (labelSeen > shownLabel) return { ...c, ch: " " }
      }
      return c
    })
  )

  return (
    <div className="pm-dg-figure">
      <pre className="pm-dg-grid" aria-label={`${figure.title} state diagram`}>
        {painted.map((row, r) => (
          <div className="pm-dg-row" key={r}>
            {runsOf(row).map((run, i) =>
              run.nodeId ? (
                <button
                  key={i}
                  type="button"
                  className={`pm-dg-node pm-dg-${run.kind}`}
                  disabled={!canPick(run.nodeId)}
                  title={reasonFor(run.nodeId)}
                  onClick={() => onPick(run.nodeId as string)}
                >
                  {run.text}
                </button>
              ) : (
                <span key={i} className={`pm-dg-${run.kind}`}>
                  {run.text}
                </span>
              )
            )}
          </div>
        ))}
      </pre>
      <p className="pm-dg-caption">{figure.caption}</p>
    </div>
  )
}

export interface ScenarioDiagramProps {
  zIndex?: number
  /** Where it opens. Default "right". */
  defaultDock?: DockMode
  /** Let it be dragged off its edge and resized. Default true. */
  draggable?: boolean
}

/**
 * The whole scenario space as figures, beside the app.
 *
 * One figure per visible machine, stacked. Fields are deliberately absent:
 * they are free axes, not states, and drawing them here would blur the one
 * distinction the model exists to make.
 *
 * It docks to an edge rather than covering the viewport, and there is no
 * backdrop — a diagram explaining a component must not be the thing hiding it.
 * That also makes it NON-modal, so it carries no `aria-modal`: the app behind
 * it is still there to be read and clicked.
 */
export function ScenarioDiagram({
  zIndex = 691,
  defaultDock = "right",
  draggable = true,
}: ScenarioDiagramProps) {
  const p = useScenario()
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const paneRef = React.useRef<HTMLDivElement>(null)

  injectStyles()

  const dock = useDock({
    storageKey: p.storageKey,
    enabled: draggable,
    defaultMode: defaultDock,
    elementRef: paneRef,
  })

  React.useEffect(() => {
    closeRef.current?.focus()
  }, [])

  React.useEffect(() => {
    if (typeof document === "undefined") return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault()
        p.setDiagramOpen(false)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [p])

  const machines = Object.entries(p.machine.config.machines).filter(([, def]) =>
    visible(def, p.env)
  )

  const figures = machines
    .map(([id, def]) => layout(p.machine, id, p.snapshot.machines[id] ?? def.initial))
    .filter((f): f is Figure => f !== null)

  const busy = dock.dragging || dock.resizing

  return (
    <>
      <div
        ref={paneRef}
        className={
          `pm-root pm-dg pm-dg-${dock.state.mode}` + (busy ? " pm-dg-busy" : "")
        }
        style={{ zIndex, ...dock.style }}
        role="dialog"
        aria-label="Scenario diagram"
      >
        {draggable && dock.state.mode !== "free" ? (
          <div
            className="pm-dg-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the scenario diagram"
            {...dock.resizeProps}
          />
        ) : null}

        <div className="pm-dg-head" {...(draggable ? dock.headerProps : {})}>
          <span className="pm-dg-title">Scenario diagram</span>
          <div className="pm-dg-head-actions">
            {draggable && dock.state.mode === "free" ? (
              <button
                type="button"
                className="pm-dg-close"
                onClick={() => dock.dock(defaultDock === "left" ? "left" : "right")}
                title="Put it back against the edge"
              >
                dock
              </button>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              className="pm-dg-close"
              onClick={() => p.setDiagramOpen(false)}
              aria-label="Close scenario diagram"
            >
              esc
            </button>
          </div>
        </div>

        <div className="pm-dg-body">
          {figures.length ? (
            figures.map((figure) => (
              <FigureView
                key={figure.machineId}
                figure={figure}
                onPick={(stateId) => p.go(figure.machineId, stateId)}
                canPick={(stateId) => p.can(figure.machineId, stateId)}
                reasonFor={(stateId) =>
                  p.can(figure.machineId, stateId)
                    ? `Go to ${stateId}`
                    : `Not reachable from here`
                }
              />
            ))
          ) : (
            /* Fields-only configs are legitimate — say so rather than drawing an
               empty frame and leaving the reviewer to wonder what broke. */
            <p className="pm-dg-empty">
              This scenario declares no machines, so there is no state space to draw. Free
              fields vary independently and have no shape.
            </p>
          )}
        </div>
      </div>

      {dock.edgePreview ? (
        <div
          aria-hidden="true"
          className={`pm-root pm-dg-edge-preview pm-dg-edge-${dock.edgePreview}`}
          style={{ zIndex: zIndex - 1, width: dock.state.width }}
        />
      ) : null}
      {dock.snapPreview ? (
        <div
          aria-hidden="true"
          className={`pm-root pm-${dock.snapPreview} pm-snap-preview`}
          style={{
            zIndex: zIndex - 1,
            width: dock.state.width,
            height: dock.state.mode === "free" ? dock.state.height : undefined,
          }}
        />
      ) : null}
    </>
  )
}
