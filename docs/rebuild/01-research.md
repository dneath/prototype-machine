# Research

Phase 1 of the rebuild. Nothing in the package changed. Every claim cites the page it came
from; claims about this repo cite a file. Read on 2026-11-16.

**Clean room.** Agentation and Retune are both under the PolyForm Shield License 1.0.0,
which forbids using them "to provide a product or service that competes with the
Software" ([Agentation LICENSE](https://github.com/benjitaylor/agentation/blob/main/LICENSE));
Retune's adds that "goods and services compete even when provided free of charge"
([Retune LICENSE](https://github.com/khadgi-sujan/retune/blob/main/LICENSE)). For both,
only READMEs, docs sites, changelogs, the LICENSE files and npm registry metadata were
read. No source file, source tree listing, skill file or internal doc of either project
was opened. Where a doc page shows a public API name (a prop, an MCP tool name, an
output field), it is recorded as documented behaviour. None of it is copied into this
package; the designs in [02-architecture.md](02-architecture.md) are written from the
brief and from the other sources cited here.

## Contents

- [A. Feature matrix](#a-feature-matrix)
- [B. Element to source mapping in React 18 and 19](#b-element-to-source-mapping-in-react-18-and-19)
- [C. Agent connectivity](#c-agent-connectivity)
- [D. Local bridge security](#d-local-bridge-security)
- [E. Edge cases at the element level](#e-edge-cases-at-the-element-level)
- [F. The tweak engine](#f-the-tweak-engine)
- [G. Comparable tools](#g-comparable-tools)
- [H. Open questions](#h-open-questions)
- [I. Retune 0.4.1, read under its MIT license](#i-retune-041-read-under-its-mit-license)

---

## A. Feature matrix

Versions read: Agentation 3.1.2 and agentation-mcp 1.3.2
([registry](https://registry.npmjs.org/agentation)), Retune 0.7.6
([registry](https://registry.npmjs.org/retune)), prototype-machine 0.13.0 (this repo).

Sources, cited by key in the table:

| Key | Page |
| --- | --- |
| AG-site | https://agentation.com/ |
| AG-features | https://agentation.com/features |
| AG-faq | https://agentation.com/faq |
| AG-schema | https://agentation.com/schema |
| AG-output | https://agentation.com/output |
| AG-mcp | https://agentation.com/mcp |
| AG-api | https://agentation.com/api |
| AG-webhooks | https://agentation.com/webhooks |
| AG-install | https://agentation.com/install |
| AG-changelog | https://agentation.com/changelog |
| AG-readme | https://github.com/benjitaylor/agentation/blob/main/package/README.md |
| AG-repo | https://github.com/benjitaylor/agentation |
| RT-readme | https://github.com/khadgi-sujan/retune |
| RT-overlay | https://raw.githubusercontent.com/khadgi-sujan/retune/main/packages/overlay/README.md |
| RT-releases | https://github.com/khadgi-sujan/retune/releases |
| RT-site | https://www.retune.dev |

"Not documented" means the docs do not say, not that the feature is absent.

### Picking

| Feature | Agentation | Retune | prototype-machine today | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| Hover highlight | Yes, with a searchable name such as `button.submit-btn` (AG-site) and the React hierarchy (AG-features) | Yes; a parent's children get dotted outlines (RT-readme) | None | **Adopt** | The base of both modes. Drawn as crop marks, not a filled box (02 §2). |
| Click select | Yes (AG-site) | Yes; repeated clicks cycle through what is under the pointer (RT-releases) | None | **Adopt** | Cycling through stacked elements is worth having too: one key while picking. |
| Text selection | A Text mode (AG-features) | Not documented | None | **Adopt** | A copy change needs the exact words and their context. |
| Multi-select | Cmd/Ctrl-click or drag (AG-repo) | Bulk reorder and reparent mentioned (RT-releases) | None | **Adopt** | Shift-click, the convention design tools use. One note on several elements. |
| Area select | Yes, on empty space too (AG-repo) | Drag to annotate an area (RT-readme) | None | **Adopt** | For "this whole region feels cramped". |
| Parent, child, sibling navigation | Not documented (AG-features) | Enter child, Shift+Enter parent, Tab siblings (RT-readme) | None | **Adapt** | Arrow keys, and only while picking, so no key is bound outside a mode. Tab stays the browser's. |
| Shadow DOM | Open roots; closed not supported (AG-faq) | Stops events at its own boundary (RT-releases); picking inside not documented | Overlays live in shadow roots (`shadow.ts`) | **Adopt** | Open roots through `elementsFromPoint` per root. Closed roots cannot be entered by any page script. |
| Same-origin iframes | Yes, nested since 3.1.0 (AG-faq, AG-changelog) | Not documented | None | **Adopt** | Coordinates translated per frame; cross-origin frames are out of reach and say so. |
| Portals and modals | `portalContainer` prop (AG-readme) | Not documented | Panel stays above product modals (`shadow.ts` z-index) | **Adapt** | Picking by point already reaches portals. The component stack comes from React, not the DOM. When a native modal `<dialog>` or popover is open, the tool layer joins the top layer too (section F). |
| Fixed and sticky | `isFixed`, y measured from the viewport (AG-schema) | Repositions absolute and fixed elements (RT-releases) | Panel avoids fixed bars (`edges.ts`) | **Adopt** | Rects are captured in viewport space with `position` in the style subset. |
| Scroll containers | Markers track scroll in child frames (AG-features) | Not documented | Canvas keeps wheel for inner scrollers (`canvas-gestures.ts`) | **Adopt** | Overlays follow a passive scroll listener (capture phase) while a selection exists. |
| Transforms | Not documented | Not documented | None | **Adapt** | `getBoundingClientRect` gives the axis-aligned box of a transformed element. Rotated elements get that box, and the inspector says it is transformed. |

### Annotation

| Feature | Agentation | Retune | prototype-machine today | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| Markers that follow scroll | Numbered markers; position stored as % of width and document y (AG-features, AG-schema) | Markers follow scroll (RT-overlay) | None | **Adopt** | Anchored to the element, re-placed per frame only on scroll, resize or mutation. Detached when the element is gone. |
| Threads | `thread` of human and agent messages (AG-schema) | Not documented | None | **Adopt** | The agent can ask a question instead of guessing. |
| Statuses | pending, acknowledged, resolved, dismissed (AG-mcp) | Not documented | None | **Adapt** | The brief's four: pending, acknowledged, applied, rejected. "Applied" says what happened, not that the reviewer agrees. |
| Intent and severity | fix, change, question, approve; blocking, important, suggestion (AG-schema) | Not documented | None | **Adopt** | Cheap, and it tells an agent what to do first. Severity is blocking, important, minor. |
| Local persistence | localStorage, 7 days per page (AG-features) | Not documented | Scenario only (`serialize.ts`) | **Adapt** | Per route, no expiry; the inbox clears what is applied. |

### Tweaking

| Feature | Agentation | Retune | prototype-machine today | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| Controls by element type | None; computed styles read-only (AG-features) | Any, text, flex, grid, image, video, SVG, positioned, background image (RT-readme) | None | **Adopt** | Text, box, layout container, image and interactive groups. |
| Scrub to adjust | No | Shift ×10, Alt ×0.1 (RT-readme) | Slider press-and-drag (`slider.tsx`) | **Adopt** | DevTools' step scheme for keys (section G). |
| Scope targeting | No | Base class, variants, this instance; variants from a manifest (RT-overlay) | None | **Adapt** | This instance, this variant, every instance, worked out at runtime from the component and its classes. No manifest file to keep in sync. |
| Token snapping | No | To CSS variables, utility classes or tokens; manifest or runtime scan (RT-overlay) | None | **Adapt** | Runtime scan of custom properties only (section F). Utility-class suggestions only for Tailwind, where the class is derivable from the token. |
| Pseudo-states | No | Hover, Focus, Active (RT-readme) | None | **Adopt** | Plus `:focus-visible` and `:disabled`, which are where focus and contrast bugs live. |
| Text edit | No | Double-click (RT-readme) | None | **Adopt** | A `textChange` item, previewed on the text node. |
| Reorder and reparent | Layout mode: drag components and sections, sent as hints (AG-features) | Drag, arrow keys, resize, delete (RT-readme) | None | **Later** | Risky against React's ownership of the DOM, and an agent turns "move it above the title" into code as well from a note. A stretch goal in M4. |
| Undo and redo | Not documented | Yes (RT-readme) | Per-field Reset (`controls.tsx`) | **Adopt** | A command stack per selection. |
| Props and state | No | Since 0.7.0 (RT-releases) | Scenario fields drive props already | **Later** | `propChange` is in the schema; scenario fields cover most of the need. |
| Breakpoint-aware styles | No | Since 0.7.5 (RT-releases) | None | **Later** | Records `media` on a change when the matching rule is inside one. |

### Output

| Feature | Agentation | Retune | prototype-machine today | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| Formats | Markdown; copy formats markdown, source, classes, or an attribute (AG-output, AG-readme) | Markdown, plus before/after diffs (RT-overlay, RT-site) | Plain text from Copy (`describe.ts`) | **Adopt** | Agent markdown, human markdown, JSON. |
| Fidelity levels | Compact, Standard, Detailed, Forensic (AG-output) | minimal, standard, full, not described (RT-overlay) | One | **Adopt** | The brief's three, measured per agent in M8. |
| Schema | AFS v1.1, a published JSON Schema (AG-schema) | Not documented | None | **Adopt** our own | Versioned, with the scenario and reproduce URL as required fields. Not compatible with AFS (question H3). |
| Source file and line | Vite, Next, Webpack, Turbopack in development (AG-output) | Optional, from `__source` (RT-overlay) | None | **Adopt** | Layered, with a confidence (section B). |
| State it was given in | URL (AG-schema) | Not documented | Copy writes the query, not the route (audit 6.7) | **Adopt** | The differentiator: every item carries its scenario and a reproduce URL. |

### Transports

| Feature | Agentation | Retune | prototype-machine today | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| Clipboard | Yes (AG-readme) | Fallback for other agents (RT-readme) | Yes (`panel.tsx` `copyText`) | **Adopt** | Works with every agent and chat. |
| File | Not documented | Not documented | None | **Adopt** | Download, and the bridge writes `.prototype-machine/feedback.md` for agents without MCP (section C). |
| MCP | 9 tools (AG-mcp) | 8 tools over a WebSocket bridge (RT-overlay) | None | **Adopt** | 8 tools, each justified (02 §5). |
| HTTP | REST plus SSE on port 4747, no auth documented (AG-api) | WebSocket on 9223 (RT-overlay) | None | **Adopt** | Loopback, Host and Origin checks, a pairing token (section D). |
| Webhook | Yes, with delivery ids (AG-webhooks) | Not documented | None | **Adopt** | Only to a URL the user configures. |
| Callbacks | `onSubmit`, `onAnnotationAdd` and others (AG-readme) | Not documented | Actions (`schema.ts`) | **Adopt** | `onFeedback(session, item)`. |

### Setup and other

| Feature | Agentation | Retune | prototype-machine today | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| CLI init | `init`, `server`, `doctor` (AG-mcp) | `setup`: MCP for Claude Code and Cursor, skill, token manifest (RT-overlay) | None | **Adopt** | `init` shows every config change before writing it; `doctor` sends a test item end to end. |
| Agent skill | Yes (AG-install) | Since 0.5.0 (RT-releases) | `SKILL.md` and `reference/` ship in the tarball | **Adopt** | Extended in M7, plus an `AGENTS.md` snippet. |
| Animation pause | CSS, JS timers, rAF, Web Animations, video (AG-changelog) | Not documented | CSS and Web Animations (`tools.ts`) | **Adapt** | Add media elements. Patching timers and `requestAnimationFrame` changes how the app runs, so it stays out; the Page section says what is not paused. |
| Hash routes | Opt-in separate storage (AG-repo) | Not documented | Provider reads `location.search` only | **Adopt** | Storage per route includes the hash route; reproduce URLs keep the hash. |
| Dark mode | Light and dark tool themes (AG-repo) | Since 0.6.0 (RT-releases) | Dark only, on purpose (`styles.ts`) | **Skip** | The tool looks unlike the product. One dark slab, plus forced colours. Screenshots cover it over light and dark pages. |
| Keyboard | Global Cmd/Ctrl+Shift+F and Esc even when closed; can be turned off (AG-features, AG-readme) | `alt+d` hotkey (RT-readme) | None bound (`api.md` Keyboard) | **Skip** the defaults | Keys only while a mode is picking; a `hotkeys` prop opts in. |
| Production safety | Recommended dev-only (AG-faq) | Dev-only by `NODE_ENV`, `force` to override (RT-overlay) | Export condition swaps in a stub (`production.ts`) | **Keep** | Stronger than a runtime check: the code is not in the bundle. |
| Runtime dependencies | None (browser); the MCP package uses zod, better-sqlite3, the MCP SDK (AG registry) | `@medv/finder`, MCP SDK, `parsel-js`, `ws`, `zod` ([registry](https://registry.npmjs.org/retune)) | None | **Keep** | Zero in the browser entries; the bin too, if D2 agrees. |
| Narrow screens | Not documented | Hidden below 768px (RT-overlay) | Works at any width | **Keep** | The bench and the panel already work on a phone. Picking by touch is later. |

---

## B. Element to source mapping in React 18 and 19

### What React 19 took away, and what it left

- **The removal.** The brief cites facebook/react#29092. That is an issue ("Fiber is
  missing a debug information"), closed as not planned
  ([#29092](https://github.com/facebook/react/pull/29092)). The removal itself was PR
  #28265, "Remove __self and __source location from elements", merged 2024-02-07 and shipped
  in 19.0.0 ([#28265](https://github.com/facebook/react/pull/28265)).
- **Why.** The old field only worked with JSX, differed between build pipelines, did not
  survive source maps, and existed only in development. A maintainer: "The internal fiber
  structure is internal and will break between any release"
  ([#29092](https://github.com/facebook/react/pull/29092)).
- **The replacement** is a stack captured per JSX call. `jsxDEV` creates
  `Error('react-stack-top-frame')`, and fibers copy `_debugStack`, `_debugTask` and
  `_debugOwner` from the element, in development only
  ([#29032](https://github.com/facebook/react/pull/29032),
  [ReactJSXElement.js](https://github.com/facebook/react/blob/main/packages/react/src/jsx/ReactJSXElement.js),
  [ReactFiber.js](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiber.js)).
  19.3.0 limits owner stacks to 10 frames
  ([CHANGELOG](https://github.com/facebook/react/blob/main/CHANGELOG.md)); the latest
  release is 19.3.1 ([registry](https://registry.npmjs.org/react)).
- **`captureOwnerStack()`** (19.1.0) is development-only and returns `null` "in a custom DOM
  event handler" ([react.dev](https://react.dev/reference/react/captureOwnerStack)). A click
  inspector is exactly that, so it cannot use it. It reads `fiber._debugStack` instead.
- **React 18** sets `fiber._debugSource = element._source` in development, from
  `__source`, which `@babel/plugin-transform-react-jsx-source` emits with a column since
  Babel 7.9 ([ReactFiber.new.js v18.3.1](https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.new.js),
  [Babel](https://babeljs.io/docs/babel-plugin-transform-react-jsx-source)).

### Observed in this repo's demo (React 19, Vite, development)

On `/overview`, clicking the card title `<h2>`:

| Read | Got |
| --- | --- |
| A key on the DOM node starting `__reactFiber$` | Present |
| `fiber._debugSource` | Absent |
| `fiber._debugStack` | An `Error`. Second frame: `at Screen (http://127.0.0.1:5199/src/screen.tsx:87:23)`. The first is `jsxDEV`. |
| Parent component fibers (`.return`) | `Screen`, `ScenarioProvider`, `App` |
| Owner chain (`_debugOwner`) | `Screen`, `App` |
| `87:23` through the inline source map Vite serves with `/src/screen.tsx` | `screen.tsx` **line 56, column 9**: the `<h2>` in the original file |

The source map was decoded with 30 lines of VLQ written for the check. So line and
column are recoverable on React 19 with no build plugin and no dependency, in
development, wherever the bundler serves source maps. React DOM tags every host node with
`__reactFiber$` plus a random suffix
([ReactDOMComponentTree.js](https://github.com/facebook/react/blob/main/packages/react-dom-bindings/src/client/ReactDOMComponentTree.js)),
which is how the fiber was found without the DevTools hook.

### The candidates

| Approach | Build plugin | Works in | file:line confidence | Runtime dependency | License |
| --- | --- | --- | --- | --- | --- |
| DevTools global hook | No, but must load before React: react-dom connects once at startup ([ReactFiberDevToolsHook.js](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberDevToolsHook.js)) | Dev and prod | n/a (gives commits, not source) | n/a | n/a |
| [bippy](https://github.com/aidenybai/bippy) 0.7.3 | No; "import bippy before React" | Dev | Medium (React 19), high (React 18) | Yes, about 19 kB gzip with source support ([tarball](https://registry.npmjs.org/bippy/-/bippy-0.7.3.tgz)); warns it "may break production apps" | MIT |
| [element-source](https://github.com/aidenybai/element-source) 0.0.5 | No | Dev, needs bippy instrumentation active | Medium; column always null | Yes (bippy) | MIT file in the tarball, but no `license` field in `package.json` ([registry](https://registry.npmjs.org/element-source)) |
| [react-grab](https://github.com/aidenybai/react-grab) 0.2.0 | No | Dev | Medium | Yes; about 99 kB IIFE | MIT |
| [LocatorJS](https://github.com/infi-pc/locatorjs) 2.0 | Babel plugin or loader for the data-id mode | Dev | High | Runtime UI on solid-js ([registry](https://registry.npmjs.org/@locator/runtime)) | MIT |
| [code-inspector-plugin](https://github.com/zh-lx/code-inspector) | Yes (webpack, vite, rspack, esbuild, turbopack and others); injects `data-insp-path` and runs a server on port 5678 | Dev | High | A custom element in the page | MIT |
| Our own `__reactFiber$` walk | No | Dev and prod | Names only; minified in prod | None | ours |
| Our own `_debugStack` + source map decode | No | Dev | Medium; observed exact above | None | ours |
| Our own `_debugSource` read | No (needs React 18's dev JSX transform, the default) | Dev | High | None | ours |
| Our own optional Vite or Babel plugin adding `data-pm-source` | Yes, opt-in | Dev | High, host elements only | None | ours |

On build plugins:

- **Vite.** `@vitejs/plugin-react` 6.0.0 (2026-03-12) removed Babel; Babel plugins now
  go through `@rolldown/plugin-babel` ([CHANGELOG](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md)).
  A plain Vite `transform` plugin with `apply: "serve"` is the stable route
  ([Vite plugin API](https://vite.dev/guide/api-plugin.html)).
- **Next.js** uses SWC. SWC plugins are Rust compiled to Wasm and must match the host's
  `swc_core` ([swc.rs](https://swc.rs/docs/plugin/selecting-swc-core)). A JS loader in
  `turbopack.rules` is the practical route
  ([Next turbopack](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack)).
- **Next strips test ids.** Its `reactRemoveProperties` option removes `^data-test`
  attributes ([Next compiler](https://nextjs.org/docs/architecture/nextjs-compiler)), so
  layer 1 can be empty in a Next production build.

### Strategy

No third-party runtime dependency is needed. Every layer is written in the package, and
all prior art above is MIT if it were ever wanted.

| Layer | What | Without a build plugin | Dev / prod | Confidence |
| --- | --- | --- | --- | --- |
| 1 | **Identifying attributes**: `data-testid`, `data-test`, `data-cy`, `data-qa`, `id` (skipped when it looks generated), `name`, `aria-label` | Yes | Both | Exact identity, no location |
| 2 | **Component stack**: walk `__reactFiber$` up through `.return` for the parent chain, and `_debugOwner` for owners | Yes | Both; names minified in prod | Names |
| 3 | **Source file:line**, in order: an opt-in `data-pm-source` attribute (high), React 18 `_debugSource` (exact), React 19 `_debugStack` mapped through the module's source map (likely). Report both the host element's JSX site and the owner component's call site. | Yes, except the opt-in attribute | Dev only | `exact`, `likely`, or `guess` (component name matched to a file name) |
| 4 | **Fallback**: ranked selectors (test id, role and name, stable attributes, stable classes, then structure), visible text, classes | Yes | Both | Locates the element on the page, not in source |

Ranking follows Playwright's guidance that user-facing attributes beat structure
([Playwright locators](https://playwright.dev/docs/locators)). Hashed classes (CSS
Modules, styled-components, Emotion, vanilla-extract; section F) are never used as
selectors, but they are reported as a styling hint. The source-map decoder fetches only
same-origin module URLs, caches per URL, and gives up silently (falling to `guess`) when
there is no map. An optional Vite plugin for `data-pm-source` is a later milestone
(question H5).

---

## C. Agent connectivity

### C1. The MCP specification today

**The current revision is 2026-07-28** ([changelog](https://modelcontextprotocol.io/specification/latest/changelog)).
The previous one is 2025-11-25. What changed that matters to a small local server:

- **Stateless.** "Remove the `initialize`/`notifications/initialized` handshake. Every
  request now carries its protocol version and client capabilities in `_meta`." ([changelog](https://modelcontextprotocol.io/specification/latest/changelog))
- **`server/discover` is required**, for version selection, and as "a backward-compatibility
  probe on STDIO" (same).
- **No sessions.** `Mcp-Session-Id` is gone. "Servers that need cross-call state use
  explicit, server-minted handles passed as ordinary tool arguments" (same). For us,
  item and session ids are exactly those handles.
- **`resultType`** is required on every result: `"complete"`, or `"input_required"` for
  multi round-trip requests (same).
- **`ping` and `logging/setLevel` are removed.** Roots, Sampling and Logging are deprecated.
  List results carry `ttlMs` and `cacheScope` (same).
- **Tasks** moved out of core into the `io.modelcontextprotocol/tasks` extension (same).

**Both eras have to work.** Clients written for 2025-11-25 still send `initialize`. The
v2 TypeScript SDK notes that `server.connect(new StdioServerTransport())` "serves
2025-era clients only", and serving both needs `serveStdio(...)`
([v2 migration](https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2)).

**Transports.**

- **stdio.** Newline-delimited JSON-RPC over a subprocess the client launches
  ([transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)).
- **Streamable HTTP.** One POST endpoint answering with JSON or a request-scoped SSE
  stream, with `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name` headers
  ([streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)).
  - Its security rules: "Servers MUST validate the `Origin` header on all incoming
    connections to prevent DNS rebinding attacks"; "When running locally, servers SHOULD
    bind only to localhost (127.0.0.1)"; "Servers SHOULD implement proper authentication"
    (same).
- **HTTP+SSE** is deprecated: "New implementations SHOULD NOT adopt it" (same).

**Tools, resources, prompts.**

- **Who controls each.** Tools are "model-controlled", resources "application-controlled",
  prompts "user-controlled" ([server](https://modelcontextprotocol.io/specification/2026-07-28/server)).
- **Client support varies:**
  - **Claude Code** surfaces resources as `@server:` references and prompts as slash
    commands ([Claude Code MCP](https://code.claude.com/docs/en/mcp)).
  - **Gemini CLI** does both ([Gemini MCP](https://geminicli.com/docs/tools/mcp-server/)).
  - **Cursor** lists tools, prompts and resources ([Cursor MCP](https://cursor.com/docs/context/mcp)).
  - **VS Code Copilot** sessions do not expose prompts, and resource support is "Limited"
    ([VS Code](https://code.visualstudio.com/api/extension-guides/ai/mcp)).
  - **Copilot cloud agent** does "not currently support resources or prompts"
    ([GitHub](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/extend-cloud-agent-with-mcp)).
- **Conclusion:** anything an agent must be able to do is a tool. Resources and prompts
  are conveniences on top.
- **Annotations.** `readOnlyHint` (default false), `destructiveHint` (default true),
  `idempotentHint`, `openWorldHint` are hints only
  ([schema](https://modelcontextprotocol.io/specification/2026-07-28/schema)).
- **Structured output.** With `outputSchema`, a server MUST return conforming
  `structuredContent` and SHOULD also return the JSON as text. Errors the model can fix
  go in the result with `isError: true`. Tool names SHOULD be 1 to 128 characters from
  `A-Z a-z 0-9 _ - .`
  ([tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)).

**Blocking tools.**

- The spec has no long-poll pattern; clients SHOULD "Implement timeouts for tool calls",
  and progress goes out as `notifications/progress`
  ([tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools),
  [progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)).
- **Client limits:**
  - **Codex:** `tool_timeout_sec` defaults to **60**
    ([Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)).
  - **Claude Code:** an idle timeout of 30 minutes on stdio unless progress arrives, and a
    call still running after 2 minutes moves to a background task
    ([Claude Code MCP](https://code.claude.com/docs/en/mcp)).
  - **Gemini CLI:** 600 s ([Gemini MCP](https://geminicli.com/docs/tools/mcp-server/)).
- **So a `wait` tool defaults to 30 s and caps at 50 s**, under the lowest limit, and
  sends progress.

**How descriptions shape behaviour.** From [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents):

- A few tools for high-impact workflows, not one per endpoint.
- Namespaced names.
- Return names, not opaque ids.
- An option for concise or detailed responses.
- Paginate and truncate with sensible defaults.
- Error messages that say how to fix the input.
- Unambiguous parameter names.

Claude Code truncates server instructions and tool descriptions at 4,096 characters,
drops tools whose full name passes 128 characters, and with tool search (on by
default) uses server instructions to decide when to look for a server's tools
([Claude Code MCP](https://code.claude.com/docs/en/mcp)).

**The official TypeScript SDK.**

- **v2** (`@modelcontextprotocol/server` 2.4.0) implements 2026-07-28. Apache-2.0,
  Node 20+, depends on `@modelcontextprotocol/core` and `zod`. About 14 MB unpacked with
  both (npm registry, read with `npm view`; [repo](https://github.com/modelcontextprotocol/typescript-sdk)).
  - Its HTTP handler "checks no `Host` or `Origin` header"; that is left to the server
    ([v2 migration](https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2)).
- **v1** (`@modelcontextprotocol/sdk` 1.32.2) is MIT and pulls in 17 packages including
  `express`, `hono` and `ajv`, with fixes promised for six months after 2026-07-27
  (npm registry; [repo](https://github.com/modelcontextprotocol/typescript-sdk)).

### C2. Registering a server, per agent

Read from each agent's own docs on 2026-11-16. Our server is a stdio command:
`npx prototype-machine mcp`.

| Agent | Project config | User config | stdio entry | Add from the CLI | Source |
| --- | --- | --- | --- | --- | --- |
| Claude Code | `.mcp.json` (project scope) | `~/.claude.json` (user and local scope) | `"mcpServers": { "pm": { "type": "stdio", "command": "npx", "args": [...] } }`; no `type` means stdio | `claude mcp add --transport stdio --scope project pm -- npx prototype-machine mcp` | [docs](https://code.claude.com/docs/en/mcp) |
| Codex CLI | `.codex/config.toml` (trusted projects only) | `~/.codex/config.toml` | `[mcp_servers.pm]` `command = "npx"` `args = [...]` | `codex mcp add pm -- npx prototype-machine mcp` | [docs](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) |
| Cursor | `.cursor/mcp.json` | `~/.cursor/mcp.json` | `"mcpServers": { "pm": { "command", "args", "env" } }` | None documented | [docs](https://cursor.com/docs/context/mcp) |
| Gemini CLI | `.gemini/settings.json` | `~/.gemini/settings.json` | `"mcpServers": { "pm": { "command", "args" } }`; `httpUrl` for HTTP, `url` means SSE | `gemini mcp add pm npx prototype-machine mcp` (project scope by default) | [docs](https://geminicli.com/docs/tools/mcp-server/) |
| Antigravity CLI (replaced Gemini CLI on 18 June 2026 for unpaid and Google One users) | `.agents/mcp_config.json` | `~/.gemini/config/mcp_config.json` | `"mcpServers": { "pm": { "command", "args" } }` | None documented | [docs](https://antigravity.google/docs/mcp?tab=cli) |
| VS Code + Copilot | `.mcp.json` at the workspace root (`mcpServers`, Copilot harness); `.vscode/mcp.json` with top-level **`servers`** (Local harness, to be removed February 2027) | user-profile `mcp.json`, `~/.copilot/mcp-config.json` | `{ "type": "stdio", "command", "args" }` | `code --add-mcp '{...}'` (user profile) | [docs](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) |
| Copilot CLI | `.mcp.json` from cwd up to the repo root, or `.github/mcp.json` | `~/.copilot/mcp-config.json` | `"mcpServers": { "pm": { "type": "local", "command", "args", "tools": ["*"] } }` | `copilot mcp add pm -- npx prototype-machine mcp` | [docs](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers) |
| OpenCode | `opencode.json(c)` or `.opencode/opencode.json(c)` | `~/.config/opencode/opencode.json(c)` | `"mcp": { "servers": { "pm": { "type": "local", "command": ["npx", "prototype-machine", "mcp"] } } }` | `opencode mcp add pm -- npx prototype-machine mcp` | [docs](https://opencode.ai/docs/mcp-servers/) |
| Windsurf | None documented | `~/.codeium/windsurf/mcp_config.json` | `"mcpServers": { "pm": { "command", "args" } }` | None documented | [docs](https://docs.devin.ai/windsurf/plugins/cascade/mcp) |
| Cline | None documented | `~/.cline/data/settings/cline_mcp_settings.json` | `{ "command", "args" }` | None documented | [docs](https://docs.cline.bot/mcp/configuring-mcp-servers) |

What this means for `init`:

- **Where possible, `init` runs the agent's own `mcp add` command** rather than editing a
  file. The agent then owns its own format, which keeps changing (OpenCode just moved
  servers under `mcp.servers`; Copilot moved from `.vscode/mcp.json` to `.mcp.json`).
- **A root `.mcp.json` with `mcpServers` is read by Claude Code, Copilot CLI and VS Code's
  Copilot harness.** One file covers three agents.
- **Copilot writes `"type": "local"` where Claude Code writes `"stdio"`.** Whether Copilot
  CLI accepts `"stdio"` or no `type` is unverified, so `doctor` checks what each agent
  actually loaded.

**AGENTS.md.**

- What it is: "a README for agents", at the repo root, the nearest file winning in a
  monorepo, stewarded under the Linux Foundation, and read by Codex, Cursor, Gemini CLI,
  opencode, VS Code, the Copilot coding agent, Windsurf, Zed, Aider, Devin and others
  ([agents.md](https://agents.md)).
- Claude Code reads it only when there is no `CLAUDE.md`; otherwise `CLAUDE.md` imports
  it ([Claude Code memory](https://code.claude.com/docs/en/memory)).

**Skills.** Every major agent now reads `SKILL.md` folders, with `name` and `description`
frontmatter:

| Agent | Where it looks | Source |
| --- | --- | --- |
| Claude Code | `.claude/skills/<name>/` | [docs](https://code.claude.com/docs/en/skills) |
| Codex | `.agents/skills/` | [docs](https://learn.chatgpt.com/docs/build-skills) |
| OpenCode | `.opencode/skills/`, `.claude/skills/` and `.agents/skills/` | [docs](https://opencode.ai/docs/skills/) |
| Gemini CLI | `.gemini/skills/` or `.agents/skills/` | [docs](https://geminicli.com/docs/cli/skills/) |
| VS Code Copilot | `.github/skills/`; its Claude and Codex harnesses add `.claude/skills/` and `.agents/skills/` | [docs](https://code.visualstudio.com/docs/copilot/customization/agent-skills) |

`.claude/skills/` plus `.agents/skills/` reach all of them. VS Code requires `name` to
match the folder and caps `description` at 1,024 characters. Today's `SKILL.md`
description is about 1,500 characters, so M7 shortens it.

### C3. Agents without MCP

- **Clipboard** works everywhere, chat included. React Grab copies a component stack with
  source locations on the normal copy shortcut ([react-grab](https://github.com/aidenybai/react-grab)).
- **File drop.** No documented convention exists (searched, none found). The mechanism is
  sound: agents read `AGENTS.md` at the start of a session
  ([agents.md](https://agents.md)), and Claude Code also reads a nested `AGENTS.md` when it
  opens files in that folder ([memory](https://code.claude.com/docs/en/memory)). So:
  - the bridge writes `.prototype-machine/feedback.md` (agent markdown) and
    `feedback.json`, gitignored;
  - one line in `AGENTS.md` tells the agent to read it before UI work;
  - the agent writes its answers to `.prototype-machine/replies.md`, which the bridge reads
    back and turns into thread messages and statuses.

  The browser shows them as if they had come through MCP.

---

## D. Local bridge security

### Binding to loopback is not enough

**DNS rebinding.**

- **How it works.** An attacker's domain resolves first to their server, then to
  127.0.0.1. The browser still thinks the page is the attacker's own origin, so it lets the
  page talk to "itself", and the request lands on the loopback server with
  `Host: attacker.example`.
- **Jupyter's answer** is a 403 when "the 'Host' header shows that the browser thinks it's
  on a non-local domain" ([Jupyter config](https://jupyter-server.readthedocs.io/en/latest/other/full-config.html)).
- **The MCP spec** requires `Origin` validation for the same reason
  ([streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)).

**Incidents in exactly this class of tool:**

| CVE | What | Fix | Source |
| --- | --- | --- | --- |
| CVE-2025-49596 | MCP Inspector, CVSS 9.4: no auth between client and proxy, reachable from a browser through 0.0.0.0, CSRF or rebinding; remote code execution | A session token by default, plus origin checks | [advisory](https://github.com/modelcontextprotocol/inspector/security/advisories/GHSA-7f8r-222p-6f5g), [write-up](https://www.oligo.security/blog/critical-rce-vulnerability-in-anthropic-mcp-inspector-cve-2025-49596) |
| CVE-2025-66414 | MCP TypeScript SDK: rebinding protection off by default before 1.24.0 | On by default | [advisory](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-w48q-cv73-mx4w) |
| CVE-2025-24010 | Vite: permissive CORS, no WebSocket Origin check, "No Host header validation" | `server.allowedHosts`, a tighter CORS default, an HMR token | [advisory](https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6) |
| CVE-2025-30359, -30360 | webpack-dev-server: source theft through a script tag; a WebSocket Origin check that allowed any IP origin | Origin checks | [advisory 1](https://github.com/webpack/webpack-dev-server/security/advisories/GHSA-4v9v-hfq4-rm2v), [advisory 2](https://github.com/webpack/webpack-dev-server/security/advisories/GHSA-9jgg-88mc-972h) |
| CVE-2025-48068 | Next.js dev server: no WebSocket Origin check | `allowedDevOrigins` | [advisory](https://github.com/vercel/next.js/security/advisories/GHSA-3h52-269p-cp9r) |
| CVE-2025-53109, -53110 | MCP filesystem server: path checks bypassed by symlinks and by colliding prefixes | realpath and prefix fixes | [advisory 1](https://github.com/modelcontextprotocol/servers/security/advisories/GHSA-q66q-fx2p-7w4m), [advisory 2](https://github.com/modelcontextprotocol/servers/security/advisories/GHSA-hc55-p739-j48w) |

**Chrome's Local Network Access** is not a substitute.

- Chrome 142 prompts before a less private page reaches a more private address
  ([LNA blog](https://developer.chrome.com/blog/local-network-access)).
- A page served from `http://localhost` "will not trigger LNA checks by default"
  ([LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access)),
  so our case gets no prompt. Other browsers have no such check (see the webpack
  advisory).

### What the bridge does

| Rule | How |
| --- | --- |
| **Loopback only** | Listens on `127.0.0.1` (and `::1` if available), never `0.0.0.0`. A test asserts the bound address. |
| **Host check** | Accepts only `Host: localhost:<port>`, `127.0.0.1:<port>`, `[::1]:<port>`. Anything else: 403. Blocks rebinding. |
| **Origin check** | Accepts only origins on the allowlist. Starts with the dev server origin the pairing link was opened from; `init` can add more. No `Origin` (curl, the stdio MCP process) is allowed only with the token. CORS echoes the allowed origin exactly, with `Vary: Origin`, never `*` ([MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)). |
| **Token** | 256 random bits per bridge run, in an `Authorization: Bearer` header on every request, compared in constant time. No cookies, so no credentials mode. |
| **Pairing** | The CLI prints a link: `http://localhost:5199/#pm-bridge=127.0.0.1:7457&token=…`. The shell reads the fragment, keeps it in `sessionStorage`, and removes it from the address bar. A fragment is never sent to a server or in a `Referer` ([MDN Referer](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referer)). Jupyter's printed token link is the precedent ([Jupyter security](https://jupyter-server.readthedocs.io/en/latest/operators/security.html)). A Vite plugin that injects the token into same-origin HTML, as Vite does for its HMR socket, is the smoother option for later ([advisory](https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6)). |
| **MCP is stdio** | The agent launches `prototype-machine mcp` as a subprocess, which talks to the bridge with the token from a file only the user can read (mode 0600). The spec's own advice: "Use the stdio transport to limit access to just the MCP client" ([best practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)). |
| **No arbitrary writes** | The bridge writes only inside `<project>/.prototype-machine/`. Every path goes through `realpath` on the root and the parent, then `path.relative`, refusing `..` and absolute results. It never writes through a symlink, and fails closed if `realpath` fails. That covers both filesystem-server bypasses above. The bridge never edits source; the agent does. |
| **No request bodies over 1 MB, no more than 1,000 items per session** | A malformed or hostile page cannot fill the disk. |

### Redaction, in the browser, before anything leaves

Prior art from session replay tools:

| Tool | What it masks | Source |
| --- | --- | --- |
| Sentry | Masks all text and inputs by default; `data-sentry-mask`, `data-sentry-block` | [docs](https://docs.sentry.io/platforms/javascript/session-replay/privacy/) |
| Datadog | `data-dd-privacy="mask\|hidden\|allow"`; always masks password, email, tel and credit-card fields | [docs](https://docs.datadoghq.com/real_user_monitoring/session_replay/browser/privacy_options/) |
| LogRocket | `data-private`; never records `type="password"` | [docs](https://docs.logrocket.com/reference/dom) |

Our rules, applied by core's `redact()` at capture time:

1. **Never captured:**
   - values of `input`, `textarea` and `select`;
   - any element with `type="password"`;
   - fields whose `autocomplete` is `cc-name`, `cc-number`, `cc-exp`, `cc-csc`,
     `current-password`, `new-password` or `one-time-code`
     ([MDN autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete)).

   The target is still identified by tag, role and label, so a note can say "this field".
2. **Masked:** text inside `[data-private]`, `[data-pm-private]`, `[data-sentry-mask]`,
   `[data-dd-privacy="mask"]` or `[data-dd-privacy="hidden"]` becomes `•••`, with its length
   kept.
3. **Patterns** in any captured text: email addresses, long digit runs, and strings shaped
   like API keys (`sk-…`, `ghp_…`, 32+ hex characters) are masked.
4. **Query parameters** named `token`, `key`, `secret`, `password`, `code`, `session` or `auth`
   are dropped from reproduce URLs.
5. **No screenshots** in v1. When they come, the DOM is masked before capture.

The reviewer's own comment is not redacted (they wrote it), and the composer warns if it
matches a secret pattern.

**Nothing leaves the page without being asked.**

- No telemetry.
- No network call except to a bridge or webhook the user configured.
- Production builds never health-check a port; Agentation removed exactly that from its
  production builds in 2.1.0 ([changelog](https://agentation.com/changelog)).

---

## E. Edge cases at the element level

The rule from the canvas carries over: a page can make some conditions real, can only
imitate others by rewriting CSS, and cannot touch the rest. Each finding says which kind
of condition produced it.

### Applying a condition from inside the page

| Condition | Real, imitated, or out of reach | How | Limit | Source |
| --- | --- | --- | --- | --- |
| `:focus`, `:focus-visible` | **Real** | `el.focus({ preventScroll: true, focusVisible: true })` | Without `focusVisible`, a mouse click on the tool suppresses `:focus-visible` on the target. Observed in Chromium 153: plain `focus()` after a click gives no `:focus-visible`, the option gives it. Supported from Chrome 145, Firefox 104, Safari 18.4. | [HTML](https://html.spec.whatwg.org/multipage/interaction.html#dom-focusoptions-focusvisible), [caniuse](https://caniuse.com/mdn-api_htmlelement_focus_options_focusvisible_parameter) |
| `:disabled` | **Real**, on button, input, select, textarea, optgroup, option, fieldset and form-associated custom elements | Set the attribute, restore after | Also removes it from the tab order. `aria-disabled` does not match `:disabled`. React does not own an attribute it never set, so restoring is safe ([React](https://react.dev/learn/manipulating-the-dom-with-refs)). | [HTML](https://html.spec.whatwg.org/multipage/semantics-other.html#concept-element-disabled) |
| `:checked` | **Real** | Set `checked`, restore after | Fires no event, so the app's state does not follow | [HTML](https://html.spec.whatwg.org/multipage/semantics-other.html#selector-checked) |
| `:hover`, `:active` | **Imitated** | Clone matching rules with the pseudo-class rewritten to an attribute (`[data-pm-hover]`), same specificity, into the adopted sheet. Mark the element and its ancestors, since an ancestor of a hovered element is hovered too. Recurse into `@media`, `@layer`, `@supports`, `@container`. | "There's no JavaScript API to toggle real pseudo states" (Storybook's addon). Cross-origin sheets throw and are skipped. The browser's own styles cannot be rewritten. | [Selectors 4](https://drafts.csswg.org/selectors-4/#the-hover-pseudo), [Storybook pseudo-states](https://github.com/chromaui/storybook-addon-pseudo-states), [CSSOM](https://drafts.csswg.org/cssom/#the-cssstylerule-interface) |
| CSS-in-JS rules | **Imitated**, same rewrite | Rules inserted with `insertRule` are still in `cssRules`, but cause no DOM mutation, so the engine re-checks rule counts | | [MDN insertRule](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/insertRule), [Emotion sheet](https://github.com/emotion-js/emotion/blob/main/packages/sheet/README.md) |
| `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast` | **Imitated** | Rewrite `MediaList.mediaText` on matching rules so the wanted branch applies; for dark, also set `color-scheme: dark` on the subtree, because `light-dark()`, form controls and scrollbars follow `color-scheme`, not the query | Script reading `matchMedia` does not see it. The real override API (`navigator.preferences`) is off in Chrome and absent in Firefox and Safari. | [MQ5](https://drafts.csswg.org/mediaqueries-5/#preferences-attribute), [caniuse](https://caniuse.com/mdn-api_navigator_preferences), [MDN light-dark](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark) |
| `forced-colors` | **Out of reach** | A rewrite turns on the author's adaptations only; the browser's palette is what matters | Shown as "needs eyes: emulate in DevTools" | [MQ5](https://drafts.csswg.org/mediaqueries-5/#forced-colors) |
| Container width | **Real** for container queries and percentages | Narrow the existing parent with an inline width, restore after; never insert a wrapper into React's DOM | Media queries read the viewport. A same-origin iframe at the target width is the only real media-query test, and that is the canvas's job, not "Stress this". | [MDN container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries), [React](https://react.dev/learn/manipulating-the-dom-with-refs) |
| Text 200% | **Real** for font-relative units | The root font size, as today's Page tool does | Is a text-size setting, not browser zoom, which also shrinks the viewport | [MDN text-scale](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/text-scale), [Understanding 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) |
| RTL | **Real** | `dir="rtl"` on the element, restored after | Logical properties flip, physical ones do not; whether the mirror is correct needs eyes | [MDN dir](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir) |
| Text spacing (1.4.12) | **Real** | The four WCAG values on the subtree through the adopted sheet | | [Understanding 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) |
| Stress text | **Real** render of a hypothetical | Set `nodeValue` of the element's text nodes to a `STRESS_TEXT` value, restore after | React re-renders overwrite it; the finding records the text used, and the fix belongs in a fixture or a field preset, not the DOM | [React](https://react.dev/learn/manipulating-the-dom-with-refs) |

### What can be measured honestly

| Check | Method | Verdict | Source |
| --- | --- | --- | --- |
| Overflow | `scrollWidth`/`scrollHeight` vs `clientWidth`/`clientHeight` | **Measurable**, ±1px (whole numbers) | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth) |
| Clipping | Overflow under `overflow: hidden` or `clip`, excluding ellipsis and line clamp | **Measurable** (what the canvas already does) | [CSSOM View](https://drafts.csswg.org/cssom-view/#dom-element-scrollwidth) |
| Truncation | `text-overflow: ellipsis` plus inline overflow; line clamp plus block overflow | **Measurable**, misses sub-pixel cuts. Reported as "truncated", not "clipped": it is shown, not hidden. | [csswg #4123](https://lists.w3.org/Archives/Public/public-css-archive/2019Jul/0300.html), [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-overflow) |
| Text contrast 1.4.3 | Computed colours to sRGB (spec conversion code, so `oklch()`, `lab()` and `color(srgb …)` all parse), backgrounds composited from `elementsFromPoint`, white when none | **Measurable** on solid backgrounds; **incomplete** over images, gradients or overlap, with the reason. A best case for thin fonts. | [WCAG 2.2](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio), [CSS Color 4](https://drafts.csswg.org/css-color-4/#color-conversion-code), [wpt.fyi](https://wpt.fyi/results/css/css-color/parsing/color-computed-lab.html?label=master&label=stable) |
| Non-text contrast 1.4.11 | Border or indicator colour against its neighbour | **Partly**: which part identifies the control is a human call | [Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |
| Target size 2.5.8 | Client rects, the 24px square test, the 24px circle spacing test, hit sampling for covered parts | **Measurable**; the inline, equivalent, user-agent and essential exceptions need eyes | [Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| Missing focus indicator 2.4.7 | Computed styles of the element, its `::before`/`::after` and its ancestors, before and after `focus({ focusVisible: true })`, transitions finished first | **Partly**: "nothing changes at all" is measured; "the change is visible" needs eyes. `outline-style: auto` is drawn as the browser likes. | [Understanding 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), [CSS UI 4](https://drafts.csswg.org/css-ui-4/#outline-style) |
| Focus not obscured 2.4.11 | An `elementsFromPoint` grid over the focused box, near sticky edges, without scrolling it into view | **Measurable**, except under `pointer-events: none` or translucent covers | [Understanding 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |
| Focus appearance 2.4.13 (AAA) | Needs pixels | **Needs eyes** (pixel capture is Chrome-only and asks permission) | [Understanding 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), [Element Capture](https://developer.chrome.com/docs/web-platform/element-capture) |
| Overlap | `elementsFromPoint` | **Measurable** | [CSSOM View](https://drafts.csswg.org/cssom-view/#dom-document-elementsfrompoint) |
| Reflow 1.4.10 at 320px | Horizontal overflow at a 320px container | **Partly**: the two-dimensional layout exception needs eyes; media queries need a 320px viewport | [Understanding 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |
| Forced colours | n/a | **Needs eyes** | [MQ5](https://drafts.csswg.org/mediaqueries-5/#forced-colors) |

### Prior art

- **axe-core** (MPL-2.0) answers "incomplete" with a reason (`bgImage`, `bgGradient`,
  `bgOverlap`, `fgAlpha`, `pseudoContent` and others) instead of guessing a contrast
  ([locales](https://github.com/dequelabs/axe-core/blob/develop/locales/_template.json)).
- Its `target-size` rule is off by default ([rule](https://github.com/dequelabs/axe-core/blob/develop/lib/rules/target-size.json)).
- It supports open shadow DOM and "cannot support closed Shadow DOM"
  ([guide](https://github.com/dequelabs/axe-core/blob/develop/doc/developer-guide.md)).
- **Lighthouse** leaves focus indicators as a manual, unscored check
  ([audit](https://developer.chrome.com/docs/lighthouse/accessibility/focusable-controls)).
- **Accessibility Insights** has a human watch the Tab stops
  ([FastPass](https://accessibilityinsights.io/docs/web/getstarted/fastpass/)).

No tool automates focus visibility. "Stress this" uses axe's three answers per check:

- **measured**, with the number;
- **incomplete**, with the reason;
- **needs eyes**, with what to look at.

It never answers "passed" for something it could not measure.

---

## F. The tweak engine

### Where the preview goes

The cascade sorts by origin and importance, then context, then element-attached styles,
then layers, then specificity, then order
([css-cascade-5](https://www.w3.org/TR/css-cascade-5/)).

| Approach | Wins against | Under CSP | React | Verdict |
| --- | --- | --- | --- | --- |
| **Inline, `el.style.setProperty(p, v, "important")`** | Every author rule, layered or not, important or not ([css-cascade-5](https://www.w3.org/TR/css-cascade-5/)) | Allowed: CSP blocks `setAttribute("style")` but not CSSOM writes ([MDN style-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src)) | React diffs the `style` prop against its previous props, not the DOM, so a tweak survives a re-render unless React writes that same key ([CSSPropertyOperations.js](https://github.com/facebook/react/blob/main/packages/react-dom-bindings/src/client/CSSPropertyOperations.js)) | **Per-property tweaks on the selected element.** Cannot express `:hover`, pseudo-elements or `@media`. |
| **An unlayered sheet** | Every layered normal rule, Tailwind v4's `@layer utilities` included ([MDN @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer), [Tailwind v4](https://tailwindcss.com/blog/tailwindcss-v4)) | `adoptedStyleSheets` (Baseline since 2023) has no element to carry a nonce ([HTML](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#nonce-attributes)); "no browser currently blocks these methods" ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src)) | Untouched by React | **Pseudo-states, variant and every-instance scope, forced states.** Must still win on specificity against unlayered app CSS, and loses to layered `!important` ([MDN @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)). |

**So the engine uses both.** Refined after reading Retune 0.4.1 (section I): the
adopted sheet carries every scope, the instance included; inline-important is the
fallback, used only when a read-back shows the sheet lost.

- As first written: instance tweaks are inline-important, with the previous value and
  priority saved for an exact revert.
- Everything else is one adopted sheet whose rules target `[data-pm-scope="…"]` markers
  with a specificity bump (`:is(#\#)` style doubling), plus `!important`.
- The CSP case gets a test page in M4, because no source names `replaceSync` directly.
- **The one React hazard,** which applied to the inline-first version only: if the
  component re-renders and writes the same inline key (the demo card's `borderRadius`
  does), React replaces the tweak.
  - The engine watches the `style` attribute of tweaked elements with a
    `MutationObserver`, re-applies the tweak, and updates the "before" value to what React
    wrote.
  - The inspector shows "the app changed this value while you were tweaking it".

### Tokens

- **No API lists every custom property on an element.**
  - Chromium leaves custom properties out of iterated computed styles; Firefox and Safari
    include them ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/ELhr0cJgb7E),
    [chromestatus](https://chromestatus.com/feature/5070655645155328)).
  - `computedStyleMap()` has limited availability
    ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/computedStyleMap)).
- **So token names come from a walk of `document.styleSheets`** (nested rules included,
  [css-nesting](https://drafts.csswg.org/css-nesting-1/#cssom)), then each value resolves
  with `getComputedStyle(el).getPropertyValue(name)`
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties)).
  - Cross-origin sheets without CORS throw `SecurityError` on `cssRules`
    ([CSSOM](https://drafts.csswg.org/cssom/)) and are skipped, and the inspector says so.
  - Tailwind v4 emits only the variables actually used, unless `@theme static` is set
    ([Tailwind theme](https://tailwindcss.com/docs/theme)). The scan finds what the page
    uses, which is the honest set to snap to.
- **Matching is per property family.**
  - Spacing tokens for padding, margin, gap and inset.
  - Radius tokens for radius.
  - Colour tokens for colours, compared after converting both sides to sRGB.
  - Type tokens for size, weight and line height.

  The scrubber snaps when within 1px (or ΔE 2 for colour), and shows the nearest token
  otherwise. Pure matching lives in core and is unit-tested.

### Which styling the code uses

| Approach | How it shows in the page | Source |
| --- | --- | --- |
| Tailwind v4 | `@layer theme, base, components, utilities;`, `--color-*` and `--spacing` on `:root`, `calc(var(--spacing) * n)` | [Tailwind v4](https://tailwindcss.com/blog/tailwindcss-v4) |
| Tailwind v3 | Utility class names, no theme variables; config in JS | same |
| CSS Modules (webpack) | `[hash:base64]` class names by default | [css-loader](https://github.com/webpack/css-loader#localidentname) |
| CSS Modules (Next.js) | `name_local__hash5`, e.g. `about_root__2oFM9` | [getCssModuleLocalIdent.ts](https://github.com/vercel/next.js/blob/canary/packages/next/src/build/webpack/config/blocks/css/loaders/getCssModuleLocalIdent.ts) |
| CSS Modules (Vite) | `_local_hash5_line` | [postcss-modules](https://github.com/madyankin/postcss-modules/blob/master/src/scoping.js) |
| styled-components | `<style data-styled data-styled-version>`, classes `sc-<hash>` or `<displayName>-<hash>` | [constants.ts](https://github.com/styled-components/styled-components/blob/main/packages/styled-components/src/constants.ts) |
| Emotion | `<style data-emotion>`, classes `css-<hash>`; empty tags in production "speedy" mode (`insertRule`) | [@emotion/cache](https://emotion.sh/docs/@emotion/cache), [sheet](https://github.com/emotion-js/emotion/blob/main/packages/sheet/README.md) |
| vanilla-extract | short hash classes, `file_style_hash` in debug | [vanilla-extract](https://vanilla-extract.style/documentation/integrations/vite/) |
| Plain CSS | none of the above | n/a |

The result is a `StylingHint` on the session and the target, and it shapes the output.

- **Tailwind:** the change as classes, when the value is a token (`p-4`, not
  `padding: 16px`).
- **CSS Modules:** the module file named, when source mapping found it.
- **CSS-in-JS:** the component's style block.
- **Plain CSS:** the matched rule's selector.

### Finding the authored rule

- `getMatchedCSSRules()` is gone, with "no standards-based alternative"
  ([Chrome](https://developer.chrome.com/blog/chrome-64-deprecations/)).
- `CSS.getMatchedStylesForNode` exists only over the DevTools protocol
  ([CDP](https://chromedevtools.github.io/devtools-protocol/tot/CSS/)).
- **In the page:**
  - Walk the rules and test `el.matches(selectorText)`, catching `SyntaxError`
    ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/matches)).
  - Check `@media` with `matchMedia`.
  - Compute specificity ourselves, since CSSOM exposes none
    ([csswg #8999](https://github.com/w3c/csswg-drafts/issues/8999)).
  - Track `@layer` order and nesting.
  - `@container` has no JS API yet
    ([csswg #6205](https://lists.w3.org/Archives/Public/public-css-archive/2026Mar/0273.html)),
    so a rule under one is reported as "inside a container query" rather than resolved.

  This gives `authored.selector` with `origin: "stylesheet"`, or `"unknown"` when the value
  came from CSS-in-JS rules inserted with `insertRule`. Those have no selector worth
  showing; the source location does the work there.

### Diffs

- **Prior art:**
  - Chrome's Changes panel shows a per-file diff with Copy, for DevTools edits only, lost on
    reload ([Chrome](https://developer.chrome.com/docs/devtools/changes)).
  - Firefox's keeps `{ selectors, ancestors (@media/@supports), add[], remove[] }` per rule
    ([reducer](https://github.com/mozilla-firefox/firefox/blob/main/devtools/client/inspector/changes/reducers/changes.js)).
- Our `styleChange.changes[]` is the same idea per property: `before` (computed), `after`,
  `authored` (selector and value when found), `token`, `state`, `media`.
- The `css` field renders it the way a person writes CSS.

### Modals and the top layer

Observed in Chromium 153 (Playwright), with a modal `<dialog>` open:

| Tried | Painted above the dialog | Clickable |
| --- | --- | --- |
| The tool's shadow host at `z-index: 2147483647` | No | No |
| A `popover="manual"` shown after the dialog | **Yes** | **No**: hit tests and clicks go to the dialog |
| The tool's shadow host moved inside the open `<dialog>` | Yes | **Yes** |

The top layer paints in the order elements enter it, but a modal dialog makes the rest of
the document inert, a later popover included. So while a modal `<dialog>` is open:

- the tool moves its host inside the topmost one, and back when it closes;
- it uses `moveBefore`, which keeps focus and modal state, where it exists
  ([MDN moveBefore](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore)),
  and `insertBefore` with a focus restore where it does not, since `moveBefore` is not
  Baseline yet.

Product modals built from divs (most React libraries) need none of this: the z-index
already wins (audit, `shadow.ts`).

---

## G. Comparable tools

One idea each, for the UX only.

| Tool | License | What it is | Idea worth considering |
| --- | --- | --- | --- |
| [DialKit](https://github.com/joshpuckett/dialkit) | MIT | Live tuning panels for React, Solid, Svelte, Vue and plain JS: sliders, colour, springs, easing, a timeline. Copy puts the values on the clipboard with an instruction. | **Saved versions.** A capture of the page goes into the panel as a thumbnail ([README](https://raw.githubusercontent.com/joshpuckett/dialkit/main/README.md)). Named tweak sets to compare before sending one: "A: 12px, B: 16px". |
| [React Grab](https://www.react-grab.com) | MIT | Hover an element and press the copy shortcut: copies its HTML, component stack and file:line. Finds source at runtime through bippy ([registry](https://registry.npmjs.org/react-grab), [bippy](https://github.com/aidenybai/bippy)). | **No mode to enter.** The copy you already know grabs context ([repo](https://github.com/aidenybai/react-grab)). For us: "Copy" on a selection puts that one target on the clipboard, without making an item. |
| [LocatorJS](https://www.locatorjs.com) | MIT | Alt-click a component to open its source in the editor. A Babel plugin or loader, or runtime metadata; v2 supports React 19, iframes and shadow DOM ([install](https://www.locatorjs.com/install/react), [releases](https://github.com/infi-pc/locatorjs/releases)). | **Hold to pick.** A held modifier is a temporary mode that ends on release, so no mode is left on by mistake. For us, an opt-in through `hotkeys`. |
| [Chrome DevTools](https://developer.chrome.com/docs/devtools/css/reference) | BSD-3-Clause ([frontend](https://github.com/ChromeDevTools/devtools-frontend)) | Styles editing, forced states (`:hov`), and Rendering emulation of colour scheme, reduced motion, forced colours and contrast ([emulate](https://developer.chrome.com/docs/devtools/rendering/emulate-css)). | **Its step scheme.** Arrow 1, Alt 0.1, Shift 10, Shift+Cmd 100 ([reference](https://developer.chrome.com/docs/devtools/css/reference)). Reviewers already know it. |
| [Figma Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) | Proprietary | Inspect, measurements, annotations, "ready for dev" status, variables with suggestions, compare changes. | **Compare changes.** A before/after toggle on a tweak before it goes to the agent. |
| [Storybook](https://storybook.js.org/docs/essentials) | MIT | Backgrounds, Viewport, Measure and outline (`m` toggles), Controls, Highlight; an a11y addon on axe-core that reports Violations, Passes and Incomplete ([a11y](https://storybook.js.org/docs/writing-tests/accessibility-testing)). | **Incomplete is a result.** axe says when it cannot decide. Stress findings get the same third answer: measured, not measurable here, or needs eyes. |
| [VisBug](https://github.com/GoogleChromeLabs/ProjectVisBug) | Apache-2.0, archived 2026-09-15 | "FireBug for designers": point-and-click margin, padding, alignment, type, colour, guides; Shift multi-select. | **Expand selection** to similar elements ([keyboard list](https://github.com/GoogleChromeLabs/ProjectVisBug/wiki/Keyboard-Master-List)). Our scope switch, made visible: show every element "all like this" will change before applying it. |

---

## H. Open questions

For you. Each is also a decision in [02-architecture.md](02-architecture.md#checkpoint)
where it changes the build.

1. **The name.** Keep `prototype-machine`, or rename at 1.0.0? Three options in
   02 §12.
2. **The MCP server: written by us, or the official SDK?** The spec changed shape in July
   (stateless, `server/discover`, no `initialize`), and clients of both eras are in use.
   - The v2 SDK handles both, but adds about 14 MB (Apache-2.0 plus zod) to every install
     if it lives in this package.
   - Writing a stdio server that answers both eras is about 400 lines, tested against
     the SDK's own client.
   - Recommendation: write it, keep zero dependencies.
3. **Agentation's schema (AFS).** It is a published JSON Schema. Exporting to it would let
   their MCP server read our items. Their license covers "the Software", and the schema is
   part of their docs. I recommend not exporting to it, and not reading their schema
   beyond the field names already noted, unless you get a written answer from the
   author.
4. **Shell in React or vanilla?** React now (reuses 2,500 working lines), vanilla engines
   (02 §1). Vanilla everything costs a rewrite for frameworks nobody has asked for.
5. **An optional build plugin for exact source lines?** Runtime mapping gives a likely
   line on React 19 with no plugin (observed in section B). A small Vite plugin adding
   `data-pm-source` would make it exact for host elements. Later milestone, or not at all?
6. **Usability sessions** (research-to-refine, step 2) need three to five real
   designers and developers. I can write the protocol, the tasks and the measures, and run
   scripted walkthroughs myself, but I cannot recruit people. Will you run them, or recruit
   for them?
7. **The agent benchmark** asks for at least three agents. This environment has Claude
   Code. Codex, Cursor and Gemini need their own accounts and keys. Can you provide access,
   or run those arms with the harness I build?
8. **Where the schema lives.** `$schema` and `$id` want a stable URL. A GitHub raw URL on a
   tag works with no hosting. A domain is nicer. Which?
9. **Webhooks** in v1, or later? They are cheap, but they are the one transport that sends
   data off the machine.
10. **Screenshots** are not in the brief. Agentation sends none
    ([output](https://agentation.com/output)). An agent can open the reproduce URL itself.
    Leave them out of v1?
11. **More from Agentation or current Retune.** Their sources were not read (section I).
    Three ways to get more:
    - ask each author for permission or a commercial license (I can draft the note);
    - have someone with no hand in this code read them and write a behaviour-only spec.
      This keeps the code clean, but the reading is still the use their license excludes,
      so it needs the author's permission too;
    - keep to their docs and the MIT 0.4.1 code, as now. This is what I recommend.

---

## I. Retune 0.4.1, read under its MIT license

Added after the checkpoint, when you asked for the sources to be read.

### What was read, and why only this

| Package | Versions | License | Read |
| --- | --- | --- | --- |
| `retune` | 0.3.0, 0.4.0, 0.4.1 | **MIT**: `"license": "MIT"` in each published `package.json`, and "## License / MIT" in the 0.4.1 README | **Yes.** The original TypeScript of 0.4.1, from `sourcesContent` in its published source map (`retune-0.4.1.tgz`, about 11,000 lines). |
| `retune` | 0.0.0, 0.1.0, 0.5.0 to 0.7.6 | PolyForm Shield 1.0.0 | No |
| `agentation`, `agentation-mcp` | every published version | PolyForm Shield 1.0.0. The two releases with an empty license field (0.0.1, 1.4.3) were unpublished. | No |

Licenses come from `npm view <pkg>@<version> license` and the tarballs, read 2026-11-16.

- **Retune 0.3.0 to 0.4.1** were released by their author under MIT, which allows reading
  and reuse with the copyright notice. Nothing below is copied; these are ideas, written up
  in our own words and designed our own way. Credit: Retune 0.4.1, MIT, © Sujan Khadgi.
- **The PolyForm Shield sources** were not opened. Reading them to apply what they do to
  this package is the use their license excludes, and Retune's says a free product
  competes. It would also make the clean room meaningless for every line written
  afterwards. Section H, question 11, has the ways to get more if you want it.

### Adopt

| From 0.4.1 | What we do with it | Where it lands |
| --- | --- | --- |
| The host is appended to `<html>`, not `<body>` | Mount every tool host on `<html>`. Observed in Chromium 153: with `transform`, `filter` or `contain: paint` on `<body>`, a fixed host inside `<body>` scrolls away with the page; one on `<html>` stays put. Today's hosts are on `<body>` (audit 6.11). | 02 §1, M0 |
| One constructed stylesheet in `document.adoptedStyleSheets` holds every preview rule, each with `!important`; detaching it reverts everything | All preview goes in one adopted sheet, the instance scope included, targeted by a marker attribute. An important author rule beats React's inline `style` writes, so the React-rewrite hazard in section F disappears. Inline `!important` becomes the fallback, used only when a read-back of the computed value shows the sheet lost (to an inline `!important` from the app, or a layered `!important`). | 02 §6 |
| Changes to one target within 300 ms form one undo step | Undo groups by gesture: a scrub, or paired properties changed together, undo as one. | 02 §6 |
| Utility classes recognised by stylesheet structure, not names: rules in `@layer utilities`, or rules with at most two property families on a single-class selector | Scope candidates leave out utility and hashed classes and keep semantic ones. Each candidate shows how many elements it matches. | 02 §6 |
| Under a class scope, the panel's values come from that class's own rules, excluding variant rules with extra classes (`.btn.active`) | "Before" values under a wider scope are the scope's authored values, not the instance's computed ones. | 02 §6 |
| Pending changes move when the scope changes | Switching scope migrates the draft instead of dropping it. | 02 §6 |
| Sizing as Fill, Hug or Fixed per axis, translated by the parent's layout (block, grid child, flex main axis, flex cross axis) | A Size control in designers' terms, with the CSS worked out from the parent. | 02 §6 |
| Controls depend on the parent's layout too (flex child, grid child, positioned), not only the element's own type | Self-alignment and sizing controls follow the parent. | 02 §6 |
| A truncation control: none, one line with an ellipsis, clamp to N lines | Text group. Ties in with the truncation check in section E. | 02 §6 |
| A bare typed number keeps the previous unit; unitless properties never gain one; scrubbing from a keyword (`normal`, `auto`) starts in px; display rounds | Value entry rules for every numeric control. | 02 §6 |
| A second click at the same spot (within 5px) steps through the element stack at that point | Click-to-cycle while picking. | 02 §2 |
| Void elements (`br`, `wbr`, `col`, `source`, `track`, `area`, `param`) resolve to their parent; a move onto an ancestor waits 50 ms, so crossing the gap between siblings does not flash the parent | Picking details. | 02 §2 |
| Clicks are intercepted in the capture phase with no glass layer, so the page's real `:hover` shows while picking | Worth testing against our glass layer. Hover is often the thing under review. 0.4.1 intercepts only `click`, so the app's `pointerdown` and `mousedown` handlers still run (menus that open on press, drags, focus moves). Our version intercepts the whole press on `window`, in the capture phase. M2 measures both. | 02 §2 |
| The component name is shown only on that component's root DOM node | Labels say `Card` on the card, not on every child of it. | 02 §2 |
| Context for finding an element without source: its own text (not its children's), parent, child summary ("3 children: h2, p, button"), siblings either side, DOM path | `Target.context`, at standard and full fidelity. | 02 §3 |
| Output: longhands collapsed into shorthands when every side changes the same way; a changes table with property, before, after, source rule and token; a one-line summary of the token system ("47 tokens; prefixes color (12), space (9)…"); an implementation hint per styling approach | All four, in the serializers. Tailwind hints come from the page's own theme variables first, the default scale second. | 02 §4 |
| `window.__retune` gives agents that drive a browser (Playwright MCP, Chrome DevTools MCP) a way in through `page.evaluate` | A page API transport, development only. | 02 §5 |
| Pending changes are saved and re-applied on load | Unsent tweaks survive a reload or hot update, with "3 tweaks restored". | 02 §6 |
| An element tree tab, hover to highlight | A tree view in the inspector: a keyboard alternative to pointing. | 02 §2, §10 |
| A box model overlay only for the input being hovered, including gaps between flex and grid children | Matches the dimension lines in 02 §2; adds gaps. | 02 §2 |

### Avoid

The bridge in 0.4.1 is a list of what section D warns about. These are observations of
0.4.1 only; later versions were not read.

| In 0.4.1 | Why not | Our rule |
| --- | --- | --- |
| The WebSocket server is created with only a port, so it listens on every interface, with no `Origin` or `Host` check and no token | WebSockets are not covered by CORS, so any page the reviewer visits can connect to `ws://localhost:9223`. | Loopback, Host, Origin, token (D). |
| A new browser connection silently replaces the previous one | Two tabs fight; a hostile page can take over. | One session per tab. |
| On a busy port the server moves to the next one, but the browser always dials 9223 | They can stop finding each other without saying so. | The pairing link and `bridge.json` carry the real port. |
| Reading the formatted changes clears them by default | If the agent fails half way, the feedback is gone. | Reads never consume; status changes are explicit. |
| Tool errors return as plain text, without `isError` | The agent may not notice the call failed. | `isError: true` with the fix. |
| The browser retries the socket forever (3 s to 60 s backoff), whether or not a bridge was ever configured | Console noise on every page. | No connection unless configured. A few retries, then "Bridge offline", with a button. |
| A global `alt+d` hotkey, and `Cmd/Ctrl+Z` taken on the document while active | Steals the app's own undo. | No global keys (invariant 4). Undo only in the inspector. |
| Default scope is the first shared class | The first edit can change dozens of elements. | Default is this instance; wider scopes show their count first. |
| Loads the Inter font from a third-party host on mount | A network call on every page, and the tool takes on a look. | System fonts, no network (invariant 9, 02 §8). |
| Hidden below 768px | | Works at any width. |
