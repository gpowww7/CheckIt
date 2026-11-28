// Checkit service worker: opens instantly and works offline, but always asks the network for a new version first.
// The app page is network-first (with a short timeout, then the saved copy), so a new release shows up on the next open.
// Fonts and icons are cache-first. Cover art and API calls are left to the browser.
const V = 'checkit-v7';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-64.png', 'icon-192.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const put = (req, res) => { if (res && (res.ok || res.type === 'opaque')) { const c = res.clone(); caches.open(V).then(x => x.put(req, c)) } return res };
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  const same = u.origin === location.origin;
  if (r.mode === 'navigate' || (same && /(\/|\.html)$/.test(u.pathname))) {
    // Network first, skipping the HTTP cache so a new version is never hidden behind a stale copy.
    const key = new Request(new URL('index.html', self.registration.scope).href);
    e.respondWith((async () => {
      const net = fetch(r.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => { if (res.ok && r.mode === 'navigate') put(key, res.clone()); return res });
      const saved = await caches.match(key);
      if (!saved) return net;
      // Use the network if it answers within 3 seconds, else open the saved copy (and the fetch still updates it).
      const timeout = new Promise(ok => setTimeout(() => ok(null), 3000));
      try { const res = await Promise.race([net, timeout]); if (res && res.ok) return res } catch (err) {}
      e.waitUntil(net.catch(() => {}));
      return saved;
    })());
    return;
  }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com' || (same && /\.(png|webmanifest)$/.test(u.pathname))) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => put(r, res))));
  }
});
