/**
 * TaskTally's service worker. It exists for one reason: to receive Web Push.
 *
 * It deliberately does NOT cache anything. The app removed its PWA worker
 * because stale caches were serving old builds, and bringing caching back
 * would bring that with it. No fetch handler is registered here, so every
 * request goes to the network exactly as if this worker did not exist.
 *
 * This file replaced a self-destructing worker whose job was to clear those
 * old caches in browsers that still had the PWA worker installed. It keeps
 * doing that — the clearing, not the self-destruction, since this one has to
 * stay registered to receive push. A visitor carrying the legacy worker gets
 * this one on their next visit, and their stale caches go with it.
 */

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      } catch {
        /* no cache storage, or nothing to clear */
      }
      await self.clients.claim()
    })(),
  )
})

/** Mirrors routeForNotification() in src/lib/notifications.ts. */
function routeFor(data) {
  if (!data) return '/'
  if (data.taskId && data.contactId) return `/contacts/${data.contactId}/t/${data.taskId}`
  if (data.contactId) return `/contacts/${data.contactId}`
  if (data.groupId) return `/groups/${data.groupId}`
  return '/'
}

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    // A push with no readable payload still means something happened.
    payload = { title: 'TaskTally', body: 'You have a new notification' }
  }

  const title = payload.title || 'TaskTally'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // The same notification delivered twice replaces itself rather than
      // stacking up: push services retry, and so does the sender.
      tag: payload.id || title,
      renotify: false,
      data: {
        route: routeFor(payload),
        id: payload.id,
        category: payload.category,
      },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const route = (event.notification.data && event.notification.data.route) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Prefer a window that is already open: opening a second copy of the app
      // loses whatever the person was in the middle of.
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-route', route })
          return client.focus()
        }
      }
      return self.clients.openWindow(route)
    }),
  )
})
