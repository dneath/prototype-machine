# Handoff: prototype-machine

`prototype-machine` is an npm package for React prototypes, plus an agent skill that ships inside it. A designer or engineer declares the states a prototype can be in (journeys as state machines, free axes as fields) and gets a dev-only control panel that drives them. Combinations that were never declared can't be set. It also gives two scratch pages for one component: a **bench** (one state at a time, one URL per state) and a **canvas** (every state times every frame on a pan-and-zoom surface, with overflow measured). It's for people reviewing and usability-testing prototypes, and for the coding agents that build them. As of the snapshot, version 0.13.0 is built, tested and documented but not yet published to npm (`PUBLISHING.md:8`; there are no git tags and no Release workflow runs).

| | |
|---|---|
| Repo | `dneath/prototype-machine` |
| Default branch | `main` |
| Snapshot | `153937a` (2026-10-23) |
| Handoff written | 2026-11-03 |
| Status | Pre-release library: 0.13.0 ready, first npm publish pending |

## Start here

- Read in this order: `README.md` (what it does, plus "Contributing" at `README.md:365`), `PUBLISHING.md` (release state and runbook), then `SKILL.md` and `reference/api.md` (the behavior contract).
- All code lives in `package/`. The repo root has no `package.json`, so run npm commands in `package/`, or in `package/demo/` for the playground.
- The binding rules are in `README.md:365-396` (Contributing) and `SKILL.md:177-233` (Design principles). The repo has no `AGENTS.md`, `CLAUDE.md`, `.claude/` or `.agents/`.
- One command proves the repo works: `cd package && npm ci && npm run check`. It passed on 2026-11-03 and is exactly what CI's package job runs.
- Never run `npm publish`, `npm login`, `npm deprecate`, `git tag` or `git push` from an agent. A published npm version can't be replaced (`PUBLISHING.md:61-63`). `npm version` rewrites tracked files (`package.json`, lockfile, `SKILL.md`, `reference/`), so only run it when you're cutting a release on purpose.
- Don't edit `package/README.md`, `package/SKILL.md` or `package/reference/`. Pack-time copies of the root files land there, they're gitignored, and they're deleted after packing. Edit the root copies.
- Don't add runtime dependencies, and keep `package/src/core/` free of React. `src/production.ts` should export the same names as `src/index.ts`, but right now it doesn't (issue 1, the top fix before the first publish).

## What the product is

**Problem.** Prototypes grow a hand-rolled panel of toggles, and a reviewer can click into a combination the product can't produce (say, "has API key" without "first request arrived"), then judge the design on it (`SKILL.md:26-37`). This package models the space so those states can't be expressed.

**Features** (from `README.md` and `package/CHANGELOG.md`):

- `defineMachine` config: **machines** (journeys whose states each `assign` a whole tuple of context, with optional `transitions`), **fields** (`boolean`, `enum`, `number`, `string`, `date`), **derived values**, **actions**, `group`, `note` tooltips and `when` guards.
- `ScenarioProvider`, plus `useScenario`, `useScenarioSelector` and `useScenarioValue` for screens to read.
- `ScenarioPanel`: a dark, deliberately foreign panel in its own shadow root. It's draggable and snaps to corners, keeps clear of fixed header and footer bars, has per-field reset, Copy (a bug-report summary plus config edits an agent can apply), stress presets (long text, RTL, CJK, emoji, numeric extremes) and "Page" tools (RTL, 200% text, slowed or paused motion). It binds no keyboard shortcut.
- `StateBench`: one real component in each of its states, chosen by `?__state=`. `missing` lists states the design shows but the code can't reach, and they're shown disabled.
- `StateCanvas`: every state times every frame (`frames="stress"`: as shipped, 320px, squeezed, wide, RTL). It measures overflow and clipping per frame and has a bar with zoom, Fit, Text 200% and Pause motion.
- `PinnedScenario` and `statesOf`: a screen in many scenario states on one page.
- `prototype-machine/core`: React-free, for tests and scripts.
- Production safety: under the `production` export condition the panel is a stub that renders nothing, the bench renders without its switcher, and the canvas renders a flat grid. `prototype-machine/panel` brings the real controls back for review builds (`README.md:355-363`).
- **Agent skill**: `SKILL.md` plus `reference/` teach a coding agent to model a scenario space and build benches and canvases. They ship in the tarball, so after an install they're at `node_modules/prototype-machine/SKILL.md`.

