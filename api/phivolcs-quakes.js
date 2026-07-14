/**
 * PHIVOLCS Earthquake Data Proxy
 *
 * Fetches the PHIVOLCS earthquake listing page, parses the HTML table,
 * and returns data in a GeoJSON-like format matching USGS structure.
 *
 * This is the PRIMARY data source — more accurate for PH earthquakes.
 * USGS is used as fallback.
 *
 * NOTE: Uses Node.js built-in https module instead of fetch because
 * Vercel's fetch (undici) has connectivity issues with PHIVOLCS server.
 */

import https from 'https';
import http from 'http';

const PHIVOLCS_HOST = 'earthquake.phivolcs.dost.gov.ph';
const PHIVOLCS_PATH = '/';
const BASE_URL = 'https://earthquake.phivolcs.dost.gov.ph/';
const FETCH_TIMEOUT_MS = 15000;

/**
 * Fetch a URL using Node's built-in http/https module.
 * More reliable for older servers than the global fetch().
 */
function nodeFetch(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      rejectUnauthorized: false,  // PHIVOLCS uses a non-standard/self-signed cert
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: () => data,
        });
      });
    });
    req.on('error', (err) => reject(new Error(`Request failed: ${err.message}`, { cause: err })));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=120');

  try {
    const response = await nodeFetch('https://' + PHIVOLCS_HOST + PHIVOLCS_PATH, FETCH_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`PHIVOLCS returned ${response.status}`);
    }

    const html = await response.text();
    const features = parsePhivolcsTable(html);

    res.status(200).json({ features });
  } catch (err) {
    console.error('PHIVOLCS fetch error:', err.message);
    // Return empty features so the app can fall back to USGS
    res.status(200).json({ features: [], _error: err.message });
  }
}

/**
 * Parse the PHIVOLCS HTML table into GeoJSON-like feature objects.
 */
function parsePhivolcsTable(html) {
  const features = [];

  // Split into table rows
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

  for (const rowMatch of rowMatches) {
    const row = rowMatch[1];

    // Skip header rows (contain <th>)
    if (row.includes('<th')) continue;

    // Extract date link — try multiple patterns
    let href = '';
    let dateStr = '';

    // Pattern 1: <a href="..."><span class="auto-style99">DATE</span></a>
    const linkMatch1 = row.match(/<a[^>]+href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="auto-style99"[^>]*>([^<]*)<\/span>/i);
    if (linkMatch1) {
      href = linkMatch1[1].trim();
      dateStr = linkMatch1[2].trim();
    } else {
      // Pattern 2: just extract the first <a> tag's href and text directly
      const linkMatch2 = row.match(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/i);
      if (linkMatch2) {
        href = linkMatch2[1].trim();
        dateStr = linkMatch2[2].trim();
      } else {
        // Pattern 3: extract from first td cell as fallback
        const tdMatches = row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        const cells = [];
        for (const td of tdMatches) {
          const text = stripHtml(td[1]);
          if (text) cells.push(text);
        }
        // Try to find a date-like string in the first cell
        if (cells.length > 0 && /^\d+\s+\w+\s+\d+/.test(cells[0])) {
          dateStr = cells[0];
          // Also try to find href in the first cell
          const hrefMatch = row.match(/<a[^>]+href="([^"]*)"[^>]*>/i);
          if (hrefMatch) href = hrefMatch[1].trim();
        }
      }
    }

    if (!href || !dateStr) continue;

    // Extract all <td> cells
    const tdMatches = row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    const cells = [];
    for (const td of tdMatches) {
      cells.push(td[1]);
    }

    // Need at least 6 cells: date, lat, lon, depth, mag, location
    if (cells.length < 6) continue;

    // Parse coordinates and magnitude
    const lat = parseFloat(stripHtml(cells[1]).trim());
    const lon = parseFloat(stripHtml(cells[2]).trim());
    const depth = parseInt(stripHtml(cells[3]).trim(), 10);
    const mag = parseFloat(stripHtml(cells[4]).trim());
    const locationRaw = stripHtml(cells[5]).trim();

    // Validate required fields
    if (isNaN(lat) || isNaN(lon) || isNaN(mag)) continue;

    // Parse date as Philippine Time (UTC+8)
    const time = parsePhivolcsDate(dateStr);
    if (!time) continue;

    // Build absolute URL
    const url = href.startsWith('http') ? href : BASE_URL + href.replace(/\\/g, '/');

    // Generate a stable ID from the URL path
    const id = 'ph-' + href.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    features.push({
      type: 'Feature',
      id,
      properties: {
        mag,
        place: locationRaw,
        time: time.getTime(),
        url,
      },
      geometry: {
        type: 'Point',
        coordinates: [lon, lat, isNaN(depth) ? 0 : depth],
      },
    });
  }

  return features;
}

/**
 * Strip HTML tags, returning only text content.
 */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
}

/**
 * Parse PHIVOLCS date format: "05 July 2026 - 02:52 PM"
 * Returns Date object (UTC-corrected from Philippine Time UTC+8).
 */
function parsePhivolcsDate(str) {
  const match = str.match(/^(\d+)\s+(\w+)\s+(\d+)\s*-\s*(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const monthStr = match[2];
  const year = parseInt(match[3], 10);
  let hour = parseInt(match[4], 10);
  const min = parseInt(match[5], 10);
  const ampm = match[6].toUpperCase();

  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const month = months[monthStr.toLowerCase()];
  if (month === undefined) return null;

  // Philippine Time is UTC+8 — store as UTC internally
  return new Date(Date.UTC(year, month, day, hour - 8, min));
}
