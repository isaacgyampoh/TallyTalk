import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { buzz } from '@/lib/haptics'
import { WandIcon } from '@/components/icons'
import { APP_NAME } from '@/lib/config'

/**
 * The app's landing screen (native build / installed PWA), shown after the
 * intro. Image-forward and clean: a branded aurora backdrop, the app name, and
 * the two ways in. Theme-aware artwork (light/dark) keeps it readable.
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
      <img
        src="/welcome-bg-light.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover dark:hidden"
      />
      <img
        src="/welcome-bg-dark.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover dark:block"
      />
      {/* readability scrim at the bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-paper/70 to-transparent" />

      <div
        className="relative flex flex-1 flex-col px-7"
        style={{
          paddingTop: 'calc(var(--safe-top) + 40px)',
          paddingBottom: 'calc(var(--safe-bottom) + 24px)',
        }}
      >
        {/* brand, anchored to the lower third */}
        <div className="flex flex-1 flex-col justify-end">
          <span className="mb-5 grid h-[64px] w-[64px] place-items-center rounded-[20px] bg-violet text-white shadow-float">
            <WandIcon width={34} height={34} />
          </span>
          <h1 className="font-display text-[52px] font-extrabold leading-[0.98] tracking-tight">
            {APP_NAME}
          </h1>
          <p className="mt-3 max-w-[19rem] text-[17px] font-medium leading-snug text-ink-soft">
            Keep everyone to their word — a two-sided tally of what they owe you and what you owe
            them.
          </p>
        </div>

        {/* actions */}
        <div className="space-y-3">
          <button onClick={() => nav('/signin')} className="btn-primary h-14 w-full text-[16px]">
            Get started
          </button>
          <button
            onClick={demo}
            className="press h-14 w-full rounded-full border border-line bg-paper/70 text-[16px] font-semibold text-ink backdrop-blur-sm"
          >
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
