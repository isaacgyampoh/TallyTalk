import type { MyProfile, PrivacyScope, ProfilePatch } from '@/data/profile'

const SCOPES: { value: PrivacyScope; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'my_contacts', label: 'My contacts' },
  { value: 'work_and_favorites', label: 'Work & favourites' },
  { value: 'nobody', label: 'Nobody' },
]

const ROWS: { key: keyof ProfilePatch; label: string; hint: string }[] = [
  {
    key: 'who_can_send_requests',
    label: 'Who can send me tasks',
    hint: 'People outside this cannot put work on your ledger.',
  },
  {
    key: 'who_can_add_to_groups',
    label: 'Who can add me to groups',
    hint: 'Applies to new group invitations.',
  },
  { key: 'photo_visibility', label: 'Who can see my photo', hint: 'Your name is always visible.' },
]

/**
 * The privacy scopes the schema has modelled since 0001 with no interface.
 * Discovery is the one that bites hardest, so it gets its own switch rather
 * than being buried in a scope list.
 */
export function PrivacySettings({
  profile,
  onChange,
  saving,
}: {
  profile: MyProfile
  onChange: (patch: ProfilePatch) => void
  saving: boolean
}) {
  return (
    <section className="mb-5">
      <h2 className="eyebrow mb-2">Privacy</h2>
      <ul className="overflow-hidden rounded-card border border-line">
        {ROWS.map((row, i) => (
          <li key={row.key} className={i > 0 ? 'border-t border-line' : ''}>
            <div className="px-4 py-3">
              <label
                htmlFor={`privacy-${row.key}`}
                className="block text-[15px] font-medium text-ink"
              >
                {row.label}
              </label>
              <p className="mb-2 text-[12.5px] text-ink-soft">{row.hint}</p>
              <select
                id={`privacy-${row.key}`}
                disabled={saving}
                value={profile[row.key as keyof MyProfile] as string}
                onChange={(e) => onChange({ [row.key]: e.target.value } as ProfilePatch)}
                className="field h-11"
              >
                {SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}

        <li className="border-t border-line">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <label
                htmlFor="privacy-searchable"
                className="block text-[15px] font-medium text-ink"
              >
                Findable by my number
              </label>
              <span className="block text-[12.5px] text-ink-soft">
                Off means nobody can add you by typing your number.
              </span>
            </span>
            <input
              id="privacy-searchable"
              type="checkbox"
              disabled={saving}
              checked={profile.searchable_by_number}
              onChange={(e) => onChange({ searchable_by_number: e.target.checked })}
              className="h-6 w-6 shrink-0 accent-violet"
            />
          </div>
        </li>
      </ul>
    </section>
  )
}
