const CACHE = 'quake-buddy-v2';
const ASSETS = ['/', '/index.html', '/manifest.json', '/javi/safe1.gif', '/javi/safe2.gif', '/javi/safe3.gif'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('earthquake.usgs.gov') || e.request.url.includes('openrouter.ai')) {
    return; // always fetch live data
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
