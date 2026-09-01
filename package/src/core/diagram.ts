import { type CompiledMachine } from "./machine"
import { type MachineDef } from "./schema"

/* The panel says where you are. It does not say what the space LOOKS like —
 * which moves exist, which are dead, how far along the journey a state sits.
 * This lays a machine out as a character grid so that shape becomes visible.
 *
 * Two layouts, because there are two kinds of machine and drawing them the
 * same way would lie about one of them:
 *
 *   - A JOURNEY declares `transitions`. It has direction and dead ends, so it
 *     is drawn as a ranked graph with arrows.
 *   - A SWITCH omits `transitions` entirely, meaning every state is reachable
 *     from every state. Drawing that as a graph would be a hairball of
 *     n*(n-1) arrows carrying no information. It is drawn as a flat row with
 *     no arrows at all, and says so.
 */

export type CellKind = "frame" | "text" | "accent" | "dim" | "dead"

export interface Cell {
  ch: string
  kind: CellKind
  /** Set on the cells that spell a state's label, so they can be clicked. */
  nodeId?: string
  /** Set on connector cells, so a travelled edge can be animated. */
  edgeId?: string
}

export interface Figure {
  machineId: string
  title: string
  mode: "journey" | "switch"
  rows: Cell[][]
  /** Shown under the frame. */
  caption: string
}

const BOX_TL = "┌"
const BOX_TR = "┐"
const BOX_BL = "└"
const BOX_BR = "┘"

function cell(ch: string, kind: CellKind, extra?: Partial<Cell>): Cell {
  return { ch, kind, ...extra }
}

function blank(width: number): Cell[] {
  return Array.from({ length: width }, () => cell(" ", "frame"))
}

/** Write a string into a row at a column, in place. */
function write(row: Cell[], col: number, text: string, kind: CellKind, extra?: Partial<Cell>) {
  for (let i = 0; i < text.length; i++) {
    if (col + i < 0 || col + i >= row.length) continue
    row[col + i] = cell(text[i], kind, extra)
  }
}

/* The reference language: a dashed rule with `+` corners and the title in
   brackets sitting ON the top rule, not above it. */
function frameRow(width: number, title?: string): Cell[] {
  const row = blank(width)
  row[0] = cell("+", "frame")
  row[width - 1] = cell("+", "frame")
  for (let i = 1; i < width - 1; i++) row[i] = cell(i % 2 === 0 ? "-" : " ", "frame")
  if (title) {
    const label = ` [ ${title.toUpperCase()} ] `
    write(row, Math.max(2, Math.floor((width - label.length) / 2)), label, "frame")
    /* Only the bracketed text is accented; the padding stays frame-coloured. */
    const start = Math.max(2, Math.floor((width - label.length) / 2)) + 1
    write(row, start, label.trim(), "accent")
  }
  return row
}

function bodyRow(width: number): Cell[] {
  const row = blank(width)
  row[0] = cell("|", "frame")
  row[width - 1] = cell("|", "frame")
  return row
}

/** A state drawn as corner brackets around its label, as in the references. */
function drawNode(
  rows: Cell[][],
  top: number,
  left: number,
  label: string,
  kind: CellKind,
  nodeId: string
) {
  const inner = label.length + 2
  write(rows[top], left, BOX_TL + " ".repeat(inner) + BOX_TR, kind === "dead" ? "dead" : "dim")
  write(rows[top + 1], left + 2, label, kind, { nodeId })
  write(rows[top + 2], left, BOX_BL + " ".repeat(inner) + BOX_BR, kind === "dead" ? "dead" : "dim")
}

function nodeWidth(label: string): number {
  return label.length + 4
}

function labelOf(def: MachineDef, id: string): string {
  return def.states[id]?.label ?? id
}

const NODE_H = 3
/* One row for the "↩ elsewhere" list, three for edge routing. */
const GUTTER = 4
const PAD = 4

/**
 * Lay a machine out.
 *
 * `current` decides what is highlighted and what counts as dead: a state you
 * cannot legally reach from here is drawn, because the shape of the journey
 * should stay visible, but drawn dim.
 */
export function layout(
  machine: CompiledMachine,
  machineId: string,
  current: string
): Figure | null {
  const def = machine.config.machines[machineId]
  if (!def) return null

  const ids = Object.keys(def.states)
  const title = def.label ?? machineId
  const legal = new Set(machine.movesFrom(machineId, current))

  const kindOf = (id: string): CellKind =>
    id === current ? "accent" : legal.has(id) ? "text" : "dead"

  return def.transitions
    ? journey(machine, machineId, def, ids, current, kindOf, title)
    : switchboard(def, ids, current, kindOf, title, machineId)
}

