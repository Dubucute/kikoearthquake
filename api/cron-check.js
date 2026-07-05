/**
 * Server-side cron endpoint — checks for new earthquakes and sends
 * push notifications to all subscribers, even when no client is open.
 *
 * Call via: GET /api/cron-check
 * Designed to be triggered by Vercel Cron or an external cron service.
 */
import webpush from 'web-push';
import https from 'https';
import http from 'http';
import { getDb } from './_db.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

let vapidReady = false;
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails('mailto:javi@javi-alert.app', vapidPublicKey, vapidPrivateKey);
    vapidReady = true;
  } catch (_) { /* invalid keys */ }
}

// ─── Fetch PHIVOLCS HTML (reuses same logic as phivolcs-quakes.js) ───
function fetchPHIVOLCS() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://earthquake.phivolcs.dost.gov.ph/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      rejectUnauthorized: false,
      timeout: 15000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        const redirectReq = https.get(res.headers.location, { rejectUnauthorized: false, timeout: 15000 }, (redirRes) => {
          let data = '';
          redirRes.on('data', chunk => data += chunk);
          redirRes.on('end', () => resolve(data));
        });
        redirectReq.on('error', reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseQuakes(html) {
  const quakes = [];
  const rowRegex = /<tr>\s*<td[^>]*>.*?<a href="([^"]+)".*?<span[^>]*>([^<]+)<\/span>.*?<\/td>\s*<td[^>]*>\s*([\d.]+)\s*<\/td>\s*<td[^>]*>\s*([\d.]+)\s*<\/td>\s*<td[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>\s*([\d.]+)\s*<\/td>\s*<td[^>]*>\s*(\d+)\s*([^<]*)<\/td>/gs;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const [, url, dateStr, lat, lon, depth, mag, distNum, distDir] = match;
    const dist = parseInt(distNum);
    const id = url.replace(/\.html$/, '').replace(/\//g, '-');
    // Parse date
    const dateMatch = dateStr.trim().match(/(\d+)\s+(\w+)\s+(\d+)\s+-\s+(\d+):(\d+)\s+(AM|PM)/i);
    let time = Date.now();
    if (dateMatch) {
      const months = { January:0, February:1, March:2, April:3, May:4, June:5, July:6, August:7, September:8, October:9, November:10, December:11 };
      const [, day, month, year, hour, min, ampm] = dateMatch;
      let h = parseInt(hour);
      if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
      time = new Date(parseInt(year), months[month], parseInt(day), h, parseInt(min)).getTime();
    }
    const place = distDir.trim().replace(/\s+/g, ' ');
    quakes.push({
      id: `ph-${id}`,
      mag: parseFloat(mag),
      place: `${dist} km ${place}`,
      time,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      depth: parseInt(depth),
      dist,
      url: `https://earthquake.phivolcs.dost.gov.ph/${url}`,
    });
  }
  return quakes;
}

// ─── Severity classification ───
function classifyQuake(q) {
  if (q.mag >= 5) return 'danger';
  if (q.mag >= 3) return 'warning';
  return 'info';
}

export default async function handler(req, res) {
  // Only GET for cron
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (prevents public abuse)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!vapidReady) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  try {
    const database = await getDb();

    // 1. Fetch latest quakes from PHIVOLCS
    const html = await fetchPHIVOLCS();
    const quakes = parseQuakes(html);

    if (!quakes.length) {
      return res.json({ ok: true, message: 'No quakes parsed', sent: 0 });
    }

    // 2. Check what we already notified about
    const tracker = database.collection('cronTracker');
    const lastDoc = await tracker.findOne({ _id: 'lastQuakeId' });
    const lastKnownId = lastDoc ? lastDoc.quakeId : null;

    // Find quakes newer than the last known
    let newQuakes;
    if (!lastKnownId) {
      // First run — only notify about the single most recent quake
      newQuakes = [quakes[0]];
    } else {
      newQuakes = quakes.filter(q => q.time > (lastDoc.lastTime || 0));
    }

    if (!newQuakes.length) {
      return res.json({ ok: true, message: 'No new quakes', sent: 0, total: quakes.length });
    }

    // Limit to prevent notification spam — max 5 per cron run
    const toNotify = newQuakes.slice(0, 5);
    const biggest = toNotify.reduce((a, b) => b.mag > a.mag ? b : a);

    // 3. Send push to all subscribers
    const subs = database.collection('pushSubscriptions');
    const allSubs = await subs.find({}).toArray();
    if (!allSubs.length) {
      // Still update tracker even if no subscribers
      await tracker.updateOne(
        { _id: 'lastQuakeId' },
        { $set: { quakeId: quakes[0].id, lastTime: quakes[0].time } },
        { upsert: true }
      );
      return res.json({ ok: true, message: 'No subscribers', sent: 0 });
    }

    const count = toNotify.length;
    const alertType = classifyQuake(biggest);
    const title = count === 1 ? 'New earthquake detected!' : count + ' new earthquakes detected!';
    const body = biggest.mag.toFixed(1) + ' mag — ' + biggest.place;

    const payload = JSON.stringify({
      title: '🌏 ' + title,
      body,
      url: '/',
      tag: 'quake-cron-' + Date.now(),
      alertType,
    });

    const results = await Promise.allSettled(
      allSubs.map(s => webpush.sendNotification(s, payload))
    );

    // Clean up invalid subscriptions
    const invalidEndpoints = allSubs
      .filter((_, i) => results[i].status === 'rejected')
      .map(s => s.endpoint);
    if (invalidEndpoints.length > 0) {
      await subs.deleteMany({ endpoint: { $in: invalidEndpoints } });
    }

    // 4. Update tracker
    await tracker.updateOne(
      { _id: 'lastQuakeId' },
      { $set: { quakeId: quakes[0].id, lastTime: quakes[0].time } },
      { upsert: true }
    );

    res.json({
      ok: true,
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: invalidEndpoints.length,
      total: allSubs.length,
      newQuakes: count,
      biggest: { mag: biggest.mag, place: biggest.place },
    });
  } catch (err) {
    console.error('cron-check error:', err);
    res.status(500).json({ error: err.message });
  }
}
