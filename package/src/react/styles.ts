/* One stylesheet, class-prefixed `pm-`, owned entirely by the panel.
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
 * It lives inside a shadow root, so no selector in the host page can reach it.
 * What a shadow boundary does NOT stop is inheritance. `color`, `font`,
 * `direction`, `letter-spacing`, `cursor`, `visibility` and friends all flow
 * across it from <body>, and so do custom properties. So `:host`
 * resets everything inheritable to a stated value, and every `--pm-*` token is
 * declared here rather than read from outside.
 *
 * When a browser cannot attach a shadow root the same sheet goes into <head>,
 * which is why every rule is still prefixed and every property still stated. */

const FONT = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

const CSS = `
:host {
  all: initial !important;
  display: block !important;
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 0 !important;
  height: 0 !important;
  overflow: visible !important;
  /* Important declarations inside a shadow tree beat important ones outside
     it, so the stacking order has to be stated here too; the host element
     passes it in. */
  z-index: var(--pm-z, 2147483000) !important;
  /* Inherited across the boundary unless stated. */
  color: #fff !important;
  font: 400 12px/1.4 ${FONT} !important;
  letter-spacing: normal !important;
  word-spacing: normal !important;
  text-transform: none !important;
  text-indent: 0 !important;
  text-shadow: none !important;
  text-align: left !important;
  white-space: normal !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  font-style: normal !important;
  font-variant: normal !important;
  font-feature-settings: normal !important;
  -webkit-text-fill-color: currentColor !important;
  -webkit-text-stroke: 0 !important;
  direction: ltr !important;
  unicode-bidi: isolate !important;
  writing-mode: horizontal-tb !important;
  visibility: visible !important;
  pointer-events: auto !important;
  cursor: auto !important;
  user-select: auto !important;
  quotes: auto !important;
  list-style: none !important;
  tab-size: 8 !important;
  color-scheme: dark !important;
}

.pm-root {
  --pm-bg: #171717;
  --pm-raise: #1f1f1f;
  --pm-fg: #ffffff;
  --pm-line: rgba(255, 255, 255, 0.35);
  --pm-line-soft: rgba(255, 255, 255, 0.14);
  --pm-line-strong: rgba(255, 255, 255, 0.5);
  --pm-muted: rgba(255, 255, 255, 0.55);
  --pm-text: rgba(255, 255, 255, 0.75);
  /* An opaque field fill, not a translucent one, so nothing behind the panel
     ever shows through a control. */
  --pm-field: #212121;
  --pm-hover: #2b2b2b;
  /* 3.6:1 on --pm-bg, so the changed dot meets WCAG 1.4.11 (3:1), and white
     text on it is 5:1 for the count badge. */
  --pm-accent: #8b3dff;
  --pm-danger: #fca5a5;
  /* color-scheme decides how the browser paints native parts: scrollbars,
     the date picker, number spinners. Stated, never inherited. */
  color-scheme: dark;
  position: fixed;
  margin: 0;
  font: 400 12px/1.4 ${FONT};
  letter-spacing: normal;
  text-transform: none;
  color: var(--pm-fg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: left;
  direction: ltr;
  box-sizing: border-box;
  pointer-events: auto;
  visibility: visible;
}
/* Set on descendants, not just the container, for the fallback with no shadow
   root: a host rule that matches every element beats inheritance outright. */
.pm-root, .pm-root * {
  font-family: ${FONT};
}
.pm-root *, .pm-root *::before, .pm-root *::after {
  box-sizing: border-box;
  margin: 0;
  letter-spacing: inherit;
  text-transform: inherit;
}
/* A form control reset. Native controls take their own font, colour, padding
   and appearance from the user agent, not from inheritance. */
.pm-root :where(button, input, textarea) {
  font: inherit;
  color: inherit;
  -webkit-appearance: none;
  appearance: none;
  background: none;
  border: 0;
  border-radius: 0;
  padding: 0;
  text-align: inherit;
  text-shadow: none;
  box-shadow: none;
  min-width: 0;
  min-height: 0;
  max-width: none;
  height: auto;
  line-height: inherit;
  text-indent: 0;
  -webkit-text-fill-color: currentColor;
}
.pm-root svg { display: block; flex: none; overflow: visible; }

/* --pm-edge-*: the height of bars fixed to that edge of the page (edges.ts). */
.pm-bottom-right { right: 16px; bottom: calc(16px + var(--pm-edge-bottom, 0px)); }
.pm-bottom-left  { left: 16px; bottom: calc(16px + var(--pm-edge-bottom, 0px)); }
.pm-top-right    { right: 16px; top: calc(16px + var(--pm-edge-top, 0px)); }
.pm-top-left     { left: 16px; top: calc(16px + var(--pm-edge-top, 0px)); }

.pm-launcher {
  display: grid;
  place-content: center;
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  background: var(--pm-bg);
  color: var(--pm-fg);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 120ms ease;
  touch-action: none;
}
.pm-launcher:hover { transform: scale(1.05); }
.pm-launcher:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
/* A dot on the launcher when the scenario has been moved off its defaults, so
   a closed panel still says "what you are looking at is not the default". */
.pm-launcher-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 9px;
  height: 9px;
  border-radius: 9999px;
  background: var(--pm-accent);
  box-shadow: 0 0 0 2px var(--pm-bg);
}
.pm-dragging, .pm-dragging .pm-head { cursor: grabbing; }
/* Only on the render after a release, so a resize-driven clamp never animates. */
.pm-settling { transition: top 180ms cubic-bezier(0.22, 1, 0.36, 1), left 180ms cubic-bezier(0.22, 1, 0.36, 1); }

/* Where a release right now would land. Predicted, not sprung on you. */
.pm-snap-preview {
  pointer-events: none;
  border: 1px dashed var(--pm-accent);
  border-radius: 12px;
  background: rgba(139, 61, 255, 0.08);
}
.pm-snap-launcher { width: 40px; height: 40px; border-radius: 9999px; }
.pm-snap-panel { width: 288px; height: 120px; }
/* A panel mid-drag should not also animate its own position. */
.pm-dragging.pm-launcher { transition: none; }
.pm-dragging.pm-launcher:hover { transform: none; }

.pm-panel {
  width: 288px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 32px - var(--pm-edge-top, 0px) - var(--pm-edge-bottom, 0px));
  max-height: calc(100dvh - 32px - var(--pm-edge-top, 0px) - var(--pm-edge-bottom, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
  padding: 16px;
  border-radius: 12px;
  background: var(--pm-bg);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  outline: none;
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
  /* Sticky, so reset, pin and close stay in reach once a long panel scrolls.
     It bleeds over the panel's padding to cover what scrolls beneath it. */
  position: sticky;
  top: -16px;
  z-index: 2;
  margin: -16px -16px 4px;
  padding: 16px 16px 8px;
  background: var(--pm-bg);
}
/* The one heading in sentence case and full white, so it reads above the
   uppercase section titles, which read above the row labels. */
.pm-title {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--pm-fg);
}
.pm-head-actions { display: flex; align-items: center; gap: 2px; flex: none; }

.pm-icon-button {
  position: relative;
  display: grid;
  place-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: transparent;
  color: var(--pm-muted);
  cursor: pointer;
}
.pm-icon-button:hover:not(:disabled) { color: var(--pm-fg); background: var(--pm-hover); }
.pm-icon-button:disabled { opacity: 0.3; cursor: default; }
.pm-icon-button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
.pm-icon-button[aria-pressed="true"] { color: var(--pm-fg); }
.pm-count {
  position: absolute;
  top: -3px;
  right: -4px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 9999px;
  background: var(--pm-accent);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.pm-rows { display: grid; gap: 12px; }
.pm-row { display: grid; gap: 6px; min-width: 0; }
.pm-row-head { display: flex; align-items: center; gap: 6px; min-height: 16px; }
.pm-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: var(--pm-text);
}
/* A changed field gets a dot and a way back. The dot alone is the signal; the
   reset is a 16px target beside it, so it never competes with the control. */
.pm-reset {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  color: var(--pm-muted);
  font-size: 10px;
  cursor: pointer;
  flex: none;
}
.pm-reset::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: var(--pm-accent);
}
.pm-reset:hover { color: var(--pm-fg); background: var(--pm-hover); }
.pm-reset:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
.pm-options { display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; }
.pm-stack { display: grid; gap: 6px; min-width: 0; }

/* A named group. The top border and margin are what make a run of rows read
   as a section rather than as more rows. */
.pm-section { display: grid; gap: 10px; }
.pm-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 8px 0 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--pm-line);
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pm-muted);
}
.pm-section-title:hover { color: var(--pm-fg); }
.pm-section-title:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pm-chevron { transition: transform 120ms ease; }
.pm-section[data-collapsed="true"] .pm-chevron { transform: rotate(-90deg); }

.pm-pill {
  max-width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--pm-line);
  border-radius: 6px;
  background: transparent;
  color: var(--pm-text);
  font-size: 12px;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.pm-pill:hover:not([aria-disabled="true"]):not([aria-pressed="true"]) {
  border-color: var(--pm-line-strong);
  color: var(--pm-fg);
}
.pm-pill[aria-pressed="true"] {
  border-color: rgba(255, 255, 255, 0.8);
  background: var(--pm-fg);
  color: #171717;
}
.pm-pill:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
/* An illegal move. Visible, so the shape of the journey is legible, but dead.
   The point is that you can see it is not available from here. */
.pm-pill[aria-disabled="true"] {
  opacity: 0.35;
  cursor: not-allowed;
  border-style: dashed;
}
.pm-presets .pm-pill { padding: 2px 6px; font-size: 11px; color: var(--pm-muted); }

.pm-text, .pm-number, .pm-textarea, .pm-trigger {
  display: block;
  width: 100%;
  min-height: 28px;
  padding: 5px 8px;
  border: 1px solid var(--pm-line);
  border-radius: 6px;
  background: var(--pm-field);
  color: var(--pm-fg);
  font-size: 12px;
  line-height: 16px;
}
.pm-text::placeholder, .pm-textarea::placeholder { color: var(--pm-muted); opacity: 1; }
.pm-textarea { resize: vertical; min-height: 56px; white-space: pre-wrap; }
.pm-number[aria-invalid="true"] { border-color: var(--pm-danger); }
.pm-text:focus-visible, .pm-number:focus-visible, .pm-textarea:focus-visible, .pm-trigger:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}
.pm-number { font-variant-numeric: tabular-nums; }
.pm-root input[type="number"]::-webkit-inner-spin-button { opacity: 0.6; }
.pm-root input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.7; cursor: pointer; }
.pm-date-row { display: flex; gap: 4px; }
.pm-date-row .pm-text { flex: 1; }

/* The dropdown trigger. A button, not a native <select>: the browser draws a
   native popup from the OS and the host's colour scheme, which is how a dark
   panel ended up with a light, unreadable list. */
.pm-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  text-align: left;
}
.pm-trigger:hover { border-color: var(--pm-line-strong); }
.pm-trigger[aria-expanded="true"] { border-color: rgba(255, 255, 255, 0.8); }
.pm-trigger-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-trigger .pm-chevron { color: var(--pm-muted); }

/* The list. position: fixed, so the panel's own scroll box cannot clip it. */
.pm-popover {
  position: fixed;
  z-index: 3;
  display: flex;
  flex-direction: column;
  min-width: 160px;
  padding: 4px;
  border: 1px solid var(--pm-line-soft);
  border-radius: 8px;
  background: var(--pm-raise);
  box-shadow: 0 16px 32px -8px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.4);
  color: var(--pm-fg);
  overflow: hidden;
}
.pm-popover-search {
  display: block;
  width: 100%;
  margin: 0 0 4px;
  padding: 5px 8px;
  border: 1px solid var(--pm-line-soft);
  border-radius: 6px;
  background: var(--pm-field);
  color: var(--pm-fg);
  font-size: 12px;
  line-height: 16px;
  outline: none;
  flex: none;
}
.pm-popover-search:focus-visible { border-color: rgba(255, 255, 255, 0.8); }
.pm-listbox {
  display: block;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
  outline: none;
}
.pm-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 4px;
  color: var(--pm-text);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.pm-option-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-option-check { width: 12px; flex: none; color: var(--pm-fg); }
.pm-option[data-active="true"] { background: var(--pm-hover); color: var(--pm-fg); }
.pm-option[aria-selected="true"] { color: var(--pm-fg); font-weight: 600; }
.pm-option[aria-disabled="true"] { opacity: 0.4; cursor: not-allowed; }
.pm-option[aria-disabled="true"] .pm-option-label { text-decoration: line-through; text-decoration-color: rgba(255, 255, 255, 0.4); }
.pm-listbox:focus-visible .pm-option[data-active="true"] { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6); }
.pm-option-empty { padding: 5px 8px; color: var(--pm-muted); }

/* The slider: a track you press anywhere and drag. The fill and the thumb move
   by transform only, so a jump can animate without re-laying anything out. */
.pm-slider {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 28px;
  border: 1px solid var(--pm-line);
  border-radius: 6px;
  background: var(--pm-field);
  overflow: hidden;
  cursor: ew-resize;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  outline: none;
}
.pm-slider:hover { border-color: var(--pm-line-strong); }
.pm-slider:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
.pm-slider-fill {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.14);
  transform-origin: left center;
  pointer-events: none;
}
.pm-slider-tick {
  position: absolute;
  top: 50%;
  width: 1px;
  height: 8px;
  margin-top: -4px;
  background: var(--pm-line);
  pointer-events: none;
}
/* Inset by 3px each side, so the bar at either end stays inside the track. */
.pm-slider-thumb {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  right: 3px;
  pointer-events: none;
}
.pm-slider-thumb::before {
  content: "";
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: -1px;
  width: 2px;
  border-radius: 1px;
  background: var(--pm-fg);
}
.pm-slider-jump .pm-slider-fill,
.pm-slider-jump .pm-slider-thumb { transition: transform 140ms cubic-bezier(0.22, 1, 0.36, 1); }
.pm-number-row { display: flex; align-items: center; gap: 6px; }
.pm-number-compact { flex: none; width: 64px; text-align: right; }
/* The slider and the arrow keys already step it; spinners would crowd the box. */
.pm-root .pm-number-compact::-webkit-inner-spin-button { display: none; }

.pm-action {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--pm-line);
  border-radius: 6px;
  background: transparent;
  color: var(--pm-text);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.pm-action:hover { border-color: var(--pm-line-strong); color: var(--pm-fg); }
.pm-action:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pm-actions { display: grid; gap: 6px; margin-top: 4px; }

.pm-error {
  padding: 8px 12px;
  color: var(--pm-danger);
}
.pm-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 0 8px;
  border: 1px solid var(--pm-line);
  border-radius: 6px;
  background: var(--pm-field);
  color: var(--pm-muted);
}
.pm-filter:focus-within { outline: 2px solid #fff; outline-offset: 1px; }
.pm-filter input {
  flex: 1;
  min-width: 0;
  padding: 5px 0;
  outline: none;
  background: transparent;
  color: var(--pm-fg);
  font-size: 12px;
  line-height: 16px;
}
.pm-filter input::placeholder { color: var(--pm-muted); opacity: 1; }
.pm-filter input::-webkit-search-cancel-button { -webkit-appearance: none; }
.pm-empty { color: var(--pm-muted); }


/* The state switcher. One bar, centred on an edge, opaque so nothing behind
   it shows through. The active state is inverted, as in the panel's pills:
   a 14% white fill reads at about 1.5:1 against the bar, and a selected
   state needs 3:1 (WCAG 1.4.11). */
.pm-switcher {
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: calc(100vw - 32px);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  padding: 4px;
  border-radius: 999px;
  background: var(--pm-bg);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 8px 24px rgba(0, 0, 0, 0.25);
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
}
.pm-switcher::-webkit-scrollbar { display: none; }
.pm-switcher-bottom { bottom: max(24px, env(safe-area-inset-bottom)); }
.pm-switcher-top { top: max(24px, env(safe-area-inset-top)); }
.pm-switch {
  flex: none;
  min-height: 28px;
  padding: 7px 14px;
  border-radius: 999px;
  color: var(--pm-text);
  cursor: pointer;
}
.pm-switch:hover:not([aria-pressed="true"]):not([aria-disabled="true"]) {
  background: var(--pm-hover);
  color: var(--pm-fg);
}
.pm-switch[aria-pressed="true"] {
  background: var(--pm-fg);
  color: #171717;
}
.pm-switch[aria-disabled="true"] {
  color: var(--pm-muted);
  text-decoration: line-through;
  cursor: not-allowed;
}
.pm-switch:focus-visible, .pm-switch-hide:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pm-switch-sep {
  flex: none;
  width: 1px;
  height: 16px;
  margin: 0 2px;
  background: var(--pm-line-soft);
}
.pm-switch-hide {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: var(--pm-muted);
  cursor: pointer;
}
.pm-switch-hide:hover { background: var(--pm-hover); color: var(--pm-fg); }

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
  .pm-root, .pm-root * { transition: none !important; animation: none !important; }
}
/* Windows High Contrast and friends: the panel's greys vanish, so restate the
   edges in system colours. */
@media (forced-colors: active) {
  .pm-panel, .pm-launcher, .pm-popover, .pm-switcher { border: 1px solid CanvasText; }
  .pm-switch[aria-pressed="true"] { forced-color-adjust: none; background: Highlight; color: HighlightText; }
  .pm-switch[aria-disabled="true"] { color: GrayText; }
  .pm-pill[aria-pressed="true"], .pm-option[data-active="true"] { forced-color-adjust: none; background: Highlight; color: HighlightText; }
  .pm-pill, .pm-trigger, .pm-text, .pm-number, .pm-textarea, .pm-action, .pm-slider { border: 1px solid CanvasText; }
  .pm-slider-thumb::before { forced-color-adjust: none; background: Highlight; }
}
`

const MARKER = "data-prototype-machine"

/** Put the stylesheet into a root, once. A shadow root, normally; `document`
 *  in the fallback where shadow DOM is unavailable. Idempotent per root. */
export function injectStyles(nonce?: string, root?: ShadowRoot | Document): void {
  if (typeof document === "undefined") return
  const target = root ?? document
  const parent = target instanceof Document ? target.head : target
  if (!parent) return
  if (parent.querySelector(`style[${MARKER}]`)) return
  const el = document.createElement("style")
  el.setAttribute(MARKER, "")
  if (nonce) el.nonce = nonce
  el.textContent = CSS
  parent.prepend(el)
}

export { CSS as styles }
