// Self-destructing service worker.
//
// A previous version of this site (when it was a PWA) registered a caching
// service worker. Because that worker is still alive in visitors' browsers, it
// keeps serving the OLD cached app even after new deploys. This replacement
// takes over, deletes all caches, unregisters itself, and reloads open tabs so
// everyone gets the fresh site. Safe to delete once traffic has cycled.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      } catch (e) {
        /* ignore */
      }
      try {
        await self.registration.unregister()
      } catch (e) {
        /* ignore */
      }
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        try {
          client.navigate(client.url)
        } catch (e) {
          /* ignore */
        }
      }
    })(),
  )
})

// Pass everything through to the network — never serve from cache.
self.addEventListener('fetch', () => {})
