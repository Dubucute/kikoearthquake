import webpush from 'web-push';
import { getDb } from './_db.js';

// Simple haversine distance (same as api-utils.js)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Should this mag & distance combination get a push notification?
function shouldNotifyQuake(mag, distKm) {
  if (mag >= 5.0) return true;
  if (mag >= 4.0 && distKm <= 300) return true;
  if (mag >= 3.0 && distKm <= 200) return true;
  return false;
}

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

let vapidReady = false;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('VAPID keys not set — push sending disabled');
} else {
  try {
    webpush.setVapidDetails(
      'mailto:javi@javi-alert.app',
      vapidPublicKey,
      vapidPrivateKey
    );
    vapidReady = true;
  } catch (err) {
    console.error('VAPID key validation failed:', err.message);
    console.error('Please regenerate and update VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel.');
  }
}

// ─── CORS helper ──────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://javi-alert.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

function setCorsHeaders(res, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://javi-alert.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, req.headers.origin);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    setCorsHeaders(res, req.headers.origin);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!vapidReady) {
    setCorsHeaders(res, req.headers.origin);
    return res.status(500).json({ error: 'VAPID keys not configured or invalid. Regenerate keys in Vercel.' });
  }
  try {
    const database = await getDb();
    const subs = database.collection('pushSubscriptions');
    const allSubs = await subs.find({}).toArray();
    if (!allSubs.length) {
      setCorsHeaders(res, req.headers.origin);
      return res.json({ sent: 0, total: 0 });
    }

    // Filter subscribers by distance to quake
    const quakeLat = req.body.lat;
    const quakeLon = req.body.lon;
    const mag = (() => {
      const match = (req.body.body || '').match(/Magnitude ([\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    })();
    const targetSubs = (quakeLat && quakeLon && mag)
      ? allSubs.filter(s => {
          if (!s.lat || !s.lon) return true; // no location = always notify (legacy)
          const dist = getDistance(s.lat, s.lon, quakeLat, quakeLon);
          return shouldNotifyQuake(mag, dist);
        })
      : allSubs; // fallback: send to everyone if no location data

    if (!targetSubs.length) {
      setCorsHeaders(res, req.headers.origin);
      return res.json({ sent: 0, total: allSubs.length, filtered: true });
    }

    const payload = JSON.stringify({
      title: req.body.title || 'JaviAlert',
      body: req.body.body || 'May bagong earthquake update!',
      icon: req.body.icon || '/icons/javi-icon.png',
      badge: req.body.badge || '/icons/javi-icon.png',
      image: req.body.image || '/icons/javi-icon.png',
      url: req.body.url || '/',
      tag: req.body.tag || 'javi-alert',
      alertType: req.body.alertType || null
    });
    const results = await Promise.allSettled(
      targetSubs.map(s => webpush.sendNotification(s, payload))
    );
    const invalidEndpoints = targetSubs
      .filter((_, i) => results[i].status === 'rejected')
      .map(s => s.endpoint);
    if (invalidEndpoints.length > 0) {
      await subs.deleteMany({ endpoint: { $in: invalidEndpoints } });
    }
    setCorsHeaders(res, req.headers.origin);
    res.json({
      sent: results.filter(r => r.status === 'fulfilled').length,
      total: allSubs.length
    });
  } catch (err) {
    console.error('push-send error:', err);
    setCorsHeaders(res, req.headers.origin);
    res.status(500).json({ error: err.message });
  }
}
