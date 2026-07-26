import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { APP_NAME } from '@/lib/config'
import { WandIcon, ContactsIcon, PersonalIcon, GroupsIcon, CheckIcon } from '@/components/icons'

export function Landing() {
  const nav = useNavigate()
  const { enterPreview } = useAuth()
  const { canInstall, promptInstall, installed, isIOS } = useInstallPrompt()
  const [showInstall, setShowInstall] = useState(false)

  function tryDemo() {
    enterPreview()
    nav('/contacts')
  }

  function onInstall() {
    if (canInstall) promptInstall()
    else setShowInstall(true)
  }

  return (
    <div className="min-h-full overflow-y-auto bg-paper">
      {/* soft violet wash behind the hero */}
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
          style={{
            background:
              'radial-gradient(120% 90% at 80% -10%, rgba(102,0,255,0.16), rgba(102,0,255,0.04) 40%, rgba(255,255,255,0) 70%)',
          }}
        />

        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
          {/* nav */}
          <nav
            className="flex items-center justify-between py-5"
            style={{ paddingTop: 'calc(var(--safe-top) + 20px)' }}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet text-white shadow-float">
                <WandIcon width={20} height={20} />
              </span>
              <span className="font-display text-[19px] font-bold tracking-tight">{APP_NAME}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3">
              {!installed && (
                <button
                  onClick={onInstall}
                  className="press hidden rounded-full border border-line px-4 py-2 text-[13.5px] font-semibold text-ink sm:inline-flex"
                >
                  Install app
                </button>
              )}
              <button
                onClick={() => nav('/signin')}
                className="press rounded-full px-3 py-2 text-[13.5px] font-semibold text-ink-soft"
              >
                Sign in
              </button>
            </div>
          </nav>

          {/* hero */}
          <div className="grid items-center gap-10 pb-8 pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:pt-12">
            <div className="animate-rise-in">
              <span className="eyebrow inline-flex items-center gap-2 rounded-full bg-violet-tint px-3 py-1.5 text-violet-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-violet" /> Accountability, not chatter
              </span>
              <h1 className="mt-5 font-display text-[42px] font-bold leading-[1.02] tracking-tight sm:text-[54px]">
                Stop chasing.
                <br />
                Start <span className="text-violet">tallying.</span>
              </h1>
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft">
                {APP_NAME} turns messages into <span className="font-semibold text-ink">tasks</span>.
                Every contact becomes a two-sided ledger — what they owe you, and what you owe
                them — so nothing quietly slips.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button onClick={tryDemo} className="btn-primary px-7">
                  Try the live demo
                </button>
                {!installed && (
                  <button onClick={onInstall} className="btn-ghost px-6">
                    Install app
                  </button>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-ink-faint">
                <Trust>Installs like a real app</Trust>
                <Trust>Works offline</Trust>
                <Trust>No app store needed</Trust>
              </div>
            </div>

            {/* phone preview */}
            <div className="flex justify-center lg:justify-end">
              <PhonePreview />
            </div>
          </div>
        </div>
      </div>

      {/* features */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-4 pt-10 sm:px-8">
        <h2 className="font-display text-[24px] font-bold tracking-tight">One place for every commitment</h2>
        <p className="mt-1.5 max-w-xl text-[15px] text-ink-soft">
          Familiar like a chat app, but built around who owes what.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature Icon={ContactsIcon} title="The owe-ledger">
            See “3 for them · 2 for you” at a glance for every person. Overdue and urgent surface
            first.
          </Feature>
          <Feature Icon={PersonalIcon} title="Personal checklists">
            Private lists for calls, errands, payments and travel — some reset daily, some on
            demand.
          </Feature>
          <Feature Icon={GroupsIcon} title="Group checklists">
            Shared to-dos your whole team works from, with roles and assignments.
          </Feature>
          <Feature Icon={WandIcon} title="Poke to nudge">
            A gentle wand that lifts your task to the top of someone’s screen — without nagging.
          </Feature>
        </div>
      </section>

      {/* closing band */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <div className="overflow-hidden rounded-[26px] bg-ink px-7 py-10 text-paper sm:px-12">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-[26px] font-bold tracking-tight">
                Take it for a spin
              </h3>
              <p className="mt-2 max-w-md text-[15px] text-white/70">
                The demo is loaded with real-feeling sample data. Tap around — open a contact, a
                checklist, a group. Nothing to sign up for.
              </p>
            </div>
            <button
              onClick={tryDemo}
              className="press shrink-0 rounded-full bg-violet px-7 py-3.5 text-[15px] font-semibold text-white shadow-float"
            >
              Open the demo
            </button>
          </div>
        </div>
        <p className="mt-8 text-center text-[12.5px] text-ink-faint">
          {APP_NAME} · a task-first way to stay accountable · Built for web, installable on any
          phone.
        </p>
      </section>

      {showInstall && <InstallHelp isIOS={isIOS} onClose={() => setShowInstall(false)} />}
    </div>
  )
}

function Trust({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CheckIcon width={15} height={15} className="text-violet" />
      {children}
    </span>
  )
}

function Feature({
  Icon,
  title,
  children,
}: {
  Icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-card border border-line bg-paper p-5 transition hover:shadow-card">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-tint text-violet">
        <Icon width={22} height={22} />
      </span>
      <h3 className="mt-4 font-display text-[17px] font-bold">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-snug text-ink-soft">{children}</p>
    </div>
  )
}

/** A static, on-brand mockup of the Contacts ledger inside a phone frame. */
function PhonePreview() {
  const rows = [
    { i: 'BO', c: '#6600FF', name: 'Ben Owusu', sub: 'Send me the Ecobank document', them: 3, you: 2, tag: '1 overdue', tone: 'overdue' as const },
    { i: 'AS', c: '#0E7C86', name: 'Ama Serwaa', sub: 'Drop the keys with caretaker', them: 2, you: 0 },
    { i: 'KM', c: '#B4530A', name: 'Kwame Mensah', sub: 'Finish the Q3 slide deck', them: 0, you: 2, tag: '1 urgent', tone: 'urgent' as const },
    { i: 'EB', c: '#8A3BFF', name: 'Efua Boateng', sub: 'Return the borrowed charger', them: 1, you: 1 },
  ]
  return (
    <div className="relative w-[290px] rotate-[1.5deg] rounded-[2.4rem] border-[10px] border-ink bg-paper shadow-[0_30px_60px_-20px_rgba(102,0,255,0.45)] sm:w-[320px]">
      <div className="overflow-hidden rounded-[1.7rem]">
        {/* status bar */}
        <div className="flex items-center justify-between bg-paper px-5 pb-2 pt-3 text-[11px] font-semibold text-ink">
          <span>9:41</span>
          <span className="text-ink-faint">▲ ▮ ●</span>
        </div>
        {/* header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <span className="font-display text-[22px] font-bold tracking-tight">Contacts</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-wash text-ink-soft">⌕</span>
        </div>
        {/* chips */}
        <div className="flex gap-1.5 px-5 pb-3">
          {['All', 'Unread', 'Work'].map((c, k) => (
            <span
              key={c}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${k === 0 ? 'bg-ink text-white' : 'bg-wash text-ink-soft'}`}
            >
              {c}
            </span>
          ))}
        </div>
        {/* rows */}
        <div className="px-2 pb-4">
          {rows.map((r) => (
            <div key={r.i} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[13px] font-semibold text-white"
                style={{ background: r.c }}
              >
                {r.i}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-ink">{r.name}</span>
                  <span className="nums shrink-0 text-[11px] font-semibold">
                    {r.them > 0 && <span className="text-violet">{r.them} for them</span>}
                    {r.them > 0 && r.you > 0 && <span className="text-ink-faint"> · </span>}
                    {r.you > 0 && <span className="text-ink-soft">{r.you} for you</span>}
                  </span>
                </div>
                <p className="truncate text-[11.5px] text-ink-faint">{r.sub}</p>
                {r.tag && (
                  <span
                    className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      r.tone === 'overdue' ? 'bg-overdue/10 text-overdue' : 'bg-urgent/10 text-urgent'
                    }`}
                  >
                    {r.tag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* floating add */}
      <span className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-violet text-2xl leading-none text-white shadow-float">
        +
      </span>
    </div>
  )
}

function InstallHelp({ isIOS, onClose }: { isIOS: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-card bg-paper p-6 shadow-card animate-rise-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-[19px] font-bold">Install {APP_NAME}</h3>
        {isIOS ? (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            In Safari, tap the <span className="font-semibold text-ink">Share</span> button, then
            choose <span className="font-semibold text-ink">Add to Home Screen</span>. {APP_NAME}{' '}
            will open like a normal app.
          </p>
        ) : (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            Open your browser menu and choose{' '}
            <span className="font-semibold text-ink">Install app</span> (or “Add to Home Screen”).
            It’ll launch in its own window, offline-ready.
          </p>
        )}
        <button onClick={onClose} className="btn-primary mt-5 w-full">
          Got it
        </button>
      </div>
    </div>
  )
}
