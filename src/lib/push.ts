import { isNative, platform } from './platform'
import { supabase } from './supabase'
import { CHANNELS, routeForNotification, type NotificationData } from './notifications'
import { routeForUrl } from './deeplinks'

/**
 * Device push: registration, channels, and what happens when one arrives.
 *
 * Everything here is native-only and no-ops on web and in preview, so screens
 * can call it unconditionally.
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

export type PushSetupResult = 'registered' | 'denied' | 'unsupported' | 'no-session'

export async function registerPush(
  onForeground?: (title: string, body: string, data: NotificationData) => void,
): Promise<PushSetupResult> {
  if (!isNative) return 'unsupported'
  if (!supabase) return 'no-session'
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'no-session'
  if (registered) return 'registered'

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    // Channels must exist before the first notification, or Android drops it.
    if (platform === 'android') {
      for (const c of CHANNELS) {
        await PushNotifications.createChannel({
          id: c.id,
          name: c.name,
          description: c.description,
          importance: c.importance,
          visibility: 1,
          vibration: c.vibration,
        }).catch(() => {
          /* a channel the user already customised cannot be rewritten */
        })
      }
    }

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return 'denied'

    registered = true
    await PushNotifications.register()

    await PushNotifications.addListener('registration', (token) => {
      // Fires again whenever FCM rotates the token.
      void saveToken(token.value)
    })

    await PushNotifications.addListener('registrationError', (err) => {
      registered = false
      console.error('Push registration error', err)
    })

    // Arrived while the app is open: the OS does not draw it, so we must.
    await PushNotifications.addListener('pushNotificationReceived', (n) => {
      onForeground?.(n.title ?? 'TaskTally', n.body ?? '', (n.data ?? {}) as NotificationData)
    })

    // The user tapped one.
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = (action.notification.data ?? {}) as NotificationData
      go(routeForNotification(data))
    })

    return 'registered'
  } catch (err) {
    console.error('Push setup failed', err)
    return 'unsupported'
  }
}

async function saveToken(token: string) {
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' },
    )
}

/**
 * Detach this device on sign-out.
 *
 * Without it the token stays attached to the account, and whoever uses the
 * device next receives the previous user's notifications. Runs before the
 * session is torn down, because the delete needs it.
 */
export async function unregisterPush(): Promise<void> {
  if (!isNative || !supabase) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.removeAllListeners()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('push_tokens').delete().eq('user_id', user.id).eq('platform', platform)
    }
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