**Outputs.** An npm tarball (ESM, CJS, `.d.ts`, the docs). The Vite playground in `package/demo` isn't deployed anywhere. `PUBLISHING.md:144-153` only describes how it could be hosted.

## Tech stack

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Language | TypeScript | 5.9.3 (locked; `^5.7.2`) | `strict`, `verbatimModuleSyntax`, `noUnusedLocals` (`package/tsconfig.json`) |
| UI peer | React, React DOM | peer `>=18`, optional | Dev and tests use 19.2.8. React 18 isn't exercised anywhere (see issue 2) |
| Bundler (library) | tsup (esbuild) | 8.5.1 (`^8.3.5`) | Two configs, ESM and CJS, with a `"use client"` banner (`package/tsup.config.ts`) |
| Tests | Vitest + jsdom + Testing Library | vitest 2.1.9, jsdom 25.0.1, @testing-library/react 16.3.3, user-event 14.6.6 | `package/vitest.config.ts`, globals on |
| Package lint | publint, Are the Types Wrong | 0.3.25, 0.18.5 (exact) | Run on a real packed tarball by `scripts/lint-package.mjs` |
| Demo | Vite + @vitejs/plugin-react | vite 6.4.3, plugin 4.7.0 | Separate `package/demo/package.json` and lockfile |
| Package manager | npm | lockfileVersion 3 | Lockfiles at `package/package-lock.json` and `package/demo/package-lock.json` |
| Node | `engines.node >=18` | CI: 20, 22, 24 | Verified here on Node 22.23.4 / npm 10.9.9 |
| CI/CD | GitHub Actions | `actions/checkout@v5`, `actions/setup-node@v5` | `ci.yml` on push and PR. `release.yml` on `v*` tags (npm trusted publishing, provenance) |
| Runtime deps | none | | No `dependencies` key in `package/package.json`. Zero is a stated feature (`README.md:369`) |

## Setup and commands

You need Node 18 or later (CI uses 20, 22 and 24) and npm. There are no environment variables and no secrets. `release.yml` authenticates to npm through GitHub OIDC (`id-token: write`), so no token is stored. `test:pack` installs React from the npm registry into a temp app, so `npm run check` needs network access.

| Task | Command | Verified on 2026-11-03 |
|---|---|---|
| Install (library) | `cd package && npm ci` | Pass. 264 packages, one upstream deprecation warning (`whatwg-encoding`) |
| Unit tests | `npm test` | Pass. 19 files, 574 tests, about 25s. The `[prototype-machine] ...` lines on stderr are expected: tests assert those warnings |
| Typecheck | `npm run typecheck` | Pass |
| Build | `npm run build` | Pass. tsup writes ESM, CJS and d.ts to `dist/` (about 96s here, mostly d.ts) |
| Smoke | `npm run smoke` | Pass (as part of `check`) |
| Package lint | `npm run lint:package` | Pass (as part of `check`). publint "All good!"; attw green for node16 and bundler, node10 ignored by design (`scripts/lint-package.mjs:29-31`) |
| Pack test | `npm run test:pack` | Pass (as part of `check`). "38 files, 738 kB packed" |
| Everything CI and a release run | `npm run check` | Pass (about 4 min here; CI runs take under a minute) |
| Checked tarball | `npm run tarball` | Pass. Wrote `package/prototype-machine-0.13.0.tgz` (38 files, 738 kB). It's gitignored; I deleted it afterwards |
| Tarball with ignore-scripts on | `npm_config_ignore_scripts=true npm run tarball -- --out <dir>` | Pass, 38 files. For comparison, plain `npm pack --dry-run` with the same setting listed 31 files with no README, SKILL.md or `reference/`, which confirms the hazard the latest commit addresses |
| Library watch build | `npm run dev` | Not run (long-running) |
| Install (demo) | `cd package/demo && npm ci` | Pass, 68 packages |
| Demo build | `npm run build` (in `package/demo`) | Pass. `dist/assets/index-*.js` is 324 kB. A module probe confirmed the build bundles a single React copy from `demo/node_modules` |
| Demo dev server | `npm run dev` (in `package/demo`), port 5199 | Not run (long-running dev server, not needed) |
| Demo typecheck | none exists; ad hoc `../node_modules/.bin/tsc -p demo/tsconfig.json --noEmit` from `package/` | Fail. One TS2322 at `package/src/react/canvas-state.tsx:384` from two `@types/react` copies (issue 4) |
| Production-entry export parity (ad hoc) | After `npm run build`: symlink `package/` into a temp app's `node_modules`, then `node --conditions=production` importing `{ Pill }` from `prototype-machine` | Fail. `SyntaxError: ... does not provide an export named 'Pill'` (issue 1) |
| Publish | `npm publish ...` | Not run (forbidden for agents; see `PUBLISHING.md`) |

