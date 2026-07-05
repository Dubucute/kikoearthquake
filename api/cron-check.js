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
    if (!row.includes('auto-style99') || row.includes('<th')) continue;
    const linkMatch = row.match(/<a[^>]+href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="auto-style99"[^>]*>([^<]*)<\/span>/i);
    if (!linkMatch) continue;
    const href = linkMatch[1].trim();
    const dateStr = linkMatch[2].trim();
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
