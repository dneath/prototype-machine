# prototype-machine

A dev-only control panel for React prototypes. Declare the states your prototype can be
in (empty, loading, first run, admin, trial expired) and get a panel that drives it.
Combinations you never declared can't be set.

Two scratch pages show one component in the states its code can reach:

- A **bench** shows one state at a time, and every state is a link.
- A **canvas** shows every state at once, at every width, and marks the frames that
  overflow or cut off content.

In production the panel and the bench's switcher render nothing, and the canvas draws
its frames in a plain grid, without its camera, names or bar.

## Quick start

**0. Install it** as a dev dependency. It needs React 18 or later.

```bash
npm install --save-dev --save-exact prototype-machine
```

**1. Describe the states.**

```ts
// scenario.ts
import { defineMachine } from "prototype-machine"

export const scenario = defineMachine({
  machines: {
    account: {
      label: "Account",
      initial: "newUser",
      states: {
        newUser: { label: "New user", assign: { projects: 0, hasTeam: false } },
        firstProject: { label: "First project", assign: { projects: 1, hasTeam: false } },
        team: { label: "Team", assign: { projects: 8, hasTeam: true } },
      },
      transitions: {
        newUser: ["firstProject"],
        firstProject: ["team", "newUser"],
        team: ["newUser"],
      },
    },
  },
  fields: {
    loading: { type: "boolean", label: "Loading", default: false },
  },
})
```

**2. Mount the provider and the panel once, at the root.**

```tsx
// main.tsx
import { ScenarioPanel, ScenarioProvider } from "prototype-machine"
import { scenario } from "./scenario"

export function Root() {
  return (
    <ScenarioProvider machine={scenario} storageKey="my-prototype-v1">
      <App />
      <ScenarioPanel />
    </ScenarioProvider>
  )
}
```

**3. Read it in any screen.**

```tsx
import { useScenario } from "prototype-machine"
import { scenario } from "./scenario"

export function Projects() {
  const p = useScenario(scenario)

  if (p.loading) return <Skeleton />
  if (p.projects === 0) return <EmptyState />
  return <ProjectList count={p.projects} team={p.hasTeam} />
}
```

A button appears in the bottom-right corner. Click it to open the panel, drag it to move
it. No stylesheet to import, no build config to change.

## Machines and fields

Two kinds of control, and choosing between them is most of the work.

| | What it is | Example |
| --- | --- | --- |
| **Machine** | A journey. One state is current, and it writes several context values at once. | new user → first project → team |
| **Field** | A free axis that varies on its own and means nothing to the others. | dark mode, role, unread count |

Values that move together belong in one machine. Then "8 projects but no team" stops
being something a reviewer can click into: `go()` refuses a move you never declared, and
the panel draws it disabled: visible, but not reachable.

- **Transitions** declare the legal moves. Omit them and every state is one click from
  every other: a switch, not a journey.
- **Fields** are `boolean`, `enum`, `number`, `string` or `date`. A boolean or enum can
  mirror itself onto `<html>` as an attribute, so plain CSS can read it.
- **Derived values** are computed from context, never stored, so they can't disagree
  with it.
- **Actions** are buttons for what a control can't say. Ungrouped ones render last.
- **`when`** hides a control on screens where it would be meaningless.

## Groups

Any control can carry `group`. Controls sharing a group render under one collapsible
heading, in the order the group is first seen; ungrouped controls stay at the top. A
section is always a title and its controls, never a line of explanation. Put
explanations in `note`, which becomes a tooltip.

```ts
fields: {
  unread: { type: "number", label: "Unread", default: 0, group: "Inbox" },
  dark:   { type: "boolean", label: "Dark mode", default: false, group: "Look" },
  role:   { type: "enum", label: "Role", default: "member", options: ["member", "admin"] },
}
```

Past eight rows the panel grows a filter box. Pin it open to keep it up while you click
around the prototype.

## Every state of one component

A bench puts one real component on a scratch page, with a switcher for every state the
component can be in. The state lives in the URL, so every state is a link.

```tsx
// src/states/request-log/page.tsx
import { StateBench } from "prototype-machine"
import { RequestLog } from "../../components/request-log"
import { FIXTURES } from "./fixtures"

const STATES = {
  loading: "Loading",
  empty: { label: "Empty", note: "A new key, no traffic yet" },
  typical: "Typical",
  error: "Error",
}

export function RequestLogStates() {
  return (
    <StateBench states={STATES} missing={{ partial: "Partly loaded" }} width={880} label="Request log states">
      {(state) => <RequestLog {...FIXTURES[state]} />}
    </StateBench>
  )
}
```

Open `/states/request-log?__state=empty`. A bar at the bottom center lists the states.

- **The URL is the source of truth.** `?__state=empty` survives a reload, opens the same
  state for a teammate, and lets a test loop over every state.
- **A state the code cannot reach is listed, not faked.** Put it in `missing`. The bar
  shows it struck through and disabled, so the gap stays visible.
