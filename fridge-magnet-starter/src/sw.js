import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

// Every screen in this app reads live data from Supabase — there's no
// offline mode yet (that's a possible later step), so this only ever
// precaches the app's own JS/CSS/HTML/icons. self.__WB_MANIFEST is filled
// in by vite-plugin-pwa's injectManifest step at build time.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
self.addEventListener('activate', () => self.clients.claim())

// The one thing a generated service worker can't do: react to a push
// message from the server and actually show something. Web Push only
// hands over raw bytes — this app always sends JSON with a title and body.
self.addEventListener('push', (event) => {
  let payload = { title: 'Fridge Magnet', body: 'Something needs using up.' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    // Not JSON for some reason — fall back to the default text above
    // rather than showing a blank notification.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'fridge-magnet-expiring',
    })
  )
})

// Tapping the notification should bring an already-open tab to the front
// rather than always opening a fresh one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client)
      if (existing) return existing.focus()
      return self.clients.openWindow('/inventory')
    })
  )
})
