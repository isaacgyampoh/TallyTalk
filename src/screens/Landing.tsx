import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { APP_NAME } from '@/lib/config'
import { WandIcon, ContactsIcon, PersonalIcon, GroupsIcon, CheckIcon } from '@/components/icons'

const DOT_GRID = 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.4px)'

export function Landing() {
  const nav = useNavigate()
  const { enterPreview } = useAuth()

  function tryDemo() {
    enterPreview()
    nav('/today')
  }
  function getApp() {
    window.location.href = '/download'
  }

  return (
    <div className="min-h-full overflow-y-auto bg-paper">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* nav */}
        <nav
          className="flex items-center justify-between py-5"
          style={{ paddingTop: 'calc(var(--safe-top) + 18px)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet text-white shadow-float">
              <WandIcon width={20} height={20} />
            </span>
            <span className="font-display text-[19px] font-bold tracking-tight">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={getApp}
              className="press rounded-full bg-violet-tint px-4 py-2 text-[13.5px] font-semibold text-violet-ink"
            >
              Get the app
            </button>
            <button
              onClick={() => nav('/signin')}
              className="press rounded-full px-3 py-2 text-[13.5px] font-semibold text-ink-soft"
            >
              Sign in
            </button>
          </div>
        </nav>

        {/* hero */}
        <div className="grid items-center gap-8 pb-4 pt-6 lg:grid-cols-[1fr_1fr] lg:gap-10 lg:pt-14">
          <div className="animate-rise-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[11.5px] font-semibold">
              <span className="h-2 w-2 rounded-full bg-violet" />
              <span className="text-ink-soft">for them</span>
              <span className="text-ink-faint">·</span>
              <span className="h-2 w-2 rounded-full bg-ink" />
              <span className="text-ink-soft">for you</span>
            </span>

            <h1 className="mt-5 font-display text-[46px] font-extrabold leading-[0.98] tracking-[-0.02em] sm:text-[60px]">
              Stop chasing.
              <br />
              Start{' '}
              <span className="relative inline-block text-violet-ink">
                tallying.
                <svg
                  className="absolute -bottom-1.5 left-0 w-full"
                  height="12"
                  viewBox="0 0 200 12"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 8C40 3 120 2 198 6"
                    stroke="#6600FF"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.4"
                  />
                </svg>
              </span>
            </h1>

            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-soft">
              {APP_NAME} turns messages into <span className="font-semibold text-ink">tasks</span>.
              Every contact becomes a two-sided tally — what they owe you, what you owe them — so
              nothing quietly slips.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={tryDemo} className="btn-primary px-7 text-[15.5px]">
                Open the demo
              </button>
              <button onClick={getApp} className="btn-ghost px-6">
                Get the app
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-ink-faint">
              <Trust>Installs like a real app</Trust>
              <Trust>Works offline</Trust>
              <Trust>No app store</Trust>
            </div>
          </div>

          {/* signature: solid violet panel holding the phone — the one bold thing */}
          <div className="flex justify-center lg:justify-end">
            <div
              className="relative w-full max-w-[420px] overflow-hidden rounded-[30px] bg-violet px-6 pb-0 pt-8 shadow-[0_40px_80px_-24px_rgba(102,0,255,0.55)]"
              style={{ backgroundImage: DOT_GRID, backgroundSize: '18px 18px' }}
            >
              <div className="mb-5 flex items-center justify-between px-1">
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-white/90">
                  <WandIcon width={16} height={16} /> Poke to nudge
                </span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">
                  Live demo
                </span>
              </div>
              <div className="flex justify-center">
                <PhonePreview />
              </div>
            </div>
          </div>
        </div>

        {/* signature echo: the running tally split */}
        <section className="py-12">
          <p className="eyebrow mb-3">Your running tally</p>
          <div className="flex overflow-hidden rounded-[20px] border border-line">
            <div className="flex-[23] bg-violet px-5 py-6 text-white">
              <p className="nums font-display text-[34px] font-extrabold leading-none">23</p>
              <p className="mt-1.5 text-[13px] font-semibold text-white/80">they owe you</p>
            </div>
            <div className="flex-[8] bg-carbon px-5 py-6 text-white">
              <p className="nums font-display text-[34px] font-extrabold leading-none">8</p>
              <p className="mt-1.5 text-[13px] font-semibold text-white/70">you owe them</p>
            </div>
          </div>
          <p className="mt-3 text-[13.5px] text-ink-faint">
            One glance and you know exactly where every commitment stands.
          </p>
        </section>

        {/* features */}
        <section className="pb-4">
          <h2 className="font-display text-[26px] font-bold tracking-tight">
            Built around who owes what
          </h2>
          <p className="mt-1.5 max-w-xl text-[15px] text-ink-soft">
            Familiar like a chat app — organised like a ledger.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature Icon={ContactsIcon} title="The owe-ledger">
              “3 for them · 2 for you” on every contact. Overdue and urgent rise to the top.
            </Feature>
            <Feature Icon={PersonalIcon} title="Personal checklists">
              Private lists for calls, errands, payments and travel — some reset daily.
            </Feature>
            <Feature Icon={GroupsIcon} title="Group checklists">
              Shared to-dos your whole team works from, with roles and assignments.
            </Feature>
            <Feature Icon={WandIcon} title="Poke, don’t nag">
              A gentle wand lifts your task to the top of someone’s screen. Files and voice notes
              too.
            </Feature>
          </div>
        </section>

        {/* closing */}
        <section className="py-12">
          <div className="overflow-hidden rounded-[26px] bg-carbon px-7 py-10 text-white sm:px-12">
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-[26px] font-bold tracking-tight">
                  See it for yourself
                </h3>
                <p className="mt-2 max-w-md text-[15px] text-white/70">
                  Loaded with real-feeling sample data. Open a contact, a checklist, a group — send
                  a file or a voice note. Nothing to sign up for.
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
          <p className="mt-8 pb-8 text-center text-[12.5px] text-ink-faint">
            {APP_NAME} · a task-first way to stay accountable · available on web and Android
          </p>
        </section>
      </div>
    </div>
  )
}

function Trust({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CheckIcon width={15} height={15} className="text-violet-ink" />
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
    <div className="rounded-card border border-line bg-paper p-5 transition hover:-translate-y-0.5 hover:shadow-card">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-tint text-violet-ink">
        <Icon width={22} height={22} />
      </span>
      <h3 className="mt-4 font-display text-[17px] font-bold">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-snug text-ink-soft">{children}</p>
    </div>
  )
}

function PhonePreview() {
  const rows = [
    {
      i: 'BO',
      c: '#6600FF',
      name: 'Ben Owusu',
      sub: 'Send me the Ecobank document',
      them: 3,
      you: 2,
      tag: '1 overdue',
      tone: 'overdue' as const,
    },
    {
      i: 'AS',
      c: '#0E7C86',
      name: 'Ama Serwaa',
      sub: 'Drop the keys with caretaker',
      them: 2,
      you: 0,
    },
    {
      i: 'KM',
      c: '#B4530A',
      name: 'Kwame Mensah',
      sub: 'Finish the Q3 slide deck',
      them: 0,
      you: 2,
      tag: '1 urgent',
      tone: 'urgent' as const,
    },
    {
      i: 'EB',
      c: '#8A3BFF',
      name: 'Efua Boateng',
      sub: 'Return the borrowed charger',
      them: 1,
      you: 1,
    },
  ]
  return (
    <div className="relative w-[280px] translate-y-2 rounded-t-[2.2rem] border-[9px] border-b-0 border-ink bg-paper shadow-[0_20px_40px_-16px_rgba(0,0,0,0.35)]">
      <div className="overflow-hidden rounded-t-[1.5rem]">
        <div className="flex items-center justify-between bg-paper px-5 pb-2 pt-3 text-[11px] font-semibold text-ink">
          <span>9:41</span>
          <span className="text-ink-faint">▲ ▮ ●</span>
        </div>
        <div className="flex items-center justify-between px-5 pb-3">
          <span className="font-display text-[21px] font-bold tracking-tight">Contacts</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-wash text-ink-soft">
            ⌕
          </span>
        </div>
        <div className="flex gap-1.5 px-5 pb-2.5">
          {['All', 'Unread', 'Work'].map((c, k) => (
            <span
              key={c}
              className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${k === 0 ? 'bg-carbon text-white' : 'bg-wash text-ink-soft'}`}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="px-2 pb-3">
          {rows.map((r) => (
            <div key={r.i} className="flex items-center gap-2.5 rounded-2xl px-3 py-2">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-[12px] font-semibold text-white"
                style={{ background: r.c }}
              >
                {r.i}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-ink">{r.name}</span>
                  <span className="nums shrink-0 text-[10.5px] font-semibold">
                    {r.them > 0 && <span className="text-violet-ink">{r.them} for them</span>}
                    {r.them > 0 && r.you > 0 && <span className="text-ink-faint"> · </span>}
                    {r.you > 0 && <span className="text-ink-soft">{r.you} for you</span>}
                  </span>
                </div>
                <p className="truncate text-[11px] text-ink-faint">{r.sub}</p>
                {r.tag && (
                  <span
                    className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${r.tone === 'overdue' ? 'bg-overdue/10 text-overdue' : 'bg-urgent/10 text-urgent'}`}
                  >
                    {r.tag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
