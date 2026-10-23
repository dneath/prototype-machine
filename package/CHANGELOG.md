# Changelog

## 0.13.0

The first release on npm: 0.12.0 was never published, so its changes below ship
here too.

Every state at once. A canvas lays one component out in every state and every frame on
a surface you pan and zoom, and measures which frames overflow. The method is Jakub
Krehel's [break](https://github.com/jakubkrehel/skills/tree/main/skills/break) skill; the
surface follows ibelick's
[component-canvas](https://www.ui-skills.com/skills/ibelick/component-canvas).

### Added
- `StateCanvas`: the same `states`, `missing` and fixtures as `StateBench`, all at once.
  A row per state, a column per frame. Pan by dragging empty space or scrolling; zoom
  with a pinch or `Ctrl`/`Cmd` and the wheel. The camera never re-renders a component:
  it moves the world with one transform per animation frame. A box inside a frame that
  can scroll keeps the wheel; a drag that starts on a frame belongs to the component.
- Frames: `width`, `minHeight`, `dir`, `attrs`, `background` and `squeeze` (a hatched
  sibling that takes room the way a sidebar would). `frames="stress"` is the built-in set
  (`stressFrames(width)`): as shipped, 320px, squeezed, very wide, right to left.
- Names that stay on screen. States down the left, frames along the top, frozen to the
  edges like a spreadsheet's headers. Each is a toggle: a state, a frame, or both focus a
  row, a column or one frame, and the URL holds it (`?__state=`, `?__frame=`,
  `FRAME_PARAM`). Names that would collide give way, in order.
- Crop marks just outside each frame's corners, instead of a border that could pass for
  the component's own.
- Findings. Each frame is measured once its layout settles: content wider than its
  container, and boxes that hide content without an ellipsis or a scrollbar. A flagged
  frame gets amber marks and a note (`134px too wide`, `Cuts off content`), and
  `data-overflow` / `data-clipped` for tests. The bar counts them; clicking the count
  steps through them.
- The canvas bar: zoom, 100%, Fit, Text 200% and Pause motion for every frame at once,
  and the findings count. Keys (arrows, `+`, `-`, `1`, `0`) only while the canvas itself
  has focus. Tabbing to something off screen moves the camera to it.
- `PinnedScenario`: a scenario pinned to flat `values`, with no storage, URL or `<html>`
  attributes, so a screen can be shown in many states on one page. `go` and `set` work
  inside it; `reset` returns to the pin. A pin the config would not hold throws.
- `statesOf(machine, id)` in core: one machine's states, or one enum field's options,
  labelled and typed, for a canvas's rows or columns.
- `reference/canvas.md`: the workflow. Which axes apply to a component, frames, a screen
  in every state of a machine, what is and is not measured, and how to report what broke.
- The demo has a canvas for the request log (`/states/request-log/canvas`, with a new
  Long values state) and for the overview screen in every journey and data state
  (`/states/overview/canvas`).

### Changed
- A field's `dom` attribute is set before paint, not after it.
- `checkStates`, `subscribeUrl` and `writeSearchParams` are shared by the bench and the
  canvas, so both refuse the same configs with the same messages.

### Added
- `npm run tarball` builds when it needs to, packs, and checks the tarball holds the
  built code and the docs, deleting it and failing if not. It works whatever npm's
  `ignore-scripts` setting is, and `--out <folder>` writes it somewhere else.

### Fixed
- `npm pack` on a fresh clone packed a tarball with no `dist/`, which installed and then
  failed on its first import. Packing now builds first when `dist/` is missing or older
  than its sources, and leaves a fresh build alone.
- With npm's `ignore-scripts` on, `npm pack` skipped the build and the docs and packed
  three files, and `npm publish` would have uploaded them. Nothing in a package can stop
  that, so `npm run tarball` exists, and `PUBLISHING.md` publishes the tarball it checked.
  `npm run check` now passes with the setting on.
- `npm run build` works on Windows: it cleared `dist/` with `rm -rf`, which `cmd.exe`
  does not have.

## 0.12.0

Ready for npm, plus three things learned from Josh Puckett's
[DialKit](https://github.com/joshpuckett/dialkit).

### Added
- A real slider for `control: "range"`. Press anywhere on the track to jump there and
  drag from there; the drag holds if the pointer leaves the track. A tick marks each
  step when there are ten or fewer. A box beside it shows the exact value and takes a
  typed one. Arrow keys move one step, `Shift` or `Page Up`/`Page Down` ten, and
  `Home`/`End` go to the ends. The fill and thumb move by `transform` only.
- Copy ends with the config edits that would make the scenario on screen the starting
  one, written as an instruction for a coding agent, when anything has changed. Tune,
  copy, paste, and it becomes the default. The same text is `toDefaults()` in core.
- The package ships its agent skill: `SKILL.md` and `reference/` are in the tarball, so
  an agent can read the guidance that matches the installed version from
  `node_modules/prototype-machine/`.

### Changed
- A `set` or `go` that changes nothing writes nothing: no render, no storage write, no
  address bar update. A slider dragged within one step no longer re-renders the app on
  every pointer move.
- Row labels are sentence case at 12px; section titles stay small capitals; the panel
  title is sentence case and white. Before, all three looked the same, and the title
  was cut off at "Prototype contro…".
- The README on npm links to GitHub with absolute URLs, so its links work there.

### Release tooling
- `npm run check` runs everything a release needs: tests, typecheck, build, smoke,
  `publint`, Are the Types Wrong, and `test:pack`, which installs the packed tarball
  into a throwaway app and imports every entry as ESM and CommonJS, checks the
  `production` stub, and typechecks an app against the shipped types.
  `prepublishOnly` runs it.
- `npm version` updates the version named in `SKILL.md` and `reference/`, and a test
  fails if they drift or if the changelog has no entry for the version.
- GitHub Actions: CI on pushes and pull requests, and a release workflow that publishes
  to npm with provenance when a `v*` tag is pushed, using npm trusted publishing (no
  stored token).

## 0.11.0

A bench shows one component in every state its code can reach, one URL per state.

### Added
- `StateBench`: renders the real component in each of its `states` on a scratch page,
  with a switcher bar. The state lives in `?__state=` (`STATE_PARAM`), written with
  `replaceState`, so a reload keeps it, a link opens it, and a test can loop over it.
  Each state mounts fresh. The container sets only `width`.
- `missing` on `StateBench`: states the design shows but the code cannot reach. Listed
  struck through and disabled, with "Not in the code yet" and the note. Never rendered.
- `useStateParam(ids, { initial, param, missing })`: the URL hook under the bench.
- `avoidBars` on `ScenarioPanel` and `StateBench`, default `true`. The
  tools keep clear of bars fixed to the top or bottom edge of the page (a header, a
  footer). They hit-test the edges, so no configuration is needed, and check again after
  a resize, a scroll or a change to the page.
- The switcher bar: dark and neutral, in its own shadow root (`data-pm-layer="switcher"`),
  a labelled `nav` of `aria-pressed` buttons at the bottom center (`placement="top"` and
  `offset` move it). Scrolls sideways on narrow screens and keeps the current state in
  view. Arrow keys, `Home` and `End` move between states only while focus is in the bar.
  A Hide button removes it until reload. Forced-colors styles included.
- `reference/bench.md`: the bench workflow, adapted from Jakub Krehel's state-machine
  skill. Recipe 9 in `recipes.md`.

### Changed
- Each shadow host carries `data-pm-layer` (`"panel"` or `"switcher"`). Tests that found
  the panel with `document.querySelector("prototype-machine")` should add
  `[data-pm-layer="panel"]`.
- The production entry renders a bench's current state without the switcher.
- Recipe 2: hold loading still, branch where the data comes in, use product-shaped data.
- Docs and messages no longer use em dashes.

### Fixed
- The accent colour is `#8b3dff` (was `#7410ff`). The launcher's changed dot was 2.8:1
  against the panel background, below the 3:1 of WCAG 2.1 SC 1.4.11. It is now 3.6:1, and
  white text on the count badge is 5:1.

### Not adopted from the source skill
- Page-wide keys (`←` `→`, `1` to `9`, `H`). The package binds no keyboard shortcut.
- A 14% white fill for the active state. It is about 1.5:1 against the bar, below the
  3:1 of WCAG 2.1 SC 1.4.11. The active button is white with dark text.

## 0.10.0

The panel now owns its styling completely, its dropdowns work everywhere, and it can
stress-test the layout it sits beside.

### Changed
- The panel renders through a portal into a shadow root on a `<prototype-machine>`
  element on `<body>`. Host stylesheets cannot reach it; `:host` resets every inherited
  property with `!important`; the host element pins its own position with an inline
  `!important` style. An ancestor `transform` no longer re-anchors it, and RTL or a
  scaled root font on the page no longer leaks into it.
- Events from inside the panel stop at the host element, so host hotkeys don't fire while
  typing in it, and a modal library's click-outside handler doesn't close the dialog
  being inspected. Click-outside and Escape read `composedPath()`.
- Default `zIndex` is now 2147483000, so the controls stay usable over the product's own
  modals and toasts. Pass a lower value to sit under something that must never be
  covered.
- Enum and machine dropdowns are a panel-drawn listbox instead of a native `<select>`,
  whose popup took the OS and host colour scheme and could be unreadable. The listbox
  flips above the trigger when needed, grows a filter past ten options, supports the full
  keyboard model including type-to-jump, and shows why an illegal state is unavailable.
- The panel renders nothing until mounted on the client (it never did anything useful
  on the server), so there is no panel markup to hydrate.
- The header stays visible while a long panel scrolls.
- `children` render inside the shadow root; build them from `Row`, `Pill` and `Select`.

### Added
- `presets` on string and number fields, with built-in `"stress"` sets (`STRESS_TEXT`,
  `STRESS_NUMBERS`) for empty, long, unbreakable, RTL, mixed-direction, CJK, emoji,
  diacritics, markup, newlines, and numeric boundaries.
- `multiline` on string fields (a textarea).
- `nullable` on date fields, and a "Not set" pill that writes `null`.
- A per-field Reset beside a changed field's label, a header Reset with a changed count,
  and a dot on the launcher while anything is off its default.
- A header Copy button that copies the scenario as text (`summarize()` in core).
- The Page section (`tools` prop, default true): text direction, root text size, and
  slowed or paused CSS and Web Animations for the host page, each restored when off.
- `Select` export, plus `summarize`, `changedCount`, `presetsOf` and `isDate` in core.

### Fixed
- Date values that `Date` cannot read are refused from `set`, storage and URLs, and a
  bad date default throws at boot.
- A `dom` binding restores the attribute the page had before, instead of deleting it.
- An action whose `run` throws warns instead of taking the panel down.
- `describe()` no longer prints "undefined" for a machine without a label.
- A number input shows when its draft is out of range.

## 0.9.0

### Removed
- `link()` and `toLink()`. A prototype on localhost can't be linked to, so the feature is gone.
- `description` on machines, fields, actions and sections, and the panel's `descriptions` prop.
  A section is a title plus its controls; explanations belong in `note` (the tooltip).

### Fixed
- Several `go`/`set`/`reset` calls in one handler all apply, instead of only the last.
- A URL with scenario parameters is authoritative; saved state no longer leaks into it.
- Inherited names (`constructor`, `__proto__`, `toString`) in URLs, storage or field ids no longer crash.
- Storage keeps only values that differ from defaults, tagged with a config shape hash, so
  default changes reach every browser.
- `set` rejects out-of-range values with a warning.
- Clearing a number input no longer sets it to 0.
- Escape only closes the panel when focus is inside it (or on the page body).
- Styles are injected only when the panel is active.
- A throwing `derive` or `when` warns instead of taking down the screen; the panel has an error boundary.
- `"use client"` is preserved on the React entries for the Next.js App Router.

### Added
- `syncUrl` prop: keep the address bar in step with the scenario. Off by default, scenario
  parameters are read once and then removed from the URL.
- `syncTabs` prop: follow scenario changes made in other tabs.
- `production` export condition resolving to a stub panel; `prototype-machine/panel` for review builds.
- `useScenarioSelector`, and `useScenarioValue` now re-renders only when its key changes.
- Typed `go`, `set`, `can` and `movesFrom` from `useScenario(machine)`.
- `describe(machine)` text outline, and "did you mean" suggestions in warnings.
- Panel: focus moves in on open, pin toggle, persisted open/pinned/collapsed state, collapsible
  sections, a filter box past eight rows, `nonce` prop for strict CSP.
- Compile-time errors for mismatched `assign` keys across states, number defaults out of range,
  range sliders without bounds, and empty labels or groups.
- Dev warning when two providers share a `storageKey`.

### Changed
- Unreachable options use `aria-disabled` with a screen-reader reason, and stay focusable.
- Stronger pill borders, 24px close button, drag hint moved to `aria-describedby`.
- Storage and drag updates are batched.
- CJS entries share one copy of core; types resolve correctly for both `import` and `require`.
