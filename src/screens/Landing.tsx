import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { APP_NAME } from '@/lib/config'
import { WandIcon, ContactsIcon, CheckIcon } from '@/components/icons'
import shotToday from '@/assets/shot-today.png'
import shotChat from '@/assets/shot-chat.png'

const APK_URL = '/download'

export function Landing() {
  const nav = useNavigate()
  const { enterPreview } = useAuth()

  function demo() {
    enterPreview()
    nav('/today')
  }
  function getApk() {
    window.location.href = APK_URL
  }

  return (
    <div className="min-h-full overflow-y-auto bg-paper text-ink">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* nav */}
        <nav
          className="flex items-center justify-between py-5"
          style={{ paddingTop: 'calc(var(--safe-top) + 16px)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet text-white shadow-float">
              <WandIcon width={20} height={20} />
            </span>
            <span className="font-display text-[19px] font-bold tracking-tight">{APP_NAME}</span>
          </div>
          <button
            onClick={getApk}
            className="press rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-paper"
          >
            Get the app
          </button>
        </nav>

        {/* hero */}
        <section className="grid items-center gap-10 py-8 md:grid-cols-2 md:gap-6 md:py-16">
          <div className="order-2 md:order-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-tint px-3 py-1 text-[12.5px] font-semibold text-violet-ink">
              <WandIcon width={13} height={13} /> Task-first accountability
            </span>
            <h1 className="mt-4 font-display text-[40px] font-extrabold leading-[0.98] tracking-tight sm:text-[52px]">
              Keep everyone
              <br />
              to their word.
            </h1>
            <p className="mt-4 max-w-md text-[16.5px] leading-relaxed text-ink-soft">
              Instead of endless chats, {APP_NAME} turns messages into <b>tasks</b>. Every contact
              becomes a two-sided tally — what they owe you, and what you owe them.
            </p>

            {/* store badges */}
            <div className="mt-7 flex flex-wrap gap-3">
              <StoreBadge store="play" onClick={getApk} />
              <StoreBadge store="apple" soon />
            </div>
            <button
              onClick={demo}
              className="press mt-4 text-[14.5px] font-semibold text-violet-ink underline underline-offset-4"
            >
              or try the live demo in your browser →
            </button>

            {/* social proof */}
            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {[
                  ['BO', '#6600FF'],
                  ['AS', '#0E7C86'],
                  ['KM', '#B4530A'],
                  ['EB', '#8A3BFF'],
                ].map(([i, c]) => (
                  <span
                    key={i}
                    className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-white ring-2 ring-paper"
                    style={{ background: c }}
                  >
                    {i}
                  </span>
                ))}
              </div>
              <p className="text-[13px] text-ink-faint">Built for teams, families and friends.</p>
            </div>
          </div>

          {/* phone mockup */}
          <div className="order-1 flex justify-center md:order-2">
            <Phone src={shotToday} />
          </div>
        </section>

        {/* features */}
        <section className="grid gap-3 py-6 sm:grid-cols-3">
          <Feature Icon={ContactsIcon} title="Two-sided ledger">
            Every contact shows what they owe you and what you owe them, at a glance.
          </Feature>
          <Feature Icon={CheckIcon} title="Real tasks">
            Priority, due dates, accept or decline — not just messages that get forgotten.
          </Feature>
          <Feature Icon={WandIcon} title="Poke to nudge">
            A tap lifts your task to the top of their screen — a friendly reminder, not a nag.
          </Feature>
        </section>

        {/* showcase 2 */}
        <section className="grid items-center gap-10 py-12 md:grid-cols-2">
          <div className="flex justify-center">
            <Phone src={shotChat} />
          </div>
          <div>
            <h2 className="font-display text-[32px] font-extrabold leading-tight tracking-tight">
              A conversation, but made of tasks.
            </h2>
            <p className="mt-3 max-w-md text-[16px] leading-relaxed text-ink-soft">
              Each contact is a space where requests fly both ways. Attach files, send a voice note,
              mark things done — and nothing quietly slips through.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <StoreBadge store="play" onClick={getApk} />
              <StoreBadge store="apple" soon />
            </div>
          </div>
        </section>

        {/* footer */}
        <footer className="border-t border-line py-8 text-center">
          <p className="text-[13px] text-ink-faint">
            {APP_NAME} · a task-first way to stay accountable · Android available now, iOS soon
          </p>
        </footer>
      </div>
    </div>
  )
}

function Phone({ src }: { src: string }) {
  return (
    <div className="relative w-[248px] sm:w-[280px]">
      <div className="overflow-hidden rounded-[40px] border-[10px] border-carbon bg-carbon shadow-soft">
        <img src={src} alt="TaskTally app" className="block w-full" />
      </div>
    </div>
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
    <div className="rounded-card border border-line bg-paper p-5 shadow-card">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-tint text-violet-ink">
        <Icon width={20} height={20} />
      </span>
      <h3 className="mt-3 font-display text-[17px] font-bold">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-snug text-ink-soft">{children}</p>
    </div>
  )
}

function StoreBadge({
  store,
  onClick,
  soon,
}: {
  store: 'play' | 'apple'
  onClick?: () => void
  soon?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={soon}
      className={`press flex items-center gap-3 rounded-2xl px-5 py-3 ${
        soon ? 'cursor-default bg-wash text-ink-faint' : 'bg-ink text-paper'
      }`}
    >
      {store === 'play' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 2.5v19l11-9.5L3 2.5Z" fill="currentColor" />
          <path d="m14 12 4.5-3.9 2.8 1.6c1 .6 1 2 0 2.6l-2.8 1.6L14 12Z" fill="currentColor" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.4 12.9c0-2 1.6-3 1.7-3-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .6 1 1.4 2 2.4 2 .9 0 1.3-.6 2.4-.6 1.1 0 1.4.6 2.4.6s1.7-1 2.3-2c.7-1.1 1-2.2 1-2.2s-1.9-.7-1.9-2.9ZM14.6 6.4c.5-.7.9-1.6.8-2.5-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.7-.4 2.3-1.1Z" />
        </svg>
      )}
      <div className="text-left leading-none">
        <p className="text-[10px] opacity-80">
          {soon ? 'Coming soon on' : store === 'play' ? 'GET IT ON' : 'Download on the'}
        </p>
        <p className="mt-0.5 text-[16px] font-semibold">
          {store === 'play' ? 'Google Play' : 'App Store'}
        </p>
      </div>
    </button>
  )
}
