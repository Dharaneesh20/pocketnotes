const CACHE = 'pocket-notes-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest']
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return
  if (url.origin !== self.location.origin) return
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.startsWith('/assets/'))) {
      const copy = response.clone()
      caches.open(CACHE).then(cache => cache.put(event.request, copy))
    }
    return response
  }).catch(async () => (await caches.match(event.request)) || (await caches.match('/index.html'))))
})