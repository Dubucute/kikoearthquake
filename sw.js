const CACHE = 'quake-buddy-v5';
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/style.css', '/app.js',
  '/javi/safe1.gif', '/javi/safe2.gif', '/javi/safe3.gif',
  '/javi/warning1.gif', '/javi/warning2.gif',
  '/javi/danger1.gif', '/javi/danger2.gif',
  '/javi/safe1.png', '/javi/safe2.png',
  '/javi/warning1.png', '/javi/warning2.png',
  '/javi/danger1.png', '/javi/danger2.png'
];

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
