import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export const ContactsIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20a6 6 0 0 1 12 0" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M16.5 13.2A4.8 4.8 0 0 1 21 18" />
    <path d="M16 5.4a3 3 0 0 1 0 5.2" />
  </svg>
)

export const PersonalIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 6h11M8 12h11M8 18h11" />
    <path d="M3.5 6l1 1 1.5-1.8M3.5 12l1 1 1.5-1.8M3.5 18l1 1 1.5-1.8" />
  </svg>
)

export const GroupsIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="9" r="2.6" />
    <circle cx="16" cy="9" r="2.6" />
    <path d="M3.5 19a4.5 4.5 0 0 1 9 0M11.5 19a4.5 4.5 0 0 1 9 0" />
  </svg>
)

export const ProfileIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
)

export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const CheckIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

export const BackIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 19l-7-7 7-7" />
  </svg>
)

export const SearchIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </svg>
)

export const PhoneIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4z" />
  </svg>
)

// Signature element: the Poke wand.
export const WandIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 4l1 2.4L18.5 7l-2 1.6.6 2.6L15 9.8 12.9 11l.6-2.6-2-1.6L14 6.4 15 4z" />
    <path d="M13 10L4 19" />
    <path d="M19.5 14.5l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4.4-1z" />
  </svg>
)