GitHub (read-only): no open or closed issues or pull requests. All six CI runs on `main` succeeded, the last on 2026-10-23 for `153937a`. There are no Release runs and no tags.

## Repository map

```
.
├── README.md                 Product docs and contributor guide. Copied to package/README.md at pack time
├── SKILL.md                  Agent skill (YAML frontmatter + guidance), shipped in the tarball
├── PUBLISHING.md             First-publish and release runbook, current release state
├── LICENSE                   MIT (identical copy in package/LICENSE)
├── reference/                Skill sub-docs, shipped in the tarball
│   ├── api.md                Every option and type
│   ├── recipes.md            How to model journeys, data states, roles, migrations, CSS, stress
│   ├── bench.md              Bench workflow
│   ├── canvas.md             Canvas workflow
│   └── control-types.json    Machine-readable field catalogue (carries the version string)
├── .github/workflows/
│   ├── ci.yml                npm ci + npm run check on Node 20/22/24; demo npm ci + build on Node 24
│   └── release.yml           On a v* tag: verify tag == package.json version, npm publish --provenance
└── package/                  The npm package root
    ├── package.json          Manifest: exports map (lines 21-63), files whitelist (64-71), scripts (72-87)
    ├── package-lock.json
    ├── CHANGELOG.md          Per-version notes. A test requires "## <version>"
    ├── tsconfig.json         Covers src/ only, excludes demo/
    ├── tsup.config.ts        Build. The shared-core plugin makes React entries import the built core
    ├── vitest.config.ts      jsdom, src/**/*.test.{ts,tsx}
    ├── scripts/
    │   ├── fresh-build.mjs   buildIfStale(): build when dist/ is missing or older than src/, tsup config, package.json
    │   ├── prepack.mjs       prepack/postpack: build if stale, copy root docs in (links made absolute), --clean removes them
    │   ├── tarball.mjs       npm run tarball: build if stale, pack with scripts forced on, verify REQUIRED files
    │   ├── lint-package.mjs  Pack to a temp dir, run publint and attw on the tarball
    │   ├── pack-test.mjs     Pack, install into a throwaway app with React, import ESM/CJS/production, tsc the types
    │   ├── smoke.cjs         require() the built CJS entries
    │   └── sync-version.mjs  npm "version" hook: write the version into SKILL.md and reference/; --check for the test
    ├── src/
    │   ├── index.ts          Main entry (React + core re-exports)
    │   ├── production.ts     "production" condition entry: stub panel, bench without switcher, flat canvas
    │   ├── panel.ts          prototype-machine/panel: the real panel, bench and canvas in any build
    │   ├── versions.test.ts  Docs version and changelog bookkeeping
    │   ├── core/             No React. schema.ts (types), machine.ts (compile, validate, isDev), serialize.ts
    │   │                     (URL and storage layers), describe.ts (describe, summarize, toDefaults), sections.ts,
    │   │                     stress.ts (STRESS_TEXT, STRESS_NUMBERS), states.ts (statesOf), index.ts
    │   └── react/            provider.tsx, use-scenario.ts, panel.tsx, controls.tsx, select.tsx, slider.tsx,
    │                         drag.ts, edges.ts, shadow.ts, styles.ts (all panel CSS as a string), tools.ts,
    │                         icons.tsx, bench-state.tsx + switcher.tsx (bench), canvas.tsx + canvas-state.tsx +
    │                         canvas-chrome.tsx + canvas-gestures.ts + camera.ts + overflow.ts (canvas).
    │                         Tests sit beside the source as *.test.ts(x)
    └── demo/                 Vite playground. Aliases "prototype-machine" to ../src/index.ts (vite.config.ts, tsconfig paths)
        ├── src/main.tsx      Hand-rolled path router and the provider/panel mount
        ├── src/scenario.ts   Demo config exercising every control type, including a "hostile host CSS" stress field
        ├── src/screen.tsx    A screen that reads the scenario. ROUTES at line 5
        ├── src/components/request-log.tsx   Sample product component
        └── src/states/       request-log/ (bench page, canvas, fixtures), overview/canvas.tsx
```

Generated or untracked: `package/dist/` (tsup), `package/README.md`, `package/SKILL.md` and `package/reference/` (prepack copies), `*.tgz`, `node_modules/`. There's no vendored code and there are no large binary assets. Content lives in the root Markdown files. Demo data lives in `package/demo/src/scenario.ts` and `package/demo/src/states/request-log/fixtures.ts`.

