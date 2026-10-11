"use client"

import * as React from "react"

import { CheckIcon, ChevronIcon } from "./icons"
import { eventWithin } from "./shadow"

/* A dropdown the panel draws itself.
 *
 * A native <select> hands its popup to the operating system, which paints it
 * from the host page's colour scheme and the OS theme rather than from the
 * panel. On a light product that meant a dark panel opening a light list with
 * the option ink resolved for the wrong background, and on some platforms an
 * unreadable one. It also cannot say WHY an option is unavailable: `title` on
 * an <option> is ignored nearly everywhere.
 *
 * This one is a button that opens a listbox. The list is `position: fixed`, so
 * the panel's scroll box cannot clip it; it flips above the trigger when there
 * is no room below; long lists grow a filter; and the keyboard model is the
 * one a native select taught everybody — arrows, Home/End, PageUp/PageDown,
 * type-to-jump, Enter or Space to choose, Escape to back out. */

export interface SelectOption {
  value: string
  label: string
  /** Present but not choosable: an illegal move, drawn so the shape shows. */
  disabled?: boolean
  /** Why it is disabled. Shown as the tooltip and read to screen readers. */
  reason?: string
  /** Tooltip for an enabled option. */
  note?: string
}

/** Past this many options the list gets a filter box. */
export const SEARCH_THRESHOLD = 10

/** How long typed characters keep building one type-to-jump query. */
const TYPEAHEAD_MS = 700
const LIST_MAX_HEIGHT = 280
const GAP = 4
const MARGIN = 8

export interface ListPlacement {
  left: number
  width: number
  maxHeight: number
  /** Exactly one of these is set. */
  top?: number
  bottom?: number
  side: "below" | "above"
}

/**
 * Where the list goes. Below the trigger if it fits or if below is the roomier
 * side; above otherwise. Clamped inside the viewport horizontally. Pure, so it
 * is testable without layout.
 */
export function placeList(
  trigger: { top: number; bottom: number; left: number; width: number },
  viewport: { width: number; height: number },
  natural: number,
): ListPlacement {
  const desired = Math.min(natural, LIST_MAX_HEIGHT)
  const below = viewport.height - trigger.bottom - GAP - MARGIN
  const above = trigger.top - GAP - MARGIN
  const width = Math.min(Math.max(trigger.width, 160), viewport.width - MARGIN * 2)
  const left = Math.min(Math.max(trigger.left, MARGIN), Math.max(MARGIN, viewport.width - width - MARGIN))
  if (below >= desired || below >= above) {
    return { side: "below", top: trigger.bottom + GAP, left, width, maxHeight: Math.max(0, Math.min(LIST_MAX_HEIGHT, below)) }
  }
  return {
    side: "above",
    bottom: viewport.height - trigger.top + GAP,
    left,
    width,
    maxHeight: Math.max(0, Math.min(LIST_MAX_HEIGHT, above)),
  }
}

/** Next index in `dir` from `from`, clamped to the list. */
function step(from: number, dir: number, length: number): number {
  if (length === 0) return -1
  return Math.min(Math.max(from + dir, 0), length - 1)
}

/** Type-to-jump: the first option after `from` whose label starts with the
 *  query, wrapping. A query of one repeated letter cycles through that letter. */
