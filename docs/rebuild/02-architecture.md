# Architecture

Phase 2 of the rebuild: the proposal. Nothing is built until it is approved. It rests on
[00-audit.md](00-audit.md) (what exists) and [01-research.md](01-research.md) (what is
known). Section numbers follow the brief.

Decisions that need you are marked **Decision Dn** and collected in the
[checkpoint](#checkpoint) at the end.

## Contents

1. [Packaging and entry points](#1-packaging-and-entry-points)
2. [One shell](#2-one-shell)
3. [The FeedbackSession schema](#3-the-feedbacksession-schema)
4. [Serializers](#4-serializers)
5. [Transports and the MCP server](#5-transports-and-the-mcp-server)
6. [The tweak engine](#6-the-tweak-engine)
7. [Element-level edge cases](#7-element-level-edge-cases)
8. [Security and privacy](#8-security-and-privacy)
9. [Performance budgets](#9-performance-budgets)
10. [Accessibility of the tool](#10-accessibility-of-the-tool)
11. [Migration](#11-migration)
12. [Naming](#12-naming)
13. [Milestone plan and test infrastructure](#13-milestone-plan-and-test-infrastructure)

[Checkpoint](#checkpoint)

---

## 1. Packaging and entry points

### One package

Keep one npm package. One version means one skill that matches it, one changelog, and
no matrix of `core@x` with `react@y`. Conditions and tree shaking already keep each
entry's cost separate. The one thing that would justify a split is the bin's Node
dependencies, because `dependencies` are installed for everyone, browser-only users
included. Section 5 avoids needing any (**Decision D2**); if you would rather use the
official MCP SDK, the bin moves to its own package and this one stays at zero.

| Import | What is in it | Needs | In a production build |
| --- | --- | --- | --- |
| `prototype-machine/core` | Scenario model (as today). Feedback schema, validator, migrations, serializers. Selector ranking, token matching, redaction, reproduce URLs. | nothing | Tree-shaken. The stub imports only the scenario half. |
| `prototype-machine/dom` (new) | Shadow layer, picker, overlay, target identification, measurement (`overflow.ts` moves here), element stress, pseudo-state forcing, tweak engine, Page tools, transports (clipboard, download, webhook, bridge client). Vanilla TS. | nothing | Only if imported directly. |
| `prototype-machine` | Provider, hooks, `PinnedScenario`. The shell with every mode, `StateBench`, `StateCanvas`, `Row`/`Pill`/`Select`. The React component adapter (fiber, owner stacks). Re-exports core. | React 18+ | `production` condition: the stub. |
| `prototype-machine/panel` | The real shell, bench and canvas, for a review build. | React 18+ | Yes. That is its job. |
| bin `prototype-machine` | `init`, `doctor`, `bridge`, `mcp`. | Node 20+ | Not a browser entry. |

The JSON Schema ships as a file, `prototype-machine/schema/feedback.v1.json`, and as an
object exported from core.

### Shared runtime, not islands

Audit 6.1: `/panel` cannot see the main entry's provider because each React entry
bundles its own copy of the context. The fix generalises what `tsup.config.ts` already
does for core. Two internal modules are built once and imported, not inlined, by every
React entry:

- `dist/_runtime/react.js`: the scenario context, store, provider and hooks.
- `dist/dom/index.js`: the engines.

So `ScenarioProvider` from `prototype-machine` and the shell from `prototype-machine/panel`
share one context object, in ESM and CJS. Two new pack tests guard it: the `/panel`
shell renders inside the main entry's provider under both conditions, and every name
the development entry exports also exists in the production entry (audit 6.2). In
production, `Row`, `Pill`, `Select`, `FieldRow` and `MachineRow` render nothing and
`useDrag` does nothing, so following the docs no longer breaks a production build.

### The production stub stays small

The stub keeps today's surface (provider, hooks, core, the URL-reading bench, the flat
canvas) and adds nothing from `dom`. The shell, picker, tweak engine, stress tools and
the React component adapter are absent. A pack test asserts known strings from each are
missing from Vite, webpack, esbuild and Next production bundles.

### Modes load when first used

The ESM build splits each mode into its own chunk. The launcher imports States; Select,
Tweak, Annotate and Stress arrive with a dynamic `import()` the first time someone picks
them. A closed tool costs the launcher and the provider, which is what it costs today. CJS
builds load everything eagerly; they are for Node and tests, not for pages.

### The shell stays React, the engines do not

The UI in the shadow root stays React: it is 2,500 lines that work, and its consumers
are React prototypes. Everything that touches the page (picking, overlays, measurement,
stress, the tweak engine) is in `dom`, with an imperative API and no React. A later Vue
or Svelte adapter reuses `dom` whole and needs its own shell, or a vanilla one. Writing
the shell in vanilla TS now would cost a rewrite of the panel for a framework nobody has
asked for yet (**Decision D1**).

### The component adapter is a seam

`dom` identifies an element with DOM facts only: tag, role, accessible name, text,
identifying attributes, ranked selectors, rect, frame and shadow path, computed styles.
It accepts an adapter for the rest:

```ts
interface ComponentAdapter {
  describe(el: Element): { name: string; stack: string[]; source?: SourceRef; props?: Record<string, unknown> } | null
}
```

The React entry registers one. Section 6 and research B say how it finds names and
files.

## 2. One shell

One launcher, in one shadow root, with three modes and an inbox. It keeps every rule the
panel has: drag and corner snapping, keeping clear of fixed bars, a foreign look, no
product components inside, explanations in tooltips rather than subtext, nothing bound to
the keyboard by default.

### Intent

- **Who:** a product designer mid-review on localhost. The prototype is in one window and
  a coding agent's terminal in the other. They have just clicked their way into "Key made,
  no data, right to left" and do not want to lose that state while they say what is
  wrong.
- **What:** mark three problems on the empty-state card (the padding, a clipped label, a
  missing focus ring), send them to the agent with the state attached, and watch each one
  go from pending to applied.
- **Feel:** a proof-reader's markup on a press proof. Exact, sparse, and never mistaken for
  the page under it.

### Domain

Print production, where a proof is checked before it goes to press.

- **Concepts:** press proof, crop marks, registration marks, proof-reader's marks (caret,
  delete loop, stet), margin callouts, the loupe, the job ticket, non-repro blue.
- **Colour world:**
  - **Registration black** `#171717`: the slab (today's `--pm-bg`).
  - **Proof white**: ink on the slab.
  - **Non-repro blue** `#56b6ff`: hover and selection marks. Printers use it for marks that
    must not reproduce, which is exactly what the tool's marks are.
  - **Proof red** `#ff6159`: annotation callouts, and rejected items.
  - **Process yellow** `#f5b83d`: measured findings (today's canvas amber).
  - **Violet** `#8b3dff`: tool state such as "changed" and "current" (today's accent).

  Every colour drawn over the page has a 1px registration-black halo, so it reads on a
  white page and a black one. Contrast is checked in M8.
- **Signature: crop marks.** Corner brackets already mark canvas frames. They become the
  one way the tool marks the page: the hovered element, the selection, each element of a
  multi-selection, a dragged area, an annotation's anchor, and a stress finding (in
  yellow). Seven uses, one shape.
- **Defaults rejected:**
  1. DevTools' tinted box model (blue content, green padding, orange margin), which reads
     as "the browser". Instead, crop marks, plus dimension lines like a spec drawing, only
     for the property being scrubbed.
  2. Round avatar pins over the page, as in Figma comments. Instead, numbered callouts in
     proof red with a leader line to the element's top-left crop mark.
  3. A docked inspector that resizes the page. Instead, the floating slab, so the product
     never reflows because the tool opened.

### Validation

- **Swap test.** Draw the selection as a blue filled rectangle and it reads as DevTools;
  draw the slab light and it reads as part of the product. The marks and the slab are
  doing the separating.
- **Squint test.** Blurred, the page is one region, the slab another, and the marks thin
  lines at corners. Nothing in the tool competes with the product for weight.
- **Signature test.** Crop marks at seven uses, listed above.
- **Token test.** `--pm-registration`, `--pm-nonrepro`, `--pm-proof-red`,
  `--pm-process-yellow`. Not `--blue-500`.
- **Ban list.**
  - No side-stripe borders, gradient text, glassmorphism, metric heroes, identical card
    grids or spring easing.
  - Nothing opens as a modal. The composer is a popover anchored to its target.
  - `.pm-settling`, which animates `top` and `left` (audit 6.9 b), becomes a transform.
  - The one conflict is fonts. The slab keeps the system UI stack, because loading a font
    would be a network call and would break "looks unlike the product" in the other
    direction. Values and measurements switch to `ui-monospace`, which gives the slab its
    spec-sheet character with nothing downloaded.

### Layout

```
closed                         open
                               ┌ Prototype tools ────── Inbox 3  ⧉  ↺  ⌖  ✕ ┐
  ┌────┐                       │ States │ Select │ Annotate                   │
  │ ◇• │  40px, snaps,          ├──────────────────────────────────────────────┤
  └────┘  dot when off          │ (the mode's body)                            │
          default or pending    └──────────────────────────────────────────────┘
```

- **The mode row** is a radio group. Choosing Select or Annotate turns picking on; choosing
  States, or closing the slab, turns it off.
- **States** is today's panel, unchanged: machines, fields, actions, the Page section. It
  adds a Pages section that lists benches and canvases from a `pages` prop, and a "Missing
  state" action that files a `stateGap` item. On a bench page, a missing state's
  disabled button has "Report" in its tooltip menu.
- **Select** is picking plus the inspector:
  - a breadcrumb (component stack, then tag);
  - identity (best selector, source file:line and its confidence);
  - controls grouped by element type, pseudo-state tabs, and the scope switch;
  - the diff, Undo and Redo, and "Stress this";
  - "Add to inbox", which makes the tweaks one `styleChange` item.
- **Annotate** is picking plus a composer popover anchored to the target, with sub-tools
  Element, Text and Area. Shift adds to a multi-selection. Intent and severity are pills,
  and the comment is a textarea.
- **Inbox** (header button) lists items for this route, or for every route.
  - Each item shows its status chip, its scenario, and its thread.
  - The export menu has Copy for an agent, Copy as a bug report, Download JSON, and Send
    to bridge, with a fidelity choice. Copy in the header still copies the scenario as
    today.
  - Status changes from the bridge appear live.
- **Without a provider** the shell still mounts. Select and Annotate work, and States says
  there is no scenario on this page.

### Picking

- **Capture.** Picking draws a transparent full-viewport layer inside the shadow root, so
  clicks never reach the product. The element under the pointer comes from
  `document.elementsFromPoint`, skipping the tool's own host. It descends into open shadow
  roots and same-origin iframes, translating coordinates.
- **Cost.** At most one hit test per animation frame; the overlay moves by transform.
- **Keys** belong to the mode only while it is picking:
  - `Esc` stops picking.
  - `↑` parent, `↓` first child, `←` `→` siblings.
  - `Enter` selects.
  - Nothing else is bound, and nothing at all once picking stops.
- **Keyboard-only start.** Picking begins at the focused element, or at `<main>` when
  nothing is focused, so a selection can be made without a pointer.
- **Native modal dialogs.** A modal `<dialog>` makes everything outside it inert, a later
  popover included (observed, research F). While one is open, the tool's host moves inside
  it, using `moveBefore` where available, and moves back when it closes.
- **Hotkeys are opt-in.** A `hotkeys` prop can bind keys to open the tool or start picking;
  it is off by default.

## 3. The FeedbackSession schema

One versioned document carries everything the three modes produce. Core owns it: the
TypeScript types, a JSON Schema, a validator, migrations, and the serializers in
section 4. The browser builds it, the bridge stores it, an agent reads it.

### Shape

```ts
interface FeedbackSession {
  $schema: "https://prototype-machine.dev/schema/feedback.v1.json" // placeholder host, see D9
  schemaVersion: 1
  id: string                         // "fs_" + 16 base32 chars, made in the browser
  createdAt: string                  // ISO 8601, UTC
  updatedAt: string
  tool: { name: "prototype-machine"; version: string }
  app: {
    origin: string                   // "http://localhost:5199"
    title?: string
    framework?: { name: "react"; version: string }
    styling?: StylingHint            // section 6
  }
  scenarios: Record<string, ScenarioSnapshot> // by id; items point at one
  items: FeedbackItem[]
}

interface ScenarioSnapshot {
  id: string                         // content hash, so identical states share one entry
  route: string                      // pathname + hash route: "/overview", "/#/settings"
  reproduceUrl: string               // opens this exact state; see "The reproduce URL"
  scenario?: {                       // absent when no ScenarioProvider is mounted
    machines: Record<string, { state: string; label: string; initial: string }>
    fields: Record<string, { value: Primitive; label: string; default: Primitive }>
    changed: string[]                // ids off their default
    query: string                    // toSearch()
    configEdits: Array<{ path: string; value: Primitive; was: Primitive }> // toDefaults(), structured
  }
  bench?: { param: string; state: string; missing: string[] }
  canvas?: { state?: string; frame?: string }
  pageTools: { dir: "auto" | "ltr" | "rtl"; text: number; motion: "normal" | "slow" | "paused" }
  stress?: StressCondition[]         // element-level stress active when captured (section 7)
  viewport: { width: number; height: number; dpr: number }
  environment: {
    colorScheme: "light" | "dark"
    reducedMotion: boolean
    forcedColors: boolean
    dir: "ltr" | "rtl"
  }
}

type FeedbackItem =
  | AnnotationItem
  | StyleChangeItem
  | TextChangeItem
  | StructureChangeItem
  | PropChangeItem
  | StateGapItem

interface ItemBase {
  id: string                         // "fi_" + 12 base32 chars
  kind: string
  scenarioId: string                 // the state it was given in
  status: "pending" | "acknowledged" | "applied" | "rejected"
  scope: "instance" | "variant" | "all"     // this element, this variant, every instance
  stateScope: "scenario" | "all"            // only this state, or every state
  target: Target | null              // null: about the page, not an element
  targets?: Target[]                 // multi-select: every element, target is the first
  thread: Array<{ id: string; author: "human" | "agent"; body: string; at: string; status?: ItemBase["status"] }>
  createdAt: string
  updatedAt: string
}

interface AnnotationItem extends ItemBase {
  kind: "annotation"
  comment: string
  intent?: "fix" | "change" | "question" | "approve"
  severity?: "blocking" | "important" | "minor"
  selection?: { text: string; before: string; after: string }  // a text selection, with context
  area?: { x: number; y: number; width: number; height: number; space: "page" }
  evidence?: Finding                 // a measured finding this note was made from (section 7)
}

interface StyleChangeItem extends ItemBase {
  kind: "styleChange"
  changes: Array<{
    property: string                 // "padding-top", "--card-radius"
    before: string                   // computed value when picked
    after: string                    // what the preview applied
    authored?: { selector: string; value: string; origin: "stylesheet" | "inline" | "unknown" }
    token?: { name: string; value: string; exact: boolean } // "--space-4", nearest or exact
    state?: "hover" | "focus-visible" | "active" | "disabled" | "checked"
    media?: string                   // only under this condition
  }>
  css: string                        // the same change as a CSS block, for a person to read
}

interface TextChangeItem extends ItemBase {
  kind: "textChange"
  before: string
  after: string
}

interface StructureChangeItem extends ItemBase {       // stretch goal, section 6
  kind: "structureChange"
  op: "move" | "remove"
  from: { parent: Target; index: number }
  to?: { parent: Target; index: number }
}

interface PropChangeItem extends ItemBase {            // stretch goal, section 6
  kind: "propChange"
  component: string
  prop: string
  before: Primitive
  after: Primitive
}

interface StateGapItem extends ItemBase {
  kind: "stateGap"
  description: string                // what the design shows
  missing?: { where: "bench" | "canvas"; id: string; label: string; note?: string }
  machine?: string                   // the machine the state belongs to, if any
}

interface Target {
  tag: string                        // "button"
  role?: string                      // computed or explicit ARIA role
  name?: string                      // accessible name, redacted
  text?: string                      // first 120 visible characters, redacted
  ids: {                             // identifying attributes, in rank order
    testId?: string                  // data-testid, data-test, data-cy, data-qa
    id?: string                      // skipped when it looks generated
    name?: string                    // form controls
    ariaLabel?: string
  }
  selectors: Array<{ value: string; strategy: SelectorStrategy; unique: boolean }>
  component?: { name: string; stack: string[] }   // nearest first: ["Card", "ProjectList", "Overview"]
  source?: { file: string; line: number; column?: number; confidence: "exact" | "likely" | "guess"; via: SourceVia }
  path?: { frames: string[]; shadowHosts: string[] } // how to reach it: iframe selectors, shadow hosts
  rect: { x: number; y: number; width: number; height: number } // viewport px when captured
  styles?: Record<string, string>    // computed subset; size depends on fidelity
  classes?: string[]
}

type SelectorStrategy = "testId" | "id" | "role" | "attribute" | "class" | "structural"
type SourceVia = "attribute" | "debugSource" | "ownerStack" | "none"
type Finding = { check: string; measured: Record<string, unknown>; condition: StressCondition[]; message: string }
```

`Primitive`, `StressCondition` and `StylingHint` are defined in core beside it.

### Rules

- **Every item records the state it was given in.** `scenarioId` points at a
  `ScenarioSnapshot`, and every snapshot has a `reproduceUrl`. Identical states share one
  entry, so twenty notes on one screen do not repeat the scenario twenty times.
- **Observed, never predicted.** `before` values are computed values read from the page.
  `evidence` is a measurement with the conditions it was measured under. Nothing in the
  schema holds a guess about what would break.
- **Redacted at capture.** `text`, `name`, `selection` and `comment` pass through the
  redaction rules in section 8 before they are stored, so no transport sees raw values.
- **Selectors are ranked, not trusted.** Each records whether it was unique when captured.
- **Source has a confidence.** `exact` comes from an injected attribute or React 18's
  `_debugSource`; `likely` from a parsed owner stack; `guess` from matching names; with
  `via` saying which.
- **Optional is optional.** A minimal session is valid: one annotation, a target with a
  tag and one selector, a scenario with a route and a reproduce URL.

### The reproduce URL

`reproduceUrl` is the page's URL with:

- the scenario's own parameters from `toSearch()` (a URL is authoritative, so it beats
  whatever the reviewer's storage held),
- `__state` and `__frame` when it was taken on a bench or a canvas,
- new parameters `__dir`, `__text` and `__motion` for Page tools that are not at their
  default, read by the shell on load,
- every other query parameter kept, except ones the redaction rules drop,
- the hash kept, so hash routes work.

Element-level stress is not in the URL. It is recorded in `stress` and replayed through
the bridge's `set_scenario` (section 5), because it targets one element.

### Validation and migrations

- **One source of truth.** The JSON Schema is written once as a JS object in core and
  shipped as `prototype-machine/schema/feedback.v1.json`. The TypeScript types are written
  by hand beside it; a type test and a fixture test keep them in step.
- **A small validator in core.** About 150 lines covering the subset the schema uses
  (`type`, `enum`, `const`, `required`, `properties`, `additionalProperties`, `items`,
  `oneOf` by `kind`, `maxLength`, `pattern`). It returns errors with JSON pointers. No
  dependency. A dev-only test checks it agrees with Ajv on every fixture (**Decision D6**).
- **`migrate(input)`** reads `schemaVersion`, runs each registered step in order, then
  validates. A version newer than the code throws, naming the version that wrote it. The
  chain exists from day one with a test-only step, so the first real migration is not
  also the first test of the mechanism.
- **Unknown fields survive.** A reader keeps fields it does not know (`additionalProperties`
  is true on items), so an older bridge does not strip what a newer browser wrote.

## 4. Serializers

All in core, all pure, all snapshot-tested.

```ts
toMarkdown(session, { audience: "human" | "agent", fidelity: "minimal" | "standard" | "full" }): string
toJSON(session, { fidelity }): FeedbackSession   // the same document, trimmed to the fidelity
fromJSON(text): FeedbackSession                   // parse, migrate, validate
```

### Three outputs

- **Agent markdown** is the default for Copy, the bridge and MCP. It is compact and
  deterministic, with the same field order every time.
  - Each item leads with what an agent needs first: the file and line, the component, the
    best selector, and then the change.
  - A style change is a CSS block; a text change is a before and after; a note is the
    comment, verbatim.
- **Human markdown** is for a bug report. It has a title, the page, the state in the
  reviewer's own labels, steps to reproduce (the reproduce URL), then expected and
  observed for each item.
- **JSON** is the document itself, validated, at the chosen fidelity.

### Fidelity

| Level | Per item |
| --- | --- |
| `minimal` | Kind, comment or change, file:line or best selector, the state's labels. One to three lines. |
| `standard` | Adds the component stack, two ranked selectors, the reproduce URL, before and after computed values, the token, scope and state scope. |
| `full` | Adds every selector, identifying attributes, rect, the computed-style subset, frame and shadow path, environment, viewport, and the thread. |

Which level works best per agent is measured, not assumed: the M8 benchmark runs each
task at each level.

### The ending

Every output ends with concrete next steps, generated from the items, never generic:

```md
## Next steps
1. Open the state: http://localhost:5199/overview?journey=keyMade&state=empty&__dir=rtl
   (or call set_scenario with scenario s_7f3a).
2. Edit src/components/card.tsx:42 (Card): padding-inline 12px -> var(--space-4) (16px).
3. Check it in every state this item covers: journey × data (20 states). Use the
   canvas at /states/overview/canvas, or set_scenario for each.
4. Mark fi_01h… applied with a one-line summary (respond_to_feedback), or reply if the
   change is not what the code can do.
```

### Copy keeps working

M1 starts by snapshotting today's Copy output for a handful of scenarios, Page tools
included. The States-mode Copy is then rebuilt on the serializers and must produce the
same text: the summary, the query, and "To make this the starting scenario, change these
in the defineMachine config". It changes only by adding lines:

- the route, so the text names the page;
- the reproduce URL;
- the bench or canvas state, when there is one.

Controls that `when` hides on this screen are still listed, under "Not on this screen",
because the query carries them (audit 6.7).

## 5. Transports and the MCP server

### One interface

```ts
interface Transport {
  id: "clipboard" | "download" | "callback" | "webhook" | "bridge"
  send(session: FeedbackSession, opts: { items: string[]; format: "agent" | "human" | "json"; fidelity: Fidelity }):
    Promise<{ ok: true } | { ok: false; reason: string }>
  listen?(onEvent: (event: BridgeEvent) => void): () => void  // the bridge only
}
```

| Transport | Configured by | Sends | Hears back |
| --- | --- | --- | --- |
| Clipboard | always on | agent or human markdown, or JSON | n/a |
| Download | always on | `feedback-<route>-<date>.json` or `.md` | n/a |
| Callback | `onFeedback(session, item)` prop | the document | n/a |
| Webhook | `webhook={{ url }}` prop; nothing by default | JSON `POST`, a delivery id per send, retried on 5xx | n/a |
| Bridge | `bridge` prop plus pairing (section 8); nothing by default | every change, as it happens | status changes, replies, and state switches requested by the agent |

The shell makes no network call unless `webhook` or `bridge` is set.

### The bridge

`npx prototype-machine bridge` runs one small Node process per project, using only
`node:http`.

- **Where it listens:** `127.0.0.1:7457`, or the next free port. It writes
  `.prototype-machine/bridge.json` (port, pid) and a token file readable only by the user
  (mode 0600), both gitignored by `init`.
- **The browser API, all under `/v1`:**
  - `PUT /sessions/:id` upserts a session, items included.
  - `POST /sessions/:id/selection` pushes what is selected.
  - `POST /sessions/:id/findings` pushes measured findings.
  - `POST /commands/:id/result` reports what the tab did with a command.
  - `GET /sessions/:id/events` is a streamed response, read with `fetch`. It carries
    status changes, replies and commands. `fetch` is used rather than `EventSource` so the
    token can go in a header.
- **What it stores:** sessions in memory, mirrored to `.prototype-machine/sessions/<id>.json`.
  It also writes `.prototype-machine/feedback.md` (agent markdown, pending items) for
  agents without MCP, and reads `.prototype-machine/replies.md` back into threads and
  statuses (research C3).
- **Tabs:** each tab is its own session. Commands go to the session's most recently active
  tab unless a tab id is given. Two tabs and two sessions are tested together.

### The MCP server

`npx prototype-machine mcp`, launched by the agent over stdio.

- **Finding the bridge:** it connects to the project's bridge with the token from the file,
  and starts one in-process if none is running. Several agents can share one bridge.
- **Both protocol eras** are answered: `initialize` for clients written for 2025-11-25,
  `server/discover` and per-request `_meta` for 2026-07-28 (research C1).
- **Tool results:** every result carries `resultType: "complete"`, a text block (agent
  markdown) and `structuredContent` matching an `outputSchema`.
- **Errors** come back as `isError: true` with the fix, such as "No tab is connected. Open
  the prototype with the pairing link `npx prototype-machine pair` prints."

**Decision D2:**

- **Recommended:** write it in the package, about 400 lines, with no dependency. It is
  conformance-tested against the official SDK's clients of both eras (dev dependencies).
- **Alternative:** the v2 SDK, in a separate `prototype-machine-mcp` package so this one
  stays at zero. Adding it here would put about 14 MB on every install, including
  browser-only users (research C1).

#### Eight tools

Fewer, sharper tools beat many (research C1). The brief suggested eleven. Five of them
merge into two; nothing is lost.

| Tool | Does | Read only | Why it exists | Replaces |
| --- | --- | --- | --- | --- |
| `list_feedback` | Items by status (default `pending`), route and session. One line each: id, kind, summary, file:line, the state's labels. Paginated, 20 at a time. | yes | The agent's first look. Sessions appear as headers, because an agent never needs a session without its items. | `list_sessions`, `get_pending` |
| `get_feedback` | Full items by id (a list), at a fidelity, as markdown or JSON. Includes the scenario, the reproduce URL and the next steps. | yes | What the agent works from. A list, so three items are one call. | `get_item` |
| `wait_for_feedback` | Blocks until items are added or change, or until `timeoutSeconds` (default 30, at most 50) passes. Returns a cursor either way and sends progress every 10 s. | yes | Lets an agent sit in a loop with the reviewer. 50 s stays under Codex's 60 s default. | `watch` |
| `respond_to_feedback` | `{ id, status?, message }`. Status `acknowledged` when starting, `applied` with a one-line summary when done and checked, `rejected` with the reason. No status is a reply or a question. | no | One verb for talking back. The reviewer sees it at once. | `acknowledge`, `resolve`, `reply` |
| `get_selection` | What is selected in the tab now, with its target, styles, and tweaks not yet in the inbox. | yes | For "fix this", said while pointing, without making an item. | as briefed |
| `get_scenario` | The scenario's shape (`describe()`: machines, states, legal moves, fields), the tab's current state and route, and the benches and canvases the shell knows. | yes | The agent learns which states exist before it checks them. | `get_scenario_config` |
| `set_scenario` | Puts the tab into a state: a `scenarioId` from an item, or machines, fields, a route, a bench or canvas state, Page tools, element stress. Returns the snapshot the tab reports after applying it, and its reproduce URL. | no (changes the tab, never source) | How an agent reproduces a note and checks its fix in each state. Like a URL, it reaches any declared state, and refuses an undeclared one with the legal values. | as briefed |
| `check_findings` | Measures in the tab now: the item's target or a selector, the checks of section 7, optionally under stress conditions. Returns measured, incomplete or needs-eyes for each, and restores the page. | yes (restores what it touches) | The other half of verifying: `set_scenario`, then `check_findings`, for each state. | `get_findings` |

- **Annotations:** the read-only tools set `readOnlyHint: true`. `respond_to_feedback` and
  `set_scenario` set `destructiveHint: false`, since neither touches source.
- **Names:** within 128 characters as `mcp__prototype-machine__<tool>`, and no description
  passes 1,000 characters.

#### Resources and a prompt

They are conveniences for clients that show them (research C1); every capability is
also a tool.

- **Resources:**
  - `pm://schema/feedback.v1.json`
  - `pm://skill/SKILL.md`
  - `pm://sessions/{id}` (the document)
- **A prompt:** `fix-feedback` walks the loop: list, get, reproduce, fix, check each state,
  respond.
- **Server instructions:** under 1,000 characters, saying what the server is for, so tool
  search finds it (research C1).

#### The loop, end to end

1. The reviewer annotates in the browser. The bridge stores the item.
2. The agent calls `list_feedback`, then `get_feedback` on the item.
3. The agent calls `respond_to_feedback(acknowledged)`; the chip in the inbox turns.
4. The agent calls `set_scenario(scenarioId)`; the tab switches state.
5. The agent edits the file.
6. For each state in the item's state scope, the agent calls `set_scenario` then
   `check_findings`.
7. The agent calls `respond_to_feedback(applied, "padding-inline now var(--space-4); checked 20
   states, no overflow")`.

M6's end-to-end test runs exactly this against the demo.

## 6. The tweak engine

Preview in the browser only; the agent writes source. Everything here is in `dom`, except
the pure parts (token matching, diff records, the undo stack, CSS rendering), which are in
core so they are unit-tested without a DOM.

### Where a change is applied

From research F:

- **One element ("this instance")** is changed inline, with
  `el.style.setProperty(prop, value, "important")`. It beats every author rule and is
  allowed under CSP.
  - The previous inline value and priority are saved for an exact revert.
  - A `MutationObserver` on that element's `style` notices React writing the same key,
    re-applies the tweak, and updates the "before" value. The inspector says the app
    changed it.
- **Everything else** goes in one adopted stylesheet:
  - variants and every instance;
  - pseudo-states;
  - forced states during stress.

  Rules target `[data-pm-scope~="s3"]` markers the engine adds and removes. Selectors are
  bumped in specificity, with `!important`.
- **Revert is total.** Every inline property, attribute and rule the engine adds is
  recorded and removed. A browser test compares computed styles before a session and after
  revert, and checks that no `data-pm-*` attribute is left.

### Controls by element type

The inspector shows the groups that apply. The type comes from computed styles and the
tag, not from guessing at intent.

| Group | Shown when | Properties |
| --- | --- | --- |
| Text | The element has its own text nodes | font size, weight, line height, letter spacing, colour, alignment, transform, the text itself |
| Box | Always | width, height, min and max, padding, margin, radius, border, background, opacity |
| Layout | `display` is flex, grid, or their inline forms | direction, wrap, justify, align, gap, grid template columns |
| Media | `img`, `video`, `picture`, `svg` | object fit, object position, aspect ratio |
| Position | `position` is not static | inset sides, z-index |

### Scrubbing

- **Pointer:** drag horizontally on a property's label. 1px per 2px of travel, Shift ×10,
  Alt ×0.1, with pointer capture (as the slider already does).
- **Keys:** arrow keys step with the same modifiers, DevTools' scheme (research G).
- **Typing:** double-click the value to type one.
- **Dimension lines** show the property being scrubbed on the page, and only that one
  (section 2).

### Tokens

- **The scan:** core matches values against custom properties found by a scan of the page's
  stylesheets, grouped by family: spacing, radius, colour, type.
- **Snapping:** within 1px (or ΔE 2 for colour) the scrubber snaps to the token, and the
  change records `token: { name, exact: true }`. Otherwise the inspector shows the nearest
  token, and the change records it with `exact: false`, so an agent can choose the token.
- **The styling hint** (research F) shapes the suggestion. Tailwind gets the class
  (`p-4`); plain CSS gets `var(--space-4)`.

### Scope

| Scope | Means | Found by |
| --- | --- | --- |
| This instance | The selected element | itself |
| This variant | Elements of the same component, with the same class list | fiber type plus `className` |
| Every instance | Every element of the same component, or of the same authored rule | fiber type, or the matched selector |

Before a wider scope applies, every element it will change gets crop marks, with a count
("12 elements"). This is VisBug's "expand selection" made visible (research G).

### Pseudo-states

- **Tabs:** Default, Hover, Focus visible, Active, Disabled.
- **Choosing a tab** forces that state so the reviewer sees it.
  - Focus and Disabled are real; Hover and Active are imitated through rewritten rules
    (research E), and labelled so.
- **Edits under a tab** write rules for the real pseudo-class and the imitated one, and
  record `state` on the change.

### Undo, redo, compare, diff

- **Undo and redo:** one command stack per page.
  - `Cmd/Ctrl+Z` and `Shift+Cmd/Ctrl+Z` work only while focus is in the inspector, not on
    the page.
  - Each command is `{ scope, property, state, from, to }` and replays in both directions
    (unit-tested round trips).
- **Compare:** hold the Compare button to see the page without the tweaks (Figma's compare,
  research G).
- **The diff** lists each property as before → after, with the token and the authored rule
  when found, and the same as a CSS block. "Add to inbox" turns it into one `styleChange`
  item.

### Text

- **Edits** are typed in the inspector, not into the page, and previewed on the element's
  text nodes through `nodeValue`. Changing `nodeValue` keeps the node React owns.
- **Revert** restores the node exactly.
- **The record** is a `textChange` item.

### Stretch goals (M4, only if cheap and solid)

- **Reorder** within a flex or grid container, previewed with CSS `order`. The DOM nodes
  React owns are never moved.
- **Resize handles** that write width and height through the same inline path.
- **Reparent** stays a note. Moving a node across React parents in a preview is how a
  page crashes on the next render.
- **Props:** `propChange` items, recorded from the scenario panel when a field drives a
  prop.

## 7. Element-level edge cases

"Stress this", from the Select inspector, puts one element through the edge cases the
canvas runs for a whole component, in place, on the real page.

### What it applies

Each condition says whether it is real or imitated (research E). A frame changes the
container; a state changes the data. So conditions come in groups that keep that line
visible:

| Group | Conditions | Kind |
| --- | --- | --- |
| Content (data) | The `STRESS_TEXT` presets on the element's text nodes: empty, long, 2,000 characters, unbreakable, email, RTL text, mixed direction, CJK, emoji, diacritics, markup, lines | Real render of a hypothetical. The finding records the text used, and the fix goes in a fixture or field preset. |
| Container (frame) | Parent narrowed to 320px, squeezed to 60%, widened to 1440px; `dir="rtl"`; text 200%; WCAG text spacing | Real (container queries and percentages respond; media queries do not, and the panel says so) |
| State | Focus visible, disabled, checked | Real |
| State | Hover, active | Imitated (rewritten rules) |
| Preference | Dark, light, reduced motion, more contrast | Imitated (rewritten `@media`, plus `color-scheme` for dark) |
| Preference | Forced colours | Out of reach: listed as needs eyes, with how to check it in DevTools |

One condition is applied at a time and fully restored before the next, so every finding
belongs to one condition. "Run all" steps through the list and builds a table.

### What it measures

Every check answers in one of three ways (research E):

- **measured**, with the number;
- **incomplete**, with the reason;
- **needs eyes**, with what to look at.

| Check | Answer |
| --- | --- |
| Overflow past the container | measured |
| Clipping | measured |
| Truncation (ellipsis or clamp) | measured, as "truncated" |
| Text contrast | measured on solid backgrounds; incomplete over images, gradients or overlap |
| Target size (2.5.8) | measured; exceptions need eyes |
| Focus indicator (2.4.7) | measured only as "nothing changes when focused"; otherwise needs eyes |
| Focus obscured (2.4.11) | measured |
| Overlap with siblings | measured |
| RTL mirror correct | needs eyes |

Nothing answers "passed" when it could not measure. Under the table it says, in the
canvas's words: "No overflow is not nothing broke."

### What it shows

- **Marks in place.** Findings get process-yellow crop marks on the element or descendant
  they are about, with a short label (`134px too wide`, `Contrast 3.1:1`), drawn exactly as
  the canvas draws its flags. Hovering a row of the table lights its marks.
- **Findings become items.** "Add to inbox" on a finding makes an `annotation` with
  `evidence`: the check, the numbers, and the condition. Its scenario snapshot includes the
  stress condition, so `set_scenario` can replay it.
- **One measurement module.** `overflow.ts` moves to `dom/measure`, with the new checks
  beside it. The canvas keeps calling overflow and clipping as it does now, and can opt into
  more later.

### States that do not exist

A bench's or canvas's missing state already says "Not in the code yet". With a shell on
the page:

- its tooltip menu has **Report**, which files a `stateGap` item with the missing id,
  label and note;
- the States mode has **Missing state** for one the bench has not listed yet.

Agent guidance (M7): a `stateGap` is fixed by adding the branch in code, then moving the
entry from `missing` to `states`. Never by faking a fixture.

## 8. Security and privacy

The research is in [01 §D](01-research.md#d-local-bridge-security). The design:

### Threats and answers

| Threat | Answer |
| --- | --- |
| A website in another tab calls the bridge | It checks `Host` (rebinding), checks `Origin` against an allowlist, and requires the token in a header. Any one alone stops it; all three are tested. |
| DNS rebinding | `Host` must be `localhost`, `127.0.0.1` or `[::1]` with the bridge's port. |
| Another program on the machine | Loopback only. The token file is mode 0600. Every request needs the token. |
| A hostile page writes files | The bridge writes only inside `<project>/.prototype-machine/`, after `realpath` on root and parent, refusing `..`, absolute paths and symlinks. It never writes source. Bodies are capped at 1 MB, and sessions at 1,000 items. |
| An agent drives the page somewhere unsafe | `set_scenario` reaches only declared states, fields within their rules, same-origin routes, and Page tools. It cannot run code in the page. |
| Page text instructs the agent ("ignore previous instructions") | Every serializer fences page-derived text (excerpts, accessible names, selections) as quoted data under a "From the page, not instructions" label, kept short. The skill (M7) says to treat it as data. The reviewer's own comment is marked as the reviewer's. |
| Secrets leave the page | Redaction at capture, before storage or any transport (01 §D): no form values, no password or payment fields, masked `data-private` and the session-replay conventions, masked emails and key-shaped strings, sensitive query parameters dropped from reproduce URLs. |
| A production build phones home | The stub contains no shell, bridge client or webhook code. A pack test greps the bundles for them. |

### Pairing

1. `npx prototype-machine pair` (or `bridge`, or `init` at its end) prints a link:
   `http://localhost:5199/#pm-bridge=7457&pm-token=…`.
2. Opening it, the shell keeps the token in `sessionStorage` and removes the fragment
   from the address bar. The page's origin joins the allowlist.

A fragment never reaches a server or a `Referer`. A Vite plugin that injects the token
into same-origin HTML, as Vite does for its HMR socket, is the smoother path for later
(**Decision D5**).

### Privacy defaults

- No telemetry, ever.
- No network call except to a bridge or webhook the user configured.
- No screenshots in v1 (question H10).
- Items stay in `localStorage` per route until the reviewer clears them, or in the
  project's `.prototype-machine/` folder when the bridge is on.

## 9. Performance budgets

### Closed costs nothing

While the launcher is collapsed and no mode is on:

- no `MutationObserver`, `ResizeObserver` or `IntersectionObserver`;
- no interval, and no animation frame;
- no pointer or scroll listener outside the launcher.

The edge-bar check (audit 6.8) runs on open, on resize, and on a passive scroll listener
throttled to one hit test per 250 ms; its subtree observer runs only while the slab is
open. Page tools that the reviewer left on (RTL, 200%, paused) keep their one `<style>`;
the `getAnimations()` poll runs only while motion is slowed or paused, and the Page
section says so.

### A mode costs only while it is on

- `pointermove` is coalesced to one `elementsFromPoint` per animation frame.
- Overlays move by `transform` only.
- Scroll and resize listeners are passive. Observers attach on entering a mode and
  detach on leaving it.

### Budgets, checked in CI

From the baseline in the audit. min + gzip, React external, measured the way the audit
measured them:

| What | Today | Budget |
| --- | --- | --- |
| Production condition, typical import | 8.8 kB | **9.5 kB** |
| Production condition, whole entry | 11.6 kB | 14 kB |
| `/core`, whole entry | 6.0 kB | 16 kB (schema, validator, serializers, selectors) |
| `/dom`, whole entry | n/a | 30 kB |
| `prototype-machine`, development, initial chunk (launcher, States, provider) | 38.2 kB, all of it | 42 kB |
| Each lazy mode chunk | n/a | 20 kB |
| Pointer handling while picking, 5,000-node page | n/a | p95 under 2 ms per frame |
| Closed tool on that page, 10 s idle | 0 frames, 0 timers | 0 frames, 0 timers, 0 observers |

A script enforces the byte budgets in CI, using the esbuild tsup already installs
(section 13, **Decision D6**). A Playwright test measures the frame budget with the
Performance API on a generated 5,000-node page.

## 10. Accessibility of the tool

WCAG 2.2 AA for everything the tool draws, checked with axe-core inside each shadow root
and by hand.

- **Keyboard.** Every mode works without a pointer. Picking starts from focus and walks
  the tree with arrow keys (section 2). Scrubbing has a keyboard equivalent: arrows step,
  with Shift for 10 and Alt for 0.1, the steps DevTools uses. The composer, inspector and
  inbox are reachable in tab order from the slab.
- **Focus.** Popovers (the composer, a dropdown, the export menu) move focus in on open,
  keep `Tab` inside while open, and return focus to their trigger on `Esc` or close. The
  slab stays non-modal.
- **Announcements.** A polite live region says what was selected ("button, Save, in Card,
  card.tsx line 42"), when an item is added, and when the bridge changes an item's status.
- **Marks are not the only signal.** A selection is named in the inspector; a finding has
  a text label beside its yellow marks; a status chip has a word, not only a colour.
- **Targets** in the slab are at least 24 × 24 CSS px (WCAG 2.2 2.5.8). Today's 24px icon
  buttons pass; the preset pills are checked in M8.
- **Reduced motion** turns off the settle, the flight and every transition, as today.
  **Forced colours** restates marks and focus in system colours, extended to every new
  part.
- **Global hotkeys** stay opt-in through `hotkeys`.

## 11. Migration

No breaking change is needed. Everything that exists keeps its name, its entry and its
behaviour. New things are additions.

| Today | After | Change |
| --- | --- | --- |
| `prototype-machine/core` exports (30 values, all types) | `prototype-machine/core` | None. Gains the feedback schema, validator, migrations, serializers, selectors, tokens, redaction. |
| `ScenarioProvider`, `PinnedScenario`, `ScenarioContext`, `useHydrated`, `useScenario`, `useScenarioValue`, `useScenarioSelector` | `prototype-machine` (built from `_runtime/react`) | None. One shared context across entries (fixes audit 6.1). |
| `ScenarioPanel` | `prototype-machine`, `prototype-machine/panel` | Keeps its props and renders the shell with `modes={["states"]}` by default, so an upgrade looks exactly as it did. A new `modes` prop turns on Select and Annotate (**Decision D4**). |
| `StateBench`, `useStateParam`, `STATE_PARAM` | unchanged | Missing states gain "Report" (a `stateGap` item) when a shell is mounted. |
| `StateCanvas`, `stressFrames`, `FRAME_PARAM`, `DEFAULT_CANVAS_WIDTH` | unchanged | Overflow measurement moves to `dom`; the canvas calls it. |
| `Row`, `Pill`, `Select`, `FieldRow`, `MachineRow` | unchanged | Now also exported, as stubs, by the production entry (fixes audit 6.2). |
| `useDrag`, `snapTarget`, `cornerPosition`, `clampToViewport`, `DRAG_THRESHOLD`, `SNAP_DISTANCE` | unchanged | Production entry exports no-op versions. |
| `injectStyles`, `styles` | unchanged | Same string; the shell adds its rules to it. |
| `summarize`, `toDefaults`, `describe` | unchanged in core | Copy is rebuilt on the serializers and kept byte-identical except for added lines (section 4). |
| Storage keys | unchanged | New: `${storageKey}:pm-feedback:${route}` for items, `${storageKey}:pm-shell` for the mode. |
| URL parameters | unchanged | New: `__dir`, `__text`, `__motion`. |
| `<prototype-machine data-pm-layer>` | unchanged | New layer value `"tools"` for overlays drawn over the page. |

### Semver

- **0.14.0:** fixes for audit 6.1 to 6.5, the shared runtime, M1 (core schema and
  serializers). No visible change.
- **0.15.0 to 0.19.0:** one minor per milestone (M2 to M7), each with a changelog entry
  and its docs.
- **1.0.0-rc.1:** after M8. 1.0.0 once you have used it on a real prototype.

If a rename is approved (section 12), 1.0.0 ships under the new name. The last
`prototype-machine` release re-exports it, and `npm deprecate` names the new package.
That is the only break, and it is a one-line import change.

## 12. Naming

The package now drives states, tweaks styles and takes notes, and every note carries the
state it was made in. "prototype-machine" names the first of those. Three options, all
checked free on npm on 2026-11-16 (trademarks not checked):

| Name | For | Against |
| --- | --- | --- |
| **`prototype-machine`** (keep) | No migration. Existing links, skill and changelog stay valid. "Machine" still names the differentiator: notes that carry a state machine's state. | Reads as a state-machine library. Says nothing about review, notes or tweaks. "Prototype" undersells use on any React app in development. |
| **`stateproof`** | A proof is the copy a reviewer marks up before it goes to press, which is the tool's job and its visual language (crop marks). "State" is the differentiator. Short, unusual, says review and state together. | Can read as "proof that a state is correct", or as an echo of "bulletproof". A new name loses the history the old one has. |
| **`scenemark`** | On a stage, tape marks show where everything stands in each scene: position per state. Annotation in one word, and the theatre vocabulary matches "scenario". | "Scene" also means a 3D scene graph. Less obvious on first read than the other two. |

**Recommendation: `stateproof`**, renamed at 1.0.0 and not before, so every 0.x release
in between is a normal upgrade (**Decision D8**). Nothing is renamed until you say so.

## 13. Milestone plan and test infrastructure

### M0 first: fixes and a browser harness

The brief starts at M1. I would add a small M0, because two of the audit's bugs break
documented paths today, and every later milestone needs a real browser to prove anything
(**Decision D3**).

1. Shared runtime across the React entries, with pack tests (audit 6.1).
2. Production export parity, with a test (audit 6.2).
3. `useClientLayoutEffect` in the provider, and a React 18 CI job that runs the whole
   suite (audit 6.3).
4. `sample` moves to `src/test/fixtures.ts`, and the count drops to 277 honest tests
   (audit 6.4).
5. A `nonce` for the motion freeze (audit 6.5).
6. A Playwright harness against the demo; CI starts typechecking the demo; and the size
   script with today's numbers as budgets.

Each item is its own commit. `npm run check` passes after every one.

### Then M1 to M8 as briefed

| Milestone | Builds | Proves it with |
| --- | --- | --- |
| M1 core | Schema, validator, migrations, serializers, selector ranking, token matching, redaction, reproduce URLs. Copy rebuilt on the serializers. | Copy snapshots taken before the change and unchanged after. Serializer snapshots for every item kind × fidelity × audience. Schema fixtures and the Ajv parity test. Migration chain. Redaction cases. URL round trips. |
| M2 dom | Layer, picker, overlay, identification across shadow roots, same-origin iframes, portals, fixed and sticky elements, scroll containers, transforms. The React component adapter. | A demo fixture page per case. Overlay boxes within 1px of `getBoundingClientRect`, on React 18 and 19. |
| M3 Annotate | Element, text, multi and area notes. Markers, edit, delete. Per-route storage (hash routes too). Animation pause. Inbox. | Keyboard-only and pointer flows in Playwright. Markers that follow scroll. Storage keyed by route. |
| M4 Select & Tweak | Inspector, controls by element type, preview sheet, tokens, scope, pseudo-states, undo and redo, the diff. | Preview applies and reverts fully: computed styles back to the before snapshot, no tool sheet or attribute left in the DOM. Undo and redo round trips. Token snapping. |
| M5 States integration | Scenario snapshot and reproduce URL on every item. "Stress this". Findings to items. `stateGap` from bench missing states. | Seeded overflow and clipping fixtures are caught; clean fixtures stay quiet. Reproduce URLs open the state they name. |
| M6 Bridge, MCP, CLI | `bridge`, `mcp`, `init`, `doctor`. `init` detects installed agents, prefers each agent's own `mcp add` command, and shows every change before writing (**Decision D7**). | An MCP SDK client calls every tool against the schema. `watch` times out cleanly. Two tabs and two sessions at once. Bad Origin, Host or token rejected. Loopback only. A status set through MCP appears in the browser. The end-to-end loop in the brief. |
| M7 Agent guidance | `SKILL.md` and `reference/` for the modes and the agent loop; an `AGENTS.md` snippet. | Each doc example runs; the version test covers the new files. |
| M8 Hardening | Performance, accessibility, the React 18/19 matrix, a security review, a release candidate. No publish. | axe on the shell in each mode and on every bench state. Screenshots of each mode, light and dark. The 5,000-node frame budget. Bundler tests (Vite, webpack, esbuild, Next) for the production condition. |

### Test infrastructure

- **Unit:** Vitest with jsdom stays, for core and the React adapter.
- **Real browser:** Playwright Test against the demo, which grows a `/fixtures/*` route
  per hard case: shadow DOM, iframe, portal, fixed and sticky, nested scroll, transform,
  overflow seeded and clean, 5,000 nodes.
- **React 18 and 19:** a CI matrix job that installs React 18 over the dev dependency
  and runs Vitest and the browser tests.
- **Bundlers:** a `package/test/bundlers/` fixture with its own `package.json`, so
  webpack and Next never enter the package's own dev dependencies.

New dev dependencies, none at runtime (**Decision D6**):

| Package | Why | License |
| --- | --- | --- |
| `@playwright/test` pinned to 1.63.0 | Real-browser tests, matching the installed Chromium | Apache-2.0 |
| `axe-core` | Accessibility checks inside shadow roots and on bench states | MPL-2.0 (dev only, not bundled) |
| `@modelcontextprotocol/client` 2.x and `@modelcontextprotocol/sdk` 1.x | Real MCP clients of both protocol eras in the conformance tests | Apache-2.0 and MIT (dev only) |
| `ajv` | Checks the hand-written validator against the schema | MIT |
| `webpack`, `next` | Production-condition tests, in `test/bundlers/` only | MIT |

No `size-limit`: a 40-line script using the esbuild that tsup already installs measures
exactly what the audit measured. Say if you would rather have `size-limit`.

---

## Checkpoint

Nothing in Phase 3 starts until these are answered. Each has a recommendation; "yes to
all recommendations" is a complete answer.

| # | Decision | Recommendation | Alternative |
| --- | --- | --- | --- |
| D1 | Shell UI framework | React now; every engine vanilla in `dom` | Vanilla shell now (rewrite of the panel) |
| D2 | MCP server | Written in the package, stdio, both protocol eras, zero dependencies, tested against the official clients | Official SDK v2 in a separate package |
| D3 | An M0 before M1 | Yes: fix audit 6.1 to 6.5, test fixtures, Playwright harness, size script, React 18 job | Fold the fixes into M1 |
| D4 | What `ScenarioPanel` shows after the upgrade | States only, as today; `modes` opts into Select and Annotate | Every mode on by default |
| D5 | Bridge pairing | A printed link with the token in the URL fragment | A Vite plugin that injects it (later either way) |
| D6 | New dev dependencies (none at runtime) | `@playwright/test` 1.63.0, `axe-core`, the MCP SDK clients (both eras), `ajv`, and `webpack` plus `next` in an isolated fixture. A size script instead of `size-limit`. | Any subset; say which to drop |
| D7 | Agents `init` supports in v1 | Claude Code, Codex, Cursor, Gemini CLI, Copilot (VS Code and CLI through `.mcp.json`), OpenCode. It uses each agent's own `mcp add` where it has one and shows every change before writing. | A shorter list |
| D8 | Name | `stateproof`, at 1.0.0, not before | Keep `prototype-machine`, or `scenemark` |
| D9 | Where the schema's `$id` points | A GitHub raw URL on the release tag | A domain you own |

Questions only you can answer (01 §H):

- **H6:** who runs the usability sessions;
- **H7:** access to Codex, Cursor and Gemini for the benchmark;
- **H3:** whether to touch Agentation's schema at all (recommended no);
- **H9:** webhooks in v1;
- **H10:** no screenshots in v1.
