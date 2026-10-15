# Component bench

**Part of [prototype-machine](../SKILL.md)**. Targets prototype-machine 0.11.0.

A bench shows one component in every state it can be in, on a scratch page, with a
switcher to step through the states. Each state has its own URL.

The method comes from the
[state-machine skill](https://github.com/jakubkrehel/skills/tree/main/skills/state-machine)
by Jakub Krehel. This file adapts it to this package. The differences are listed at the
end.

## Contents

1. [Choose the tool](#1-choose-the-tool)
2. [Scope one component](#2-scope-one-component)
3. [Find the states in the code](#3-find-the-states-in-the-code)
4. [Build the page in one folder](#4-build-the-page-in-one-folder)
5. [Feed data at the boundary](#5-feed-data-at-the-boundary)
6. [The switcher](#6-the-switcher)
7. [Verify every state](#7-verify-every-state)
8. [Hand it over](#8-hand-it-over)
9. [Remove it](#9-remove-it)
10. [Before you finish](#10-before-you-finish)
11. [Differences from the source skill](#11-differences-from-the-source-skill)

---

## 1. Choose the tool

| Question | Tool |
| --- | --- |
| "What does this component look like when the data is X?" | `StateBench` |
| "What does the product look like when the account is in state X?" | `defineMachine` + `ScenarioPanel` |
| "Step through one machine's states without the panel open." | `StateSwitcher` |

**Recommendation:** use a bench for one component and the panel for a journey across
screens. They work together: a bench page does not need the provider.

## 2. Scope one component

- Work on one component. If the user names a page, ask which component on it.
- The bench covers the component the user named. A child's states show only when the
  parent can cause them.

## 3. Find the states in the code

Read the component and the hooks it calls. A state is a branch that the code takes.

| Kind | Source | Examples |
| --- | --- | --- |
| Data | Query status, fetched values, counts | loading, empty, one, typical, paged, refetching, error |
| Account | Who looks, and what they can do | admin, member, trial expired, no permission |
| Feature | Flags, plan limits, settings | flag on, flag off, at the limit |

Rules:

1. **A state the code cannot reach is not a state.** Do not render a fake of it. Put it
   in `missing`. The switcher shows it disabled, with its note, so the gap stays visible.
2. **Combine axes only where the code branches on both.** "Member + paged" is a state
   only if the member view changes the paged layout. Do not build the cross product.
3. **Include the edges that real data makes:** zero, one, a full page, one more than a
   page, the longest real value.
4. **Name states the way the product team does.** The id goes in the URL, the label goes
   on the button.

## 4. Build the page in one folder

Put the bench in one folder, so removal is one step.

```
src/states/request-log/
  page.tsx       the route: container, fixtures, switcher
  fixtures.ts    product-shaped data for each state
```

```tsx
// src/states/request-log/page.tsx
import { StateBench } from "prototype-machine"

import { RequestLog } from "../../components/request-log"
import { FIXTURES, MISSING, STATES } from "./fixtures"

export function RequestLogStates() {
  return (
    <StateBench states={STATES} missing={MISSING} initial="typical" width={880} label="Request log states">
      {(state) => <RequestLog {...FIXTURES[state]} />}
    </StateBench>
  )
}
```

```ts
// src/states/request-log/fixtures.ts
export const STATES = {
  loading: "Loading",
  empty: { label: "Empty", note: "A new key, no traffic yet" },
  one: "One request",
  typical: { label: "Typical", note: "18 requests, the median for a team" },
  paged: { label: "Paged", note: "60 requests, so the table paginates" },
  refetching: { label: "Refetching", note: "Stale rows while a refresh runs" },
  member: { label: "Member", note: "Typical rows, seen by a member" },
  error: "Error",
}

export const MISSING = {
  partial: { label: "Partly loaded", note: "The design streams rows in. The code waits for all of them." },
}
```

- Render the real component. Do not copy it, wrap it, or restyle it.
- The page adds only three things: a container as wide as the component is in production
  (`width`), the fixtures, and the switcher. No padding, fonts or background.
- Register the route the way the app registers its other routes. Do not link it from the
  app's navigation.

The demo in `package/demo` has this bench at `/states/request-log`.

## 5. Feed data at the boundary

Give each state its data at the point where the component gets data. Do not add props or
flags to the component only for the bench.

| The component gets data from | Do this |
| --- | --- |
| Its props | Pass a fixture for each state. |
| A query hook | Seed the query cache, or set a mock handler for the state. |
| A context provider | Wrap the component in that provider with the fixture. |
| Nowhere you can reach | Stop. Tell the user that the component has no data seam. Do not patch it. |

Fixtures:

- **Product-shaped.** Real names, real ids, real value ranges, real quantities. Three
  rows of "Test item" make every state look fine.
- **Loading is held still.** Use a status of `"pending"` or a promise that never
  resolves. Do not use a timeout. A reviewer must be able to look at loading for as long
  as they need.
- **Errors use the real message** that the user would see.

Each state mounts fresh (the bench keys it by its id), so data that one state seeds does
not leak into the next.

## 6. The switcher

`StateBench` draws the switcher. Do not build one.

| Behavior | Reason |
| --- | --- |
| `?__state=` in the URL holds the state. | A reload keeps it. A link opens it. A test can loop over it. |
| Writes use `replaceState` and keep other parameters. | Ten states do not add ten history entries. |
| Dark and neutral, in its own shadow root. | It never becomes part of the design or the screenshot. App CSS cannot reach it. |
| Buttons with `aria-pressed` in a labelled `nav`. | A screen reader announces which state is on. |
| Fixed at the bottom center. Scrolls sideways on a narrow screen. | It does not wrap over the component. The active button scrolls into view. |
| Arrow keys, `Home` and `End` work only with focus in the bar. | It takes no key from the page. |
| A Hide button. | Removes the bar until the page reloads, for a clean screenshot. |
| Instant switch. Scroll position kept. | Compare two states at the same place on the page. |
| A spacer after the component. | The bar never covers the end of a long component. |
| Missing states are struck through and disabled. | The gap stays visible. The note says what the code needs. |

Props that change the defaults: `placement="top"` when the component sits at the bottom
of the viewport, `offset` to clear a fixed banner, `param` when `__state` is taken. See
[api.md](api.md#statebench).

## 7. Verify every state

Open every state in a real browser. Do not report a state as done from reading the code.

For each state:

1. Open `/states/request-log?__state=<id>`.
2. Make sure the component shows that state, not a fallback. The container carries
   `data-state="<id>"`.
3. Make sure the switcher marks that state as pressed.
4. Make sure the console has no errors.
5. Run axe on the page.

A Playwright loop does all five:

```ts
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

import { STATES } from "../src/states/request-log/fixtures"

for (const state of Object.keys(STATES)) {
  test(`request log: ${state}`, async ({ page }) => {
    const errors: string[] = []
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })

    await page.goto(`/states/request-log?__state=${state}`)
    await expect(page.locator(`[data-state-bench][data-state="${state}"]`)).toBeVisible()
    await expect(page.getByRole("button", { pressed: true })).toHaveAttribute("data-state", state)

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    expect(axe.violations).toEqual([])

    await page.getByRole("button", { name: /^Hide / }).click()
    await expect(page).toHaveScreenshot(`request-log-${state}.png`)
    expect(errors).toEqual([])
  })
}
```

**Do it again after each change.** When the component changes, run the loop again. When
a new branch appears, add a state. When a missing branch is built, move it from
`missing` to `states`.

## 8. Hand it over

Give the user:

- The bench URL.
- Each state in switcher order, with one line about what it shows.
- The missing states, and what the code needs for each.
- What you checked, and how.

```
Bench: http://localhost:5173/states/request-log

States
- Loading: rows held in a pending query.
- Empty: a new key, no traffic yet.
- ...

Not in the code yet
- Partly loaded: the design streams rows in. The code waits for all of them.

Checked: all 8 states in Chromium, axe (WCAG 2.1 AA) has 0 violations, no console errors.
```

## 9. Remove it

Remove the bench only when the user says so. Do it in one step:

1. Delete the folder.
2. Remove the route registration.
3. Search for what is left. Expect no results.

```bash
rm -rf src/states/request-log
grep -rn "states/request-log\|RequestLogStates" src
```

## 10. Before you finish

| Mistake | Fix |
| --- | --- |
| A state from the design that the code cannot reach is shown with a fake | Put it in `missing`. |
| Every axis combined with every other | Combine only where the code branches on both. |
| A copy or a wrapper of the component | Render the real component. |
| Props or flags added to the component for the bench | Feed data at the boundary. |
| Loading uses a timeout | Hold it still with a pending status or promise. |
| "Test item" data | Product-shaped data in real quantities. |
| The page adds padding, fonts or a background | Only a container at production width. |
| A switcher styled like the product | Use the switcher that `StateBench` draws. |
| A global keyboard shortcut | None. Keys work only with focus in the bar. |
| States reported as done without a browser | Open every state. Run the loop. |
| The bench is linked from the app or shipped | Keep it a scratch route. Remove it when the user says so. |

## 11. Differences from the source skill

| Source skill | This package | Reason |
| --- | --- | --- |
| `←` `→` step, `1` to `9` jump, `H` hides. The keys listen on the whole page. | Arrow keys, `Home` and `End` work only with focus in the bar. A Hide button. | The package binds no keyboard shortcut. A page-wide key can collide with the app's keys, and a reviewer who is not told about it cannot use it. |
| The active button has a 14% white fill. | The active button is white with dark text. | 14% white on the bar is about 1.5:1. WCAG 2.1 SC 1.4.11 asks for 3:1 for a state indicator. |
| Each page builds its own switcher. | One `StateBench` component. | The same behavior on every bench, tested once. |

**Known accessibility gap:** a state's `note` shows only as a `title` tooltip. Keyboard
and touch users cannot see it. Put what a reviewer must know in the label.
