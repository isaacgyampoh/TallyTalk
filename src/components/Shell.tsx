import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { InstallBanner } from './InstallBanner'
import { TodayIcon, ContactsIcon, PersonalIcon, GroupsIcon, ProfileIcon } from './icons'

const TABS = [
  { to: '/today', label: 'Today', Icon: TodayIcon },
  { to: '/contacts', label: 'Contacts', Icon: ContactsIcon },
  { to: '/personal', label: 'Personal', Icon: PersonalIcon },
  { to: '/groups', label: 'Groups', Icon: GroupsIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
] as const

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <InstallBanner />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

      <nav
        className="border-t border-line bg-paper/95 backdrop-blur"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
        aria-label="Primary"
      >
        <ul className="flex">
          {TABS.map(({ to, label, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold tracking-wide transition ${
                    isActive ? 'text-violet' : 'text-ink-faint'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`grid h-9 w-14 place-items-center rounded-full transition ${
                        isActive ? 'bg-violet-tint' : 'bg-transparent'
                      }`}
                    >
                      <Icon width={22} height={22} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function ScreenHeader({
  title,
  right,
}: {
  title: string
  right?: ReactNode
}) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between bg-paper/95 px-5 pb-3 backdrop-blur"
      style={{ paddingTop: 'calc(var(--safe-top) + 14px)' }}
    >
      <h1 className="font-display text-[26px] font-bold tracking-tight">{title}</h1>
      {right}
    </header>
  )
}