## How it works

**Config and validation (core).** `defineMachine` (`package/src/core/machine.ts:467`) calls `compile` (`machine.ts:143`), which validates eagerly at module load. It throws `ScenarioError` on, for example, an unknown initial state, inconsistent `assign` keys across a machine's states, a key owned by two machines, a field default outside its range, two controls wanting one query parameter, or a name in `RESERVED` (`machine.ts:91-95`). The compiled machine answers `initial`, `movesFrom`, `can`, `contextOf` (flattens machine cursors, assigned tuples, fields and derived values into one object) and `sanitize`. With no `transitions`, every state is one click from every other (`machine.ts:345-352`).

**Dev versus production.** `isDev` reads `process.env.NODE_ENV !== "production"` in a way bundlers can constant-fold. If `process` is undefined it assumes production, so it fails closed (`machine.ts:26-43`). The `exports` map in `package/package.json:21-63` routes the `production` condition to `dist/production.*`.

**Layering.** Precedence is defaults < localStorage < URL < this session's edits (`package/src/core/serialize.ts:4-10`). A URL naming any scenario key replaces the storage layer instead of merging with it (`package/src/react/provider.tsx:157-164`). Storage keeps only the diff from defaults, tagged with a shape hash, and a changed shape discards it (`serialize.ts:115-182`). URL parameters are read once and stripped unless `syncUrl` is set (`provider.tsx:166-177`).

**Provider.** `useProvider` (`provider.tsx:122`) is shared by `ScenarioProvider` and `PinnedScenario`. It gates hydration with `useSyncExternalStore`, so the server and first client render use defaults. It keeps edits in a ref so several `go`/`set` calls in one handler compose, batches storage writes (150 ms, flushed on `pagehide`), and supports `syncUrl` and `syncTabs`. It mirrors `dom` fields onto `<html>` or `<body>` (or onto a `display: contents` wrapper when pinned) and publishes context to a small store for the selector hooks. `go` refuses undeclared moves and `set` refuses machine-owned keys, both with dev warnings.

**Panel.** `panel.tsx` renders through `useShadowLayer` (`package/src/react/shadow.ts:91`): a `<prototype-machine data-pm-layer="panel">` host on `<body>` with an open shadow root, inline `!important` host styles, z-index 2147483000, and propagation stopped for keyboard, pointer, focus, clipboard and input events. The CSS is one string in `styles.ts`, which includes reduced-motion and forced-colors rules (`styles.ts:792-797`). Dragging and snapping are in `drag.ts`, avoiding fixed edge bars is in `edges.ts`, and page tools are in `tools.ts`. Panel UI state and position persist in localStorage under keys derived from `storageKey`.

**Bench.** `useStateParam` (`package/src/react/bench-state.tsx:119`) reads `?__state` through `useSyncExternalStore` and writes with `replaceState` plus a custom event. `switcher.tsx` draws the bar in its own shadow layer. Each state is keyed, so it mounts fresh.

**Canvas.** `StateCanvas` (`package/src/react/canvas.tsx:100`) renders `CanvasSurface` when enabled, otherwise `FlatCanvas`. The camera lives in a ref and is applied as one transform per animation frame, so components never re-render on pan or zoom. Frames are measured about 200 ms after layout settles with `inspectOverflow` (`package/src/react/overflow.ts:32`). Names, marks and the bar render in a shadow layer (`canvas-chrome.tsx`). The camera persists per `pathname + label` (`canvas.tsx:610`). Flights respect `prefers-reduced-motion`.

**Build.** tsup builds core first, then the React entries (`index`, `production`, `panel`) with the `shared-core` esbuild plugin, so CommonJS consumers get one `ScenarioError` class (`package/tsup.config.ts:13-21`).

**Packaging and publishing flow** (from `package/package.json:72-87`, `package/scripts/*` and `PUBLISHING.md`):

