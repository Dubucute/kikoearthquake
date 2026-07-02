export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}