/* ---------------------------------------------------------------- switch -- */

function switchboard(
  def: MachineDef,
  ids: string[],
  current: string,
  kindOf: (id: string) => CellKind,
  title: string,
  machineId: string
): Figure {
  /* One row, wrapping. No arrows: there is no journey here and drawing every
     pair would say something untrue about the model. */
  const MAX = 76
  const lines: string[][] = [[]]
  let used = PAD
  for (const id of ids) {
    const w = nodeWidth(labelOf(def, id)) + 2
    if (used + w > MAX && lines[lines.length - 1].length) {
      lines.push([])
      used = PAD
    }
    lines[lines.length - 1].push(id)
    used += w
  }

  const width = Math.max(
    46,
    Math.min(
      MAX + PAD,
      PAD * 2 +
        Math.max(...lines.map((line) => line.reduce((n, id) => n + nodeWidth(labelOf(def, id)) + 2, 0)))
    )
  )

  const rows: Cell[][] = [frameRow(width, title), bodyRow(width)]
  for (const line of lines) {
    const start = rows.length
    for (let i = 0; i < NODE_H; i++) rows.push(bodyRow(width))
    let col = PAD
    for (const id of line) {
      const label = labelOf(def, id)
      drawNode(rows, start, col, label, kindOf(id), id)
      col += nodeWidth(label) + 2
    }
    rows.push(bodyRow(width))
  }
  rows.push(frameRow(width))

  return {
    machineId,
    title,
    mode: "switch",
    rows,
    caption: `no transitions declared — any state is one click from any other. currently ${labelOf(def, current)}.`,
  }
}

/* --------------------------------------------------------------- journey -- */

function journey(
  machine: CompiledMachine,
  machineId: string,
  def: MachineDef,
  ids: string[],
  current: string,
  kindOf: (id: string) => CellKind,
  title: string
): Figure {
  const transitions = def.transitions ?? {}

  /* Rank by distance from `initial` along declared edges. Rank becomes a row,
     so the journey reads top to bottom. */
  const rank = new Map<string, number>([[def.initial, 0]])
  const queue = [def.initial]
  while (queue.length) {
    const from = queue.shift() as string
    for (const to of transitions[from] ?? []) {
      if (rank.has(to)) continue
      rank.set(to, (rank.get(from) as number) + 1)
      queue.push(to)
    }
  }
  /* Anything nothing reaches still gets drawn, on a row of its own at the end.
     A one-way journey legitimately has an unreachable initial state. */
  const orphans = ids.filter((id) => !rank.has(id))
  const maxRank = Math.max(0, ...rank.values())
  for (const id of orphans) rank.set(id, maxRank + 1)

  const ranks: string[][] = []
  for (const id of ids) {
    const r = rank.get(id) as number
    ;(ranks[r] ??= []).push(id)
  }

  /* Column positions, per rank. */
  const at = new Map<string, { col: number; row: number; width: number }>()
  let width = 46
  ranks.forEach((row, r) => {
    let col = PAD
    for (const id of row) {
      const w = nodeWidth(labelOf(def, id))
      at.set(id, { col, row: r, width: w })
      col += w + 4
    }
    width = Math.max(width, col + PAD)
  })

  const rowTop = (r: number) => 2 + r * (NODE_H + GUTTER)
  /* Stop one blank row after the last rank's overflow line, rather than
     carrying an empty gutter down to the frame. */
  const height = rowTop(ranks.length - 1) + NODE_H + 3

  const rows: Cell[][] = [frameRow(width, title)]
  for (let i = 1; i < height - 1; i++) rows.push(bodyRow(width))
  rows.push(frameRow(width))

  for (const id of ids) {
    const pos = at.get(id)
    if (!pos) continue
    drawNode(rows, rowTop(pos.row), pos.col, labelOf(def, id), kindOf(id), id)
  }

  /* Edges. Forward edges between adjacent ranks get drawn; anything else —
     back edges, rank skips, and any edge that will not fit in the gutter — is
     listed as text under its source instead. An unreadable tangle of routed
     lines is worse than an honest list. */
  const overflow = new Map<string, string[]>()
  for (const [from, tos] of Object.entries(transitions)) {
    const src = at.get(from)
    if (!src) continue
    const forward: string[] = []
    for (const to of tos) {
      const dst = at.get(to)
      /* Only a drop to the very next rank is drawn. Back edges and rank skips
         would have to be routed around the figure, and a tangle of routed
         lines says less than an honest list. */
      if (dst && dst.row === src.row + 1) forward.push(to)
      else {
        const listed = overflow.get(from) ?? []
        listed.push(labelOf(def, to))
        overflow.set(from, listed)
      }
    }
    if (forward.length) {
      drawFan(
        rows,
        from,
        src,
        forward.map((to) => ({ to, pos: at.get(to) as Placed, dead: kindOf(to) === "dead" })),
        rowTop
      )
    }
  }

  for (const [from, tos] of overflow) {
    const pos = at.get(from)
    if (!pos) continue
    /* Clip at whatever sits to the right on this rank. Two long lists on the
       same row otherwise overwrite each other and produce a word that is half
       of one state and half of another. */
    const nextCol = ranks[pos.row]
      .map((id) => at.get(id))
      .filter((other): other is Placed => !!other && other.col > pos.col)
      .reduce((min: number, other) => Math.min(min, other.col), width - 2)
    const room = Math.max(0, nextCol - pos.col - 2)
    const full = `↩ ${tos.join(", ")}`
    const line = full.length > room ? `↩ ${tos.length} more` : full
    write(rows[rowTop(pos.row) + NODE_H], pos.col + 1, line.slice(0, room), "dim")
  }

  const moves = machine.movesFrom(machineId, current)
  return {
    machineId,
    title,
    mode: "journey",
    rows,
    caption:
      `currently ${labelOf(def, current)}. ` +
      (moves.length
        ? `legal from here: ${moves.map((m) => labelOf(def, m)).join(", ")}.`
        : "a dead end — nothing is legal from here."),
  }
}

