const CACHE = 'quake-buddy-v1.62';
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/style.css', '/style.css?v=2', '/app.js',
  '/audio.js', '/api-utils.js', '/messages.js',
  '/javi/safe1.gif', '/javi/safe2.gif', '/javi/safe3.gif',
  '/javi/warning1.gif', '/javi/warning2.gif',
  '/javi/danger1.gif', '/javi/danger2.gif',
  '/javi/safe1.png', '/javi/safe2.png',
  '/javi/warning1.png', '/javi/warning2.png',
  '/javi/danger1.png', '/javi/danger2.png',
  '/sounds/Alerto sa Sakuna.mp3',
  '/sounds/Ligtas.mp3',
  '/sounds/Javilerto.mp3',
  '/sounds/Sabay_sabay_Tayong_Bida.mp3',
  '/sounds/NDRRMC-Alert.mp3'
];

self.addEventListener('install', e => {
  // Auto-clear ALL old caches before creating new one
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => caches.open(CACHE).then(c => c.addAll(ASSETS)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Listen for skipWaiting message from the app
self.addEventListener('message', e => {
  if (e.data && e.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('earthquake.usgs.gov') || e.request.url.includes('openrouter.ai')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('push', e => {
  let data = {
    title: 'JaviAlert',
    body: 'May bagong earthquake update!',
    icon: '/icons/javi-icon.png',
    badge: '/icons/javi-icon.png',
    url: '/',
    tag: 'javi-alert'
  };
  try {
    if (e.data) {
      const payload = e.data.json();
      data = { ...data, ...payload };
    }
  } catch (_) { /* ignore */ }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      renotify: true,
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: { url: data.url, alertType: data.alertType }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const urlToOpen = e.notification.data?.url || '/';
  const alertType = e.notification.data?.alertType;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if (alertType) {
            client.postMessage({ action: 'playAlertSound', alertType });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen).then(newWin => {
          if (newWin && alertType) {
            newWin.onload = () => {
              newWin.postMessage({ action: 'playAlertSound', alertType });
            };
          }
        });
      }
    })
  );
});