- **No keys taken from the page.** Arrow keys, `Home` and `End` move between states only
  while focus is in the bar. A Hide button clears it for a screenshot.
- **One folder, one delete.** The bench renders the real component and changes nothing
  in it. Delete the folder and the route to remove it.

The full workflow is in [reference/bench.md](reference/bench.md).

## Every state at once

A canvas takes the same states and fixtures as a bench and lays them all out on one
surface you pan and zoom: a row per state, a column per **frame**. A frame is a
condition the component is put in from outside, without touching it. `frames="stress"`
is the built-in set: as shipped, 320px, squeezed by a sidebar, very wide, and right to
left.

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

- **Overflow is measured, not guessed.** A frame whose content is wider than its
  container, or that hides content behind `overflow: hidden` without an ellipsis or a
  scrollbar, gets amber crop marks and a note: `134px too wide`, `Cuts off content`. The
  bar counts them; click the count to step through them.
- **Names stay on screen.** States run down the left and frames along the top, frozen to
  the edges like a spreadsheet's headers, so a frame you have zoomed into is still named.
  Click a state, a frame, or both: `?__state=long&__frame=narrow` opens on that frame.
- **Page tools apply to every frame at once.** Text 200% and Pause motion are in the bar.
- **A screen in every state of the journey.** `statesOf` lists a machine's states, and
  `PinnedScenario` shows a screen in one of them, any number to a page:

```tsx
<StateCanvas states={statesOf(scenario, "journey")} frames={statesOf(scenario, "data")} width={1280}>
  {(journey, data) => (
    <PinnedScenario machine={scenario} values={{ journey, data }} path="/overview">
      <Overview />
    </PinnedScenario>
  )}
</StateCanvas>
```

Drag empty space or scroll to move; pinch or `Ctrl`/`Cmd` and scroll to zoom. With the
canvas focused, arrow keys move, `+` and `-` zoom, `1` fits everything and `0` is 100%.
The workflow, adapted from Jakub Krehel's break skill, is in
[reference/canvas.md](reference/canvas.md).

## What you get

**Out of the way.** The panel and the bench bar keep clear of bars fixed to the top or
bottom of the page, such as a header or a footer. Nothing to configure.

**Nothing bound to the keyboard.** The panel opens from a click on its launcher. It
binds no shortcut, so it never collides with your app's keys. The bench's bar and the
canvas take keys only while focus is on them, never inside a component.

**A panel that owns its own look.** Dark, plain and deliberately unlike your app, so it
never becomes part of a screenshot or part of the critique. It renders in its own shadow
root on `<body>`: your app's resets, fonts, dark-mode classes and transforms can't reach
it, it stays above your modals, and keystrokes typed into it never trigger your app's
hotkeys. Its dropdowns are drawn by the panel, not the OS, so they're always readable.
Drag it by the launcher or the header; drop it near a corner and it snaps. The bench's
bar and the canvas's names, marks and bar are drawn the same way, each in its own shadow
root.

**Stress tests, one click away.** Give a string or number field `presets: "stress"` and
it gets the worst cases real data produces: empty, 2,000 characters, an unbreakable URL,
right-to-left, CJK, emoji sequences, markup, 1M. The panel's **Page** section flips the
whole page to RTL, scales its text to 200%, and slows or pauses its animations, then
puts everything back. On a canvas, `frames="stress"` does the same for the container:
every state at 320px, squeezed by a sidebar, very wide and right to left, side by side.

```ts
fields: {
  title:  { type: "string", label: "Title", default: "Acme", presets: "stress" },
  unread: { type: "number", label: "Unread", default: 3, min: 0, presets: [0, 1, 99, 1000] },
}
```

**Sliders that feel like sliders.** `control: "range"` draws a track you press and drag,
with a tick for each step when there are few, and a box beside it for typing an exact
value.

**A way back.** Every changed field gets its own Reset, and the header resets the lot
(with a count).

**Copy for a person and for an agent.** Copy puts the current scenario on the
clipboard as text for a bug report, and ends with the exact config edits that would
make it the starting scenario. Tune a value in the panel, copy, paste it to your coding
agent, and it becomes the default.

**Layered state.** A scenario resolves in four layers, each beating the one before:

```
config defaults  <  localStorage  <  the URL  <  this session's clicks
```

A URL with scenario parameters replaces what storage held rather than mixing with it.
Only values that differ from their defaults are saved, so changing a default in the
config reaches every browser. By default the parameters are read once and removed from
the address bar; `<ScenarioProvider syncUrl>` keeps them in step with the panel instead.

**A React-free core.** `prototype-machine/core` imports no React, so a test or a script
can build a scenario and assert on it.

## Example prompts

The package ships an agent skill ([`SKILL.md`](SKILL.md) and [`reference/`](reference))
that teaches a coding agent to model a scenario space, wire the panel, and build benches
and canvases. After
`npm install` it is at `node_modules/prototype-machine/SKILL.md`, matching the
installed version; point your agent at it, or copy it into your agent's skills folder.
With it loaded, these are the kinds of things to ask for.

