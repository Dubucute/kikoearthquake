import { getDb } from './_db.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, req.headers.origin);
    return res.status(204).end();
  }

  if (req.method === 'DELETE') {
    try {
      const database = await getDb();
      const subs = database.collection('pushSubscriptions');
      const target = req.body;
      if (target && target.endpoint) {
        await subs.deleteOne({ endpoint: target.endpoint });
      }
      setCorsHeaders(res, req.headers.origin);
      return res.json({ ok: true });
    } catch (err) {
      console.error('unsubscribe error:', err);
      setCorsHeaders(res, req.headers.origin);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') {
    setCorsHeaders(res, req.headers.origin);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const database = await getDb();
    const subs = database.collection('pushSubscriptions');
    const newSub = req.body;
    const { lat, lon } = req.body; // user's location for distance-based filtering
    const subData = {
      endpoint: newSub.endpoint,
      keys: newSub.keys,
      lat: lat || null,
      lon: lon || null,
      createdAt: new Date()
    };
    const exists = await subs.findOne({ endpoint: newSub.endpoint });
    if (!exists) {
      await subs.insertOne(subData);
    } else {
      // Update location in case user moved
      await subs.updateOne(
        { endpoint: newSub.endpoint },
        { $set: { lat: lat || null, lon: lon || null } }
      );
    }
    const count = await subs.countDocuments();
    setCorsHeaders(res, req.headers.origin);
    res.json({ ok: true, count });
  } catch (err) {
    console.error('subscribe error:', err);
    setCorsHeaders(res, req.headers.origin);
    res.status(500).json({ error: err.message });
  }
}
