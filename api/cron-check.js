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
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails('mailto:javi@javi-alert.app', vapidPublicKey, vapidPrivateKey);
    vapidReady = true;
  } catch (_) { /* invalid keys */ }
}

// ─── Shared fetch + parse (same proven logic as phivolcs-quakes.js) ───
function nodeFetch(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: () => data }));
    });
    req.on('error', (err) => reject(new Error('Request failed: ' + err.message)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\u00A0/g, ' ').replace(/\u00C2/g, '').trim();
}

function parsePhivolcsDate(dateStr) {
  const match = dateStr.match(/(\d+)\s+(\w+)\s+(\d+)\s*-\s*(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  const months = { january:0, february:1, march:2, april:3, may:4, june:5, july:6, august:7, september:8, october:9, november:10, december:11 };
  const [, day, month, year, hour, min, ampm] = match;
  let h = parseInt(hour);
  if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
  return new Date(parseInt(year), months[month.toLowerCase()], parseInt(day), h, parseInt(min));
}

function parsePhivolcsTable(html) {
  const quakes = [];
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const row = rowMatch[1];
    if (row.includes('<th')) continue;
    // Extract date link — try multiple patterns
    let href = '';
    let dateStr = '';
    const linkMatch1 = row.match(/<a[^>]+href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="auto-style99"[^>]*>([^<]*)<\/span>/i);
    if (linkMatch1) {
      href = linkMatch1[1].trim();
      dateStr = linkMatch1[2].trim();
    } else {
      const linkMatch2 = row.match(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/i);
      if (linkMatch2) {
        href = linkMatch2[1].trim();
        dateStr = linkMatch2[2].trim();
      } else {
        const tdCells = row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        const firstCells = [];
        for (const td of tdCells) {
          const txt = stripHtml(td[1]);
          if (txt) firstCells.push(txt);
        }
        if (firstCells.length > 0 && /^\d+\s+\w+\s+\d+/.test(firstCells[0])) {
          dateStr = firstCells[0];
          const hrefMatch = row.match(/<a[^>]+href="([^"]*)"[^>]*>/i);
          if (hrefMatch) href = hrefMatch[1].trim();
        }
      }
    }
    if (!href || !dateStr) continue;
    const tdMatches = row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    const cells = [];
    for (const td of tdMatches) cells.push(td[1]);
    if (cells.length < 6) continue;
    const lat = parseFloat(stripHtml(cells[1]));
    const lon = parseFloat(stripHtml(cells[2]));
    const depth = parseInt(stripHtml(cells[3]), 10);
    const mag = parseFloat(stripHtml(cells[4]));
    const locationRaw = stripHtml(cells[5]);
    if (isNaN(lat) || isNaN(lon) || isNaN(mag)) continue;
    const time = parsePhivolcsDate(dateStr);
    if (!time) continue;
    const url = href.startsWith('http') ? href : 'https://earthquake.phivolcs.dost.gov.ph/' + href.replace(/\\/g, '/');
    const id = 'ph-' + href.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    quakes.push({ id, mag, place: locationRaw, time: time.getTime(), lat, lon, depth: isNaN(depth) ? 0 : depth, url });
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

  // Verify cron secret — accepts Authorization header OR ?token= query param
  // (query param makes it easy for cron services that can't set custom headers)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  // Parse query token from URL (more reliable than req.query on Vercel)
  let queryToken = '';
  try {
    const parsedUrl = new URL(req.url, 'https://javi-alert.vercel.app');
    queryToken = parsedUrl.searchParams.get('token') || '';
  } catch (_) { /* ignore */ }
  const authorized = !cronSecret ||
    authHeader === `Bearer ${cronSecret}` ||
    queryToken === cronSecret;
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!vapidReady) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  try {
    const database = await getDb();

    // 1. Fetch latest quakes from PHIVOLCS
    const response = await nodeFetch('https://earthquake.phivolcs.dost.gov.ph/', 15000);
    if (!response.ok) throw new Error('PHIVOLCS returned ' + response.status);
    const html = await response.text();
    const quakes = parsePhivolcsTable(html);

    if (!quakes.length) {
      return res.json({ ok: true, message: 'No quakes parsed', sent: 0 });
    }

    // 2. Check what we already notified about
    const tracker = database.collection('cronTracker');
    const lastDoc = await tracker.findOne({ _id: 'lastQuakeId' });
    const lastTime = lastDoc ? (lastDoc.lastTime || 0) : 0;

    // First run ever — set tracker silently, don't notify
    if (!lastTime) {
      await tracker.updateOne(
        { _id: 'lastQuakeId' },
        { $set: { lastTime: quakes[0].time, quakeId: quakes[0].id } },
        { upsert: true }
      );
      return res.json({ ok: true, message: 'First run — tracker set', sent: 0, total: quakes.length });
    }

    // Find quakes genuinely newer than the last notified
    const newQuakes = quakes.filter(q => q.time > lastTime);

    if (!newQuakes.length) {
      return res.json({ ok: true, message: 'No new quakes', sent: 0, total: quakes.length });
    }

    // Only notify about quakes from the last 10 minutes (avoid stale notifications on deploy)
    const cutoff = Date.now() - 600000;
    const freshQuakes = newQuakes.filter(q => q.time > cutoff);

    if (!freshQuakes.length) {
      // Still update tracker to skip stale quakes
      await tracker.updateOne(
        { _id: 'lastQuakeId' },
        { $set: { lastTime: quakes[0].time, quakeId: quakes[0].id } },
        { upsert: true }
      );
      return res.json({ ok: true, message: 'New quakes found but too old to notify', sent: 0 });
    }

    // Only notify for magnitude 3+ (warning/danger level)
    const significantQuakes = freshQuakes.filter(q => q.mag >= 3);
    if (!significantQuakes.length) {
      await tracker.updateOne(
        { _id: 'lastQuakeId' },
        { $set: { quakeId: quakes[0].id, lastTime: quakes[0].time } },
        { upsert: true }
      );
      return res.json({ ok: true, message: 'New quakes found but all below mag 3', sent: 0 });
    }

    // Limit to prevent notification spam — max 5 per cron run
    const toNotify = significantQuakes.slice(0, 5);
    const biggest = toNotify.reduce((a, b) => b.mag > a.mag ? b : a);

    // 3. Filter subscribers by distance to quake
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

    // Only notify subscribers within range of the biggest quake.
    // Subscribers without location data always get notified (legacy fallback).
    const quakeLat = biggest.lat;
    const quakeLon = biggest.lon;
    const notifiedSubs = allSubs.filter(s => {
      if (!s.lat || !s.lon) return true; // no location = always notify
      const dist = getDistance(s.lat, s.lon, quakeLat, quakeLon);
      return shouldNotifyQuake(biggest.mag, dist);
    });

    if (!notifiedSubs.length) {
      await tracker.updateOne(
        { _id: 'lastQuakeId' },
        { $set: { quakeId: quakes[0].id, lastTime: quakes[0].time } },
        { upsert: true }
      );
      return res.json({ ok: true, message: 'No nearby subscribers to notify', sent: 0 });
    }

    const alertType = classifyQuake(biggest);
    const title = 'New earthquake detected';
    const depthInfo = biggest.depth > 0 ? ' · ' + biggest.depth + 'km deep' : '';
    const body = 'Magnitude ' + biggest.mag.toFixed(1) + ' in ' + biggest.place + depthInfo;

    const payload = JSON.stringify({
      title: title,
      body,
      url: '/',
      tag: 'quake-cron-' + Date.now(),
      alertType,
    });

    const results = await Promise.allSettled(
      notifiedSubs.map(s => webpush.sendNotification(s, payload))
    );

    // Clean up invalid subscriptions
    const invalidEndpoints = notifiedSubs
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
      newQuakes: freshQuakes.length,
      biggest: { mag: biggest.mag, place: biggest.place },
    });
  } catch (err) {
    console.error('cron-check error:', err);
    res.status(500).json({ error: err.message });
  }
}
