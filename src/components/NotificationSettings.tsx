import { CHANNELS, categoryEnabled, type NotificationCategory } from '@/lib/notifications'
import type { MyProfile, ProfilePatch } from '@/data/profile'

/**
 * Which notifications a user wants. Sound and vibration are deliberately not
 * here: Android exposes them per channel in system settings and iOS per
 * category, and an app may not override a user's choice there. Offering a
 * duplicate in-app control would be a lie about what it does.
 */
export function NotificationSettings({
  profile,
  onChange,
  saving,
}: {
  profile: MyProfile
  onChange: (patch: ProfilePatch) => void
  saving: boolean
}) {
  const prefs = profile.notification_prefs ?? {}

  function toggle(id: NotificationCategory, on: boolean) {
    onChange({ notification_prefs: { ...prefs, [id]: on } })
  }

  return (
    <section className="mb-5">
      <h2 className="eyebrow mb-2">Notifications</h2>
      <ul className="overflow-hidden rounded-card border border-line">
        {CHANNELS.map((c, i) => {
          const on = categoryEnabled(prefs, c.id)
          return (
            <li key={c.id} className={i > 0 ? 'border-t border-line' : ''}>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <label
                    htmlFor={`notif-${c.id}`}
                    className="block text-[15px] font-medium text-ink"
                  >
                    {c.name}
                  </label>
                  <span className="block text-[12.5px] text-ink-soft">{c.description}</span>
                </span>
                <input
                  id={`notif-${c.id}`}
                  type="checkbox"
                  disabled={saving}
                  checked={on}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                  className="h-6 w-6 shrink-0 accent-violet"
                />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 px-1 text-[12.5px] text-ink-soft">
        Sound and vibration are set per category in your device&rsquo;s notification settings.
      </p>
    </section>
  )
}
