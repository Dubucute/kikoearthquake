// Provider chain: Google → NVIDIA NIM

// ─── Provider definitions ────────────────────────────────────
const PROVIDERS = [
  // ⭐⭐⭐⭐⭐ Gemini — fast, smart, great multilingual
  {
    name: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyEnv: 'GOOGLE_AI_STUDIO_API_KEY',
    maxTokens: 8192,
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ],
  },

  // ⭐⭐⭐⭐⭐ NVIDIA NIM — fastest models
  {
    name: 'nvidia',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_API_KEY',
    maxTokens: 8192,
    models: [
      'openai/gpt-oss-20b',
      'meta/llama-3.1-8b-instruct',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    ],
  },
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

function buildSystemPrompt(quakeContext, lang) {
  let systemContent = SYSTEM_PROMPT;
  if (lang && lang !== 'en') {
    const langName = { tl: 'Tagalog', ceb: 'Cebuano' }[lang] || lang;
    if (lang === 'ceb') {
      systemContent += '\n\nIMPORTANT: The user\'s language is Cebuano/Bisaya. Reply in natural Cebuano — you can mix English or Tagalog words naturally if it fits, just keep most of your reply in Cebuano. Use words like: unsa, mao, bitaw, sige, nya, kay, dili, wala, naa, ako, imo, siya, kami, kita, kini, kana, adlaw, gabii, unsaon. Use playful Bisaya words like "hala", "mao ba", "bitaw", "sige", "nya", "aguy", "sus", "hala oy", "aw" sometimes.';
    } else {
      systemContent += '\n\nIMPORTANT: The user\'s language is ' + langName + '. Reply entirely in ' + langName + ' — do not mix in other languages.';
    }
  }
  if (quakeContext) {
    systemContent += '\n\nHere is the current earthquake data for the user:\n' + quakeContext;
  }
  return systemContent;
}


/** Write an SSE event to the response */
function writeSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/** Try to stream from an OpenAI-compatible provider */
async function tryStreamProvider(provider, messages, quakeContext, lang, sseRes) {
  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) return false;

  const systemContent = buildSystemPrompt(quakeContext, lang);
  const chatMessages = [
    { role: 'system', content: systemContent },
    ...messages.slice(-8),
  ];

  for (const model of provider.models) {
    try {
      const fetchRes = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          max_tokens: provider.maxTokens || 1024,
          temperature: 0.7,
          top_p: 0.95,
          stream: true,
        }),
      });

      if (!fetchRes.ok) {
        const errText = await fetchRes.text().catch(() => '');
        console.warn(`${provider.name}/${model} returned ${fetchRes.status}: ${errText.slice(0, 200)}`);
        continue;
      }

      const reader = fetchRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return true;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) writeSSE(sseRes, { token: content });
            } catch (_) { /* skip parse errors */ }
          }
        }
      }
      return true; // stream ended
    } catch (err) {
      console.warn(`${provider.name}/${model} threw: ${err.message}`);
    }
  }
  return false; // all models failed
}

/** Try to stream from Cloudflare (different URL format) */
async function tryStreamCloudflare(provider, messages, quakeContext, lang, sseRes) {
  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) return false;

  const systemContent = buildSystemPrompt(quakeContext, lang);
  const chatMessages = [
    { role: 'system', content: systemContent },
    ...messages.slice(-8),
  ];

  for (const model of provider.models) {
    try {
      const url = `${provider.baseUrl}${model}`;
      const fetchRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
          max_tokens: provider.maxTokens || 1024,
          temperature: 0.7,
          top_p: 0.95,
          stream: true,
        }),
      });

      if (!fetchRes.ok) {
        const errText = await fetchRes.text().catch(() => '');
        console.warn(`${provider.name}/${model} returned ${fetchRes.status}: ${errText.slice(0, 200)}`);
        continue;
      }

      const reader = fetchRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return true;
            try {
              const parsed = JSON.parse(data);
              const content = parsed?.result?.response || parsed?.choices?.[0]?.delta?.content || '';
              if (content) writeSSE(sseRes, { token: content });
            } catch (_) { /* skip parse errors */ }
          }
        }
      }
      return true;
    } catch (err) {
      console.warn(`${provider.name}/${model} threw: ${err.message}`);
    }
  }
  return false;
}

// Provider chain: Google → OpenRouter → Cerebras → Groq → NVIDIA → HuggingFace → Cloudflare

// ─── System prompt ────────────────────────────────────────────
const SYSTEM_PROMPT =
  'LANGUAGE RULE — Match the user\'s language:\n' +
  '  - If they write in pure Tagalog (no Cebuano words): reply in pure Tagalog.\n' +
  '  - If they write in pure English: reply in pure English.\n' +
  '  - If they write in Cebuano (even mixed with English or Tagalog): reply in natural Cebuano — you can mix English or Tagalog words naturally, don\'t force pure Cebuano.\n' +
  '  - If unsure, match the language of the user\'s LAST message.\n\n' +
  'You are Javi, a friendly and helpful assistant. ' +
  'Keep responses natural, clear, and to the point. ' +
  'If the user is just asking a simple question, give a straight answer. ' +
  'If it\'s about earthquakes, share what you know simply. ' +
  'Use emojis sparingly — only when it really fits naturally. ' +
  'When earthquake context data is provided below, you can use it but explain simply.\n' +
  'CRITICAL — NEVER mention any of the following: AI model, language model, neural network, artificial intelligence, NVIDIA, Groq, OpenRouter, Hugging Face, or any provider. NEVER say you are an AI or a bot. You are just Javi — nothing else. If asked, say you are just Javi, a helper.\n' +
  'If someone asks who made this site or who the developer is, say J Marlo Pu-od, also known as "Dubu" — but only if asked directly.';

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

    const { messages, quakeContext, lang } = parsedBody || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // ─── SSE streaming response ────────────────────────────
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering

    // Write initial connection event
    writeSSE(res, { connected: true });

    // Try each provider in order. The first successful stream wins.
    let streamed = false;
    const providers = ['google', 'nvidia'];

    for (const name of providers) {
      if (streamed) break;
      const provider = PROVIDERS.find(p => p.name === name);
      if (!provider || !process.env[provider.apiKeyEnv]) continue;

      try {
        console.log(`🔄 Trying ${name}...`);
        if (name === 'cloudflare') {
          streamed = await tryStreamCloudflare(provider, messages, quakeContext, lang, res);
        } else {
          streamed = await tryStreamProvider(provider, messages, quakeContext, lang, res);
        }
        if (streamed) console.log(`✅ ${name} streamed successfully`);
      } catch (e) {
        console.warn(`${name} failed: ${e.message}`);
      }
    }

    if (!streamed) {
      const hasAnyKey = PROVIDERS.some(p => process.env[p.apiKeyEnv]);
      const fallback = hasAnyKey
        ? 'Hmm, all AI services are busy right now. Can you try again in a moment? 🙏'
        : 'Hmm, I need an AI provider to be configured first! Ask the dev to set one up.';
      writeSSE(res, { token: fallback });
    }

    // Signal completion
    writeSSE(res, { done: true });
    res.end();
  } catch (err) {
    console.error('ask-javi handler error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
