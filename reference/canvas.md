# State canvas

**Part of [prototype-machine](../SKILL.md)**. Targets prototype-machine 0.12.0.

A canvas shows one component in every state at once. Each state is a row. Each column is
a frame: a condition the component is put in from outside, such as a 320px container, a
sidebar that squeezes it, or right-to-left text. You pan and zoom it like a design file,
and it flags every frame whose content overflows its container or is cut off.

The method comes from the
[break skill](https://github.com/jakubkrehel/skills/tree/main/skills/break) by Jakub
Krehel: render the real component under every scenario that can reach it, on one page,
and report what visibly breaks. The surface follows the
[component-canvas skill](https://www.ui-skills.com/skills/ibelick/component-canvas) from
ibelick's UI Skills. The differences are listed at the end.

## Contents

1. [Choose the tool](#1-choose-the-tool)
2. [Scope one component](#2-scope-one-component)
3. [Find the states, then the frames](#3-find-the-states-then-the-frames)
4. [Build the page](#4-build-the-page)
5. [Frames](#5-frames)
6. [A screen in every state of a machine](#6-a-screen-in-every-state-of-a-machine)
7. [Look at every frame](#7-look-at-every-frame)
8. [Report what you saw](#8-report-what-you-saw)
9. [Check it in a test](#9-check-it-in-a-test)
10. [Remove it](#10-remove-it)
11. [Before you finish](#11-before-you-finish)
12. [Differences from the source skills](#12-differences-from-the-source-skills)

---

## 1. Choose the tool

| Question | Tool |
| --- | --- |
| "Give me a link to the error state of this component." | `StateBench` |
| "Show every state of this component at once." "Break it." "Stress-test it." | `StateCanvas` |
| "Show this screen in every rung of the journey." | `StateCanvas` with `statesOf` and `PinnedScenario` |
| "What does the product look like when the account is in state X?" | `defineMachine` and `ScenarioPanel` |

A bench and a canvas take the same `states`, `missing` and fixtures. Write the fixtures
once and give each its own route: the bench for a link to one state, the canvas for all
of them.

## 2. Scope one component

- Work on one component per canvas. If the user names a page, ask which component on
  it, or build a canvas of the whole screen (section 6).
- The canvas covers the component the user named. A child's states show only when the
  parent can cause them.

## 3. Find the states, then the frames

**States first.** Follow [bench.md step 3](bench.md#3-find-the-states-in-the-code). A
state is a branch the code takes, plus the edges real data makes. A state the code
cannot reach goes in `missing`.

**Then the axes.** Go through each axis below against this component. Keep an axis only
when its cue matches. Write down the axes you kept before you build, and each one you
dropped with its reason.

| Axis | Values | Keep it when | Goes into |
| --- | --- | --- | --- |
| Content length | empty, one word, typical, several sentences, one unbroken string | the component renders text it does not write: user input, API data, translations | states, with `STRESS_TEXT` in the fixtures |
| Content shape | emoji sequences, right-to-left, mixed direction, diacritics, CJK, numbers in columns | that text can come from users or locales the team does not write in | states, with `STRESS_TEXT` in the fixtures |
| Quantity | zero, one, the realistic count, a page, a page plus one, ten times the realistic count | the component repeats over items | states |
| State | loading, error, disabled, refetching | the code branches on it | states |
| Container | as shipped, 320px, squeezed by a sibling, very wide | always | `frames="stress"` |
| Direction | right to left | the product ships to a right-to-left locale, or might | `frames="stress"` |
| Theme | light, dark | the product's CSS reads the theme from an attribute or a class | a frame with `attrs` and `background` |
| Text size | 200% | always | the bar's Text 200% |
| Motion | paused | the component animates | the bar's Pause motion |

**The rule: states are what the component is fed, frames are what it is put in.**
Content goes through fixtures, at the component's data boundary. A frame never changes
the data. It changes the container.

A text input keeps content length and state, and drops quantity. A static icon button
keeps container and direction, and drops content length: its label is written by the
team, not by a user.

## 4. Build the page

Put the canvas beside the bench, in the same folder, so removal stays one step.

```
src/states/request-log/
  fixtures.ts    product-shaped data for each state
  page.tsx       the bench
  canvas.tsx     the canvas
```

```tsx
// src/states/request-log/canvas.tsx
import { StateCanvas } from "prototype-machine"

import { RequestLog } from "../../components/request-log"
import { FIXTURES, MISSING, STATES } from "./fixtures"

export function RequestLogCanvas() {
  return (
    <StateCanvas states={STATES} missing={MISSING} width={880} frames="stress" label="Request log">
      {(state) => <RequestLog {...FIXTURES[state]} />}
    </StateCanvas>
  )
}
```

- Register the route the way the app registers its others, such as
  `/states/request-log/canvas`. Do not link it from the app's navigation.
- Render the real component. Do not copy it, wrap it or restyle it.
- `width` is the component's width in production, as on the bench.
- The canvas fills the viewport, above the app's layout. Add nothing around it.
- **Every frame mounts at once.** A fixture that seeds something shared (a query cache, a
  store, a module-level variable) seeds it once per frame, and the frames overwrite each
  other. Give each frame its own copy: wrap the child in its own provider with a fresh
  client. `children` gets the state and the frame id for this.

```tsx
{(state, frame) => (
  <QueryClientProvider client={clientFor(state, frame)}>
    <RequestLog />
  </QueryClientProvider>
)}
```

- Loading is held still with a pending status, as on the bench. The bar's Pause motion
  stops a skeleton's shimmer so every frame can be compared at rest.

## 5. Frames

`frames="stress"` is the built-in set, worked out from `width`:

| Id | Label | What it does |
| --- | --- | --- |
| `shipped` | the width, such as `880px` | The component as it ships. |
| `narrow` | `320px` | The narrowest phone in common use. Left out when `width` is 320 or less. |
| `squeezed` | `Squeezed` | A hatched sibling takes 40% of the row, the way a sidebar would. The component gets the rest, unless its content refuses to shrink. |
| `wide` | `1440px`, or one and a half times `width` | A container much wider than designed. |
| `rtl` | `Right to left` | `dir="rtl"` on the container. Logical properties flip; physical ones do not. |

Your own frames are an object, one column each:

```tsx
<StateCanvas
  states={STATES}
  width={880}
  frames={{
    light: { label: "Light" },
    dark: { label: "Dark", attrs: { "data-theme": "dark" }, background: "#0b0b0b" },
    phone: { label: "Phone", width: 375 },
  }}
>
```

| Key | Does |
| --- | --- |
| `width` | The container's width. Defaults to the canvas's `width`. A length, never a percentage. |
| `minHeight` | The frame is at least this tall. For a whole screen, the viewport height it is designed for. |
| `dir` | `"rtl"` or `"ltr"` on the container. |
| `attrs` | Attributes on the container: `{ "data-theme": "dark" }`, or `{ class: "dark" }` for Tailwind's class strategy. |
| `background` | The frame's background. Defaults to the page's. A dark frame needs the dark one. |
| `squeeze` | Room a hatched sibling takes from the container, as a flex neighbour would. |
| `label`, `note` | The column's name, and its tooltip. |

What a frame can and cannot reach:

- **CSS that reads an ancestor reaches it.** `[data-theme="dark"] .card`, Tailwind's
  `dark:` with the class strategy, and `[dir="rtl"]` selectors all match inside the frame.
- **CSS pinned to the root does not.** `:root[data-theme="dark"]`, `html.dark` and
  `@media (prefers-color-scheme: dark)` cannot see a frame's attributes. Check those
  with the page's own switch, one at a time.
- **Media queries read the viewport, not the frame.** A 320px frame does not switch a
  layout that changes at `@media (max-width: 640px)`. That layout needs a narrow window,
  or a bench in a narrow window. Container queries do respond, when the component's own
  markup declares the container.
- **`100vh` is the real viewport.** Use `minHeight` for a screen's height.
- **Portals leave the frame.** A dialog or popover rendered into `<body>` draws in screen
  space, behind the canvas. If the library takes a container, give it one inside the
  child. Otherwise, check that state on the bench.

## 6. A screen in every state of a machine

A canvas of a whole screen uses the scenario the prototype already declares. `statesOf`
lists a machine's states, labelled the way the panel labels them, and `PinnedScenario`
shows the screen in one of them:

```tsx
import { PinnedScenario, StateCanvas, statesOf } from "prototype-machine"

import { scenario } from "../../scenario"
import { Overview } from "../../screens/overview"

const JOURNEY = statesOf(scenario, "journey")
const DATA = statesOf(scenario, "data")

export function OverviewCanvas() {
  return (
    <StateCanvas states={JOURNEY} frames={DATA} width={1280} label="Overview">
      {(journey, data) => (
        <PinnedScenario machine={scenario} values={{ journey, data }} path="/overview">
          <Overview />
        </PinnedScenario>
      )}
    </StateCanvas>
  )
}
```

- Rows are one machine's states, columns another's. `statesOf` also takes an enum field.
- `values` is checked against the config. A pin that names no state, or a key a machine
  writes, throws, because the frame would be labelled with a state it is not in.
- A pinned scenario reads no storage and no URL and writes neither, so twenty can share a
  page. `go` and `set` still work inside one, so the product's own buttons move it on.
- **Cross two machines only when the screen branches on both**, as with bench states.
  Five journey rungs by four data states is twenty real screens. Five by four by three
  roles is sixty, and most of them say nothing new.
- To show a screen at device sizes instead, pin the state in `children` and use frames
  with a `width` and `minHeight`: `{ laptop: { width: 1280, minHeight: 800 } }`.

## 7. Look at every frame

Open the canvas once, in a real browser. Do not open a browser for each state.

1. Open `/states/request-log/canvas`. It fits every frame on screen.
2. Read the count at the end of the bar: `13 overflowing`, or `No overflow`. Click it
   to step through the flagged frames. Each step is a link.
3. Click a state's name to fly to its row and a frame's name to fly to its column. Click
   both for one frame. The URL holds the focus: `?__state=long&__frame=narrow`.
4. **Look at every frame, not only the flagged ones.** The canvas measures two things.
   Everything else needs eyes.
5. Turn on Text 200% and look again. Then Pause motion, if anything animates.
6. Write one line for each break you see, under the frame's name, as you find it.

What the canvas measures, and what it does not:

| Measured | Flag | Data attribute |
| --- | --- | --- |
| The component is wider than its container. | `134px too wide` | `data-overflow="134"` |
| A box inside hides content without an ellipsis or a scrollbar. | `Cuts off content` | `data-clipped="1"` |

| Not measured: look for these |
| --- |
| Elements that overlap each other |
| Truncation with an ellipsis that hides the part that matters |
| An icon or arrow that points the wrong way in right to left |
| Text that is too faint, or a state that looks like another |
| A layout that jumps between two states |
| Anything outside the frame: a portal, a toast, the page's own scrollbar |

A flagged frame gets amber crop marks at any zoom, and the finding under its corner when
there is room. Overflow content past a frame is drawn over the dark surface, where dark
text is hard to see: that is why it is measured.

## 8. Report what you saw

Give the user the canvas URL and a table of what broke, broken frames first. Each frame
is a link that opens on it.

```
Canvas: http://localhost:5173/states/request-log/canvas

| Frame | Observed |
| --- | --- |
| Long values · 880px | The model id is cut mid-word. Nothing says it continues. |
| Long values · 320px | The table stops after the User column. Model, Tokens, Latency and Result are gone. |
| Typical · Squeezed | 134px too wide. The table will not shrink beside a sidebar and runs past it. |

Survived: Loading, Empty and Error in every frame; every state at 1440px; Text 200%.
Not in the code yet: Partly loaded.
Checked: 9 states × 5 frames in Chromium, Text 200%, axe 0 violations.
```

- **Observed, never predicted.** Report what the page shows. "This might overflow with a
  long name" is not a finding. Add the long name as a state and look.
- **No verdicts.** Say what broke, not whether the design is good.
- **Do not fix anything unless asked.** If asked, fix it, then open the same frames again
  to confirm.
- **Nothing broke** is a result. Say so, and list what was checked.

## 9. Check it in a test

The frames carry their state, their frame and their findings as attributes, so one test
covers all of them:

```ts
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("request log canvas", async ({ page }) => {
  await page.goto("/states/request-log/canvas")
  /* The bar's count appears once every frame has been measured. */
  await expect(page.locator(".pm-canvas-findings")).toBeVisible()

  const broken = await page
    .locator("[data-state-canvas-frame][data-overflow], [data-state-canvas-frame][data-clipped]")
    .evaluateAll((frames) => frames.map((f) => f.getAttribute("aria-label")))
  expect(broken).toEqual([])

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  expect(axe.violations).toEqual([])
})
```

For a screenshot of each state, use the bench loop in
[bench.md](bench.md#7-verify-every-state). A canvas screenshot is scaled.

## 10. Remove it

Remove the canvas only when the user says so, in one step:

1. Delete `canvas.tsx`, or the whole folder with the bench.
2. Remove the route registration.
3. Search for what is left. Expect no results.

```bash
rm src/states/request-log/canvas.tsx
grep -rn "states/request-log/canvas\|RequestLogCanvas" src
```

## 11. Before you finish

| Mistake | Fix |
| --- | --- |
| Every axis run on every component | Keep an axis only when its cue matches. Note the dropped ones. |
| Long text or RTL content added as a frame | A frame changes the container. Content goes in the fixtures, as a state. |
| A shared cache or store seeded by every frame | One provider with a fresh client per frame. |
| A breakpoint layout judged at a 320px frame | Media queries read the viewport. Use a narrow window. |
| `No overflow` reported as "nothing broke" | Look at every frame. The count measures two things. |
| A predicted failure in the report | Report what the page shows. |
| Every machine crossed with every other | Cross only what the screen branches on. |
| A copy or a wrapper of the component | Render the real one. |
| A browser opened for each state | One canvas, opened once. |
| The page deleted in the same turn as the report | Keep it until the user is done with it. |
| A global keyboard shortcut | None. Keys work only while the canvas has focus. |

## 12. Differences from the source skills

| Source | This package | Reason |
| --- | --- | --- |
| break: scenarios stacked in one column, each labelled | A grid you pan and zoom: states down, frames across, their names frozen to the screen's edges | Forty frames do not fit a column. A row compares one state across conditions; a column compares one condition across states. |
| break: each break spotted by eye | Overflow and clipping are measured and flagged; the eye does the rest | Content that spills past a frame is drawn over the canvas, where it is easy to miss. |
| break: environment toggled outside the page | Text size and motion in the bar; direction and theme as frames | Applied to every frame at once, one look covers them. |
| break: an Owner column naming a domain skill | Frame and Observed, each frame a link | This package ships no domain skills. The link opens the frame. |
| component-canvas: groups in dashed borders, titled above | Crop marks just outside each frame's corners | A border can be mistaken for the component's own. Crop marks show where the container ends without touching a pixel of it. |
| component-canvas: the camera saved per project | Saved per page and label; a link overrides it | A link must open on what it names. |
| component-canvas: Space, arrows and Escape on the canvas shell | Arrows, `+`, `-`, `1` and `0`, only while the canvas itself has focus | Space and Escape belong to the component inside a frame. |

**Known gaps.** A state's or frame's name that is off screen is hidden, so it is not in
the Tab order: press `1` (or Fit) to bring every name back. Notes show only as `title`
tooltips, as on the bench.
