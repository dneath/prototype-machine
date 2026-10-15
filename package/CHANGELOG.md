# Changelog

## 0.11.0

A bench shows one component in every state its code can reach, one URL per state.

### Added
- `StateBench`: renders the real component in each of its `states` on a scratch page,
  with a switcher bar. The state lives in `?__state=` (`STATE_PARAM`), written with
  `replaceState`, so a reload keeps it, a link opens it, and a test can loop over it.
  Each state mounts fresh. The container sets only `width`.
- `missing` on `StateBench`: states the design shows but the code cannot reach. Listed
  struck through and disabled, with "Not in the code yet" and the note. Never rendered.
- `StateSwitcher`: the same bar for one machine of a scenario, inside the provider.
  Illegal moves are disabled with the panel's reason.
- `useStateParam(ids, { initial, param, missing })`: the URL hook under the bench.
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
- The production entry renders a bench's current state without the switcher, and
  `StateSwitcher` as nothing.
- Recipe 2: hold loading still, branch where the data comes in, use product-shaped data.
- Docs and messages no longer use em dashes.

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
