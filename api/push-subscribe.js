import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function getDb() {
  if (!db) {
    await client.connect();
    db = client.db('javi-alert');
  }
  return db;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
    res.json({ ok: true, count });
  } catch (err) {
    console.error('subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
}
