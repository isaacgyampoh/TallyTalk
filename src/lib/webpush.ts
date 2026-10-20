import { supabase } from './supabase'

/**
 * Web Push subscriptions, the standards-based way (RFC 8291/8292).
 *
 * The browser's own push service does the delivery; all we hold is the
 * endpoint it gives us and the two keys a message is encrypted to. There is no
 * Firebase project, no SDK and no third-party account involved — the private
 * half of the VAPID pair lives in Supabase's secret store and never reaches a
 * client, and the public half is meant to ship in one.
 *
 * Where this works: Chrome, Edge and Firefox on desktop and Android, and
 * Safari on iOS 16.4+ **once the app is added to the Home Screen**. It does not
 * work inside an Android WebView, which is what the Capacitor build is — see
 * docs/NOTIFICATIONS.md for what the native app does instead.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

export type PushState =
  | 'unsupported' // no service worker or no Push API (an Android WebView, say)
  | 'unconfigured' // no VAPID key in this build
  | 'denied' // the person said no, and only they can undo it
  | 'off' // supported, allowed to ask, not subscribed
  | 'on'

/**
 * base64url (what VAPID keys and browsers use) to the bytes subscribe() wants.
 *
 * Returns a Uint8Array over a plain ArrayBuffer: the DOM types require one,
 * and Uint8Array.from gives an ArrayBufferLike that may be shared.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** The other direction, for the keys a PushSubscription hands back. */
export function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return sub ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/** Registers the push-only worker. Safe to call more than once. */
export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

/**
 * Ask, subscribe, and record the subscription against the signed-in account.
 *
 * Returns the state afterwards rather than throwing: a refused permission is
 * an ordinary answer, not a failure.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'

  // Must be called from a user gesture; iOS enforces this strictly.
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const reg = (await registerWorker()) ?? (await navigator.serviceWorker.ready)
  if (!reg) return 'unsupported'

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const saved = await saveSubscription(sub)
  return saved ? 'on' : 'off'
}

/** Store (or refresh) the subscription row. RLS ties it to the caller. */
export async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  if (!supabase) return false
  const me = (await supabase.auth.getSession()).data.session?.user?.id
  if (!me) return false

  const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } }
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey('p256dh'))
  const auth = json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey('auth'))
  if (!p256dh || !auth) return false

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: me,
      endpoint: sub.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 300),
      failures: 0,
    },
    { onConflict: 'endpoint' },
  )
  return !error
}

/**
 * Stop notifications on this device, in both places: the browser keeps
 * delivering to a subscription we have forgotten, and we would keep sending to
 * one the browser has dropped.
 */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      if (supabase) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
      await sub.unsubscribe()
    }
  } catch {
    /* already gone */
  }
  return 'off'
}

/**
 * A subscription can be rotated by the browser without telling us. Called on
 * sign-in: if the browser holds one, make sure the server has the same one.
 */
export async function syncSubscription(): Promise<void> {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) await saveSubscription(sub)
  } catch {
    /* nothing to sync */
  }
}
