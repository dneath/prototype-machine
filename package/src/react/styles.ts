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
.pm-root *, .pm-root *::before, .pm-root *::after { box-sizing: border-box; }

.pm-bottom-right { right: 16px; bottom: 16px; }
.pm-bottom-left  { left: 16px;  bottom: 16px; }
.pm-top-right    { right: 16px; top: 16px; }
.pm-top-left     { left: 16px;  top: 16px; }

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

.pm-foot {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: grid;
  gap: 8px;
}
.pm-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}
.pm-hint kbd {
  font: inherit;
  font-size: 10px;
  padding: 1px 4px;
  border: 1px solid var(--pm-line);
  border-radius: 3px;
}

.pm-history { display: grid; gap: 3px; margin-top: 2px; }
.pm-history-item {
  display: block;
  width: 100%;
  margin: 0;
  padding: 3px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pm-history-item:hover { background: rgba(255, 255, 255, 0.08); color: var(--pm-fg); }
.pm-history-item[aria-current="true"] { color: var(--pm-fg); background: rgba(255, 255, 255, 0.1); }

/* The palette is its own layer, centred, and does not inherit the panel's
   corner positioning. */
.pm-palette-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  justify-items: center;
  align-content: start;
  padding-top: 12vh;
  background: rgba(0, 0, 0, 0.4);
}
.pm-palette {
  width: min(440px, calc(100vw - 32px));
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background: var(--pm-bg);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}
.pm-palette-input {
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: var(--pm-fg);
  font: inherit;
  font-size: 14px;
}
.pm-palette-input:focus { outline: none; }
.pm-palette-input::placeholder { color: rgba(255, 255, 255, 0.35); }
.pm-palette-list { overflow-y: auto; padding: 6px; margin: 0; list-style: none; }
.pm-palette-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--pm-text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.pm-palette-item[data-active="true"] { background: rgba(255, 255, 255, 0.12); color: var(--pm-fg); }
.pm-palette-group { color: var(--pm-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
.pm-palette-note { margin-left: auto; color: rgba(255, 255, 255, 0.35); font-size: 11px; }
.pm-palette-empty { padding: 16px; color: var(--pm-muted); font-size: 13px; text-align: center; }

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
  .pm-root *, .pm-palette-backdrop * { transition: none !important; animation: none !important; }
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
