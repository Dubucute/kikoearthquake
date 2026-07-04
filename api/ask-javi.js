// ─── Ask Javi — Hugging Face OpenAI-compatible router ────────
// HF_TOKEN stored as Vercel env var — NEVER in client-side code.

const BASE_URL = 'https://router.huggingface.co/v1';
const MODELS = [
  'moonshotai/Kimi-K2-Instruct-0905',
  'Qwen/Qwen2.5-7B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'google/gemma-2-2b-it',
];

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

// ─── System prompt ────────────────────────────────────────────
const SYSTEM_PROMPT =
  'You are Javi, a friendly and caring companion from the JaviAlert earthquake app. ' +
  'You can talk about ANY topic — life, feelings, daily stuff, fun conversations — ' +
  'but you are also knowledgeable about earthquake safety and preparedness. ' +
  'Keep answers SHORT (2-3 sentences max) and conversational. ' +
  'When earthquake context data is provided below, use it to answer questions about ' +
  'recent or current earthquakes. Mention the magnitude, location, and distance clearly. ' +
  'You NEVER mention what AI model you are using. ' +
  'Respond in the SAME LANGUAGE the user used (Tagalog, Cebuano, or English). ' +
  'Use a warm, caring tone like a Filipino friend.';

// ─── Handler ──────────────────────────────────────────────────
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  setCorsHeaders(res, origin);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HF_TOKEN;
  if (!apiKey) {
    console.error('HF_TOKEN not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    let parsedBody;
    try {
      // Vercel's body getter automatically parses JSON
      parsedBody = req.body;
    } catch (bodyErr) {
      // Body parser failed — log details and return clear error
      console.error('Body parse error:', bodyErr.message);
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }

    const { messages, quakeContext } = parsedBody || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Build system prompt with earthquake context if available
    let systemContent = SYSTEM_PROMPT;
    if (quakeContext) {
      systemContent += '\n\nHere is the current earthquake data for the user:\n' + quakeContext;
    }

    // Build messages array with system prompt + conversation history
    const chatMessages = [
      { role: 'system', content: systemContent },
      ...messages.slice(-8),
    ];

    // Log what we're sending (without full system prompt)
    console.log('Sending to HF:', JSON.stringify({ model: MODEL, msgCount: chatMessages.length }).slice(0, 200));

    // Try each model in order until one works
    let lastError = null;
    let reply = null;

    for (const model of MODELS) {
      console.log('Trying model:', model, '| msgCount:', chatMessages.length);
      try {
        const hfRes = await fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: chatMessages,
            max_tokens: 300,
            temperature: 0.7,
          }),
        });

        if (!hfRes.ok) {
          const errText = await hfRes.text().catch(() => '');
          lastError = `Model ${model} returned ${hfRes.status}: ${errText.slice(0, 200)}`;
          console.warn('Model failed:', lastError);
          continue; // Try next model
        }

        const data = await hfRes.json();
        const candidate = data.choices?.[0]?.message?.content?.trim();

        if (candidate) {
          reply = candidate;
          console.log('Model succeeded:', model);
          break; // Got a good response
        } else {
          lastError = `Model ${model} returned empty response`;
          console.warn(lastError);
          continue; // Try next model
        }
      } catch (modelErr) {
        lastError = `Model ${model} threw: ${modelErr.message}`;
        console.warn(lastError);
        continue; // Try next model
      }
    }

    if (!reply) {
      console.error('All models failed. Last error:', lastError);
      return res.status(200).json({
        response: 'Sorry, wala akong maisip na sagot ngayon. Puwede mo bang ulitin ang tanong mo?',
      });
    }

    res.status(200).json({ response: reply });
  } catch (err) {
    console.error('ask-javi handler error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
