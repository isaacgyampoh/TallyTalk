import { useEffect, useState } from 'react'
import { CHANNELS, categoryEnabled, type NotificationCategory } from '@/lib/notifications'
import type { MyProfile, ProfilePatch } from '@/data/profile'
import { disablePush, enablePush, pushState, type PushState } from '@/lib/webpush'

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
      <DeviceDelivery />
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
        Whatever arrives is also kept in your notifications list.
      </p>
    </section>
  )
}

/**
 * Whether this particular browser is subscribed to Web Push.
 *
 * Separate from the categories above, because it answers a different question:
 * those are what you want to hear about, this is whether this device can
 * interrupt you at all. Permission has to be asked for from a real press —
 * iOS refuses a request that is not tied to a gesture — so there is a button
 * rather than an automatic prompt on first load.
 */
function DeviceDelivery() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void pushState().then(setState)
  }, [])

  if (state === null || state === 'unconfigured') return null

  async function turnOn() {
    setBusy(true)
    setState(await enablePush())
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true)
    setState(await disablePush())
    setBusy(false)
  }

  return (
    <div className="mb-2 overflow-hidden rounded-card border border-line">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-ink">Alerts on this device</span>
          <span className="block text-[12.5px] text-ink-soft">{EXPLANATION[state]}</span>
        </span>
        {(state === 'off' || state === 'on') && (
          <button
            onClick={state === 'on' ? turnOff : turnOn}
            disabled={busy}
            className={`press shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold ${
              state === 'on' ? 'bg-wash text-ink-soft' : 'bg-violet text-white'
            }`}
          >
            {busy ? '…' : state === 'on' ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </div>
    </div>
  )
}

const EXPLANATION: Record<PushState, string> = {
  on: 'This device will alert you when something needs you.',
  off: 'Turn this on to be alerted when the app is closed.',
  denied:
    'Blocked in your browser or system settings — only you can undo that. Your notifications list still works.',
  unsupported:
    'This app can’t alert you while it is closed here. Everything still arrives in your notifications list.',
  unconfigured: '',
}
