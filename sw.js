// Minimal service worker: lets phones "Install" the app. Always tries the network first,
// so residents get updates straight away; falls back to the saved copy when offline.
const CACHE = 'society-hub-v2';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/config.js', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // never cache Supabase data
  // 'no-cache' = always ask the server if the file changed, so app updates show up immediately.
  const fresh = e.request.mode === 'navigate' ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(new Request(e.request, { cache: 'no-cache' }));
  e.respondWith(fresh.then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
