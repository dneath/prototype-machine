# Changelog

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
