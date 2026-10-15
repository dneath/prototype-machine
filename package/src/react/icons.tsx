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
   one thing a piece of scaffolding must not say, and sliders would say
   "values", which is what this tool deliberately is not. */
export const NodesIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M8.4 8.6 5.6 15.4M14 7.8l3.6 6.6M8.9 18h6.2" />
    <circle cx="12" cy="6" r="2.4" fill="currentColor" stroke="none" />
    <circle cx="5" cy="18" r="2.4" />
    <circle cx="19" cy="18" r="2.4" />
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

export const PinIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 17v5M9 10.8V4h6v6.8l3 3.2H6z" />
  </Svg>
)

export const ChevronIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)

export const CheckIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

/* Counter-clockwise: back to where it started. */
export const ResetIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
)

export const CopyIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Svg>
)

/* Hide, for a clean screenshot or recording. */
export const EyeOffIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.7 2.7" />
    <path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 1 0 4.2 4.2" />
    <path d="m2 2 20 20" />
  </Svg>
)
