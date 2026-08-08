import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { buzz } from '@/lib/haptics'
import { WandIcon } from '@/components/icons'
import { APP_NAME } from '@/lib/config'

/**
 * The app's own entry screen (native build / installed PWA). Unlike the web
 * marketing landing, this is a clean app welcome: brand, the ledger idea, and
 * the two ways in. No "back to website" affordance.
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
        className="flex flex-1 flex-col px-7"
        style={{
          paddingTop: 'calc(var(--safe-top) + 40px)',
          paddingBottom: 'calc(var(--safe-bottom) + 24px)',
        }}
      >
        {/* brand */}
        <div className="flex flex-1 flex-col justify-center">
          <span className="mb-7 grid h-20 w-20 place-items-center rounded-[22px] bg-violet text-white shadow-float">
            <WandIcon width={40} height={40} />
          </span>

          <h1 className="font-display text-[40px] font-extrabold leading-[1.02] tracking-tight">
            Keep everyone
            <br />
            to their word.
          </h1>
          <p className="mt-4 max-w-[19rem] text-[16px] leading-relaxed text-ink-soft">
            {APP_NAME} turns messages into <span className="font-semibold text-ink">tasks</span>.
            Every contact becomes a two-sided tally — what they owe you, what you owe them.
          </p>

          {/* signature: the running tally */}
          <div className="mt-8 flex overflow-hidden rounded-[18px] border border-line">
            <div className="flex-[3] bg-violet px-4 py-4 text-white">
              <p className="nums font-display text-[26px] font-extrabold leading-none">23</p>
              <p className="mt-1 text-[12px] font-semibold text-white/80">they owe you</p>
            </div>
            <div className="flex-1 bg-carbon px-4 py-4 text-white">
              <p className="nums font-display text-[26px] font-extrabold leading-none">8</p>
              <p className="mt-1 text-[12px] font-semibold text-white/70">you owe</p>
            </div>
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
          <p className="pt-1 text-center text-[12px] text-ink-faint">
            By continuing you agree to the Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
