import type { ReactNode } from 'react'

/**
 * Wraps the running app. On phones it fills the screen; on tablet/desktop it
 * renders inside a centred device frame on a branded backdrop, so large screens
 * look intentional rather than a narrow column in a void.
 */
export function AppViewport({ children }: { children: ReactNode }) {
  return (
    <div className="app-viewport">
      <div className="app-device">{children}</div>
    </div>
  )
}
