import { isNative } from './platform'
import { supabase } from './supabase'
import { routeForUrl } from './deeplinks'
import { disablePush, pushState, registerWorker, syncSubscription } from './webpush'

/**
 * Notifications arriving at this device, and where a tap sends you.
 *
 * Delivery is standards-based Web Push: the browser's own push service, a
 * VAPID signature, and a service worker that does nothing but receive. No
 * Firebase, and no third-party push account.
 *
 * The Capacitor build is an Android WebView, which implements neither service
 * workers nor the Push API, so the native app receives nothing in the
 * background. That is a real limitation, not an oversight — docs/NOTIFICATIONS.md
 * sets out why and what the alternatives cost. What the native app has instead
 * is the inbox: every notification is a durable row, so nothing is lost; it is
 * read when the app is opened rather than announced while it is closed.
 */

let registered = false

/** Where a tapped notification wants to go, held until the router can take it. */
let pendingRoute: string | null = null
let onRoute: ((path: string) => void) | null = null

/**
 * The app hands us its navigate function once the router exists. A tap that
 * arrived during a cold start is replayed immediately — that case is the whole
 * point, since the OS launches the app and the route lands before React does.
 */
export function setNotificationRouter(nav: (path: string) => void) {
  onRoute = nav
  if (pendingRoute) {
    const p = pendingRoute
    pendingRoute = null
    nav(p)
  }
}

export function clearNotificationRouter() {
  onRoute = null
}

function go(path: string | null) {
  if (!path) return
  if (onRoute) onRoute(path)
  else pendingRoute = path
}

/** Exposed for tests: what a tap would do right now. */
export function pendingNotificationRoute(): string | null {
  return pendingRoute
}

/** A tap reaching an already-open window arrives as a message from the worker. */
function onWorkerMessage(event: MessageEvent) {
  const data = event.data as { type?: string; route?: string } | undefined
  if (data?.type === 'notification-route' && data.route) go(data.route)
}

export type PushSetupResult = 'registered' | 'denied' | 'unsupported' | 'no-session'

/**
 * Called once there is a session.
 *
 * It does not ask for permission: that belongs to a button the person pressed,
 * in Settings, and iOS will refuse a request that is not tied to a gesture.
 * This only makes sure the worker is running, that the server still knows
 * about a subscription the browser may have rotated, and that a tap can find
 * its way into the router.
 */
export async function registerPush(): Promise<PushSetupResult> {
  if (!supabase) return 'no-session'
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'no-session'
  if (registered) return 'registered'

  const state = await pushState()
  // The WebView case, and a build with no VAPID key. Neither is an error.
  if (state === 'unsupported' || state === 'unconfigured') return 'unsupported'

  try {
    await registerWorker()
    await syncSubscription()
    navigator.serviceWorker.addEventListener('message', onWorkerMessage)
    registered = true
    return state === 'denied' ? 'denied' : 'registered'
  } catch (err) {
    console.error('Push setup failed', err)
    return 'unsupported'
  }
}

/**
 * Detach this device on sign-out.
 *
 * Without it the subscription stays attached to the account, and whoever uses
 * the browser next receives the previous person's notifications. Runs before
 * the session is torn down, because the delete needs it.
 */
export async function unregisterPush(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', onWorkerMessage)
    }
    await disablePush()
  } catch {
    /* signing out must succeed even if cleanup does not */
  } finally {
    registered = false
    pendingRoute = null
  }
}

/**
 * Links that open the app: a custom scheme, or an App Link on our own host.
 *
 * Shares the pending-route mechanism with notifications, because a cold start
 * has the same problem — the OS hands over the URL before React has mounted.
 * Returns a teardown so the listener does not outlive the session.
 */
export async function listenForDeepLinks(): Promise<() => void> {
  if (!isNative) return () => {}
  try {
    const { App } = await import('@capacitor/app')
    const handle = await App.addListener('appUrlOpen', (event) => {
      go(routeForUrl(event.url))
    })
    return () => void handle.remove()
  } catch {
    return () => {}
  }
}
