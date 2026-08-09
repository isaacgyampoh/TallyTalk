import { useEffect } from 'react'
import { WandIcon } from '@/components/icons'
import { APP_NAME } from '@/lib/config'

/**
 * A short branded intro that plays once on app cold-start (native / installed
 * PWA), so opening the app feels like a real product launch rather than dropping
 * straight into a form.
 */
export function IntroSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1750)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="app-frame relative animate-intro-out items-center justify-center overflow-hidden">
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
      <div className="relative flex flex-col items-center">
        <span className="grid h-24 w-24 animate-intro-pop place-items-center rounded-[28px] bg-violet text-white shadow-float">
          <WandIcon width={52} height={52} />
        </span>
        <span className="mt-5 animate-intro-word font-display text-[30px] font-extrabold tracking-tight">
          {APP_NAME}
        </span>
        <span className="mt-1.5 animate-intro-word text-[13px] font-medium text-ink-faint">
          Keep everyone to their word.
        </span>
      </div>
    </div>
  )
}
