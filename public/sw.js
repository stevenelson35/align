// Align's service worker: shows family map alerts sent through Firebase Cloud Messaging (data messages:
// { title, body, url, tag }), and opens Align on a tap. It doesn't cache anything (no fetch handler).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { data: { title: 'Align', body: event.data ? event.data.text() : '' } }
  }
  const m = payload.data || payload.notification || {}
  event.waitUntil(
    self.registration.showNotification(m.title || 'Align', {
      body: m.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: m.tag || undefined,
      data: { url: m.url || '#/map' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '#/map', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url).catch(() => undefined)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