interface Placed {
  col: number
  row: number
  width: number
}

/**
 * Every forward edge out of one node, drawn as a single trunk.
 *
 * Drawing them independently is the obvious approach and it is wrong: two
 * edges leaving the same node both want the cell directly beneath it, and the
 * second overwrites the first with a corner pointing the wrong way. One trunk
 * down, one bus across, one drop per target — which is also how a person would
 * draw it.
 */
function drawFan(
  rows: Cell[][],
  from: string,
  src: Placed,
  targets: Array<{ to: string; pos: Placed; dead: boolean }>,
  rowTop: (r: number) => number
) {
  const mid = (p: Placed) => p.col + Math.floor(p.width / 2)
  const fromCol = mid(src)
  /* +1 leaves the row directly under the node for the overflow list. */
  const top = rowTop(src.row) + NODE_H + 1
  const bottom = rowTop(targets[0].pos.row) - 1
  const bus = Math.floor((top + bottom) / 2)

  const allDead = targets.every((t) => t.dead)
  const trunkKind: CellKind = allDead ? "dead" : "dim"
  const trunkId = `${from}->*`
  const put = (r: number, c: number, ch: string, kind: CellKind, id: string) =>
    write(rows[r], c, ch, kind, { edgeId: id })

  for (let r = top; r < bus; r++) put(r, fromCol, "╎", trunkKind, trunkId)

  const cols = targets.map((t) => mid(t.pos))
  const lo = Math.min(fromCol, ...cols)
  const hi = Math.max(fromCol, ...cols)

  /* Dashed, not solid — the references never draw a continuous rule. */
  for (let c = lo + 1; c < hi; c++) {
    put(bus, c, (c - lo) % 2 === 0 ? "-" : " ", trunkKind, trunkId)
  }

  /* Junctions. A column that is both the trunk and a target carries both. */
  const endGlyph = (c: number, down: boolean, up: boolean) => {
    if (down && up) return "┼"
    if (c === lo) return down ? "┌" : "└"
    if (c === hi) return down ? "┐" : "┘"
    return down ? "┬" : "┴"
  }
  put(bus, fromCol, endGlyph(fromCol, cols.includes(fromCol), true), trunkKind, trunkId)
  for (const t of targets) {
    const c = mid(t.pos)
    const kind: CellKind = t.dead ? "dead" : "dim"
    const id = `${from}->${t.to}`
    if (c !== fromCol) put(bus, c, endGlyph(c, true, false), kind, id)
    for (let r = bus + 1; r <= bottom; r++) {
      put(r, c, r === bottom ? "▼" : "╎", kind, id)
    }
  }
}
