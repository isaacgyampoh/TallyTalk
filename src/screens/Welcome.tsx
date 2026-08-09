import { AuroraBg } from '@/components/AuroraBg'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { buzz } from '@/lib/haptics'
import { WandIcon, CheckIcon } from '@/components/icons'
import { APP_NAME } from '@/lib/config'

/**
 * The app's landing screen (native build / installed PWA). Image-forward: a
 * branded aurora backdrop with a floating composition of the product itself
 * (task card, tally, poke), the app name, and the two ways in.
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
    <div className="app-frame relative overflow-hidden">
      {/* branded backdrop */}
      <AuroraBg />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-paper/80 to-transparent" />

      <div
        className="relative flex flex-1 flex-col px-7"
        style={{
          paddingTop: 'calc(var(--safe-top) + 26px)',
          paddingBottom: 'calc(var(--safe-bottom) + 22px)',
        }}
      >
        {/* floating product composition */}
        <div className="relative flex-1">
          {/* task request card */}
          <div className="absolute left-0 top-[8%] w-[62%] -rotate-[7deg] rounded-bubble bg-paper p-3.5 shadow-soft">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ink-faint" />
              <div>
                <p className="text-[13.5px] leading-snug text-ink">Send me the report</p>
                <span className="mt-1.5 inline-block rounded-full bg-urgent/15 px-2 py-0.5 text-[10.5px] font-semibold text-urgent">
                  Urgent
                </span>
              </div>
            </div>
          </div>

          {/* tally mini */}
          <div className="absolute right-0 top-[2%] w-[46%] rotate-[6deg] overflow-hidden rounded-[16px] shadow-soft">
            <div className="flex">
              <div className="flex-[3] bg-violet px-3 py-2.5 text-white">
                <p className="nums font-display text-[19px] font-extrabold leading-none">23</p>
                <p className="mt-0.5 text-[9.5px] font-semibold text-white/80">they owe you</p>
              </div>
              <div className="flex-1 bg-carbon px-2 py-2.5 text-white">
                <p className="nums font-display text-[19px] font-extrabold leading-none">8</p>
              </div>
            </div>
          </div>

          {/* poke chip */}
          <div className="absolute left-[14%] top-[42%] -rotate-[3deg] rounded-full bg-carbon px-3.5 py-2 shadow-float">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white">
              <span className="text-violet-glow">
                <WandIcon width={14} height={14} />
              </span>
              You poked Ben
            </span>
          </div>

          {/* done chip */}
          <div className="absolute right-[8%] top-[52%] rotate-[5deg] rounded-full bg-violet px-3 py-1.5 shadow-float">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white">
              <CheckIcon width={13} height={13} /> Done
            </span>
          </div>

          {/* sparkles */}
          <span className="absolute left-[6%] top-[38%] text-violet/70">
            <WandIcon width={20} height={20} />
          </span>
          <span className="absolute right-[30%] top-[70%] text-violet-glow/70">
            <WandIcon width={16} height={16} />
          </span>
        </div>

        {/* brand */}
        <div className="relative">
          <h1 className="font-display text-[52px] font-extrabold leading-[0.98] tracking-tight">
            {APP_NAME}
          </h1>
          <p className="mt-3 max-w-[19rem] text-[16.5px] font-medium leading-snug text-ink-soft">
            Keep everyone to their word — a two-sided tally of what they owe you and what you owe
            them.
          </p>
        </div>

        {/* actions */}
        <div className="relative mt-6 space-y-3">
          <button onClick={() => nav('/signin')} className="btn-primary h-14 w-full text-[16px]">
            Get started
          </button>
          <button
            onClick={demo}
            className="press h-14 w-full rounded-full border border-line bg-paper/70 text-[16px] font-semibold text-ink backdrop-blur-sm"
          >
            Explore with sample data
          </button>
        </div>
      </div>
    </div>
  )
}
