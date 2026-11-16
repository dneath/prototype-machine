# Audit

Phase 0 of the rebuild. Nothing in the package changed. This is what the code does
today, what it promises, what is tested, and what is broken.

Read at commit `153937a` (prototype-machine 0.13.0), 2026-11-16, Node 22.23, npm 10.9.

## Contents

1. [Baseline](#1-baseline)
2. [Architecture map](#2-architecture-map)
3. [Public API inventory](#3-public-api-inventory)
4. [Test coverage](#4-test-coverage)
5. [Invariants](#5-invariants)
6. [Bugs, rough edges and tech debt](#6-bugs-rough-edges-and-tech-debt)

---

## 1. Baseline

### `npm run check`

Passes, in 24 seconds.

| Step | Result |
| --- | --- |
| `vitest run` (jsdom) | 19 files, **574 tests reported, 277 unique**. See [6.4](#64-tests-run-other-files-tests). |
| `tsc --noEmit` | Clean. |
| `tsup` | ESM and CJS for 4 entries, with types and source maps. |
| `smoke` | ok |
| `publint` | All good. |
| Are the Types Wrong (`node16` profile) | Green for `.`, `./panel`, `./core`. `node10` is ignored on purpose. |
| `test:pack` | 38 files, 738 kB packed. Installs, imports every entry as ESM and CJS, checks the production stub, typechecks a sample app. |

### Bundle sizes

As shipped in `dist/` (unminified; tsup does not minify):

| File | Raw | gzip |
| --- | --- | --- |
| `dist/index.js` | 172.0 kB | 42.6 kB |
| `dist/panel.js` | 158.0 kB | 39.0 kB |
| `dist/production.js` | 28.6 kB | 8.2 kB |
| `dist/core/index.js` | 25.5 kB | 7.2 kB |

What a consumer's bundler ships, minified with esbuild, React external, core included:

| Entry | Condition | min | min + gzip |
| --- | --- | --- | --- |
| `prototype-machine` (whole entry) | development | 116.6 kB | **38.2 kB** |
| `prototype-machine/panel` (whole entry) | any | 99.2 kB | **32.4 kB** |
| `prototype-machine/core` (whole entry) | any | 15.6 kB | **6.0 kB** |
| `prototype-machine` (whole entry) | production | 31.4 kB | **11.6 kB** |
| Typical app import (`ScenarioProvider`, `ScenarioPanel`, `StateBench`, `StateCanvas`, `useScenario`, `defineMachine`) | development | 112.8 kB | 36.9 kB |
| The same import | **production** | 23.9 kB | **8.8 kB** |

The production stub ships the provider, the hooks, core, the URL-reading bench and the
flat canvas grid. No tool code: the strings `pm-launcher`, `pm-panel`, `pm-switcher`,
`pm-canvas`, `attachShadow`, `Prototype controls` and `Copy the scenario` are in the
development bundle and absent from the production one.

### The demo in a browser

`npm run dev` in `package/demo`, Chromium 1280 × 800, through Playwright.

| Route | Observed |
| --- | --- |
| `/overview` | Launcher in the corner, one `prototype-machine[data-pm-layer="panel"]` host, 68 nodes on the page. Open: 15 rows, sections Viewing as, Look, Stress, Page. No console errors or warnings. |
| `/overview?journey=keyMade&seats=40&state=empty` | Scenario applied, query stripped from the address bar. Copy produced the summary, the query and three config edits (below). |
| `/states/request-log?__state=long` | Bench on Long values, switcher marks it pressed. |
| `/states/request-log/canvas` | 45 frames (9 states × 5 stress frames, plus 1 missing row). Bar reads **13 overflowing**: 6 frames clip at 320px, 4 spill when squeezed (45 to 871 px), Long values clips at 880px and in RTL. |
| `/states/overview/canvas` | 20 frames (5 journey × 4 data). No overflow. |
| Idle, panel open, 2 s | 0 animation frames, 0 timeouts, 0 intervals scheduled. |

What Copy wrote:

```
Get connected: keyMade "Key made"  (default firstRun)
Role: user "Standard user"
Data state: empty "Empty"  (default real)
Sign-in failure: none "None"
Review pipeline: drafting "Drafting the request"
...
Seats: 40  (default 12)
...
Query: ?journey=keyMade&state=empty&seats=40

To make this the starting scenario, change these in the defineMachine config:
- machines.journey.initial: "keyMade" (was "firstRun")
- machines.data.initial: "empty" (was "real")
- fields.seats.default: 40 (was 12)
```

### React 18

Checked by installing the packed tarball beside `react@18.3.1` in a scratch app.
`renderToString` of a provider, a pinned scenario, a bench and a canvas works, and logs
**two warnings**: "useLayoutEffect does nothing on the server". See [6.3](#63-react-18-server-render-warns).
The test suite itself only ever runs against React 19.

---

## 2. Architecture map

### Entry points

| Import | Condition | File | What it is |
| --- | --- | --- | --- |
| `prototype-machine` | default | `src/index.ts` | Everything: provider, hooks, panel, bench, canvas, panel building blocks, core. |
| `prototype-machine` | `production` | `src/production.ts` | Provider, hooks, core. `ScenarioPanel` returns null, `StateBench` renders the URL's state with no switcher, `StateCanvas` renders a flat grid. |
| `prototype-machine/panel` | any | `src/panel.ts` | The real `ScenarioPanel`, `StateBench` and `StateCanvas`, for review builds. |
| `prototype-machine/core` | any | `src/core/index.ts` | No React. Config, validation, URL and storage layers, text output, stress sets. |

Build (`tsup.config.ts`): core is built once. The three React entries are built
together with `splitting: false`, a `"use client"` banner, React external, and a
`shared-core` esbuild plugin that rewrites imports of core to `./core/index.js`, so CJS
consumers get one `ScenarioError` class. Nothing else is shared between the React
entries: each one carries its own copy of the provider, the hooks and the UI.

### Modules

```
src/
  core/                       React-free
    schema.ts       281   config types, type-level context inference
    machine.ts      487   compile/defineMachine, validation, legality, contextOf, sanitize, isDev
    serialize.ts    203   URL <-> snapshot, storage, precedence (resolve)
    describe.ts      87   describe, summarize, changedCount, toDefaults (Copy text)
    sections.ts      51   sectionsOf: how the panel is grouped
    stress.ts        77   STRESS_TEXT, STRESS_NUMBERS, presetsOf
    states.ts        72   statesOf: a machine or enum as bench/canvas rows
  react/
    provider.tsx    586   ScenarioProvider, PinnedScenario, layers, api, store
    use-scenario.ts  69   useScenario, useScenarioSelector, useScenarioValue
    panel.tsx       692   ScenarioPanel: launcher, header, sections, Copy, Page tools UI
    controls.tsx    407   Row, Pill, MachineRow, FieldRow, NumberInput
    select.tsx      379   panel-drawn listbox
    slider.tsx      164   range control
    drag.ts         527   useDrag, snapping, stored placement
    edges.ts        133   avoidBars: hit-test fixed or sticky bars on the edges
    shadow.ts       175   useShadowLayer: host element, shadow root, event containment
    styles.ts       829   the one stylesheet, as a string
    icons.tsx       106   inline SVG
    tools.ts        157   Page tools: dir, text scale, motion
    bench-state.tsx 244   StateBench data side: useStateParam, URL writes, BenchBody
    switcher.tsx    233   StateBench UI: the switcher bar
    canvas-state.tsx 456  StateCanvas data side: frames, grid, cells, FlatCanvas
    canvas.tsx      818   CanvasSurface: camera, paint loop, measurement, URL focus
    canvas-chrome.tsx 284 overlay (marks, axes) and bar
    canvas-gestures.ts 249 wheel, pinch, pan
    camera.ts       185   pure camera arithmetic
    overflow.ts      58   inspectOverflow: spill and clipping
  index.ts, production.ts, panel.ts
```

### Data flow: scenario

```
defineMachine(config)                       core/machine.ts
  -> compile(): validate, ownerOf, params   throws ScenarioError at module load
  -> CompiledMachine { config, initial, movesFrom, can, contextOf, sanitize }

<ScenarioProvider machine storageKey path navigate env enabled syncUrl syncTabs>
  layers  = []                              server and first client render (defaults)
          = [fromSearch(url)]               after hydration, if the URL names any param
          = [readStorage(key)]              otherwise
  edits   = this session's go()/set()
  snapshot = resolve(machine, [...layers, edits])
  context  = machine.contextOf(snapshot)    cursors + assigns + fields + derived
  api      = { ...context, go, set, can, movesFrom, reset, snapshot, machine, env, ... }
  -> ScenarioContext (api)                  useScenario()
  -> StoreCtx (context store)               useScenarioValue / useScenarioSelector
  effects: writeStorage (batched 150 ms, flushed on pagehide), strip or sync the URL,
           mirror `dom` fields onto <html>/<body>, follow popstate / other tabs

<ScenarioPanel>                             reads useScenario()
  useShadowLayer("panel") -> <prototype-machine> on <body>, open shadow root, styles
  useEdgeInsets, useDrag, usePanelUi (open, pinned, collapsed, tools)
  sectionsOf(config, env) -> MachineRow / FieldRow -> p.go / p.set
  Copy -> summarize + toDefaults -> clipboard
  usePageTools(dir, text, motion) -> <html> dir, font-size, freeze <style> + getAnimations

<PinnedScenario machine values>             same provider body with one fixed layer:
                                            no storage, no URL, dom on a wrapper div
```

### Data flow: bench

```
<StateBench states missing initial param width ...>
  useBench -> checkStates -> useStateParam(ids)
    useSyncExternalStore(subscribeUrl, read ?__state)   null on server and hydration
  BenchBody: <div data-state-bench data-state=id style=width> keyed child </div> + spacer
  SwitcherBar: useShadowLayer("switcher") -> <nav> of aria-pressed buttons
    click -> writeSearchParams (replaceState + "prototype-machine:urlchange" event)
```

### Data flow: canvas

```
<StateCanvas states missing frames width label param frameParam enabled>
  enabled ? CanvasSurface : FlatCanvas
  useCanvasConfig -> rows (states then missing), frames (resolveFrames, "stress")
  CanvasGrid (light DOM, page fonts): CanvasCell per (state, frame) with
    width, minHeight, dir, attrs, background, squeeze, contain: layout
  camera in a ref, painted once per animation frame as one transform on the world
  ResizeObserver -> measure() -> inspectSoon (200 ms) -> inspectOverflow per cell
    -> data-overflow / data-clipped on the cell, amber marks, findings store
  CanvasOverlay + CanvasBar in useShadowLayer("canvas"): names, crop marks, flags,
    zoom, Fit, Text 200%, Pause motion (its own usePageTools), findings count
  URL: ?__state & ?__frame focus a row, column or cell; camera saved per path + label
```

### Shared machinery

| Module | Used by |
| --- | --- |
| `shadow.ts` (`useShadowLayer`, `eventWithin`, `deepActiveElement`) | panel, switcher, canvas, select |
| `edges.ts` (`useEdgeInsets`) | panel, switcher |
| `tools.ts` (`usePageTools`) | panel, canvas bar |
| `bench-state.tsx` (`subscribeUrl`, `writeSearchParams`, `checkStates`) | bench, canvas |
| `styles.ts` | every shadow root gets its own copy of the sheet |

---

## 3. Public API inventory

### Runtime exports

**`prototype-machine/core`** (30 values, plus every type in `schema.ts`):
`compile`, `defineMachine`, `isDev`, `isValidFieldValue`, `isDate`, `optionsOf`,
`ScenarioError`, `visible`, `warn`, `has`, `suggest`, `sectionsOf`, `clearStorage`,
`fromSearch`, `readStorage`, `resolve`, `mergeSearch`, `toSearch`, `diffFromDefaults`,
`shapeOf`, `writeStorage`, `describe`, `summarize`, `changedCount`, `toDefaults`,
`STRESS_NUMBERS`, `STRESS_TEXT`, `presetsOf`, `statesOf`, `SELECT_THRESHOLD`.

Types: `Primitive`, `Env`, `DomBinding`, `BooleanField`, `EnumOption`, `EnumField`,
`Preset`, `NumberField`, `StringField`, `DateField`, `AnyField`, `MachineStateDef`,
`MachineDef`, `ActionApi`, `ActionDef`, `MachineConfigShape`, `Widen`,
`MachineCursors`, `AllAssigns`, `AssignKeys`, `MachineAssigns`, `FieldValue`,
`FieldValues`, `BaseContext`, `Context`, `StateOf`, `TypedMoves`, `CompiledMachine`,
`Machine`, `PartialSnapshot`, `Snapshot`, `PanelSection`, `LabelledPreset`,
`StateEntry`, `StateIdsOf`, `EnumFieldIds`.

**`prototype-machine`** (development): all of core, plus `ScenarioProvider`,
`PinnedScenario`, `ScenarioContext`, `useHydrated`, `useScenario`,
`useScenarioSelector`, `useScenarioValue`, `ScenarioPanel`, `StateBench`,
`StateCanvas`, `STATE_PARAM`, `FRAME_PARAM`, `DEFAULT_CANVAS_WIDTH`, `stressFrames`,
`useStateParam`, `Row`, `Pill`, `FieldRow`, `MachineRow`, `Select`, `useDrag`,
`snapTarget`, `cornerPosition`, `clampToViewport`, `DRAG_THRESHOLD`, `SNAP_DISTANCE`,
`injectStyles`, `styles`. Types: `Scenario`, `ScenarioApi`, `ScenarioProviderProps`,
`PinnedScenarioProps`, `TypedScenario`, `ScenarioPanelProps`, `PanelPosition`,
`StateBenchProps`, `BenchStates`, `BenchStateDef`, `StateParamOptions`,
`StateCanvasProps`, `CanvasFrames`, `CanvasFrameDef`, `SelectOption`, `Corner`,
`Placement`, `Point`, `UseDragOptions`, `UseDragResult`.

**`prototype-machine`** (production): the same, **minus** `Row`, `Pill`, `FieldRow`,
`MachineRow`, `Select`, `useDrag`, `snapTarget`, `cornerPosition`, `clampToViewport`,
`DRAG_THRESHOLD`, `SNAP_DISTANCE`, `injectStyles`, `styles`. See [6.2](#62-production-entry-is-missing-exports-the-docs-tell-people-to-use).

**`prototype-machine/panel`**: `ScenarioPanel`, `StateBench`, `StateCanvas`, and the
types `ScenarioPanelProps`, `PanelPosition`.

### Props and options

| Component or hook | Props |
| --- | --- |
| `ScenarioProvider` | `machine`*, `storageKey`*, `path`, `navigate`, `env`, `enabled`, `syncUrl`, `syncTabs`, `children` |
| `PinnedScenario` | `machine`*, `values`, `path`, `navigate`, `env`, `children` |
| `ScenarioPanel` | `position`, `title`, `zIndex`, `draggable`, `inset`, `nonce`, `enabled`, `avoidBars`, `tools`, `children` |
| `StateBench` | `states`*, `children`*, `missing`, `initial`, `param`, `width`, `label`, `placement`, `offset`, `zIndex`, `nonce`, `enabled`, `avoidBars` |
| `StateCanvas` | `states`*, `children`*, `missing`, `frames`, `width`, `label`, `param`, `frameParam`, `zIndex`, `nonce`, `enabled` |
| Canvas frame | `label`, `note`, `width`, `minHeight`, `dir`, `attrs`, `background`, `squeeze` |
| `useStateParam(ids, opts)` | `initial`*, `param`, `missing` |
| `useScenario(machine?)` returns | context keys, `go`, `set`, `can`, `movesFrom`, `reset`, `snapshot`, `machine`, `storageKey`, `env`, `navigate`, `hydrated`, `enabled`, `open`, `setOpen` |
| `useDrag(opts)` | `storageKey`, `enabled`, `elementRef` |
| `Row` / `Pill` / `Select` | `label, children, onReset, layout` / `active, disabled, onClick, title, reason, children` / `label, value, options, onChange, placeholder` |

\* required.

Config keys (`defineMachine`): machines (`initial`*, `states`*, `transitions`, `label`,
`group`, `param`, `when`, `hidden`; a state is `label`, `note`, `assign`), fields
(`type`*, `default`*, `label`, `note`, `group`, `hidden`, `param`, `when`, plus per
type: `trueLabel`, `falseLabel`, `dom`, `options`, `control`, `min`, `max`, `step`,
`presets`, `placeholder`, `multiline`, `nullable`), `derive`, actions (`id`*,
`label`*, `run`*, `title`, `group`, `when`). Reserved context names: `set`, `go`,
`can`, `movesFrom`, `reset`, `snapshot`, `machine`, `storageKey`, `env`, `navigate`,
`open`, `setOpen`, `hydrated`, `enabled`.

### URL parameters

| Parameter | Owner | Notes |
| --- | --- | --- |
| each machine's and field's `param ?? id` | provider | Read once after hydration and stripped, or kept in step with `syncUrl`. Any one present makes the URL authoritative over storage. Booleans read `1/0/true/false/on/off`, write `1/0`. Defaults are omitted. |
| `__state` (`STATE_PARAM`, `param` prop) | bench, canvas | Bench state; canvas row focus. `replaceState`, other params and the hash kept. |
| `__frame` (`FRAME_PARAM`, `frameParam` prop) | canvas | Column focus. |

### Storage keys (`localStorage`)

| Key | Shape |
| --- | --- |
| `${storageKey}` | `{ shape, machines?, fields? }`, only values off their default |
| `${storageKey}:pm-panel-ui` | `{ open, pinned, collapsed: string[], tools: { dir, text, motion } }` |
| `${storageKey}:pm-panel-position` | `{ kind: "corner", corner }` or `{ kind: "free", x, y }` (a bare `{x, y}` migrates) |
| `prototype-machine:canvas:${pathname}:${label}` | `{ v: 1, x, y, z }` |

### DOM contract

Tests and docs rely on these, so they are public in practice.

- `<prototype-machine data-prototype-machine data-pm-layer="panel|switcher|canvas" translate="no">`
  on `<body>`, open shadow root, `<div data-pm-mount>` inside, `<style data-prototype-machine>`.
- Bench: `[data-state-bench][data-state]`, `[data-state-bench-spacer]`.
- Canvas: `[data-state-canvas-viewport]`, `[data-state-canvas]`,
  `[data-state-canvas-frame][data-state][data-frame][aria-label]`,
  `[data-state-canvas-missing]`, `[data-state-canvas-squeezed]`,
  `[data-state-canvas-sibling]`, `data-overflow`, `data-clipped`.
- Pinned: `[data-pinned-scenario]` (`display: contents`).
- `<style data-prototype-machine-motion>` in `<head>` while motion is paused.
- Window event `prototype-machine:urlchange`.
- CSS custom properties: `--pm-z`, `--pm-edge-top`, `--pm-edge-bottom`, and whatever
  `inset` names.
- Class names: `canvas.md` tells tests to wait for `.pm-canvas-findings`.

---

## 4. Test coverage

Vitest with jsdom. jsdom has no layout, so every measurement is either mocked
(`Object.defineProperty` on `scrollWidth` and friends) or pure arithmetic.

| Area | File | Unique tests | Covered | Gaps |
| --- | --- | --- | --- | --- |
| Compile and legality | `core/machine.test.ts` | 33 | Transitions, tuples, ownership, every compile error, context, sanitize, presets, dates | None worth naming. |
| URL and storage | `core/serialize.test.ts` | 19 | Round trips, custom params, inherited names, shape hash, precedence | `mergeSearch` only indirectly. |
| Copy text | `core/describe.test.ts` | 10 | `describe`, `summarize`, `toDefaults`, `suggest` | No snapshot of the exact Copy output with Page tools. |
| Sections | `core/sections.test.ts` | 7 | Order, `when`, `hidden`, empty sections | |
| `statesOf` | `core/states.test.ts` | 6 | Machines, enums, errors, key types | |
| Provider | `react/provider.test.tsx` | 15 | Batched moves, no-op writes, URL authority, `syncUrl`, `syncTabs`, duplicate keys | Hydration with `hydrateRoot` against server markup. |
| Runtime | `react/runtime.test.tsx` | 5 | SSR without a browser (React 19), StrictMode, `dom` binding | React 18. |
| Pinned | `react/pinned.test.tsx` | 10 | Isolation from storage and URL, `dom` on wrapper, errors, SSR | |
| Panel | `react/panel.test.tsx` | 18 | Open, legality, groups, filter, pin, focus | Copy with tools, drag in a real browser. |
| Isolation | `react/isolation.test.tsx` | 30 | Shadow root, inline host style, events contained, dropdown keyboard, presets, reset, Page tools | CSP nonce on the freeze sheet. Real host CSS (the demo's hostile mode is manual only). |
| Slider | `react/slider.test.tsx` | 10 | Maths, keys, pointer, ticks | |
| Drag | `react/drag.test.ts` | 19 | Pure arithmetic, snapping, stored placement | `useDrag` as a hook barely, nothing in a browser. |
| Edges | `react/edges.test.tsx` | 14 | Pure insets, mocked hit tests, switcher and panel offsets | Real fixed and sticky bars. |
| Bench | `react/bench.test.tsx` | 22 | URL, history, keys, missing, hide, production body | |
| Canvas | `react/canvas.test.tsx` | 26 | Grid, frames, axes, URL focus, keys, stored camera, flat and production | Gestures, paint loop, findings in a real layout. |
| Camera | `react/camera.test.ts` | 18 | Pure arithmetic | |
| Overflow | `react/overflow.test.ts` | 7 | Spill, clipping, ellipsis, clamp (mocked sizes) | A real layout. Shadow roots inside frames. |
| Styles | `react/styles.test.ts` | 6 | Inheritance reset, colour scheme, form reset | Contrast of the tool's own colours. |
| Release | `versions.test.ts` | 2 | Docs and changelog name the package version | |

### Gaps across the suite

- **No real browser.** Nothing checks layout, overlays against
  `getBoundingClientRect`, a real fixed bar, a real overflow, focus rings, or a
  screenshot.
- **One React version.** Dev dependencies pin React 19; peers say `>=18`.
- **Entries are not tested as a consumer pairs them.** `test:pack` checks that
  `ScenarioPanel` from `/panel` is a function, never that it renders inside a
  provider from the main entry. That is how [6.1](#61-the-review-build-panel-cannot-find-its-provider)
  shipped.
- **Export parity between conditions is not tested.** That is how [6.2](#62-production-entry-is-missing-exports-the-docs-tell-people-to-use)
  shipped.
- **No accessibility automation.** No axe run on the tool UI or on bench states.
- **No size budget** in CI.
- **No CSP test.**
- **The demo is built in CI, never typechecked or opened.**

---

## 5. Invariants

These must hold after the rebuild. Each names where it is enforced today and the test
that guards it.

| # | Invariant | Enforced in | Guarded by |
| --- | --- | --- | --- |
| 1 | **Illegal states can't be expressed.** Undeclared transitions are refused; the panel draws them disabled, focusable, with the reason. Machine-owned keys refuse `set()`. | `core/machine.ts` (`can`, `ownerOf`), `react/provider.tsx` (`go`, `set`), `react/controls.tsx` (`Pill`, `unreachableReason`) | `machine.test` transition legality, `panel.test` "disables a pill", "refuses a direct write" |
| 2 | **Browser entries have zero runtime dependencies.** React and React DOM are optional peers. | `package.json` (no `dependencies`) | README rule; not tested. |
| 3 | **Every overlay renders in its own shadow root.** App CSS can't reach it, inheritance is reset with `:host` `!important`, the host pins itself inline, and keystrokes, pointer and focus events inside it stop at the host. | `react/shadow.ts`, `react/styles.ts` `:host` | `isolation.test` "the isolated layer", `bench.test` "lives in its own shadow root", `canvas.test` axes |
| 4 | **No global keyboard shortcuts by default.** The panel opens from a click. The bench bar and canvas take keys only while focus is on them. | `panel.tsx`, `switcher.tsx` `onKeyDown`, `canvas.tsx` `onKeyDown` | `bench.test` "binds no key on the page", `canvas.test` "takes keys only while the canvas itself has focus" |
| 5 | **The production condition ships no tool code.** A review build opts in through `/panel`. | `package.json` exports, `src/production.ts` | `test:pack` step 4 (stub returns null). The opt-in path is broken: [6.1](#61-the-review-build-panel-cannot-find-its-provider). |
| 6 | **The URL is the source of truth for bench and canvas state.** `replaceState`, other params and the hash kept, back and forward followed. | `bench-state.tsx` | `bench.test`, `canvas.test` |
| 7 | **Layered precedence: config < storage < URL < session.** A URL with any scenario param replaces storage for that load. Storage holds only diffs plus a shape hash. | `core/serialize.ts`, `provider.tsx` layers | `serialize.test` precedence, `panel.test` "lets a URL beat", `provider.test` "is authoritative" |
| 8 | **`prototype-machine/core` imports no React.** | `src/core/*` | By construction; `pack-test` imports core. Not asserted. |
| 9 | **The tool looks deliberately unlike the product.** Dark slab, system font, its own tokens, no product components inside. | `styles.ts`, SKILL principle 3 | `styles.test` (inheritance only) |
| 10 | **Findings are observed, never predicted. Missing states are listed, never faked.** | `overflow.ts`, `missing` on bench and canvas | `bench.test` "lists missing states ... never renders them", `canvas.test` "lists a missing state with a placeholder" |
| 11 | **Server and first client render match.** No tool markup on the server; storage and URL layer in after hydration. | `useHydrated`, `useShadowLayer` returns null until mounted, `useStateParam` null on server | `runtime.test`, `bench.test` "renders nothing on the server" |
| 12 | **Every page tool and `dom` binding restores what the page had.** | `tools.ts`, `provider.tsx` dom effect, `canvas-state.tsx` `useAttributes` | `isolation.test` page tools, `runtime.test` "restores an attribute" |
| 13 | **A write that changes nothing writes nothing.** No render, no storage, no URL. | `provider.tsx` `go`/`set`, `writeSearchParams` | `provider.test` "writes nothing" |
| 14 | **Config errors throw at load and name the fix.** Inherited names (`constructor`, `__proto__`) never match. | `core/machine.ts`, `has()` | `machine.test`, `serialize.test` inherited names |
| 15 | **Fail closed.** With no `process.env.NODE_ENV`, the tool assumes production. | `isDev` in `core/machine.ts` | Not tested. |
| 16 | **A frame changes the container; a state changes the data.** | `canvas-state.tsx`, `canvas.md` | Docs only. |
| 17 | **A section is a title and its controls. Explanations go in tooltips.** | `panel.tsx`, `controls.tsx` | `panel.test` "renders a section as a title and its controls, and nothing else" |
| 18 | **The panel stays out of the way.** Draggable, snaps to corners, keeps clear of fixed bars, closes on Escape and click outside unless pinned, returns focus to the launcher. | `drag.ts`, `edges.ts`, `panel.tsx` | `drag.test`, `edges.test`, `panel.test` |
| 19 | **One `ScenarioError` class across ESM and CJS.** | `shared-core` plugin | `smoke.cjs`, `test:pack` |
| 20 | **Docs voice.** Short plain sentences, no em dashes (CHANGELOG 0.11.0). | Docs | Review only. |

---

## 6. Bugs, rough edges and tech debt

Severity: **P0** breaks a documented path. **P1** wrong behaviour or misleading
numbers. **P2** rough edge. **Debt** costs us later. "Reproduced" means I ran it; "by
reading" means I did not.

### 6.1 The review-build panel cannot find its provider

**P0, reproduced.** `README.md`, `api.md` and `SKILL.md` say a review build imports
`ScenarioPanel` from `prototype-machine/panel`. Rendered inside a `ScenarioProvider`
from `prototype-machine`, it throws "useScenario() was called outside
<ScenarioProvider>", under both the default and the `production` condition (React 18,
jsdom, the packed tarball).

Cause: the React entries are built with `splitting: false` (`tsup.config.ts:41-49`), so
`dist/index.js`, `dist/production.js` and `dist/panel.js` each contain their own
`React.createContext` for the scenario (`react/provider.tsx:54`, `:581`). The panel from
`/panel` reads a context nothing provides. `scripts/pack-test.mjs:84-95` only checks
`typeof panel.ScenarioPanel`. `StateBench` and `StateCanvas` from `/panel` work because
they need no provider.

Side effect: importing both entries in development ships the whole UI twice (about
32 kB gzip extra).

### 6.2 Production entry is missing exports the docs tell people to use

**P1, reproduced.** `api.md` says to build the panel's `children` from `Row`, `Pill`
and `Select`. `src/production.ts` exports none of them, nor `FieldRow`, `MachineRow`,
`useDrag`, `snapTarget`, `cornerPosition`, `clampToViewport`, `DRAG_THRESHOLD`,
`SNAP_DISTANCE`, `injectStyles` or `styles`. esbuild with `--conditions=production`
fails: "No matching export ... for import "Row"". Vite and Rollup fail the same way;
webpack warns and leaves `undefined`.

### 6.3 React 18 server render warns

**P1, reproduced** on 18.3.1: two "useLayoutEffect does nothing on the server"
warnings per render with a provider or a pinned scenario. `react/provider.tsx:433`
calls `React.useLayoutEffect` directly; the file already defines
`useClientLayoutEffect` (`:115`) for exactly this. React 19 dropped the warning, which
is why the suite does not see it.

### 6.4 Tests run other files' tests

**P1, reproduced.** Nine test files import `sample` from `core/machine.test.ts`
(`core/sections.test.ts:4`, `core/serialize.test.ts:3`, `core/states.test.ts:4`,
`react/bench.test.tsx:7`, `react/canvas.test.tsx:8`, `react/edges.test.tsx:4`,
`react/panel.test.tsx:6`, `react/pinned.test.tsx:6`, `react/provider.test.tsx:6`).
Importing a test file registers its tests again, so the 33 machine tests run ten
times (574 = 277 + 33 × 9). The suite reports 574 tests; 277 are unique. Move `sample`
to a fixtures module.

### 6.5 The motion freeze breaks under a strict CSP

**P1, by reading.** Paused motion appends a `<style>` to `<head>` with no nonce
(`react/tools.ts:105-109`). The panel takes a `nonce` (`panel.tsx:88`) but does not
pass it to `usePageTools` (`panel.tsx:111`); neither does the canvas bar
(`canvas-chrome.tsx:249`). Under `style-src 'nonce-…'` the freeze silently does
nothing.

### 6.6 Two owners of the Page tools

**P2, by reading.** The panel and the canvas bar each run `usePageTools` with their own
state (`panel.tsx:111`, `canvas-chrome.tsx:248-249`). Both write `<html>` `font-size` and
`dir`. If both are mounted, whichever cleans up first puts back a value the other set.

### 6.7 Copy cannot reproduce what it describes

**P2, reproduced.** `summarize` writes the query string but not the route
(`core/describe.ts:63-64`), so the text does not name the page. It also lists every
control, including ones `when` hides on this screen ("Sign-in failure" and "Review
pipeline" on `/overview` in the browser run). There is no schema or version: an agent
parses prose. Bench and canvas state (`__state`, `__frame`) never appear in it.

### 6.8 Work while the panel is closed

**P2, reproduced in part.** `avoidBars` runs a subtree `MutationObserver` on `<body>`
and a capture-phase scroll listener whenever the panel is mounted, open or collapsed
(`react/edges.ts:96-124`, `panel.tsx:97`). Every DOM mutation in the app schedules a
hit-test pass 80 ms later. Paused or slowed motion polls `getAnimations()` every 200 ms
(`tools.ts:136`). On an idle page the browser run measured no timers, so the cost is
proportional to app activity, not zero.

### 6.9 Smaller rough edges

| # | What | Where |
| --- | --- | --- |
| a | `inset` passed inline re-runs its effect every render, removing and re-setting the property. | `panel.tsx:159-166` |
| b | The settle after a drag animates `top` and `left`, not a transform. | `styles.ts:173` |
| c | The launcher's accessible name lowercases a user-supplied `title`. | `panel.tsx:251`, `:416` |
| d | The motion freeze cannot reach the app's own shadow roots; `requestAnimationFrame` motion is untouched (documented). | `tools.ts:85-89` |
| e | Overflow inspection does not descend into open shadow roots inside a frame. | `overflow.ts:35` |
| f | `can` and `movesFrom` on the API index config without `has()`, unlike every other lookup. Harmless today. | `provider.tsx:387-396` |
| g | The canvas reads the page background once; a theme switch does not update it. | `canvas-state.tsx:423-436` |
| h | The 20 kB stylesheet is copied into every shadow root: three copies on a page with a panel and a canvas. | `styles.ts:816-827` |
| i | The tarball is 738 kB packed, mostly source maps with embedded sources. | `tsup.config.ts:29`, `:43` |
| j | `CHANGELOG.md` 0.13.0 has two `### Added` headings. | `CHANGELOG.md:14`, `:53` |
| k | `control-types.json` has no entries for `StateCanvas`, frames, `PinnedScenario` or `statesOf`. | `reference/control-types.json` |
| l | The panel UI state is written back to storage on first load. | `panel.tsx:682-690` |

### 6.10 Tech debt that shapes the rebuild

- **Each React entry is a separate island** (6.1). Any new mode added to the panel
  inherits the bug until entries share chunks, or the context moves into a shared
  module the way core already is.
- **Two state systems with no common address.** The provider's scenario lives in
  config params; benches and canvases use `__state` and `__frame` with no provider.
  A "reproduce URL" has to cover both.
- **Measurement is welded to the canvas.** `inspectOverflow` is a good pure function,
  but the only caller is the canvas paint loop. Element-level stress needs it per
  element, outside a canvas.
- **The tool UI is React.** `useShadowLayer`, the panel, and the controls are React
  components. A framework-agnostic `dom` layer for picking and overlays has to stand
  beside them without React.
- **No browser test harness exists.** Everything the rebuild adds (picking, overlays,
  tweak preview, stress) depends on layout, so Playwright or Vitest browser mode comes
  first.
- **CI** (`.github/workflows/ci.yml`) runs Node 20, 22, 24 on one React version, has no
  browser job, no size budget, and builds but never typechecks the demo.
