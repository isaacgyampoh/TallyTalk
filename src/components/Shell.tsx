import { OfflineBar } from './OfflineBar'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ContactsIcon, PersonalIcon, GroupsIcon, ProfileIcon } from './icons'
import { useT } from '@/i18n/useT'
import type { TranslationKey } from '@/i18n'

const TABS: { to: string; label: TranslationKey; Icon: typeof PersonalIcon }[] = [
  { to: '/personal', label: 'nav.personal', Icon: PersonalIcon },
  { to: '/contacts', label: 'nav.contacts', Icon: ContactsIcon },
  { to: '/groups', label: 'nav.groups', Icon: GroupsIcon },
  { to: '/profile', label: 'nav.profile', Icon: ProfileIcon },
]

export function Shell({ children }: { children: ReactNode }) {
  const loc = useLocation()
  const { t } = useT()
  return (
    <div className="app-frame">
      <OfflineBar />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div key={loc.pathname} className="h-full animate-page-in">
          {children}
        </div>
      </main>

      <nav
        className="border-t border-line bg-paper"
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
                    isActive ? 'text-violet-ink' : 'text-ink-faint'
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
                    {t(label)}
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

export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between bg-paper px-5 pb-3"
      style={{ paddingTop: 'calc(var(--safe-top) + 14px)' }}
    >
      <h1 className="font-display text-[26px] font-bold tracking-tight">{title}</h1>
      {right}
    </header>
  )
}
