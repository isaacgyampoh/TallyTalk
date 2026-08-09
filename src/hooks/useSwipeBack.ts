import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNative, platform } from '@/lib/platform'

/**
 * Lets the user swipe right from the left edge to go back — so full-screen
 * detail views don't need a back arrow. Works in the native webview and browser.
 */
export function useSwipeBack() {
  const nav = useNavigate()
  useEffect(() => {
    let startX = 0
    let startY = 0
    let tracking = false

    function onStart(e: TouchEvent) {
      const t = e.touches[0]
      if (t.clientX <= 30) {
        startX = t.clientX
        startY = t.clientY
        tracking = true
      }
    }
    function onEnd(e: TouchEvent) {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      if (dx > 65 && dy < 55) nav(-1)
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [nav])
}

const TABS = ['/today', '/contacts', '/personal', '/groups', '/profile']

/** Wire the Android hardware/gesture back button to the app's history. */
export function useAndroidBack() {
  useEffect(() => {
    if (!isNative || platform !== 'android') return
    let cleanup: (() => void) | undefined
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => {
        const path = window.location.pathname
        if (!TABS.includes(path) && window.history.length > 1) {
          window.history.back()
        } else if (path !== '/today') {
          window.location.assign('/today')
        } else {
          App.exitApp()
        }
      }).then((handle) => {
        cleanup = () => handle.remove()
      })
    })
    return () => cleanup?.()
  }, [])
}
