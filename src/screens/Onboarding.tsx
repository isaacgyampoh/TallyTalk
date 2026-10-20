import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buzz } from '@/lib/haptics'
import { WandIcon, CheckIcon } from '@/components/icons'
import { markOnboarded } from '@/lib/onboarding'
import { useT } from '@/i18n/useT'
import type { TranslationKey } from '@/i18n'

export function Onboarding() {
  const nav = useNavigate()
  const { t } = useT()
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

  return (
    <div className="app-frame relative overflow-hidden">
      <div
        className="relative flex items-center justify-end px-5"
        style={{ paddingTop: 'calc(var(--safe-top) + 14px)' }}
      ></div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="relative flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((s, idx) => (
          <section
            key={idx}
            className="flex w-full flex-none snap-center flex-col justify-center px-8 pb-6"
          >
            <div className="flex justify-center">{s.art}</div>
            <div className="mt-10">
              <h2 className="font-display text-[29px] font-extrabold leading-tight tracking-tight">
                {t(s.title)}
              </h2>
              <p className="mt-2.5 max-w-[20rem] text-[16px] leading-relaxed text-ink-soft">
                {t(s.body)}
              </p>
            </div>
          </section>
        ))}
      </div>

      {/* dots */}
      <div className="relative flex justify-center gap-2 py-5">
        {SLIDES.map((_, idx) => (
          <span
            key={idx}
            className={`h-2 rounded-full transition-all ${idx === i ? 'w-6 bg-violet' : 'w-2 bg-line'}`}
          />
        ))}
      </div>

      {/* actions */}
      <div
        className="relative space-y-3 px-8"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 22px)' }}
      >
        {last ? (
          <>
            <button onClick={getStarted} className="btn-primary h-14 w-full text-[16px]">
              {t('intro.start')}
            </button>
          </>
        ) : (
          <button onClick={next} className="btn-primary h-14 w-full text-[16px]">
            {t('intro.next')}
          </button>
        )}
      </div>
    </div>
  )
}

// ---- slide illustrations, built from the app's own design language ----

function TaskArt() {
  const { t } = useT()
  return (
    <div className="w-full max-w-[300px]">
      <div className="rounded-bubble bg-paper p-4 shadow-soft">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-md border border-ink-faint" />
          <div>
            <p className="text-[15px] leading-snug text-ink">{t('intro.art.sample')}</p>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-full bg-urgent/15 px-2 py-0.5 text-[11px] font-semibold text-urgent-ink">
                {t('intro.art.urgent')}
              </span>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                {t('intro.art.today')}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet px-3.5 py-2 text-[13px] font-semibold text-white shadow-float">
          <CheckIcon width={15} height={15} /> {t('intro.art.done')}
        </span>
      </div>
    </div>
  )
}

function LedgerArt() {
  const { t } = useT()
  return (
    <div className="w-full max-w-[300px]">
      <div className="flex overflow-hidden rounded-[20px] border border-line shadow-soft">
        <div className="flex-[23] bg-violet px-5 py-6 text-white">
          <p className="nums font-display text-[32px] font-extrabold leading-none">23</p>
          <p className="mt-1.5 text-[12.5px] font-semibold text-white/80">
            {t('intro.art.theyOwe')}
          </p>
        </div>
        <div className="flex-[8] bg-carbon px-5 py-6 text-white">
          <p className="nums font-display text-[32px] font-extrabold leading-none">8</p>
          <p className="mt-1.5 text-[12.5px] font-semibold text-white/70">
            {t('intro.art.youOwe')}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { i: '—', c: '#6600FF', n: t('intro.art.contact'), t: '3 · 2' },
          { i: '—', c: '#0E7C86', n: t('intro.art.otherContact'), t: '2' },
        ].map((r) => (
          <div
            key={r.i}
            className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-3 py-2.5 shadow-card"
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
  const { t } = useT()
  return (
    <div className="w-full max-w-[300px]">
      <div className="relative rounded-bubble bg-paper p-4 shadow-soft ring-2 ring-violet-glow">
        <span className="absolute -right-2 -top-3 text-violet-glow">
          <WandIcon width={26} height={26} />
        </span>
        <p className="text-[15px] leading-snug text-ink">{t('intro.art.venue')}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
            {t('intro.art.thisWeek')}
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-violet-ink">
            <WandIcon width={13} height={13} /> {t('intro.art.poke')}
          </span>
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-carbon px-4 py-2.5 text-[13px] font-semibold text-white shadow-card">
          <span className="text-violet-glow">
            <WandIcon width={16} height={16} />
          </span>
          {t('intro.art.poked')}
        </span>
      </div>
    </div>
  )
}

const SLIDES: { art: React.ReactNode; title: TranslationKey; body: TranslationKey }[] = [
  { art: <TaskArt />, title: 'intro.tasks.title', body: 'intro.tasks.body' },
  { art: <LedgerArt />, title: 'intro.tally.title', body: 'intro.tally.body' },
  { art: <PokeArt />, title: 'intro.poke.title', body: 'intro.poke.body' },
]
