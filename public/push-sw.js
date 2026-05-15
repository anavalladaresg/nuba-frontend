self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const fallbackPayload = {
    title: 'Nuba',
    body: 'Tienes un recordatorio pendiente de jornada.',
    url: '/',
    tag: 'nuba-reminder',
  }

  let payload = fallbackPayload

  try {
    if (event.data) {
      payload = { ...fallbackPayload, ...event.data.json() }
    }
  } catch {
    payload = fallbackPayload
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/brand/dark/android-chrome-192x192.png',
      badge: payload.badge || '/brand/dark/favicon-32x32.png',
      tag: payload.tag || 'nuba-reminder',
      data: {
        url: payload.url || '/',
      },
      renotify: Boolean(payload.renotify),
      requireInteraction: Boolean(payload.requireInteraction),
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of windowClients) {
        if (!('focus' in client)) {
          continue
        }

        try {
          const clientUrl = new URL(client.url)
          const desiredUrl = new URL(targetUrl, self.location.origin)

          if (clientUrl.origin === desiredUrl.origin && 'navigate' in client) {
            await client.navigate(desiredUrl.toString())
          }
        } catch {
          // Ignore URL parsing issues and just focus the client below.
        }

        return client.focus()
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    })(),
  )
})
