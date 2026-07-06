const CACHE = 'quake-buddy-v1.112';
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/style.css', '/style.css?v=2', '/app.js',
  '/audio.js', '/api-utils.js', '/messages.js',
  '/javi/safe1.gif', '/javi/safe2.gif', '/javi/safe3.gif',
  '/javi/warning1.gif', '/javi/warning2.gif',
  '/javi/danger1.gif', '/javi/danger2.gif',
  '/javi/safe1.png', '/javi/safe2.png', '/javi/safe3.png', '/javi/safe4.png',
  '/javi/warning1.png', '/javi/warning2.png', '/javi/warning3.png', '/javi/warning4.png',
  '/javi/danger1.png', '/javi/danger2.png', '/javi/danger3.png', '/javi/danger4.png',
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

  const notifOptions = {
    body: data.body,
    icon: data.icon || '/icons/javi-icon.png',
    badge: data.badge || '/icons/javi-icon.png',
    tag: data.tag || 'javi-alert',
    renotify: true,
    data: { url: data.url, alertType: data.alertType }
  };
  // Android: show rich image notification
  if (data.image) notifOptions.image = data.image;
  // Vibrate only on Android (iOS ignores it)
  if (typeof Notification !== 'undefined' && 'maxActions' in Notification) {
    notifOptions.vibrate = [200, 100, 200];
    notifOptions.requireInteraction = true;
  }
  e.waitUntil(
    self.registration.showNotification(data.title, notifOptions)
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const urlToOpen = e.notification.data?.url || '/';
  const alertType = e.notification.data?.alertType;
  const fullUrl = self.location.origin + urlToOpen;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Try to find an existing JaviAlert window
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          // Send alert sound message then focus
          if (alertType) {
            client.postMessage({ action: 'playAlertSound', alertType });
          }
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // No existing window — open a new one
      return clients.openWindow(fullUrl);
    })
  );
});