**Add prototype-machine to an existing prototype**

> I have a projects dashboard that fetches from a mock API. Add prototype-machine so I
> can drive it through loading, empty, error and populated without touching the fetch.
> Model the data state as one machine with no transitions, mount the provider and the
> panel at the root, and read the state at the top of the dashboard component.

**Build something new with the states declared up front**

> Create an onboarding flow with three steps: connect an account, create the first
> project, invite the team. Model it as a machine with transitions (forward one step at
> a time, back to the start from anywhere) where each state assigns `projectCount` and
> `hasTeam`. Add a "Restart" action that resets the scenario and navigates to step one.

**Switch who's looking**

> Add a role machine to this settings page with admin, member and viewer states, plus a
> boolean field for "trial expired". Hide the billing section for anyone but admin and
> show the paywall banner when the trial has expired. Mirror the role onto `<html>` as
> `data-role` so the CSS can react to it too.

**Replace a hand-rolled panel**

> The toggles in my DevControls component let me set "has billing" without "has org",
> which the product can't do. Move them into prototype-machine as a single account
> machine whose states assign both values, so that combination stops being clickable,
> then delete DevControls.

**Tune values**

> Add a number field for the inbox's unread count (0 to 999, as a slider) and a boolean
> for dark mode, so I can screenshot 0, 1 and 99+.

**Stress-test a component**

> Add stress presets to the project card: the project name as a multiline string field
> with the built-in stress set, and the member count as a number with presets for 0, 1,
> a full page of 25 and 26. Then check the card in RTL at 200% text from the Page
> section.

**Show every state of one component**

> Build a state bench for the RequestLog component. Find every state in its code, feed
> product-shaped data through its props, hold loading still, and list the states the
> design shows but the code cannot reach as missing. Check each state in a browser, then
> give me the URL and the list of states.

**Break a component**

> Break the RequestLog on a canvas. Reuse the bench's states and fixtures, add a state
> for the longest user and model ids the gateway accepts, and use the stress frames.
> Open it once in a browser, look at every frame, and give me a table of what broke,
> each frame as a link.

**Every state of a screen**

> Make a canvas of the overview screen with the journey's states as rows and the data
> states as columns, each frame pinned with PinnedScenario.

## Documentation

| Doc | What it covers |
| --- | --- |
| [reference/api.md](reference/api.md) | Every option and type: `defineMachine`, fields, provider, panel, `StateBench`, `StateCanvas`, `PinnedScenario`, `useScenario`, the core entry, errors. |
| [reference/recipes.md](reference/recipes.md) | How to model something: journey ladders, forced data states, roles, migrating a hand-rolled panel, driving CSS, a screen in every state. |
| [reference/bench.md](reference/bench.md) | How to build a bench: find the states in the code, feed data at the boundary, verify each state in a browser, remove it. |
| [reference/canvas.md](reference/canvas.md) | How to break a component on a canvas: which axes apply, frames, a screen in every state, what is measured, reporting what broke. |
| [SKILL.md](SKILL.md) | The agent skill itself. |
| [PUBLISHING.md](PUBLISHING.md) | How a new version gets to npm. |
| [CHANGELOG.md](package/CHANGELOG.md) | What changed in each version. |

Two things worth knowing before you ship a review build:

- `enabled` defaults to `process.env.NODE_ENV !== "production"` and fails safe. Bundlers
  that honour the `production` export condition (Vite, webpack 5, esbuild, Next) resolve
  `ScenarioPanel` to a stub that renders nothing, so its bytes never ship. To show the
  panel, a bench's switcher or a canvas's camera in a deployed review build, import
  `ScenarioPanel`, `StateBench` or `StateCanvas` from `prototype-machine/panel`.
- If you link the package by path, deduplicate `react` and `react-dom`. A `file:`
  dependency resolves through a symlink and can give you two copies of React.

## Contributing

- **Open an issue first.** Pull requests should reference one.
- **Keep pull requests small.** One bug fix, one feature, or one refactor.
- **No new runtime dependencies.** The package has zero, and that's a feature.
- **Edit the README at the repo root.** `package/README.md` is copied from it when the
  package is packed, and isn't tracked.
- **`npm run check` passes** before a PR. It is what CI and a release run.

```bash
cd package
npm install
npm test          # vitest, jsdom
npm run typecheck
npm run build     # tsup -> dist (esm + cjs + types)
npm run check     # all of the above, plus package lint and an install of the tarball
npm pack          # prototype-machine-<version>.tgz, built first if it needs to be

cd demo
npm install
npm run dev       # a playground on :5199
```

The playground has the panel at `/overview`, a bench at `/states/request-log`, and
canvases at `/states/request-log/canvas` and `/states/overview/canvas`.

Run `npm pack` inside `package/`; the repo root has no `package.json`. The `.tgz` installs
into any project without the npm registry: `npm install --save-dev ./prototype-machine-<version>.tgz`,
or the same path with `pnpm add -D`, `yarn add -D file:` or `bun add -d`.

## License

[MIT](LICENSE)
