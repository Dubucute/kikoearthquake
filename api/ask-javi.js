// ─── Ask Javi — Hugging Face Inference API proxy ────────────
// The HF_API_KEY is stored as a Vercel environment variable,
// NOT in client-side code. Never commit the key to GitHub.

const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3';

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

// ─── Mistral prompt builder ───────────────────────────────────
function buildPrompt(messages) {
  const systemPrompt = 'You are Javi, a friendly earthquake safety buddy from the JaviAlert app. ' +
    'Keep answers SHORT (2-3 sentences max), helpful, and focused on earthquake safety, preparedness, and science. ' +
    'If asked about non-earthquake topics, gently remind them you are an earthquake safety buddy. ' +
    'You NEVER mention what AI model you are using, never say "Mistral" or "AI model". ' +
    'Respond in the SAME LANGUAGE the user used (Tagalog, Cebuano, or English). ' +
    'Use a warm, caring tone like a Filipino friend. Always prioritize safety advice.';

  let prompt = '<s>[INST] ' + systemPrompt + ' [/INST]Okay, naiintindihan ko! Handa akong sumagot tungkol sa kaligtasan sa lindol.</s>';

  // Add conversation history (last 6 messages for context)
  const recentMessages = messages.slice(-6);
  for (const msg of recentMessages) {
    if (msg.role === 'user') {
      prompt += '\n[INST] ' + msg.content + ' [/INST]';
    } else if (msg.role === 'assistant') {
      prompt += ' ' + msg.content + '</s>';
    }
  }

  return prompt;
}

// ─── Handler ──────────────────────────────────────────────────
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  setCorsHeaders(res, origin);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Check API key is configured
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    console.error('HF_API_KEY not set in environment variables');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    const prompt = buildPrompt(messages);

    const hfRes = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 256,
          temperature: 0.7,
          top_p: 0.95,
          return_full_text: false,
          do_sample: true,
        }
      })
    });

    if (!hfRes.ok) {
      const errText = await hfRes.text().catch(() => 'Unknown error');
      console.error('HF API error:', hfRes.status, errText);
      res.status(502).json({ error: 'AI service unavailable' });
      return;
    }

    const data = await hfRes.json();

    // Parse response — HF inference API returns [{ generated_text: ... }]
    if (Array.isArray(data) && data.length > 0) {
      let text = data[0].generated_text || '';
      text = text.trim();
      text = text.replace(/<\/s>$/g, '').trim();

      if (!text) {
        text = 'Sorry, wala akong maisip na sagot ngayon. Puwede mo bang ulitin ang tanong mo?';
      }

      res.status(200).json({ response: text });
    } else {
      console.error('Unexpected HF response format:', JSON.stringify(data).slice(0, 200));
      res.status(502).json({ error: 'Unexpected response format from AI service' });
    }
  } catch (err) {
    console.error('ask-javi handler error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
