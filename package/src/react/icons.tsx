import * as React from "react"

/* Inline, because a prototype scaffold that drags an icon package into the
   dependency tree is not free to install. Stroke-based, 24-viewbox, sized by
   the caller. */

function Svg({ size = 16, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/* Three states, one of them current. A gear says "app settings", which is the
   one thing a piece of scaffolding must not say — and sliders would say
   "values", which is what this tool deliberately is not. */
export const NodesIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M8.4 8.6 5.6 15.4M14 7.8l3.6 6.6M8.9 18h6.2" />
    <circle cx="12" cy="6" r="2.4" fill="currentColor" stroke="none" />
    <circle cx="5" cy="18" r="2.4" />
    <circle cx="19" cy="18" r="2.4" />
  </Svg>
)

/* A figure, framed. Matches the diagram's own visual language. */
export const DiagramIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M3 4h4M17 4h4M3 20h4M17 20h4M3 4v3M21 4v3M3 20v-3M21 20v-3" />
    <rect x="8.5" y="7" width="7" height="4" rx="1" />
    <rect x="8.5" y="13" width="7" height="4" rx="1" />
    <path d="M12 11v2" />
  </Svg>
)

export const CloseIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)


export const SearchIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
)
