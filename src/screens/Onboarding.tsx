import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { buzz } from '@/lib/haptics'
import { WandIcon, CheckIcon } from '@/components/icons'

const ONBOARDED_KEY = 'tt.onboarded'
export const isOnboarded = () => localStorage.getItem(ONBOARDED_KEY) === '1'
const markOnboarded = () => localStorage.setItem(ONBOARDED_KEY, '1')

export function Onboarding() {
  const nav = useNavigate()
  const { enterPreview } = useAuth()
  const scroller = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  const last = i === SLIDES.length - 1

  function onScroll() {
    const el = scroller.current
    if (!el) return
    setI(Math.round(el.scrollLeft / el.clientWidth))
  }
  function next() {
    const el = scroller.current
    if (!el) return
    buzz(8)
    el.scrollTo({ left: (i + 1) * el.clientWidth, behavior: 'smooth' })
  }
  function getStarted() {
    markOnboarded()
    nav('/signin')
  }
  function demo() {
    markOnboarded()
    buzz(10)
    enterPreview()
    nav('/today')
  }
  function skip() {
    markOnboarded()
    nav('/')
  }

  return (
    <div className="app-frame">
      <div
        className="flex items-center justify-end px-5"
        style={{ paddingTop: 'calc(var(--safe-top) + 14px)' }}
      >
        {!last && (
          <button onClick={skip} className="press text-[14px] font-semibold text-ink-faint">
            Skip
          </button>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((s, idx) => (
          <section key={idx} className="flex w-full flex-none snap-center flex-col px-8">
            <div className="flex flex-1 items-center justify-center py-4">{s.art}</div>
            <div className="pb-2">
              <h2 className="font-display text-[28px] font-extrabold leading-tight tracking-tight">
                {s.title}
              </h2>
              <p className="mt-2.5 max-w-[20rem] text-[16px] leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </div>
          </section>
        ))}
      </div>

      {/* dots */}
      <div className="flex justify-center gap-2 py-5">
        {SLIDES.map((_, idx) => (
          <span
            key={idx}
            className={`h-2 rounded-full transition-all ${idx === i ? 'w-6 bg-violet' : 'w-2 bg-line'}`}
          />
        ))}
      </div>

      {/* actions */}
      <div className="space-y-3 px-8" style={{ paddingBottom: 'calc(var(--safe-bottom) + 22px)' }}>
        {last ? (
          <>
            <button onClick={getStarted} className="btn-primary h-14 w-full text-[16px]">
              Get started
            </button>
            <button onClick={demo} className="btn-ghost h-14 w-full text-[16px]">
              Explore with sample data
            </button>
          </>
        ) : (
          <button onClick={next} className="btn-primary h-14 w-full text-[16px]">
            Next
          </button>
        )}
      </div>
    </div>
  )
}

// ---- slide illustrations, built from the app's own design language ----

function TaskArt() {
  return (
    <div className="w-full max-w-[300px]">
      <div className="rounded-bubble bg-violet-tint p-4 shadow-card">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-md border border-ink-faint" />
          <div>
            <p className="text-[15px] leading-snug text-ink">Send me the Ecobank document</p>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-full bg-urgent/15 px-2 py-0.5 text-[11px] font-semibold text-urgent">
                Urgent
              </span>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                Today
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet px-3.5 py-2 text-[13px] font-semibold text-white shadow-float">
          <CheckIcon width={15} height={15} /> Marked done
        </span>
      </div>
    </div>
  )
}

function LedgerArt() {
  return (
    <div className="w-full max-w-[300px]">
      <div className="flex overflow-hidden rounded-[20px] border border-line">
        <div className="flex-[23] bg-violet px-5 py-6 text-white">
          <p className="nums font-display text-[32px] font-extrabold leading-none">23</p>
          <p className="mt-1.5 text-[12.5px] font-semibold text-white/80">they owe you</p>
        </div>
        <div className="flex-[8] bg-carbon px-5 py-6 text-white">
          <p className="nums font-display text-[32px] font-extrabold leading-none">8</p>
          <p className="mt-1.5 text-[12.5px] font-semibold text-white/70">you owe</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { i: 'BO', c: '#6600FF', n: 'Ben Owusu', t: '3 for them · 2 for you' },
          { i: 'AS', c: '#0E7C86', n: 'Ama Serwaa', t: '2 for them' },
        ].map((r) => (
          <div
            key={r.i}
            className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5"
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-full text-[12px] font-semibold text-white"
              style={{ background: r.c }}
            >
              {r.i}
            </span>
            <span className="flex-1 text-[14px] font-semibold text-ink">{r.n}</span>
            <span className="nums text-[11.5px] font-semibold text-violet-ink">{r.t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PokeArt() {
  return (
    <div className="w-full max-w-[300px]">
      <div className="relative rounded-bubble bg-violet-tint p-4 shadow-card ring-2 ring-violet-glow">
        <span className="absolute -right-2 -top-3 text-violet-glow">
          <WandIcon width={26} height={26} />
        </span>
        <p className="text-[15px] leading-snug text-ink">Confirm the venue booking</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
            This Week
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-violet-ink">
            <WandIcon width={13} height={13} /> Poke
          </span>
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-carbon px-4 py-2.5 text-[13px] font-semibold text-white shadow-card">
          <span className="text-violet-glow">
            <WandIcon width={16} height={16} />
          </span>
          You poked Ben
        </span>
      </div>
    </div>
  )
}

const SLIDES = [
  {
    art: <TaskArt />,
    title: 'Send tasks, not just messages',
    body: 'Ask someone to do something and it becomes a real, trackable task — with a priority and a due date.',
  },
  {
    art: <LedgerArt />,
    title: 'Every contact is a two-sided tally',
    body: 'One side is what they owe you, the other is what you owe them. Nothing quietly slips through.',
  },
  {
    art: <PokeArt />,
    title: 'Poke to nudge, gently',
    body: 'A tap of the wand lifts your task to the top of their screen — a friendly reminder, not a nag.',
  },
]
