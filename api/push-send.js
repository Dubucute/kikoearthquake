import { MongoClient } from 'mongodb';
import webpush from 'web-push';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('VAPID keys not set \u2014 push sending disabled');
}

webpush.setVapidDetails(
  'mailto:javi@javi-alert.app',
  vapidPublicKey,
  vapidPrivateKey
);

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
  if (!vapidPublicKey || !vapidPrivateKey) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }
  try {
    const database = await getDb();
    const subs = database.collection('pushSubscriptions');
    const allSubs = await subs.find({}).toArray();
    if (!allSubs.length) {
      return res.json({ sent: 0, total: 0 });
    }
    const payload = JSON.stringify({
      title: req.body.title || 'JaviAlert',
      body: req.body.body || 'May bagong earthquake update!',
      url: req.body.url || '/',
      tag: req.body.tag || 'javi-alert',
      alertType: req.body.alertType || null
    });
    const results = await Promise.allSettled(
      allSubs.map(s => webpush.sendNotification(s, payload))
    );
    const invalidEndpoints = allSubs
      .filter((_, i) => results[i].status === 'rejected')
      .map(s => s.endpoint);
    if (invalidEndpoints.length > 0) {
      await subs.deleteMany({ endpoint: { $in: invalidEndpoints } });
    }
    res.json({
      sent: results.filter(r => r.status === 'fulfilled').length,
      total: allSubs.length
    });
  } catch (err) {
    console.error('push-send error:', err);
    res.status(500).json({ error: err.message });
  }
}
