// my.lisaos.dev service worker — minimal, push-only.
//
// We don't precache the SPA shell here; that's a separate concern and
// would tangle with the gateway's own caching. The only reason this
// worker exists is the Push API: PushManager.subscribe() requires an
// active service worker registration on the page's origin.
//
// Two events handled:
//   • 'push'              — show a system notification
//   • 'notificationclick' — focus or open the deep link
//
// Payload shape comes from delivery-api's push dispatcher
// (internal/push/dispatcher.go fanout):
//   { id, title, body, link, type, source }

self.addEventListener('install', (event) => {
  // Take over on first install instead of waiting for tabs to close —
  // expected behavior for "I clicked enable web push, now use it."
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  /** @type {{id?:string,title?:string,body?:string,link?:string,type?:string,source?:string}} */
  let payload = {}
  if (event.data) {
    try { payload = event.data.json() } catch { payload = { title: event.data.text() } }
  }

  const title = payload.title || 'Construct'
  const options = {
    body: payload.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    // tag groups updates of the same kind so a noisy stream collapses
    // instead of stacking 30 toasts. Using `type` keeps space-related
    // events together; falling back to id makes unrelated pushes distinct.
    tag: payload.type || payload.id || 'construct',
    renotify: true,
    data: {
      id: payload.id,
      link: payload.link || '/',
      type: payload.type,
      source: payload.source,
    },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.link) || '/'

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Prefer focusing an existing my.lisaos.dev tab and navigating
    // it to the link; only fall through to openWindow if nothing's open.
    for (const client of all) {
      try {
        const url = new URL(client.url)
        const dest = new URL(target, self.location.origin)
        if (url.origin === dest.origin) {
          await client.focus()
          if ('navigate' in client) {
            try { await client.navigate(dest.toString()) } catch { /* cross-origin or detached */ }
          }
          return
        }
      } catch { /* malformed URL — ignore */ }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(target)
    }
  })())
})
