import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { buzz } from '@/lib/haptics'
import { WandIcon, ContactsIcon, PersonalIcon } from '@/components/icons'
import { APP_NAME } from '@/lib/config'

/**
 * The app's own entry screen (native build / installed PWA), shown after
 * onboarding. Brand at the top, three quick value points in the middle, and the
 * two ways in anchored at the bottom — no marketing page, no "back to website".
 */
export function Welcome() {
  const nav = useNavigate()
  const { enterPreview } = useAuth()

  function demo() {
    buzz(10)
    enterPreview()
    nav('/today')
  }

  return (
    <div className="app-frame">
      <div
        className="aura-bg relative flex flex-1 flex-col overflow-hidden px-7"
        style={{
          paddingTop: 'calc(var(--safe-top) + 34px)',
          paddingBottom: 'calc(var(--safe-bottom) + 22px)',
        }}
      >
        {/* soft decorative orbs */}
        <div className="pointer-events-none absolute -left-20 -top-16 h-60 w-60 rounded-full bg-violet/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-28 h-72 w-72 rounded-full bg-violet-glow/20 blur-3xl" />

        {/* brand — anchored near the top */}
        <div className="relative">
          <span className="mb-6 grid h-[68px] w-[68px] place-items-center rounded-[20px] bg-violet text-white shadow-float">
            <WandIcon width={36} height={36} />
          </span>
          <h1 className="font-display text-[38px] font-extrabold leading-[1.03] tracking-tight">
            Keep everyone
            <br />
            to their word.
          </h1>
          <p className="mt-3.5 max-w-[20rem] text-[15.5px] leading-relaxed text-ink-soft">
            {APP_NAME} turns messages into <span className="font-semibold text-ink">tasks</span> — a
            two-sided tally of what they owe you and what you owe them.
          </p>

          {/* signature: the running tally */}
          <div className="mt-6 flex overflow-hidden rounded-[18px] border border-line">
            <div className="flex-[3] bg-violet px-4 py-3.5 text-white">
              <p className="nums font-display text-[24px] font-extrabold leading-none">23</p>
              <p className="mt-1 text-[12px] font-semibold text-white/80">they owe you</p>
            </div>
            <div className="flex-1 bg-carbon px-4 py-3.5 text-white">
              <p className="nums font-display text-[24px] font-extrabold leading-none">8</p>
              <p className="mt-1 text-[12px] font-semibold text-white/70">you owe</p>
            </div>
          </div>
        </div>

        {/* three quick points — fill the middle intentionally */}
        <div className="flex flex-1 items-center">
          <div className="grid w-full grid-cols-3 gap-2.5">
            <Mini Icon={ContactsIcon} label="Two-sided ledger" />
            <Mini Icon={WandIcon} label="Poke to nudge" />
            <Mini Icon={PersonalIcon} label="Lists & groups" />
          </div>
        </div>

        {/* actions */}
        <div className="space-y-3">
          <button onClick={() => nav('/signin')} className="btn-primary h-14 w-full text-[16px]">
            Get started
          </button>
          <button onClick={demo} className="btn-ghost h-14 w-full text-[16px]">
            Explore with sample data
          </button>
          <p className="pt-0.5 text-center text-[12px] text-ink-faint">
            By continuing you agree to the Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}

function Mini({
  Icon,
  label,
}: {
  Icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-line px-1.5 py-3.5 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-tint text-violet-ink">
        <Icon width={20} height={20} />
      </span>
      <span className="text-[11.5px] font-semibold leading-tight text-ink-soft">{label}</span>
    </div>
  )
}
