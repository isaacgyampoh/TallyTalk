import { Capacitor } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'

// Installed PWA (added to home screen) behaves like an app, not a website.
export const isStandalone =
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true)

// True when the experience should feel like an app (native build or installed
// PWA): show the in-app Welcome, not the marketing landing page.
export const isAppMode = isNative || isStandalone

/**
 * Native-only startup: mark the document, sync the status bar to the theme,
 * and hide the splash once the web app is ready. Safe to call on web (no-ops).
 */
export async function initNative(resolvedTheme: 'light' | 'dark') {
  if (!isNative) return
  document.documentElement.classList.add('native')

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: resolvedTheme === 'dark' ? Style.Dark : Style.Light })
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({
        color: resolvedTheme === 'dark' ? '#14141a' : '#ffffff',
      })
    }
  } catch {
    /* plugin not available */
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    /* ignore */
  }
}

/** Keep the native status bar in sync when the theme changes. */
export async function syncStatusBar(resolvedTheme: 'light' | 'dark') {
  if (!isNative) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: resolvedTheme === 'dark' ? Style.Dark : Style.Light })
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({
        color: resolvedTheme === 'dark' ? '#14141a' : '#ffffff',
      })
    }
  } catch {
    /* ignore */
  }
}
