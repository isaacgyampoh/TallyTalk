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

export const TodayIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 9.5h17M8 3v3.2M16 3v3.2" />
    <path d="M8.5 14.5l2 2 3.5-4" />
  </svg>
)

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

export const PaperclipIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 11.5l-7.6 7.6a4.5 4.5 0 0 1-6.4-6.4l7.9-7.9a3 3 0 0 1 4.3 4.3l-7.9 7.9a1.5 1.5 0 0 1-2.1-2.1l7-7" />
  </svg>
)

export const MicIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </svg>
)

export const ImageIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M4 17l4.5-4.5a2 2 0 0 1 2.8 0L20 21" />
  </svg>
)

export const DocIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
)

export const PlayIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5-11-6.5z" />
  </svg>
)

export const PauseIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="6.5" y="5" width="4" height="14" rx="1" />
    <rect x="13.5" y="5" width="4" height="14" rx="1" />
  </svg>
)

export const StopIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
  </svg>
)

export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
