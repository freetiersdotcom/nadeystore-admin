/* Service worker of the admin app.
 * - Shell only: pages are fetched from the network first and the last good copy is used when offline.
 * - Built files under /assets/ never change once published (their names carry a hash): cached for speed.
 * - Never touches the API or any other site: orders, customers and money are always live data.
 * - Shows push notifications (new orders) and opens the right page when one is tapped.
 */
const SHELL = 'admin-shell-v1';
const ASSETS = 'admin-assets-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== ASSETS) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // API, fonts, anything else: the browser handles it
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put('/', res.clone());
        return res;
      } catch {
        return (await caches.match('/')) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(ASSETS)).put(req, res.clone());
      return res;
    })());
  }
});

self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { /* not JSON */ }
  e.waitUntil(self.registration.showNotification(m.title || 'Admin', {
    body: m.body || '',
    tag: m.tag || undefined,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: typeof m.url === 'string' && m.url.startsWith('/') ? m.url : '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        try { await c.navigate(target); } catch { /* the page reads the hash itself */ }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
