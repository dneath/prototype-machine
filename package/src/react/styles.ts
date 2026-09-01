/* One stylesheet, injected once, class-prefixed `pm-`.
 *
 * Shipped as a string rather than a .css file the consumer imports because a
 * prototype scaffold that needs a build-config change before it will render is
 * a scaffold nobody installs. There is no `import 'prototype-machine/styles.css'`.
 *
 * DELIBERATELY NOT YOUR DESIGN SYSTEM. Dark slab, system font stack, its own
 * spacing, no tokens. A control panel drawn in the product's own language
 * becomes part of the screenshot and part of the critique, and someone
 * eventually asks why the settings tray has a role switcher in it. Looking
 * foreign is how it stays legible as scaffolding.
 *
 * Every rule is prefixed and every property is set explicitly, because this
 * mounts into someone else's cascade and inherits whatever they have done to
 * `button` and `*`. */

const CSS = `
.pm-root {
  --pm-bg: #171717;
  --pm-fg: #ffffff;
  --pm-line: rgba(255, 255, 255, 0.2);
  --pm-line-strong: rgba(255, 255, 255, 0.5);
  --pm-muted: rgba(255, 255, 255, 0.5);
  --pm-text: rgba(255, 255, 255, 0.7);
  position: fixed;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: var(--pm-fg);
  -webkit-font-smoothing: antialiased;
  text-align: left;
  box-sizing: border-box;
}
/* The font is set on DESCENDANTS, not just the container, because a host page
   with a universal font-family rule beats inheritance outright: a selector that
   matches every element leaves nothing to inherit. Plenty of codebases have
   exactly that rule, and it would quietly pull the product's own typeface into
   a panel whose whole job is to look foreign. */
.pm-root, .pm-root * {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.pm-root *, .pm-root *::before, .pm-root *::after { box-sizing: border-box; }

/* The corner anchors read the diagram's published inset, so opening a docked
   diagram slides the panel clear of it instead of hiding it behind the thing it
   was opened from. Zero when no diagram is docked, so this costs nothing. */
.pm-bottom-right { right: calc(16px + var(--pm-diagram-inset-right, 0px)); bottom: 16px; }
.pm-bottom-left  { left:  calc(16px + var(--pm-diagram-inset-left,  0px)); bottom: 16px; }
.pm-top-right    { right: calc(16px + var(--pm-diagram-inset-right, 0px)); top: 16px; }
.pm-top-left     { left:  calc(16px + var(--pm-diagram-inset-left,  0px)); top: 16px; }

.pm-launcher {
  display: grid;
  place-content: center;
  width: 40px;
  height: 40px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 9999px;
  background: var(--pm-bg);
  color: var(--pm-fg);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 120ms ease;
}
.pm-launcher:hover { transform: scale(1.05); }
.pm-launcher:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pm-launcher { touch-action: none; }
.pm-dragging, .pm-dragging .pm-head { cursor: grabbing; }
/* Only on the render after a release, so a resize-driven clamp never animates. */
.pm-settling { transition: top 180ms cubic-bezier(0.22, 1, 0.36, 1), left 180ms cubic-bezier(0.22, 1, 0.36, 1); }

/* Where a release right now would land. Predicted, not sprung on you. */
.pm-snap-preview {
  pointer-events: none;
  border: 1px dashed #7410ff;
  border-radius: 12px;
  background: rgba(116, 16, 255, 0.08);
}
.pm-snap-launcher { width: 40px; height: 40px; border-radius: 9999px; }
.pm-snap-panel { width: 288px; height: 120px; }
/* A panel mid-drag should not also animate its own position. */
.pm-dragging.pm-launcher { transition: none; }
.pm-dragging.pm-launcher:hover { transform: none; }

.pm-panel {
  width: 288px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px;
  border-radius: 12px;
  background: var(--pm-bg);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.pm-head {
  /* The drag handle when the panel is open. touch-action:none is not
     optional: without it the browser claims the gesture for scrolling and the
     drag arrives as a pointercancel halfway through. */
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.pm-title {
  font-size: 11px;
  white-space: nowrap;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pm-muted);
}
.pm-head-actions { display: flex; align-items: center; gap: 2px; flex: none; }

.pm-icon-button {
  display: grid;
  place-content: center;
  width: 22px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--pm-muted);
  cursor: pointer;
}
.pm-icon-button:hover:not(:disabled) { color: var(--pm-fg); }
.pm-icon-button:disabled { opacity: 0.3; cursor: default; }
.pm-icon-button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }

.pm-rows { display: grid; gap: 12px; }
.pm-row { display: grid; gap: 6px; }
.pm-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pm-muted);
}
.pm-options { display: flex; flex-wrap: wrap; gap: 4px; }

.pm-pill {
  margin: 0;
  padding: 4px 8px;
  border: 1px solid var(--pm-line);
  border-radius: 6px;
  background: transparent;
  color: var(--pm-text);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}
.pm-pill:hover:not(:disabled):not([aria-pressed="true"]) {
  border-color: var(--pm-line-strong);
  color: var(--pm-fg);
}
.pm-pill[aria-pressed="true"] {
  border-color: rgba(255, 255, 255, 0.8);
  background: var(--pm-fg);
  color: #171717;
}
.pm-pill:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
/* An illegal move. Visible, so the shape of the journey is legible, but dead —
   the point is that you can see it is not available from here. */
.pm-pill:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  border-style: dashed;
}

.pm-select, .pm-text, .pm-number {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--pm-line);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--pm-fg);
  font: inherit;
  font-size: 12px;
}
.pm-select:focus-visible, .pm-text:focus-visible, .pm-number:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}
.pm-select option { color: initial; }

.pm-range { width: 100%; accent-color: #fff; }
.pm-number-row { display: flex; align-items: center; gap: 6px; }
.pm-number-value { min-width: 2.5em; color: var(--pm-text); font-variant-numeric: tabular-nums; }

.pm-action {
  margin: 0;
  padding: 6px 8px;
  border: 1px solid var(--pm-line);
  border-radius: 6px;
  background: transparent;
  color: var(--pm-text);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.pm-action:hover { border-color: var(--pm-line-strong); color: var(--pm-fg); }
.pm-action:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pm-actions { display: grid; gap: 6px; margin-top: 4px; }

/* The diagram does not share the panel's tokens. It is a technical figure —
   near-black ground, monospace, dashed frames, one accent — and it should read
   as something you would paste into a review rather than as part of the tool. */
.pm-dg {
  --pm-dg-bg: #0d0d0d;
  --pm-dg-frame: rgba(255, 255, 255, 0.16);
  --pm-dg-text: #b4b0a8;
  /* The colour itself. 3:1 on the ground above — enough for a border or a
     focus ring, which is all it paints. */
  --pm-dg-accent: #7410ff;
  /* The same hue lightened to 5.4:1, for the 13px monospace that has to be
     READ: the current state, the bracketed title, a hovered node. */
  --pm-dg-accent-text: #a564ff;
  --pm-dg-dead: rgba(255, 255, 255, 0.22);
  position: fixed;
  display: flex;
  flex-direction: column;
  background: var(--pm-dg-bg);
  color: var(--pm-dg-text);
  /* No backdrop anywhere: the app behind stays visible AND clickable, which is
     the entire point of docking rather than overlaying. */
  box-shadow: 0 0 40px -8px rgba(0, 0, 0, 0.85);
}
.pm-dg-left  { border-right: 1px solid var(--pm-dg-frame); }
.pm-dg-right { border-left: 1px solid var(--pm-dg-frame); }
.pm-dg-free {
  border: 1px solid var(--pm-dg-frame);
  border-radius: 10px;
  overflow: hidden;
}
/* While dragging or resizing, do not also fight the pointer for text. */
.pm-dg-busy { user-select: none; -webkit-user-select: none; }

.pm-dg-resize {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  touch-action: none;
  z-index: 1;
}
.pm-dg-right .pm-dg-resize { left: -3px; }
.pm-dg-left  .pm-dg-resize { right: -3px; }
.pm-dg-resize:hover, .pm-dg-busy .pm-dg-resize { background: var(--pm-dg-accent); }

.pm-dg-edge-preview {
  position: fixed;
  top: 0;
  bottom: 0;
  pointer-events: none;
  border: 1px dashed #7410ff;
  background: rgba(116, 16, 255, 0.08);
}
.pm-dg-edge-left  { left: 0; }
.pm-dg-edge-right { right: 0; }
/* Same reasoning, and it matters more here: a "monospace grid" rendered in the
   host's proportional font is not a grid at all — every row is a different
   width and the figure falls apart. Declared after the .pm-root rule above so
   it wins on source order at equal specificity. */
.pm-dg, .pm-dg * {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}
.pm-dg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: none;
  padding: 14px 20px;
  border-bottom: 1px dashed var(--pm-dg-frame);
  /* The drag handle. touch-action:none or the browser claims the gesture. */
  cursor: grab;
  touch-action: none;
}
.pm-dg-busy .pm-dg-head { cursor: grabbing; }
.pm-dg-head-actions { display: flex; align-items: center; gap: 6px; }
.pm-dg-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px;
}
.pm-dg-title {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pm-dg-dead);
}
.pm-dg-close {
  margin: 0;
  padding: 2px 8px;
  border: 1px solid var(--pm-dg-frame);
  border-radius: 4px;
  background: transparent;
  color: var(--pm-dg-text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.pm-dg-close:hover { color: var(--pm-dg-accent-text); border-color: var(--pm-dg-accent); }
.pm-dg-close:focus-visible { outline: 2px solid var(--pm-dg-accent); outline-offset: 2px; }

.pm-dg-figure { margin-bottom: 28px; display: grid; justify-items: start; }
.pm-dg-figure:last-child { margin-bottom: 0; }
.pm-dg-grid {
  margin: 0;
  /* Wide figures scroll rather than forcing the page to — which needs the
     max-width as well as the overflow, or the pre simply grows its parent. */
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  font: inherit;
  font-size: 13px;
  line-height: 1.35;
  white-space: pre;
  letter-spacing: 0.04em;
}
.pm-dg-row { min-height: 1.35em; }
.pm-dg .pm-dg-frame  { color: var(--pm-dg-frame); }
.pm-dg .pm-dg-text   { color: var(--pm-dg-text); }
.pm-dg .pm-dg-dim    { color: rgba(255, 255, 255, 0.34); }
.pm-dg .pm-dg-accent { color: var(--pm-dg-accent-text); }
.pm-dg .pm-dg-dead   { color: var(--pm-dg-dead); }

/* Inline and unpadded, so a button occupies exactly its own characters and the
   monospace grid still lines up. */
.pm-dg-node {
  display: inline;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
}
.pm-dg-node:disabled { cursor: default; }
.pm-dg-node:not(:disabled):hover { color: var(--pm-dg-accent-text); text-decoration: underline; }
.pm-dg-node:focus-visible { outline: 1px solid var(--pm-dg-accent); outline-offset: 1px; }

.pm-dg-caption {
  margin: 10px 0 0;
  max-width: 100%;
  font-size: 11px;
  color: var(--pm-dg-dead);
}
.pm-dg-empty { margin: 0; font-size: 13px; color: var(--pm-dg-text); }

.pm-sr {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pm-root * { transition: none !important; animation: none !important; }
  .pm-settling { transition: none !important; }
}
`

const MARKER = "data-prototype-machine"

let injected = false

/** Idempotent, and safe to call from every component that needs styling. */
export function injectStyles(): void {
  if (injected || typeof document === "undefined") return
  if (document.querySelector(`style[${MARKER}]`)) {
    injected = true
    return
  }
  const el = document.createElement("style")
  el.setAttribute(MARKER, "")
  el.textContent = CSS
  /* Prepended so a host that wants to restyle the panel can, without !important. */
  document.head.prepend(el)
  injected = true
}

export { CSS as styles }
