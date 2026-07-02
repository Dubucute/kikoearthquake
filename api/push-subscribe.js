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
  try {
    const database = await getDb();
    const subs = database.collection('pushSubscriptions');
    const newSub = req.body;
    const exists = await subs.findOne({ endpoint: newSub.endpoint });
    if (!exists) {
      await subs.insertOne({ ...newSub, createdAt: new Date() });
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
