import { useState } from 'react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { isNative } from '@/lib/platform'
import { APP_NAME } from '@/lib/config'
import { WandIcon } from './icons'

/** Sticky prompt shown inside the app until installed or dismissed. */
export function InstallBanner() {
  const { canInstall, promptInstall, installed, isIOS } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('tt.bannerDismissed') === '1',
  )
  const [showHelp, setShowHelp] = useState(false)

  if (isNative || installed || dismissed) return null

  function dismiss() {
    sessionStorage.setItem('tt.bannerDismissed', '1')
    setDismissed(true)
  }
  function onInstall() {
    if (canInstall) promptInstall()
    else setShowHelp(true)
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line bg-violet-tint px-4 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet text-white">
          <WandIcon width={17} height={17} />
        </span>
        <p className="min-w-0 flex-1 text-[13px] font-medium leading-tight text-violet-ink">
          Install {APP_NAME} for the full, offline-ready experience.
        </p>
        <button onClick={onInstall} className="press shrink-0 rounded-full bg-violet px-3.5 py-1.5 text-[12.5px] font-semibold text-white">
          Install
        </button>
        <button onClick={dismiss} aria-label="Dismiss" className="press shrink-0 px-1 text-lg leading-none text-violet-ink/60">
          ×
        </button>
      </div>
      {showHelp && (
        <InstallHelp isIOS={isIOS} canInstall={canInstall} onInstall={promptInstall} onClose={() => setShowHelp(false)} />
      )}
    </>
  )
}

export function InstallHelp({
  isIOS,
  canInstall,
  onInstall,
  onClose,
}: {
  isIOS: boolean
  canInstall: boolean
  onInstall: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-card bg-paper p-6 shadow-card animate-rise-in" onClick={(e) => e.stopPropagation()}>
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-violet text-white shadow-float">
          <WandIcon width={24} height={24} />
        </span>
        <h3 className="mt-4 font-display text-[20px] font-bold">Install {APP_NAME}</h3>
        {canInstall ? (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            Add {APP_NAME} to your home screen — it opens in its own window and works offline.
          </p>
        ) : isIOS ? (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            In Safari, tap the <span className="font-semibold text-ink">Share</span> icon, then choose{' '}
            <span className="font-semibold text-ink">Add to Home Screen</span>.
          </p>
        ) : (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            Open your browser menu and choose{' '}
            <span className="font-semibold text-ink">Install app</span> (or “Add to Home Screen”). It
            launches in its own window, offline-ready.
          </p>
        )}
        <div className="mt-5 flex gap-2">
          {canInstall && (
            <button
              onClick={() => {
                onInstall()
                onClose()
              }}
              className="btn-primary flex-1"
            >
              Install now
            </button>
          )}
          <button onClick={onClose} className={canInstall ? 'btn-ghost flex-1' : 'btn-primary w-full'}>
            {canInstall ? 'Later' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )
}
