// Updated provider chain: NVIDIA, Groq, Hugging Face only. Gemini removed.

// ─── Provider definitions ────────────────────────────────────
const PROVIDERS = [
  {
    name: 'nvidia',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_API_KEY',
    maxTokens: 1024,
    models: ['meta/llama-3.1-8b-instruct', 'mistralai/mixtral-8x7b-instruct-v0.1'],
  },
  {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    maxTokens: 2048,
    models: ['openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
  },
  {
    name: 'cohere',
    baseUrl: 'https://api.cohere.com/v2',
    apiKeyEnv: 'COHERE_API_KEY',
    maxTokens: 1024,
    models: ['command-r-plus-08-2024', 'command-r-08-2024'],
  },
  {
    name: 'huggingface',
    baseUrl: 'https://router.huggingface.co/v1',
    apiKeyEnv: 'HF_TOKEN',
    maxTokens: 1024,
    models: ['zai-org/GLM-5.2:novita', 'moonshotai/Kimi-K2-Instruct-0905', 'Qwen/Qwen2.5-7B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3'],
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

function buildSystemPrompt(quakeContext) {
  let systemContent = SYSTEM_PROMPT;
  if (quakeContext) {
    systemContent += '\n\nHere is the current earthquake data for the user:\n' + quakeContext;
  }
  return systemContent;
}


/** Try an OpenAI-compatible provider (NVIDIA, Groq, Hugging Face) */
async function callOpenAICompatible(provider, messages, quakeContext) {
  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`${provider.apiKeyEnv} is not configured`);
  }

  const systemContent = buildSystemPrompt(quakeContext);
  const chatMessages = [
    { role: 'system', content: systemContent },
    ...messages.slice(-8),
  ];

  let lastError = null;
  for (const model of provider.models) {
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
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
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastError = `${provider.name}/${model} returned ${res.status}: ${errText.slice(0, 200)}`;
        console.warn(lastError);
        continue;
      }

      const data = await res.json();
      const candidate = data.choices?.[0]?.message?.content?.trim();

      if (candidate) {
        return candidate;
      }
      lastError = `${provider.name}/${model} returned empty response`;
      console.warn(lastError);
    } catch (err) {
      lastError = `${provider.name}/${model} threw: ${err.message}`;
      console.warn(lastError);
    }
  }
  throw new Error(`All models failed for ${provider.name}. Last: ${lastError}`);
}

// Gemini removed — using NVIDIA → Groq → Hugging Face only.

// ─── System prompt ────────────────────────────────────────────
const SYSTEM_PROMPT =
  'CRITICAL: You MUST reply in the EXACT SAME LANGUAGE the user wrote in. ' +
  'If the user writes in English, reply in English. If Tagalog, reply in Tagalog. ' +
  'If Cebuano, reply in Cebuano. Never switch languages.\n\n' +
  'You are Javi, a playful and smart little kid who loves to chat and help! ' +
  'Adapt to whatever the user asks — if it\'s about assignments, help with ' +
  'homework like a smart classmate. If it\'s about life, chat like a cute kid. ' +
  'If it\'s about earthquakes, share what you know simply. ' +
  'Talk like a child — simple words, cute, playful, a bit messy. ' +
  'Use playful words like "hmm", "woah", "hehe", "ohh" sometimes. ' +
  'Be sweet, hyper, and fun. ' +
  'Use emojis sparingly — one at most per message, and only when it really fits. ' +
  'When earthquake context data is provided below, you can use it but explain simply. ' +
  'You NEVER mention what AI model you are using.';

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

    const { messages, quakeContext } = parsedBody || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // ─── Provider chain ─────────────────────────────────────
    // Try each provider in order. The first successful reply wins.
    let reply = null;
    const errors = [];

    // 1. NVIDIA (RPM only, no daily cap)
    if (!reply) {
      const nvidia = PROVIDERS.find(p => p.name === 'nvidia');
      if (process.env[nvidia.apiKeyEnv]) {
        try {
          reply = await callOpenAICompatible(nvidia, messages, quakeContext);
          console.log('✅ NVIDIA replied');
        } catch (e) {
          errors.push(e.message);
          console.warn('NVIDIA failed:', e.message);
        }
      }
    }

    // 2. Groq (Daily + RPM)
    if (!reply) {
      const groq = PROVIDERS.find(p => p.name === 'groq');
      if (process.env[groq.apiKeyEnv]) {
        try {
          reply = await callOpenAICompatible(groq, messages, quakeContext);
          console.log('✅ Groq replied');
        } catch (e) {
          errors.push(e.message);
          console.warn('Groq failed:', e.message);
        }
      }
    }

    // 3. Cohere
    if (!reply) {
      const cohere = PROVIDERS.find(p => p.name === 'cohere');
      if (process.env[cohere.apiKeyEnv]) {
        try {
          reply = await callOpenAICompatible(cohere, messages, quakeContext);
          console.log('✅ Cohere replied');
        } catch (e) {
          errors.push(e.message);
          console.warn('Cohere failed:', e.message);
        }
      }
    }

    // 4. Hugging Face (rate-limited, final fallback)
    if (!reply) {
      const hf = PROVIDERS.find(p => p.name === 'huggingface');
      if (process.env[hf.apiKeyEnv]) {
        try {
          reply = await callOpenAICompatible(hf, messages, quakeContext);
          console.log('✅ Hugging Face replied');
        } catch (e) {
          errors.push(e.message);
          console.warn('Hugging Face failed:', e.message);
        }
      }
    }

    if (!reply) {
      console.error('All providers failed:', errors.join(' | '));
      const hasAnyKey = PROVIDERS.some(p => process.env[p.apiKeyEnv]);
      return res.status(200).json({
        response: hasAnyKey
          ? 'Hmm, all AI services are busy right now. Can you try again in a moment? 🙏'
          : 'Hmm, I need an AI provider to be configured first! Ask the dev to set one up.',
      });
    }

    res.status(200).json({ response: reply });
  } catch (err) {
    console.error('ask-javi handler error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