1. `npm run build` deletes `dist/` with Node (Windows-safe) and runs tsup.
2. `npm pack` and `npm publish` trigger `prepack` (`scripts/prepack.mjs`). It builds if stale, then copies the root `README.md` into `package/` with relative links rewritten to `https://github.com/dneath/prototype-machine/blob/main/...`, and copies `SKILL.md` and `reference/` too. The tarball contains the `files` whitelist (`dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, `SKILL.md`, `reference`). `postpack` deletes the copies.
3. If npm's `ignore-scripts` is on, `prepack` and `postpack` never run, so a bare `npm pack` or `npm publish` ships without the docs (and without `dist/` on a fresh clone). That's why `npm run tarball` exists (`scripts/tarball.mjs`). `npm run` always runs the script it names, and the script builds if stale, calls `npm pack --ignore-scripts=false --dry-run=false --pack-destination <out>`, then checks the tarball for 11 required paths. If any are missing, it deletes the tarball and exits 1. `--out <folder>` sets where it's written.
4. `npm run check` runs test, typecheck, build, smoke, lint:package and test:pack. `prepublishOnly` runs `check`. lint:package and test:pack pack into OS temp dirs and clean up.
5. `npm version <patch|minor|major>` runs the `version` hook (`scripts/sync-version.mjs`), which rewrites "Targets prototype-machine X.Y.Z" in `SKILL.md`, `reference/*.md` and `reference/control-types.json`. `src/versions.test.ts` fails if they drift or if `CHANGELOG.md` has no `## X.Y.Z` entry.
6. **First publish** is manual, from Dan's machine (`PUBLISHING.md:25-92`): `npm ci`, `npm login`, `npm run check`, `npm run tarball`, `npm publish prototype-machine-0.13.0.tgz --dry-run`, then publish that file and push the `v0.13.0` tag. The Release run on that tag is expected to fail once, because the version will already be on npm. After that, Dan configures npm Trusted Publishing for `release.yml`.
7. **Later releases** (`PUBLISHING.md:94-121`): write the changelog entry, run `npm version minor --no-git-tag-version` and `npm run check`, commit, tag, and push. `release.yml` then installs `npm@latest`, runs `npm ci`, checks the tag against the version, and runs `npm publish --provenance` (a prerelease goes out with `--tag next`).

## What's been done

`main` was re-rooted: its first commit is `c3a9fbc` (2026-10-15). The earlier history survives only on remote branches with no common ancestor with `main`, and `origin/claude/0.12-npm-ready` holds the full older line. I compared two pairs of matching commits (`c3a9fbc` with `5482937`, and `aaffb1e` with `1e75eda`). Each pair differs only in one rewritten comment in `package/demo/src/scenario.ts`. Why it was rewritten isn't recorded (see Open questions). The timeline below comes from both lines and `package/CHANGELOG.md`.

- **2026-08-31 to 09-04, first versions** (old branches): package and skill added, then a state diagram and a draggable panel. The docs were rewritten as one README, the shortcut for opening the panel was removed, the state diagram was removed, and groups and descriptions arrived (0.7.0).
- **2026-09-29, 0.9.0 hardening**: `syncUrl`, `syncTabs`, the `production` stub, typed `go`/`set`, storage diffing, and removal of `link()` and of `description`. CI was dropped "until the push token has workflow scope" (old commit `a1ff5d9`).
- **2026-10-11, 0.10.0 isolation**: shadow-root panel, panel-drawn dropdowns, stress presets, Page tools, Copy.
- **2026-10-15, 0.11.0 bench**: `StateBench`, `useStateParam`, `avoidBars`, and an accent color raised to 3.6:1 for WCAG 1.4.11. `StateSwitcher` was then removed ("one place for scenario controls"). This is where `main` starts.
- **2026-10-16, 0.12.0 npm readiness**: real slider, an agent-ready Copy, no-op writes skipped, `npm run check`, CI and the release workflow (`aaffb1e`).
- **2026-10-23, 0.13.0 canvas**: `StateCanvas`, `PinnedScenario`, `statesOf`, `reference/canvas.md` and demo canvases (`37acec3`). Then the README refresh, the version bump to 0.13.0 (`69c10bc`), building before packing (`e3e1207`) and `npm run tarball` (`153937a`).

The most recent work hardened packaging so a fresh clone, or a machine with `ignore-scripts` on, can't produce or publish a broken tarball. Still unfinished: the first npm publish and the Trusted Publisher setup (`PUBLISHING.md:8`, steps 1-7 of Part 1). Nothing has been committed since 2026-10-23.

## Conventions and rules

There's no `CLAUDE.md`, `AGENTS.md`, `.claude/` or `.agents/` in this repo, so no rule here is hidden from Codex. The rules come from these files:

- **Contributing** (`README.md:365-396`): open an issue first and have PRs reference it, keep PRs small (one fix, feature or refactor), add no runtime dependencies, edit the root README (never `package/README.md`), and make sure `npm run check` passes. Run `npm run tarball` instead of plain `npm pack`.
- **Product design principles** (`SKILL.md:177-233`, plus its "Before you finish" table at `SKILL.md:235-254`). They're written for agents using the package, but they also define the package's own behavior, so treat them as the spec. In short:
  - A panel that can express an illegal state is a bug.
  - The panel must look foreign and stay in its shadow root.
  - Bind no keyboard shortcuts. Bench and canvas keys work only while they have focus.
  - Keep one place for scenario controls (the panel).
  - Put explanations in `note`, never in subtext.
  - A state the code can't reach goes in `missing`, never faked.
  - Frames change the container, never the data.
  - A finding is observed, never predicted.
  - Dev-only, proven at the bundler.
- **Release process** (`PUBLISHING.md`): versions change only through `npm version`, every version needs a changelog entry, and the first publish uploads the tarball that `npm run tarball` checked.
- **Agent skill tooling.** `SKILL.md` is a Claude Code-format skill (YAML frontmatter `name` and `description`, with sub-docs in `reference/`). It's meant for agents working in a consuming app and is shipped in the npm tarball. Codex won't load it automatically. Read it as documentation. It has no commands, hooks or settings.
- **Copy style**: no em dashes in docs or messages (CHANGELOG 0.11.0; a grep of the repo finds none). Sentence-case labels (CHANGELOG 0.12.0). Runtime messages start with `[prototype-machine]` and name the fix. Docs and comments often use British spelling ("colour", "modelling", "catalogue").
- **Code style** (no linter or formatter config in the repo; this is observed): no semicolons, double quotes, 2-space indent, block comments that explain *why*, and tests beside the source as `*.test.ts(x)`. `"use client"` goes at the top of React modules. `core/` imports no React (`package/src/core/index.ts:1-2`).
- **Accessibility bar**: WCAG 2.1 contrast thresholds are cited in the changelog, unreachable options use `aria-disabled` with a reason, and reduced-motion and forced-colors styles exist.
- **Commits**: imperative, sentence-case subject with no type prefix ("Add ...", "Release 0.13.0", "README: describe ..."), and a body explaining why. Recent commits carry `Co-Authored-By` and `Claude-Session` trailers.
- **Branches**: descriptive kebab-case (`harden-isolation-0.10.0`, `remove-state-diagram`), `feature/<name>` and `claude/<name>`.

## Known issues and potential bugs

| # | Severity | Status | Location | What happens | Suggested fix |
|---|---|---|---|---|---|
| 1 | High | Verified | `package/src/production.ts:1-65` vs `package/src/index.ts:37-52`, `reference/api.md:216-219` | The docs tell users to build panel `children` from `Row`, `Pill` and `Select` imported from the main entry. The `production` entry doesn't export them, or `FieldRow`, `MachineRow`, `useDrag`, `clampToViewport`, `cornerPosition`, `snapTarget`, `DRAG_THRESHOLD`, `SNAP_DISTANCE`, `injectStyles` and `styles`. `prototype-machine/panel` doesn't export them either. Reproduced against a fresh build: `node --conditions=production` with `import { Pill } from "prototype-machine"` throws `SyntaxError: ... does not provide an export named 'Pill'`. A Vite or Rollup production build of an app that follows the docs should fail the same way. I inferred that and didn't run it. TypeScript won't catch it, because it doesn't apply the `production` condition | Before the first publish, export the same names from `production.ts` (stubs or the real small components), and add an export-parity assertion to `scripts/pack-test.mjs` |
| 2 | Medium | Suspected | `package/package.json:105-106`, `README.md:18`, `package/src/react/provider.tsx:433` | React 18 is declared supported, but dev, tests, `test:pack` (which installs the devDependency React, `scripts/pack-test.mjs:53-55`) and the demo all use React 19, and types are built against `@types/react` 19. One concrete risk: `provider.tsx:433` calls `React.useLayoutEffect` directly, while the same file (`provider.tsx:113-115`) and five other modules guard it because React 18 warns about layout effects on the server. Under React 18 SSR (for example Next.js), `ScenarioProvider` will likely log that warning | Use `useClientLayoutEffect` at line 433. Add a CI leg that runs `test:pack` with `react@18`, `react-dom@18` and `@types/react@18` |
| 3 | Medium | Suspected | `PUBLISHING.md:144-153`, `package/demo/src/main.tsx:15-37` | The demo routes are client-side paths (`/overview`, `/states/request-log`, ...), and the repo has no SPA fallback config (no `vercel.json`, `netlify.toml` or `_redirects`). Hosted as `PUBLISHING.md` describes, a direct load or reload of a deep link such as `/states/request-log?__state=empty` would probably 404. Shareable links are the bench's main feature. I didn't test this against a host | Add a rewrite to `index.html` for the chosen host, or switch the demo to hash routes |
| 4 | Low | Verified | `package/tsconfig.json:24`, `package/demo/package.json`, `.github/workflows/ci.yml:34-45` | Nothing typechecks the demo: the package tsconfig excludes `demo`, the demo has no `typescript` dependency or typecheck script, and CI only runs `vite build`, which strips types. An ad hoc `tsc -p demo/tsconfig.json` fails with TS2322 at `package/src/react/canvas-state.tsx:384` because it sees two `@types/react` copies (package and demo) | Add `typescript` and a `typecheck` script to the demo, map `react` types to one copy in `demo/tsconfig.json` `paths`, and run it in the CI demo job |
| 5 | Low | Verified | `.github/workflows/release.yml:30` | `npm install -g npm@latest` is unpinned, so a new npm major could change publish behavior on a release tag with no review. The actions are pinned to major tags, not SHAs | Pin npm to a known 11.x at or above 11.5.1 (the stated minimum), and consider SHA-pinning the actions |
| 6 | Low | Verified | `package/CHANGELOG.md:14`, `package/CHANGELOG.md:53` | The 0.13.0 entry has two `### Added` headings. The changelog ships in the tarball and can't change for a published version | Merge them before the first publish |
| 7 | Low | Verified | `README.md:376`, `README.md:384` | The contributing steps say `npm install`, while CI and `PUBLISHING.md` use `npm ci`. With caret ranges in devDependencies, `npm install` can rewrite a tracked lockfile | Say `npm ci` |
| 8 | Low | Suspected | `package/demo/src/main.tsx:17` | `window.location.pathname \|\| "/overview"`: a browser's pathname is never empty (it's at least `/`), so the fallback never fires. Opening the dev server root shows a page titled `/` with no nav item marked current, while `README.md:388` says the panel is at `/overview` | Map `/` to `/overview` |
| 9 | Low | Suspected | `package/src/react/overflow.ts:35`, `package/src/react/canvas.tsx:205` | Each inspection walks every element in every frame and reads `scrollWidth` and `clientWidth`, which forces layout. On a big canvas (the demo overview has 20 full screens) re-measuring after each settle could be slow. It's debounced but not budgeted | Profile on the demo canvases, and limit the walk or batch it with `requestIdleCallback` if it shows up |
| 10 | Low | Verified | jsdom-only test suite (`package/vitest.config.ts`) | All 574 tests run in jsdom, which has no layout. Overflow, camera, edge-bar and shadow-root styling behavior are only checked with stubbed sizes (for example `overflow.test.ts:5-9`), so real-browser regressions in the canvas and panel need a manual pass | Add a small Playwright smoke test against the demo routes |
| 11 | Low | Verified | Remote branches `claude/0.12-npm-ready`, `harden-isolation-0.10.0`, `remove-state-diagram`, `docs-rewrite-and-no-open-shortcut`, `state-diagram-and-draggable-panel`, `feature/state-canvas` | `main` was re-rooted on 2026-10-15, but five branches still carry the pre-rewrite history with no common ancestor (`feature/state-canvas` is already in `main`). If the rewrite was meant to drop content, that content is still public on GitHub | Dan decides whether to delete the stale branches |

## Planned and slated work

- **First npm publish of 0.13.0**: `PUBLISHING.md:8-23` and Part 1 (`PUBLISHING.md:25-92`). It covers the publish itself, then tagging `v0.13.0` and configuring npm Trusted Publishing for `release.yml` (step 6).
- **Releases after that**: `PUBLISHING.md:94-121` uses 0.14.0 as its example. No content for 0.14.0 is written down anywhere.
- **Fallback if the npm name is taken**: switch to the scoped `@dneath/prototype-machine` (`PUBLISHING.md:134-142`). The name was free on 2026-10-23 (`PUBLISHING.md:10-11`).
- **Optional demo hosting**: Vercel or Netlify with root `package/demo` (`PUBLISHING.md:144-153`).
- **Possible non-React adapter**: `package/src/core/index.ts:1-2` says the core has no React imports "so a Vue or Svelte adapter has somewhere to stand". That's an architectural note, not a commitment.
- There are no TODO, FIXME, HACK or XXX markers or `@deprecated` tags in the source. There are no GitHub issues or PRs, open or closed, and no ideas, backlog or roadmap file.

## Suggested improvements

These are my recommendations as the handoff author. They aren't Dan's plans.

1. Before the first publish, close the export gap in `src/production.ts` (issue 1). Then make `scripts/pack-test.mjs` assert that the main and `production` entries export the same names.
2. Fix `provider.tsx:433` (issue 2) and add a React 18 job to CI that runs `npm run test:pack` with React 18 and `@types/react` 18, so the `>=18` peer range is tested.
3. Add a CI step that runs `npm_config_ignore_scripts=true npm run tarball` and asserts 38 files, so the guarantee from the latest commit stays tested.
4. Merge the duplicate `### Added` in the 0.13.0 changelog (issue 6) before the first publish. The tarball is permanent once published.
5. Give the demo a `typecheck` script with deduplicated React types and run it in the CI demo job (issue 4).
6. Pin npm in `release.yml` (issue 5) and SHA-pin the third-party actions.
7. Add a Playwright smoke test over the demo routes (`/overview`, `/states/request-log?__state=<each>`, both canvases) that checks for no console errors, runs axe, and checks the canvas `data-overflow` and `data-clipped` attributes on a known-broken frame. `SKILL.md` principle 14 already asks for this check by hand.
8. Change `npm install` to `npm ci` in the README's contributing steps (issue 7).
9. If the demo will be hosted, commit the rewrite config together with the hosting decision (issue 3).
10. Consider adding a root `AGENTS.md` (Dan's call; this handoff doesn't create one) that points coding agents at `README.md` Contributing, `SKILL.md` Design principles and this file.

## Review checklist

- [ ] `cd package && npm ci && npm run check` passes (the same as CI and `prepublishOnly`).
- [ ] `cd package/demo && npm ci && npm run build` passes.
- [ ] If packaging, scripts or `files` changed: `npm run tarball` passes and lists the expected files (38 at 0.13.0). If the count changes, update `PUBLISHING.md:55` and the allowlist in `scripts/pack-test.mjs:39`. Delete the `.tgz` afterwards.
- [ ] No new `dependencies` in `package/package.json`, and React stays an optional peer.
- [ ] Public API changes are reflected in all three entries (`src/index.ts`, `src/production.ts` with a stub or flat equivalent, `src/panel.ts` if it's a control). Every name the main entry exports also exists under the `production` condition (check with `node --conditions=production` against a built `dist/`). The changes are also reflected in `reference/api.md`, `reference/control-types.json` and `SKILL.md`, and in the assertions in `scripts/pack-test.mjs`.
- [ ] `package/src/core/**` still imports nothing from React.
- [ ] Docs are edited at the root, not in `package/`. Versions change only through `npm version`, and `package/CHANGELOG.md` has a `## X.Y.Z` entry.
- [ ] No page-level keyboard shortcuts. Panel, bench and canvas UI stays inside its shadow root and styles live in `styles.ts`. No em dashes in docs or runtime messages.
- [ ] High-risk files get extra care: `package/package.json` (exports, files, scripts), `package/tsup.config.ts`, `package/scripts/prepack.mjs`, `tarball.mjs`, `fresh-build.mjs`, `.github/workflows/release.yml`, `package/src/core/machine.ts` (`isDev`, `compile`) and `package/src/react/provider.tsx`.
- [ ] Visual and functional check in the playground (`cd package/demo && npm run dev`, then http://localhost:5199):
  - `/overview`: open the panel, move the journey, and confirm undeclared moves are disabled.
  - Turn on "Hostile host CSS" and "Modal open" in the Stress group, and confirm the panel stays readable and usable.
  - `/states/request-log?__state=empty` and each other state.
  - `/states/request-log/canvas` and `/states/overview/canvas`: the findings count, Fit, Text 200% and reduced motion.
  - Run axe on each.
- [ ] No agent ran `npm publish`, `npm login`, `git tag` or `git push`.

## Open questions

1. Has 0.13.0 been published to npm since 2026-10-23? There's no tag and no Release run, and I didn't query the registry.
2. Why was `main` re-rooted at `c3a9fbc` on 2026-10-15? Should the older remote branches (issue 11) be deleted?
3. Is React 18 support a real commitment, or should the peer range move to `>=19`?
4. Which tool reads the `allowScripts` map in `package/package.json:135-138`? It pins exact esbuild versions (0.27.7, 0.21.5) that have to track the lockfile.
5. Will the demo be hosted, and on which host? That decides how issue 3 gets fixed.
6. Is anything planned for 0.14.0, or a non-React adapter?
