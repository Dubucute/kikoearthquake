// ─── API & CONFIG ────────────────────────────────────────────
export const API = {
  USGS: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
  NOMINATIM: 'https://nominatim.openstreetmap.org/reverse',
  NOMINATIM_SEARCH: 'https://nominatim.openstreetmap.org/search'
};

export const CONFIG = {
  QUAKE_LIMIT: 25,
  MIN_MAGNITUDE: 1,
  DISPLAY_COUNT: 10,
  AUTO_REFRESH_MS: 300000,
  DANGER_THRESHOLD: 4.0,
  WARNING_THRESHOLD: 3.0,
  DANGER_WINDOW_MS: 21600000,
  WARNING_WINDOW_MS: 86400000,
  TODAY_WINDOW_MS: 86400000,
  DANGER_DIST_KM: 120,
  SHALLOW_DEPTH_KM: 70,
  DEEP_DEPTH_KM: 150
};

// ─── HELPER FUNCTIONS ────────────────────────────────────────
export function timeSince(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + 'd ago';
  return Math.floor(days / 30) + 'mo ago';
}

export function getCompassDir(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x = Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
            Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(brng / 22.5) % 16];
}

export function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function parsePlaceName(raw) {
  // USGS format:         "20 km SSW of La Paz, Philippines"
  // PHIVOLCS format:     "029 km N 74° E of Sablayan (Occidental Mindoro)"
  const match = raw.match(/^([\d.]+)\s*km\s+(.+?)\s+of\s+(.+)$/i);
  if (match) {
    return {
      distance: parseFloat(match[1]),
      direction: match[2].trim().toUpperCase(),
      place: match[3].trim()
    };
  }
  return { distance: null, direction: null, place: raw };
}

export function magClass(mag) {
  if (mag < 3) return 'mag-low';
  if (mag < 4) return 'mag-minor';
  if (mag < 5) return 'mag-moderate';
  if (mag < 6) return 'mag-strong';
  return 'mag-major';
}

// ─── PHIVOLCS INTENSITY ESTIMATOR ──────────────────────────────
// Estimates PEIS intensity from magnitude + distance using empirical
// approximation: felt intensity ≈ mag − log10(distance) − 1.0

export const PEIS_LABELS = [
  '',               // 0 (unused)
  'I — Scarcely Perceptible',
  'II — Slightly Felt',
  'III — Weak',
  'IV — Moderately Strong',
  'V — Strong',
  'VI — Very Strong',
  'VII — Destructive',
  'VIII — Very Destructive',
  'IX — Devastating',
  'X — Completely Devastating'
];

export const PEIS_SHORT = [
  '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
];

export function getPHIVOLCSIntensity(mag, distanceKm) {
  // Empirical approximation based on PHIVOLCS/USGS intensity-distance tables
  // MMI ≈ 1.0 + 1.5 × Mag − 2.0 × log₁₀(Distance)
  const dist = Math.max(distanceKm, 1); // avoid log(0)
  const felt = 1.0 + 1.5 * mag - 2.0 * Math.log10(dist);
  const level = Math.round(Math.max(1, Math.min(10, felt)));
  return level;
}

export function intensityClass(intensity) {
  if (intensity <= 2) return 'intensity-low';
  if (intensity <= 4) return 'intensity-moderate';
  if (intensity <= 6) return 'intensity-strong';
  return 'intensity-extreme';
}

export function shouldShowQuake(mag, distKm) {
  // Tiered filter: larger quakes shown from further away
  if (mag >= 5.0) return true;         // Always show major quakes
  if (mag >= 4.0 && distKm <= 300) return true;  // Strong quakes
  if (mag >= 3.0 && distKm <= 200) return true;  // Moderate quakes
  if (mag >= 2.0 && distKm <= 100) return true;  // Small quakes
  if (distKm <= 50) return true;      // Very near quakes regardless of mag
  return false;
}
