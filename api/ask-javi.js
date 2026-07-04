// ─── Ask Javi — Hugging Face Inference API proxy ────────────
// The HF_TOKEN is stored as a Vercel environment variable,
// NOT in client-side code. Never commit the key to GitHub.

const MODEL_URL = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct";

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

// ─── Qwen prompt builder (chat template format) ───────────────
function buildPrompt(messages) {
  const systemPrompt = 'You are Javi, a friendly earthquake safety buddy from the JaviAlert app. ' +
    'Keep answers SHORT (2-3 sentences max), helpful, and focused on earthquake safety, preparedness, and science. ' +
    'If asked about non-earthquake topics, gently remind them you are an earthquake safety buddy. ' +
    'You NEVER mention what AI model you are using, never say "Qwen" or "AI model" or "Mistral". ' +
    'Respond in the SAME LANGUAGE the user used (Tagalog, Cebuano, or English). ' +
    'Use a warm, caring tone like a Filipino friend. Always prioritize safety advice.';

  let prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;

  // Add conversation history (last 6 messages for context)
  const recentMessages = messages.slice(-6);
  for (const msg of recentMessages) {
    if (msg.role === 'user') {
      prompt += `<|im_start|>user\n${msg.content}<|im_end|>\n`;
    } else if (msg.role === 'assistant') {
      prompt += `<|im_start|>assistant\n${msg.content}<|im_end|>\n`;
    }
  }

  // Final assistant turn — model generates from here
  prompt += `<|im_start|>assistant\n`;

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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key is configured
  const apiKey = process.env.HF_TOKEN;
  if (!apiKey) {
    console.error('HF_TOKEN not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const prompt = buildPrompt(messages);

    const hfRes = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 250,
          temperature: 0.7,
          repetition_penalty: 1.1,
          return_full_text: false,
          do_sample: true,
        }
      })
    });

    if (!hfRes.ok) {
      const errText = await hfRes.text().catch(() => 'Unknown error');
      console.error('HF API error:', hfRes.status, errText);
      return res.status(502).json({ error: 'AI service unavailable' });
    }

    const data = await hfRes.json();

    // Parse response — HF inference API returns [{ generated_text: ... }]
    let reply = data[0]?.generated_text || '';

    // Clean up Qwen chat template artifacts
    if (reply.includes('<|im_start|>assistant\n')) {
      reply = reply.split('<|im_start|>assistant\n').pop().replace('<|im_end|>', '').trim();
    }
    reply = reply.replace(/<\|im_end\|>/g, '').trim();

    if (!reply) {
      reply = 'Sorry, wala akong maisip na sagot ngayon. Puwede mo bang ulitin ang tanong mo?';
    }

    res.status(200).json({ response: reply });
  } catch (err) {
    console.error('ask-javi handler error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
