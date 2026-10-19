const CACHE = 'rental-manager-shell-v8-9'
const APP_SHELL = ['/', '/manifest.webmanifest', '/offline.html', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k.startsWith('rental-manager-shell-') && k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
    const clients = await self.clients.matchAll({ type: 'window' })
    clients.forEach(client => client.postMessage({ type: 'RM_SW_UPDATED' }))
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Always request the current app document. Never serve a stale cached HTML
  // document that may reference bundles removed by a newer deployment.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-store' }).then(response => response).catch(async () => {
      return (await caches.match('/offline.html')) || (await caches.match('/')) || Response.error()
    }))
    return
  }

  const isAppAsset = url.pathname.startsWith('/assets/') || /\.(?:css|js)$/.test(url.pathname)
  if (!isAppAsset && url.pathname !== '/manifest.webmanifest') return

  // Prefer the deployed asset. Cache only successful responses; if the server
  // says a hashed chunk is missing, don't hide that 404 with an old cached file.
  event.respondWith(fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)))
    }
    return response
  }).catch(async () => (await caches.match(request)) || (await caches.match('/offline.html')) || Response.error()))
})
