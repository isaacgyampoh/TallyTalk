import { APP_NAME, APP_VERSION, BUILD_ID } from '@/lib/config'
import { ScreenHeader } from '@/components/Shell'
import { Avatar } from '@/components/Avatar'
import { useAuth } from '@/context/AuthContext'
import { useTheme, type ThemePref } from '@/context/ThemeContext'
import { SAMPLE_PROFILE } from '@/lib/sampleData'
import { useIsLive, useMyProfile, useUpdateProfile } from '@/data/hooks'
import { PrivacySettings } from '@/components/PrivacySettings'
import { deleteMyAccount, exportMyData } from '@/data/account'
import { useRef, useState } from 'react'
import { useToast } from '@/components/Toast'

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ProfileScreen() {
  const { session, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const live = useIsLive()
  const toast = useToast()
  const { data: profile } = useMyProfile()
  const { save, changePhoto } = useUpdateProfile()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)

  async function doExport() {
    setBusy('export')
    try {
      const data = await exportMyData()
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `tasktally-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('Could not export your data', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function doDelete() {
    setBusy('delete')
    try {
      await deleteMyAccount()
      await signOut()
    } catch {
      toast('Could not delete your account', 'error')
      setBusy(null)
      setConfirmingDelete(false)
    }
  }

  const phone =
    profile?.phone ?? (session?.user?.phone ? `+${session.user.phone}` : SAMPLE_PROFILE.phone)
  const name =
    profile?.display_name ??
    (session?.user?.user_metadata?.display_name as string) ??
    SAMPLE_PROFILE.name

  function saveName() {
    const next = nameDraft.trim()
    if (!next || next === name) return setEditingName(false)
    save.mutate(
      { display_name: next },
      {
        onSuccess: () => setEditingName(false),
        onError: () => toast('Could not save your name', 'error'),
      },
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Profile" />

      <div className="px-5">
        <div className="flex items-center gap-4 rounded-card border border-line p-4">
          <button
            onClick={() => live && fileRef.current?.click()}
            disabled={!live || changePhoto.isPending}
            aria-label={live ? 'Change your photo' : undefined}
            className={live ? 'press relative shrink-0 rounded-full' : 'shrink-0'}
          >
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt=""
                className="h-[60px] w-[60px] rounded-full object-cover"
              />
            ) : (
              <Avatar initials={name.slice(0, 2).toUpperCase()} color="#6600FF" size={60} />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              changePhoto.mutate(f, {
                onError: () => toast('Could not upload that photo', 'error'),
              })
              e.target.value = ''
            }}
          />
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex gap-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  aria-label="Your name"
                  className="field h-10 flex-1"
                  autoFocus
                />
                <button
                  onClick={saveName}
                  disabled={save.isPending}
                  className="btn-primary h-10 px-4"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-2 truncate font-display text-[20px] font-bold">
                {name}
                {live && (
                  <button
                    onClick={() => {
                      setNameDraft(name)
                      setEditingName(true)
                    }}
                    className="press text-[13px] font-semibold text-violet-ink"
                  >
                    Edit
                  </button>
                )}
              </p>
            )}
            <p className="nums text-[14px] text-ink-soft">{phone}</p>
            {live && (
              <p className="text-[11.5px] text-ink-faint">
                Your number comes from sign-in and cannot be changed.
              </p>
            )}
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

        {live && profile && (
          <PrivacySettings
            profile={profile}
            saving={save.isPending}
            onChange={(patch) =>
              save.mutate(patch, { onError: () => toast('Could not save that setting', 'error') })
            }
          />
        )}

        {live && (
          <section className="mb-5">
            <h2 className="eyebrow mb-2">Data &amp; account</h2>
            <ul className="overflow-hidden rounded-card border border-line">
              <li>
                <button
                  onClick={doExport}
                  disabled={busy !== null}
                  className="press flex w-full items-center justify-between px-4 py-3 text-left text-[15px] text-ink hover:bg-wash disabled:opacity-50"
                >
                  {busy === 'export' ? 'Preparing…' : 'Export my data'}
                  <span className="text-ink-faint">↓</span>
                </button>
              </li>
              <li className="border-t border-line">
                {confirmingDelete ? (
                  <div className="px-4 py-3">
                    <p className="text-[15px] font-semibold text-ink">Delete your account?</p>
                    <p className="mt-1 text-[13px] text-ink-soft">
                      Your profile, contacts, tasks and checklists go with it. This cannot be undone
                      — export first if you want a copy.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setConfirmingDelete(false)}
                        className="btn-ghost h-11 flex-1"
                      >
                        Keep it
                      </button>
                      <button
                        onClick={doDelete}
                        disabled={busy !== null}
                        className="press h-11 flex-1 rounded-full bg-overdue text-[15px] font-semibold text-white disabled:opacity-50"
                      >
                        {busy === 'delete' ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="press flex w-full items-center justify-between px-4 py-3 text-left text-[15px] text-overdue-ink hover:bg-wash"
                  >
                    Delete account
                    <span className="text-ink-faint">›</span>
                  </button>
                )}
              </li>
            </ul>
          </section>
        )}

        <button className="btn-ghost w-full" onClick={signOut}>
          Sign out
        </button>

        <p className="pb-2 pt-1 text-center text-[12px] text-ink-faint">
          {APP_NAME} v{APP_VERSION} · build {BUILD_ID}
        </p>
      </div>
    </div>
  )
}
