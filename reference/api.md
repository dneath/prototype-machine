# API reference

**Part of [prototype-machine](../SKILL.md)**. Targets prototype-machine 0.12.0.

For *how to model* a scenario space, read [recipes.md](recipes.md) first. This file is
the exhaustive surface.

## Contents

- [defineMachine](#definemachine)
- [MachineDef](#machinedef)
- [Fields](#fields)
- [Actions](#actions)
- [ScenarioProvider](#scenarioprovider)
- [ScenarioPanel](#scenariopanel)
- [StateBench](#statebench)
- [useStateParam](#usestateparam)
- [StateCanvas](#statecanvas)
- [PinnedScenario](#pinnedscenario)
- [useScenario](#usescenario)
- [The core entry](#the-core-entry)
- [Errors and warnings](#errors-and-warnings)
- [Keyboard](#keyboard)

---

## defineMachine

```ts
const scenario = defineMachine({ machines, fields, derive, actions })
```

| Key | Type | Description |
| --- | --- | --- |
| `machines` | `Record<string, MachineDef>` | Journeys. Each puts its current state id into context under its own name. |
| `fields` | `Record<string, AnyField>` | Independent axes. |
| `derive` | `Record<string, (ctx) => value>` | Computed values. Never stored, never in a URL. `ctx` is fully typed and contains machines, tuples and fields, but not other derived values. |
| `actions` | `ActionDef[]` | Buttons. Ungrouped ones render last. |

Everything is validated at module load. Types are inferred, so `useScenario(scenario)`
knows the shape of context with no annotation anywhere.

Context is the union of four things, and no two of them may share a name:

1. each machine's id → its current state id
2. every key any state `assign`s
3. every field id
4. every derived name

## MachineDef

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `initial` | `string` | yes | Where a fresh visitor starts. Must be one of `states`. |
| `states` | `Record<string, MachineStateDef>` | yes | See below. |
| `transitions` | `Record<string, string[]>` | no | Legal moves, `from -> to[]`. |
| `label` | `string` | no | Row heading. Defaults to the id. |
| `group` | `string` | no | Section the row renders under. See [Grouping](#grouping). |
| `param` | `string` | no | Query-string key. Defaults to the id. |
| `when` | `(env: Env) => boolean` | no | Render the row only when this passes. |
| `hidden` | `boolean` | no | In context, URL and storage; out of the panel. |

`MachineStateDef` is `{ label?, note?, assign? }`. `assign` is the tuple this state
writes into context; `note` is the tooltip.

### transitions

Three distinct meanings, and the difference matters:

| Written | Means |
| --- | --- |
| key omitted entirely | Not a journey. Every state reachable from every state. |
| `{ a: ["b"] }` | From `a` you may go to `b`. From anything else, nowhere. |
| `{ a: [] }` | `a` is a dead end. Deliberate, not "unspecified". |

Staying put is always legal. An illegal move is refused by `go()` with a console
warning naming the legal moves, and its pill renders present but disabled, so the shape of
the journey stays visible.

A state that nothing can reach produces a boot-time warning rather than an error,
because the initial state of a one-way journey is legitimately unreachable.

## Fields

Every field takes the common keys below and a **required** `default`.

| Key | Type | Description |
| --- | --- | --- |
| `label` | `string` | Row heading. Defaults to the id. |
| `note` | `string` | Hover tooltip. |
| `group` | `string` | Section the row renders under. See [Grouping](#grouping). |
| `hidden` | `boolean` | In context, URL and storage; out of the panel. |
| `param` | `string` | Query-string key. Defaults to the id. |
| `when` | `(env: Env) => boolean` | Render the row only when this passes. |

| `type` | Value | Control | Extra keys |
| --- | --- | --- | --- |
| `boolean` | `boolean` | Two pills | `trueLabel`, `falseLabel`, `dom` |
| `enum` | literal union of the options | Pills; a dropdown above 6 options | `options`, `control`, `dom` |
| `number` | `number` | Number input, or a slider | `min`, `max`, `step`, `control`, `presets` |
| `string` | `string` | Text input, or a textarea | `placeholder`, `multiline`, `presets` |
| `date` | `string \| null` | Datetime input plus a "Not set" pill, stored as ISO/UTC | `nullable` |

`options` accepts `["a", "b"]` or `[{ value, label, note }]`. `control` is
`"pills" | "select"` for enums and `"stepper" | "range"` for numbers.

### The slider

`control: "range"` draws a slider, and needs both `min` and `max` (it throws at boot
without them). Press anywhere on the track to jump there, then drag; the drag keeps
going if the pointer leaves the track. When the range divides into ten steps or
fewer, a tick marks each one. The box beside the track shows the exact value and
takes a typed one.

```ts
radius: { type: "number", label: "Card radius", default: 8, min: 0, max: 16, step: 4, control: "range" }
```

Use a slider to tune a value by feel (a radius, a width, a count you want to watch
grow). Use the default stepper for a count you'll type exactly.

`dom: { attribute, target? }` mirrors the value onto `<html>` (or `"body"`) as an
attribute, so plain CSS can read it. On unmount the attribute goes back to whatever
the page had before: removed if it had nothing, restored if the page's own markup
set it.

### Presets

`presets` puts one-click values under a string or number field. Up to six render as
pills; more become a dropdown. A bare value labels itself; `{ label, value }` names it.

```ts
fields: {
  title:  { type: "string", default: "Acme", presets: "stress" },
  unread: { type: "number", default: 3, min: 0, presets: [0, 1, { label: "99+", value: 120 }] },
}
```

`presets: "stress"` uses the built-in worst cases, exported as `STRESS_TEXT` and
`STRESS_NUMBERS`:

| Set | Values |
| --- | --- |
| text | Empty, whitespace only, one character, long, 2,000 characters, an unbreakable compound and URL, a long email, right-to-left Arabic, mixed-direction text, CJK, emoji with ZWJ and skin-tone sequences, diacritics, HTML markup, newlines |
| numbers | 0, 1, -1, `0.1 + 0.2`, 99, 100, 999, 1,000, 1M, `Number.MAX_SAFE_INTEGER`. Only those inside the field's `min`/`max`. |

A preset the field would refuse to hold (outside its range, wrong type) throws at boot.
Use `multiline: true` with the text set, or the "Lines" preset loses its newlines to a
single-line input.

A boolean reads `1`, `0`, `true`, `false`, `on` or `off` from a URL, and writes `1` or `0`.

A field value that fails validation (wrong type, an enum option that no longer exists,
a number outside `min`/`max`) is dropped from storage and URLs rather than reaching
context. Storage outlives configs.

## Actions

```ts
actions: [{ id, label, title?, group?, when?, run: (api) => void }]
```

`api` is `{ set, go, reset, navigate, get }`. `navigate` is a no-op (with a dev warning)
unless the provider was given a `navigate` prop.

`title` is the hover tooltip. `group` moves the button into that section, after the
section's rows; without it the button renders last, after the panel's `children`.

## ScenarioProvider

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `machine` | `Machine` | None | **Required.** |
| `storageKey` | `string` | None | **Required.** Version it when a field changes meaning. |
| `path` | `string \| null` | `null` | Current route, for `when` predicates. |
| `navigate` | `(to: string) => void` | None | Router push, for actions. |
| `env` | `Record<string, unknown>` | None | Merged into what `when` sees. |
| `enabled` | `boolean` | `NODE_ENV !== "production"` | Whether the controls mount. Context is provided either way. |
| `syncUrl` | `boolean` | `false` | Keep the address bar in step with the scenario (`replaceState`, other params kept). Off: scenario params are read once, then removed. |
| `syncTabs` | `boolean` | `false` | Follow scenario changes saved by other tabs on the same `storageKey`. |

Mount it once, above everything that reads a scenario.

### Precedence

```
defaults  <  localStorage  <  URL  <  this session's clicks
```

Storage is read on the render after hydration, never in an effect: the server and the
first client render both produce the declared defaults, so markup matches and nothing
needs `suppressHydrationWarning`.

A URL carrying any scenario parameter is authoritative: storage is ignored for that load,
then overwritten with what the URL said. Storage holds only values that differ from their
defaults, plus a hash of the config's shape; a saved scenario from a different shape is
dropped. Writes are batched (~150ms) and flushed on `pagehide`.

In development, two providers sharing a `storageKey` log a warning.

## ScenarioPanel

| Prop | Type | Default |
| --- | --- | --- |
| `position` | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | `"bottom-right"` |
| `title` | `string` | `"Prototype controls"` |
| `zIndex` | `number` | `2147483000` |
| `draggable` | `boolean` | `true` |
| `inset` | `{ name: string; value: string }` | None |
| `nonce` | `string` | None |
| `enabled` | `boolean` | the provider's |
| `avoidBars` | `boolean` | `true` |
| `tools` | `boolean` | `true` |
| `children` | `ReactNode` | None |

`children` renders after the rows, for anything the config cannot express: a
theme switch bound to the host's own provider, a link to the design file. It renders
inside the panel's shadow root, where the host's stylesheets do not reach, so build it
from the exported `Row`, `Pill` and `Select` rather than from the product's components.

### Isolation

The panel never takes on the look of the product it sits in. It renders through a
portal into a shadow root on a `<prototype-machine>` element appended to `<body>`:

- **No host selector reaches it.** A reset that restyles every `button` or `select`, a
  `* { font-family }` rule, Tailwind's preflight, a dark-mode class: none of them match
  inside the shadow root.
- **Inheritance is cut.** `:host` resets every inherited property (font, colour,
  letter-spacing, text-transform, direction, visibility, cursor, colour-scheme) with
  `!important`, which beats even `!important` rules aimed at the host element from
  outside. The panel stays left-to-right on an RTL page and 12px on a page whose root
  font size is 20px.
- **The host element pins itself** with an inline `!important` style, so a page rule like
  `body > * { display: flex; transform: … }` cannot move or hide it.
- **Its stacking is its own.** Being on `<body>` rather than inside the app means no
  ancestor `transform` turns `position: fixed` into "fixed to that wrapper", and the
  default `zIndex` keeps it above the product's modals and toasts, which are the states you
  most need to drive while they are open. Native top-layer elements (`<dialog>.showModal()`,
  the Popover API) still draw above it.
- **Its events stay inside.** Keystrokes, pointer and focus events stop at the host
  element, so a host hotkey does not fire while you type in the panel, and a modal
  library's "click outside" does not close the dialog you are inspecting.
- **Dropdowns are drawn by the panel**, not by the browser: a native `<select>` popup is
  painted from the OS and the host's colour scheme, which is how a dark panel used to
  open an unreadable light list. See [Dropdowns](#dropdowns).

Where a browser cannot attach a shadow root the panel falls back to the same element
with its stylesheet in `<head>`; every rule is still `pm-` prefixed and stated
explicitly. Each tool has its own host element, marked with `data-pm-layer` (`"panel"` or `"switcher"`).
Tests that query the panel should search
`document.querySelector('prototype-machine[data-pm-layer="panel"]').shadowRoot`.

### Dropdowns

An enum past six options (or with `control: "select"`), a machine past six states, and a
long preset list render as a button that opens a listbox.

- The list is `position: fixed`, so the panel's scroll box cannot clip it, and it flips
  above the trigger when there is no room below.
- Past ten options it grows a filter box.
- A machine's illegal moves are listed but struck through and unchoosable, with the
  reason as a tooltip and in the accessible name.
- Keyboard: `↓`/`↑` open it from the trigger; inside, `↑` `↓` `Home` `End` `PageUp`
  `PageDown` move, typing jumps to a matching label, `Enter` or `Space` chooses, `Esc`
  closes the list without closing the panel, and `Tab` returns to the trigger.

### Header

| Button | Does |
| --- | --- |
| Copy | Copies the scenario as text: every control's value, changed ones marked with their default, then the query string that reproduces it. When anything has changed, it ends with the config edits that would make this the starting scenario (`machines.journey.initial: "keyMade"`, `fields.seats.default: 40`), written as an instruction a coding agent can carry out. Tune it in the panel, copy, paste into the agent, and it becomes the default. |
| Reset | Resets the scenario, with a count of how many values are off their default. Disabled when nothing is. |
| Pin | Keeps the panel open through clicks outside. |
| Close | Collapses to the launcher. |

A changed field also gets its own **Reset** beside its label, and the collapsed
launcher shows a dot while anything is off its default. The header stays put while a
long panel scrolls.

### Page tools

The **Page** section, at the foot of the panel, stresses the host page as a whole.
These are states of the person looking, not of the product, so they are not part of
the scenario config.

| Tool | Values | Does |
| --- | --- | --- |
| Direction | Auto, LTR, RTL | Sets `dir` on `<html>`. |
| Text size | 100%, 125%, 150%, 200% | Scales the root font size from the page's own computed value, as a browser text-size setting would. Layouts in `rem`/`em` respond; ones in `px` do not, which is the finding. |
| Motion | Normal, Slow ×10, Paused | Slows or pauses CSS animations and Web Animations, and with Paused turns transitions off. JavaScript-driven `requestAnimationFrame` motion is out of reach. |

Each tool records what the page had and puts it back when switched off or unmounted.
Tools persist with the panel's other UI state. `tools={false}` removes the section.

`inset` sets a CSS custom property on `<html>` while the controls are mounted, so the
host can push its own corner UI clear: `{ name: "--toast-inset-bottom", value: "4.5rem" }`.

`zIndex` defaults to 2147483000 so the controls stay reachable over the product's own
modals. Lower it if something must never be covered, even after someone drags the panel
over it.

`avoidBars` (default `true`) keeps the corners clear of bars fixed to the top or bottom
edge of the page, such as a header or a footer. A bar counts when it is `fixed` or
`sticky`, touches the edge, spans at least half the viewport's width, and is no taller
than 30% of its height. The corner moves inward by the bar's height, and an open panel's
height leaves room for both edges. The check runs again after a resize, a scroll or a
change to the page. A panel dragged to a free position stays where it was put.

`nonce` is set on the `<style>` element inside the shadow root, for pages with a strict
CSP.

The panel is non-modal: focus moves to the first control on open, and a click outside
closes it unless it is pinned (the pin button in the header). Open, pinned and collapsed
sections and the page tools persist under `` `${storageKey}:pm-panel-ui` ``. Past eight rows a filter box
appears. Unreachable states are `aria-disabled` and say why, to screen readers and in a
tooltip.

In production (the `production` export condition) `ScenarioPanel` from the main entry
renders nothing. Import it from `prototype-machine/panel` to show it in a review build.

### Grouping

Any machine, field or action can carry `group`. A section is a title and its controls,
nothing else: there is no description line. Explanations go in `note` (a tooltip).

`group` names a section. Controls sharing a group render together under a heading with
that text. The rules:

- Ungrouped controls render first, above every section, in declaration order.
- Sections follow in the order their group is first seen, walking machines, then fields,
  then actions.
- Inside a section the order is machines, then fields, then that section's actions.
- Ungrouped actions render last, after `children`.
- Section titles are buttons that collapse the section; collapsed state is remembered.
- A section with nothing visible in it is not rendered.

```ts
fields: {
  unread: { type: "number", label: "Unread", default: 0, group: "Inbox" },
  dark:   { type: "boolean", label: "Dark mode", default: false, group: "Look" },
}
```

The same split is available without React as `sectionsOf(machine.config, env)` from the
core entry. It returns `PanelSection[]`, each `{ group, machines, fields, actions }`,
with `group: null` for the ungrouped section.

### Dragging and snapping

`position` is where the panel *starts*. Drag the launcher anywhere, or the expanded
panel by its header; buttons and inputs inside the header are excluded, so a button click
is never a drag.

**Release within 140px of a corner and it takes the corner**, measured diagonally, so a
drop that is 100px out on both axes is 141px away and stays put. A dashed outline
previews the corner while you drag, and the settle is animated once.

What gets stored is the corner itself, not pixels:

| Stored | Rendered as |
| --- | --- |
| `{ kind: "corner", corner }` | The `pm-<corner>` class, so the browser keeps it anchored through a resize |
| `{ kind: "free", x, y }` | Inline offsets, clamped to the viewport on resize and on mount |

Under `` `${storageKey}:pm-panel-position` ``. A bare `{x, y}` from before snapping
existed is migrated to a free placement rather than discarded.

Movement under 8px is a click, not a drag. Arrow keys nudge by 8px (32 with shift) while
the handle has focus, and always produce a free placement, because someone pressing an arrow key
is aiming. Double-click the handle to send it back to `position` and forget the stored
value. `draggable={false}` turns all of it off.

## StateBench

```tsx
import { StateBench } from "prototype-machine"

<StateBench states={STATES} missing={MISSING} initial="typical" width={880} label="Request log states">
  {(state) => <RequestLog {...FIXTURES[state]} />}
</StateBench>
```

One component in each of its states, with a switcher. It needs no provider. For the
workflow, read [bench.md](bench.md).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `states` | `Record<string, string \| { label?, note? }>` | None | **Required.** Every state, in switcher order. The key is the URL value. A string is the label. `note` is the tooltip. |
| `children` | `(state) => ReactNode` | None | **Required.** Renders the real component in one state. Called for the active state only. |
| `missing` | same shape as `states` | None | States the design shows but the code cannot reach. Listed and disabled. Never rendered. |
| `initial` | a key of `states` | the first key | Shown when the URL names no state, or names one that is not known. |
| `param` | `string` | `"__state"` | The search parameter. Exported as `STATE_PARAM`. |
| `width` | `number \| string` | the page's width | As wide as the component is in production. A number is pixels. Capped at `100%`. |
| `label` | `string` | `"States"` | The switcher's accessible name. |
| `placement` | `"bottom" \| "top"` | `"bottom"` | The edge the switcher sits on, centered. |
| `offset` | `number \| string` | `24px` | Distance from that edge. A string is any CSS length, such as `"calc(var(--header-h) + 8px)"`. |
| `zIndex` | `number` | `2147483000` | Stacking order of the switcher. |
| `nonce` | `string` | None | Set on the switcher's `<style>`, for a strict CSP. |
| `enabled` | `boolean` | `NODE_ENV !== "production"` | Whether the switcher mounts. The state renders either way. |
| `avoidBars` | `boolean` | `true` | Keep the switcher clear of bars fixed to its edge of the page. Ignored when `offset` is set. |

**The URL is the source of truth.** A click writes `?__state=<id>` with `replaceState`.
Other parameters and the hash are kept. Back and forward are followed. A click always
writes the parameter, also for `initial`, so a link means the same thing after `initial`
changes.

**Nothing renders until the URL can be read.** On the server and during hydration the
container is empty, so no state's fixtures show for one frame by mistake.

**Each state mounts fresh.** The child is keyed by the state id, so a seeded cache or a
held request belongs to the state that set it up.

**The page's markup is minimal:**

```html
<div data-state-bench data-state="empty" style="width: 880px; max-width: 100%">...</div>
<div aria-hidden="true" data-state-bench-spacer style="height: 88px"></div>
```

The container sets only `width` and `max-width`. The spacer is on the switcher's side, so
the bar never covers the end of a long component. Without the switcher there is no spacer.
When the switcher sits above a bar fixed to the page's edge, it moves 8px clear of the bar
and the spacer grows by the bar's height.

**The switcher** renders in its own shadow root (`data-pm-layer="switcher"`), apart from
the panel. It is a `<nav>` with the `label` as its name and a button for each state, with
`aria-pressed` on the current one. A missing state is `aria-disabled`, struck through, and
says "Not in the code yet" with its note, as a tooltip and to screen readers. On a narrow
screen the bar scrolls sideways and keeps the current state in view. **Hide** removes it
until the page reloads.

**In production** (the `production` export condition) the main entry renders the state
the URL names, without the switcher, and the switcher's code is not shipped.
`prototype-machine/panel` keeps the switcher for a review build.

## useStateParam

```ts
const [state, setState] = useStateParam(["loading", "empty", "typical"], { initial: "typical" })
```

The hook under `StateBench`, for a bench with its own layout.

| Option | Type | Default |
| --- | --- | --- |
| `initial` | one of the ids | **Required.** |
| `param` | `string` | `"__state"` |
| `missing` | `string[]` | `[]` |

`state` is `null` until the URL can be read. `setState` writes with `replaceState` and
keeps other parameters and the hash. A URL value that is not in the ids warns and gives
`initial`.

## StateCanvas

```tsx
import { StateCanvas } from "prototype-machine"

<StateCanvas states={STATES} missing={MISSING} width={880} frames="stress" label="Request log">
  {(state, frame) => <RequestLog {...FIXTURES[state]} />}
</StateCanvas>
```

One component in every state at once, each state in every frame, on a surface you pan
and zoom. A row per state, a column per frame. It needs no provider. For the workflow,
read [canvas.md](canvas.md).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `states` | `Record<string, string \| { label?, note? }>` | None | **Required.** Every state, one row each, in this order. The shape `StateBench` takes. |
| `children` | `(state, frame) => ReactNode` | None | **Required.** Renders the real component in one state, in one frame. Called once for each pair. |
| `missing` | same shape as `states` | None | States the design shows but the code cannot reach. Each gets a row with a placeholder that says so, never a render. |
| `frames` | `Record<string, string \| CanvasFrameDef> \| "stress"` | one frame at `width` | The columns. `"stress"` is the built-in set, below. |
| `width` | `number \| string` | `1280` | The component's width in production, and the width of any frame that names none. A length, never a percentage. |
| `label` | `string` | `"States"` | The canvas's accessible name, and its bar's. Also part of the key its camera is saved under. |
| `param` | `string` | `"__state"` | The search parameter naming the state in focus. |
| `frameParam` | `string` | `"__frame"` | The search parameter naming the frame in focus. Exported as `FRAME_PARAM`. |
| `zIndex` | `number` | `2147483000` | Stacking order of the names and the bar. The surface sits 1000 below. |
| `nonce` | `string` | None | Set on the canvas's `<style>`, for a strict CSP. |
| `enabled` | `boolean` | `NODE_ENV !== "production"` | Off, every frame renders in a plain grid with no camera, names or bar. |

### Frames

A frame is a condition the component is put in from outside. It changes the container,
never the data.

| Key | Type | Description |
| --- | --- | --- |
| `label` | `string` | The column's name. Defaults to the id. |
| `note` | `string` | The name's tooltip. |
| `width` | `number \| string` | The container's width. Defaults to the canvas's `width`. |
| `minHeight` | `number \| string` | The frame is at least this tall. |
| `dir` | `"ltr" \| "rtl"` | Text direction on the container. |
| `attrs` | `Record<string, string>` | Attributes on the container, for CSS that reads them: `{ "data-theme": "dark" }`, `{ class: "dark" }`. Selectors pinned to `:root` or `html` cannot see them. |
| `background` | `string` | The frame's background. Defaults to the page's own. |
| `squeeze` | `number \| string` | Room a hatched sibling takes from the container, as a flex neighbour would. The component keeps its content's minimum width, so content that will not shrink runs past. |

`frames="stress"` is `stressFrames(width)`, exported:

| Id | Label | Container |
| --- | --- | --- |
| `shipped` | the width | as wide as `width` |
| `narrow` | `320px` | 320px. Left out when `width` is 320 or less. |
| `squeezed` | `Squeezed` | `width`, with a sibling taking 40% |
| `wide` | `1440px` | 1440px, or one and a half times `width` when that is wider |
| `rtl` | `Right to left` | `width`, with `dir="rtl"` |

A frame's container sets its width, its minimum height, its direction, its attributes,
its background and `contain: layout`, which makes it the containing block for anything
the component fixes in place: a modal's backdrop covers its own frame. Nothing is
clipped; content wider than the frame runs past its edge. Media queries read the
viewport, not the frame, and a portal into `<body>` draws outside it.

### The surface

The canvas fills the viewport with a dark surface. The frames are the product's: they
render in the page's light DOM and inherit its fonts and colours, and the camera moves
them with one transform. Everything the canvas adds is in its own shadow root
(`data-pm-layer="canvas"`), drawn at the same size at any zoom:

- **Names.** The states down the left, the frames along the top. They freeze to the
  screen's edges, like a spreadsheet's headers, so a frame you have zoomed into is still
  named. A name is a toggle: a state's name focuses its row, a frame's name its column,
  both together one frame. Names that would land on each other give way, in order.
- **Crop marks** just outside each frame's corners show where its container ends, without
  a border that could pass for the component's own. The frame in focus has violet marks.
- **Findings.** Each frame is measured once the layout settles. A frame whose content is
  wider than its container, or that holds a box hiding content without an ellipsis or a
  scrollbar, gets amber marks and a note under its corner (`134px too wide`, `Cuts off
  content`).
- **The bar**, at the bottom: zoom out, the zoom level (click it for 100%), zoom in, Fit,
  Text 200%, Pause motion, and the count of frames with findings. Click the count to step
  through them.

The first view is the frame or row a link names, else where this canvas was left, else
everything. The camera is saved under
`` `prototype-machine:canvas:${pathname}:${label}` `` as `{ v: 1, x, y, z }`.

### Moving around

| Input | Does |
| --- | --- |
| Drag empty space, or the middle button anywhere | Pan |
| Wheel or two-finger scroll | Pan. A box inside a frame that can scroll that way scrolls instead. |
| `Ctrl` or `Cmd` + wheel, a trackpad pinch, a two-finger pinch | Zoom around the pointer |
| Tab into a frame | The camera moves to show what has focus |

A drag that starts on a frame belongs to the component, so buttons click and text
selects. Zoom runs from 5% to 400%.

### The URL

`?__state=empty` opens the canvas on that row, `?__frame=narrow` on that column, and both
on one frame. Clicking a name writes them with `replaceState`, keeping other parameters
and the hash. Fit removes them. Back and forward are followed. A value the canvas does
not have warns, with a suggestion.

### For tests

| Attribute | On | Value |
| --- | --- | --- |
| `data-state-canvas` | the grid | |
| `data-state-canvas-frame` | each frame | with `data-state`, `data-frame` and an `aria-label` of `"State, Frame"` |
| `data-state-canvas-missing` | each missing state's placeholder | with `data-state` |
| `data-overflow` | a frame wider than its container | the overflow in pixels |
| `data-clipped` | a frame with boxes that hide content | how many |

In production (the `production` export condition) the main entry renders every frame in
the plain grid, and the camera's code is not shipped. `prototype-machine/panel` keeps
the canvas for a review build.

## PinnedScenario

```tsx
import { PinnedScenario } from "prototype-machine"

<PinnedScenario machine={scenario} values={{ journey: "keyMade", data: "empty" }} path="/overview">
  <Overview />
</PinnedScenario>
```

A scenario pinned to one set of values, for showing a screen in a state without the
panel: in a canvas frame, beside the same screen in another state.

| Prop | Type | Description |
| --- | --- | --- |
| `machine` | `Machine` | **Required.** |
| `values` | machine states and field values, flat | Where this scenario starts. Anything left out is at its default. Checked against the config. |
| `path` | `string \| null` | Current route, for `when` predicates. |
| `navigate` | `(to: string) => void` | Router push, for actions. |
| `env` | `Record<string, unknown>` | Merged into what `when` sees. |

- It reads no storage and no URL and writes neither, so any number share a page, and one
  inside a `ScenarioProvider` leaves the outer scenario alone.
- `go` and `set` work inside it, so the product's own buttons move it on. `reset` goes
  back to `values`.
- A field with `dom` sets its attribute on a `display: contents` wrapper around the
  children (`data-pinned-scenario`), not on `<html>`, so two can differ on one page.
- A `ScenarioPanel` inside it does not mount.
- A value that is not one of a machine's states, a key a machine writes, a value a field
  would refuse, or an unknown key throws. A canvas labels each frame with its pin, so a
  pin that fell back to the default would be a frame labelled with a state it is not in.

## useScenario

```ts
const p = useScenario(scenario)   // typed
const p = useScenario()           // untyped, for a shared component
```

Returns context and the API on one object.

| Member | Signature | Notes |
| --- | --- | --- |
| `go` | `(machine, state) => void` | Refuses an undeclared move; warns with the legal ones. |
| `set` | `(patch) => void` | Refuses machine-owned keys and undeclared fields. |
| `can` | `(machine, state) => boolean` | From the current state. |
| `movesFrom` | `(machine) => string[]` | |
| `reset` | `() => void` | Defaults, and clears storage. |
| `snapshot` | `{ machines, fields }` | |
| `machine` | `CompiledMachine` | |
| `env` | `Env` | |
| `navigate` | `(to) => void` | |
| `hydrated` | `boolean` | |
| `enabled` | `boolean` | |
| `open` / `setOpen` | | For your own trigger. |
| `storageKey` | `string` | The provider's own key, for namespacing beside it. |

`useScenario(machine)` types `go`, `can`, `movesFrom` and `set` against the config:
state ids and field values are checked.

`useScenarioValue(machine, key)` reads one value and re-renders only when it changes.
`useScenarioSelector(machine, ctx => ...)` does the same for any derived slice.

Misspelled ids in `go` and `set` warn with a "did you mean" suggestion.

These names are reserved and a config may not use them for context keys. `compile`
throws if it tries.

## The core entry

```ts
import { defineMachine, toSearch, fromSearch, resolve } from "prototype-machine/core"
```

No React import anywhere in it. Use it in tests, scripts, or a non-React adapter:
`compile`, `defineMachine`, `isDev`, `isValidFieldValue`, `optionsOf`, `ScenarioError`,
`sectionsOf`, `visible`, `warn`, `has`, `suggest`, `describe`, `summarize`,
`toDefaults`, `changedCount`, `presetsOf`, `STRESS_TEXT`, `STRESS_NUMBERS`, `isDate`, `clearStorage`,
`fromSearch`, `readStorage`, `resolve`, `toSearch`, `mergeSearch`, `diffFromDefaults`,
`shapeOf`, `writeStorage(machine, key, snapshot)`, `statesOf`, plus every type in the schema. The React entry additionally
exports the snapping primitives (`snapTarget`, `cornerPosition`, `clampToViewport`,
`useDrag`), which are pure and testable without a DOM, and `stressFrames`.

`statesOf(machine, id)` lists one machine's states, or one enum field's options, as
`{ id: { label, note } }` in declaration order, labelled the way the panel labels them.
It is a canvas's `states` or `frames`. Its keys are typed as the state ids, so a canvas's
`children` can pass them to `PinnedScenario`. It throws for an unknown id, with a
suggestion, and for a boolean field, saying what to write instead.

`describe(machine)` prints a text outline of the scenario space (states, legal moves,
dead ends, fields, actions). `summarize(machine, snapshot)` prints the scenario on
screen, and `toDefaults(machine, snapshot)` writes the config edits that would make it
the starting scenario (empty when nothing changed). The panel's Copy button writes
both. `changedCount(machine, snapshot)` counts the values off their default. `writeStorage` saves only values that differ from their
defaults, tagged with `shapeOf(machine)`; a stored shape that no longer matches is ignored.

A compiled machine is itself usable without React. `scenario.contextOf(snapshot)` returns
the flat object a screen would read; `scenario.can(machineId, from, to)` takes an explicit
`from`, unlike the hook's version, which is relative to the current state;
`scenario.movesFrom(machineId, from)` and `scenario.sanitize(partial)` round it out.

## Errors and warnings

Thrown at module load, by `compile`:

- an `initial` that is not one of the machine's states
- a transition naming a state that does not exist
- two machines assigning the same key
- a machine and a field claiming the same key
- two controls wanting the same query parameter
- a derived name shadowing something real
- a context key that would shadow the API
- an enum default that is not one of its options
- a date default that `Date` cannot read
- a preset the field would refuse to hold, or a preset with an empty label
- duplicate action ids

Thrown on render, by `<StateBench>`:

- no `states`
- an `initial` that is not one of its states, with a suggestion
- an id in both `states` and `missing`
- a state with an empty label

Thrown on render, by `<StateCanvas>`: the same, plus

- an empty `frames` object
- a frame with an empty label
- a width, `minHeight` or `squeeze` that is a percentage, or not above zero
- an attribute in `attrs` that is not a valid name

Thrown on render, by `<PinnedScenario>`:

- a value that is not one of a machine's states, with a suggestion
- a key a machine assigns, naming the machine to pin instead
- a value a field would refuse to hold
- a key that is not a machine or a field, with a suggestion

Console warnings at runtime:

- a state nothing can reach
- `set()` on a machine-owned key, naming the owner
- `go()` to an unknown state or an illegal move, naming the legal ones
- a URL parameter that does not name a valid state or value
- `navigate` with no `navigate` prop
- an action whose `run` throws (the panel stays up)
- a `?__state=` value that is not a bench state (with a suggestion), or that names a
  missing state
- a `?__state=` or `?__frame=` value that is not a state or frame of a canvas, with a
  suggestion

The errors are worded to name the fix. They are the main way the package teaches the
model, so do not swallow them.

## Keyboard

The panel opens **only** from a click on its launcher button. There is no global shortcut
that reveals it, and no prop to bind one. A dev tool should not claim a key on a page it
is only visiting, and a reviewer who has not been told a shortcut exists cannot use it
anyway.

| Binding | Does |
| --- | --- |
| `Esc` | Close the open dropdown; otherwise close the panel |
| `↓` `↑` on a dropdown | Open it |
| `←` `→` `↑` `↓` on a slider | One step down or up |
| `shift` + arrows, `Page Up` `Page Down` on a slider | Ten steps |
| `Home` `End` on a slider | Its minimum or maximum |
| `↑` `↓` `←` `→` | Nudge the panel 8px while its handle has focus |
| `shift` + arrows | Nudge 32px |
| `←` `→` `↑` `↓` in a switcher bar | Previous or next state. Skips disabled states and wraps. |
| `Home` `End` in a switcher bar | First or last state |
| `←` `→` `↑` `↓` on a focused canvas | Pan 80px (`shift`: 320px) |
| `+` `-` on a focused canvas | Zoom to the next stop |
| `1` on a focused canvas | Fit every frame |
| `0` on a focused canvas | Zoom to 100% |

The switcher's keys work only while focus is inside the bar. They ignore `ctrl`, `alt`,
`meta` and `shift`, so browser and system shortcuts still work.

The canvas's keys work only while the canvas itself has focus, not a component inside a
frame: there, the keys are the component's. They ignore `ctrl`, `alt` and `meta`, so
`Ctrl` `+` still zooms the browser.

Closing returns focus to the launcher, so a keyboard user does not have to start over
from `<body>`.
