// NEXUS service worker. Strategy:
//  - On install: pre-cache the app shell and EVERY built file listed in /precache.json (works offline after one visit).
//  - Navigations: network first (so deploys show up), fall back to the cached app shell, then /offline.html.
//  - Hashed /assets/*: cache first (they never change). Everything else same-origin: stale-while-revalidate.
//  - /.netlify/functions/* (AI) is never cached.
//  - A new worker waits until the user taps "Update" in the app (no surprise reloads while logging a workout).
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE = `nexus-${VERSION}`
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/offline.html', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll(SHELL)
    try {
      const r = await fetch('/precache.json', { cache: 'no-store' })
      if (r.ok) { const { files } = await r.json(); await Promise.all(files.map(f => cache.add(f).catch(() => {}))) }
    } catch (e) { /* offline during install: shell is enough to boot */ }
  })())
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k.startsWith('nexus-') && k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting() })

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/.netlify/')) return

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        const c = await caches.open(CACHE); c.put('/index.html', fresh.clone()).catch(() => {})
        return fresh
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || (await caches.match('/offline.html')) || Response.error()
      }
    })())
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const hit = await caches.match(req); if (hit) return hit
      const res = await fetch(req); if (res.ok) (await caches.open(CACHE)).put(req, res.clone()); return res
    })())
    return
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE); const hit = await cache.match(req)
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res }).catch(() => null)
    return hit || (await net) || Response.error()
  })())
})
