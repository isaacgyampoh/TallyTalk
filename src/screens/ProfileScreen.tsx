import { ScreenHeader } from '@/components/Shell'
import { Avatar } from '@/components/Avatar'
import { useAuth } from '@/context/AuthContext'
import { useTheme, type ThemePref } from '@/context/ThemeContext'
import { SAMPLE_PROFILE } from '@/lib/sampleData'

const SETTINGS: { group: string; items: string[] }[] = [
  { group: 'Account', items: ['Display name', 'Profile photo', 'Phone number', 'Active devices'] },
  {
    group: 'Privacy',
    items: [
      'Who can send task requests',
      'Who can add me to groups',
      'Blocked contacts',
      'Archived contacts',
    ],
  },
  { group: 'Security', items: ['Two-step verification', 'Active sessions'] },
  { group: 'Data & account', items: ['Export my data', 'Delete account'] },
  { group: 'Help & legal', items: ['Help & support', 'Terms of service', 'Privacy policy'] },
]

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ProfileScreen() {
  const { session, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const phone = session?.user?.phone ? `+${session.user.phone}` : SAMPLE_PROFILE.phone
  const name = (session?.user?.user_metadata?.display_name as string) || SAMPLE_PROFILE.name

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Profile" />

      <div className="px-5">
        <div className="flex items-center gap-4 rounded-card border border-line p-4">
          <Avatar initials={name.slice(0, 2).toUpperCase()} color="#6600FF" size={60} />
          <div className="min-w-0">
            <p className="truncate font-display text-[20px] font-bold">{name}</p>
            <p className="nums text-[14px] text-ink-soft">{phone}</p>
            <span className="mt-1 inline-block rounded-full bg-wash px-2 py-0.5 text-[11px] font-semibold text-ink-faint">
              {session ? 'Connected to Supabase' : 'Preview · sample data'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
        {/* Appearance — a real, working control */}
        <section className="mb-5">
          <h2 className="eyebrow mb-2">Appearance</h2>
          <div className="rounded-card border border-line p-1.5">
            <div className="flex gap-1">
              {THEME_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setTheme(o.value)}
                  className={`press flex-1 rounded-[13px] py-2.5 text-[13.5px] font-semibold transition ${
                    theme === o.value ? 'bg-carbon text-white' : 'text-ink-soft hover:bg-wash'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="eyebrow mb-2">App</h2>
          <ul className="overflow-hidden rounded-card border border-line">
            {['Default landing screen', 'Notification preferences'].map((item, i) => (
              <li key={item}>
                <button
                  className={`press flex w-full items-center justify-between px-4 py-3 text-left text-[15px] text-ink hover:bg-wash ${i > 0 ? 'border-t border-line' : ''}`}
                >
                  {item}
                  <span className="text-ink-faint">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {SETTINGS.map((s) => (
          <section key={s.group} className="mb-5">
            <h2 className="eyebrow mb-2">{s.group}</h2>
            <ul className="overflow-hidden rounded-card border border-line">
              {s.items.map((item, i) => (
                <li key={item}>
                  <button
                    className={`press flex w-full items-center justify-between px-4 py-3 text-left text-[15px] hover:bg-wash ${
                      i > 0 ? 'border-t border-line' : ''
                    } ${item === 'Delete account' ? 'text-overdue' : 'text-ink'}`}
                  >
                    {item}
                    <span className="text-ink-faint">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <button className="btn-ghost w-full" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