export function typeahead(options: ReadonlyArray<SelectOption>, query: string, from: number): number {
  if (!query || !options.length) return -1
  const q = query.toLowerCase()
  const repeated = q.split("").every((c) => c === q[0])
  const needle = repeated ? q[0] : q
  const start = repeated || q.length === 1 ? from + 1 : from
  for (let i = 0; i < options.length; i++) {
    const index = (start + i + options.length) % options.length
    if (options[index].label.toLowerCase().startsWith(needle)) return index
  }
  return -1
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  /** The control's name, for the trigger's accessible label. */
  label: string
  /** Shown on the trigger when `value` matches no option. */
  placeholder?: string
  value: string
  options: ReadonlyArray<SelectOption>
  onChange: (value: string) => void
}) {
  const id = React.useId()
  const listId = `${id}-list`
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(-1)
  const [placement, setPlacement] = React.useState<ListPlacement | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const typed = React.useRef({ text: "", at: 0 })

  const searchable = options.length > SEARCH_THRESHOLD
  const q = query.trim().toLowerCase()
  const shown = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
    : options
  const current = options.find((o) => o.value === value)

  const openList = React.useCallback(() => {
    setQuery("")
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }, [options, value])

  const close = React.useCallback((refocus: boolean) => {
    setOpen(false)
    setPlacement(null)
    if (refocus) triggerRef.current?.focus()
  }, [])

  const choose = (option: SelectOption | undefined) => {
    if (!option || option.disabled) return
    close(true)
    if (option.value !== value) onChange(option.value)
  }

  /* Focus into the list (or its filter) once it exists. */
  React.useEffect(() => {
    if (!open) return
    ;(searchable ? searchRef.current : listRef.current)?.focus({ preventScroll: true })
  }, [open, searchable])

  /* Follow the trigger. One measurement per frame while open, compared before
     anything re-renders: cheaper than listening to every scroll container
     between here and the window, and it also catches the panel being dragged,
     resized, or reflowed by a section collapsing above it. */
  React.useEffect(() => {
    if (!open) return
    let frame = 0
    let last = ""
    const measure = () => {
      const trigger = triggerRef.current
      const pop = popoverRef.current
      if (trigger && pop) {
        const rect = trigger.getBoundingClientRect()
        const natural = (listRef.current?.scrollHeight ?? 0) + (searchRef.current ? 34 : 0) + 10
        const key = `${rect.top}|${rect.bottom}|${rect.left}|${rect.width}|${window.innerWidth}|${window.innerHeight}|${natural}`
        if (key !== last) {
          last = key
          setPlacement(placeList(rect, { width: window.innerWidth, height: window.innerHeight }, natural))
        }
      }
      frame = window.requestAnimationFrame(measure)
    }
    measure()
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  /* A press anywhere else closes it. Capture phase on the document, read
     through composedPath, because inside a shadow root `target` has been
     retargeted to the host by the time the document sees it. */
  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (eventWithin(event, popoverRef.current) || eventWithin(event, triggerRef.current)) return
      close(false)
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [open, close])

  /* Keep the active option in view as the keyboard moves it. */
  React.useEffect(() => {
    if (!open || active < 0) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" })
  }, [open, active])

  const onListKeyDown = (event: React.KeyboardEvent) => {
    const fromSearch = event.target === searchRef.current
    const page = 8
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        setActive((i) => step(i, event.altKey ? shown.length : 1, shown.length))
        return
      case "ArrowUp":
        event.preventDefault()
        if (event.altKey) return choose(shown[active])
        setActive((i) => step(i, -1, shown.length))
        return
      case "PageDown":
        event.preventDefault()
        setActive((i) => step(i, page, shown.length))
        return
      case "PageUp":
        event.preventDefault()
        setActive((i) => step(i, -page, shown.length))
        return
      case "Home":
        if (fromSearch) return
        event.preventDefault()
        setActive(shown.length ? 0 : -1)
        return
      case "End":
        if (fromSearch) return
        event.preventDefault()
        setActive(shown.length - 1)
        return
      case "Enter":
        event.preventDefault()
        choose(shown[active])
        return
      case " ":
        if (fromSearch) return
        event.preventDefault()
        choose(shown[active])
        return
      case "Escape":
        /* Ours, not the panel's: an Escape that closes the list must not
           also close the panel it is in. */
        event.preventDefault()
        event.stopPropagation()
        close(true)
        return
      case "Tab":
        /* Back to the trigger, so the tab order resumes from the control the
           list belongs to rather than from wherever the list was drawn. */
        event.preventDefault()
        close(true)
        return
    }
    if (fromSearch || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
    const now = Date.now()
    const text = now - typed.current.at > TYPEAHEAD_MS ? event.key : typed.current.text + event.key
    typed.current = { text, at: now }
    const hit = typeahead(shown, text, active)
    if (hit >= 0) setActive(hit)
  }

  const activeOption = active >= 0 ? shown[active] : undefined
  const activeId = activeOption ? `${id}-opt-${options.indexOf(activeOption)}` : undefined

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="pm-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${current?.label ?? placeholder ?? value}`}
        title={current?.note}
        onClick={() => (open ? close(true) : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault()
            openList()
          }
        }}
      >
        <span className="pm-trigger-label">{current?.label ?? placeholder ?? value}</span>
        <span className="pm-chevron" aria-hidden="true">
          <ChevronIcon size={12} />
        </span>
      </button>
      {open ? (
        <div
          ref={popoverRef}
          className="pm-popover"
          data-side={placement?.side}
          style={
            placement
              ? {
                  top: placement.top,
                  bottom: placement.bottom,
                  left: placement.left,
                  width: placement.width,
                  maxHeight: placement.maxHeight,
                }
              : /* Unmeasured for one frame. Transparent rather than hidden:
                   a `visibility: hidden` list cannot take the focus that
                   the open effect is about to give it. */
                { opacity: 0, pointerEvents: "none", top: 0, left: 0 }
          }
          onKeyDown={onListKeyDown}
        >
          {searchable ? (
            <input
              ref={searchRef}
              className="pm-popover-search"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              aria-label={`Filter ${label}`}
              placeholder="Filter"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
            />
          ) : null}
          <ul
            ref={listRef}
            id={listId}
            className="pm-listbox"
            role="listbox"
            aria-label={label}
            tabIndex={searchable ? -1 : 0}
            aria-activedescendant={searchable ? undefined : activeId}
          >
            {shown.map((option, index) => {
              const selected = option.value === value
              return (
                <li
                  key={option.value}
                  id={`${id}-opt-${options.indexOf(option)}`}
                  data-index={index}
                  className="pm-option"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled ? true : undefined}
                  data-active={index === active ? "true" : undefined}
                  title={option.disabled ? option.reason : option.note}
                  onPointerMove={() => {
                    if (index !== active) setActive(index)
                  }}
                  /* Keep focus where it is; a mousedown would move it to <li>. */
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span className="pm-option-check" aria-hidden="true">
                    {selected ? <CheckIcon size={12} /> : null}
                  </span>
                  <span className="pm-option-label">{option.label}</span>
                  {option.disabled && option.reason ? <span className="pm-sr">{`, ${option.reason}`}</span> : null}
                </li>
              )
            })}
            {!shown.length ? <li className="pm-option-empty" role="presentation">Nothing matches.</li> : null}
          </ul>
        </div>
      ) : null}
    </>
  )
}
