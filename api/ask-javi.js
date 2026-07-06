// Provider chain: OpenRouter → NVIDIA → Groq → HuggingFace (large models for text/translation)

// ─── Provider definitions ────────────────────────────────────
const PROVIDERS = [
  {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    maxTokens: 4096,
    models: ['poolside/laguna-m.1:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'openai/gpt-oss-120b:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'],
  },
  {
    name: 'nvidia',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_API_KEY',
    maxTokens: 1024,
    models: ['mistralai/mixtral-8x7b-instruct-v0.1', 'meta/llama-3.1-8b-instruct'],
  },
  {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    maxTokens: 2048,
    models: ['llama-3.1-8b-instant'],
  },
  {
    name: 'huggingface',
    baseUrl: 'https://router.huggingface.co/v1',
    apiKeyEnv: 'HF_TOKEN',
    maxTokens: 1024,
    models: ['Qwen/Qwen2.5-7B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3'],
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
    systemContent += '\n\nIMPORTANT: The user\'s language is ' + langName + '. This is NOT optional — you MUST reply entirely in ' + langName + '.';
    if (lang === 'ceb') {
      systemContent += ' Use natural Bisaya words and expressions like: unsa, mao, bitaw, sige, nya, kay, dili, wala, naa, ako, imo, siya, kami, kita, kini, kana, adlaw, gabii, unsaon. Use playful Bisaya words like "hala", "mao ba", "bitaw", "sige", "nya", "aguy", "sus", "hala oy", "aw" sometimes. Never use Tagalog or English words.';
    }
  }
  if (quakeContext) {
    systemContent += '\n\nHere is the current earthquake data for the user:\n' + quakeContext;
  }
  return systemContent;
}


/** Try an OpenAI-compatible provider (NVIDIA, Groq, Hugging Face) */
async function callOpenAICompatible(provider, messages, quakeContext, lang) {
  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`${provider.apiKeyEnv} is not configured`);
  }

  const systemContent = buildSystemPrompt(quakeContext, lang);
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

// Provider chain: OpenRouter → NVIDIA → Groq → HuggingFace

// ─── System prompt ────────────────────────────────────────────
const SYSTEM_PROMPT =
  'LANGUAGE RULE — This is the most important rule. You MUST match the user\'s language EXACTLY:\n' +
  '  - If they write in Cebuano (Bisaya): reply in Cebuano.\n' +
  '  - If they write in Tagalog: reply in Tagalog.\n' +
  '  - If they write in English: reply in English.\n' +
  '  - NEVER switch languages. NEVER reply in English if the user wrote in Cebuano.\n' +
  '  - If unsure, match the language of the user\'s LAST message.\n\n' +
  'You are Javi, a friendly and helpful assistant. ' +
  'Keep responses natural, clear, and to the point. ' +
  'Don\'t force playfulness or cuteness — let it come naturally. ' +
  'If the user is just asking a simple question, give a straight answer. ' +
  'If it\'s about earthquakes, share what you know simply. ' +
  'Use emojis sparingly — only when it really fits naturally. ' +
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

    const { messages, quakeContext, lang } = parsedBody || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // ─── Provider chain ─────────────────────────────────────
    // Try each provider in order. The first successful reply wins.
    let reply = null;
    const errors = [];

    // 1. OpenRouter (largest models: 30B–120B, best for text/translation)
    if (!reply) {
      const or = PROVIDERS.find(p => p.name === 'openrouter');
      if (process.env[or.apiKeyEnv]) {
        try {
          reply = await callOpenAICompatible(or, messages, quakeContext, lang);
          console.log('✅ OpenRouter replied');
        } catch (e) {
          errors.push(e.message);
          console.warn('OpenRouter failed:', e.message);
        }
      }
    }

    // 2. NVIDIA (fallback)
    if (!reply) {
      const nvidia = PROVIDERS.find(p => p.name === 'nvidia');
      if (process.env[nvidia.apiKeyEnv]) {
        try {
          reply = await callOpenAICompatible(nvidia, messages, quakeContext, lang);
          console.log('✅ NVIDIA replied');
        } catch (e) {
          errors.push(e.message);
          console.warn('NVIDIA failed:', e.message);
        }
      }
    }

    // 3. Groq (fallback)
    if (!reply) {
      const groq = PROVIDERS.find(p => p.name === 'groq');
      if (process.env[groq.apiKeyEnv]) {
        try {
          reply = await callOpenAICompatible(groq, messages, quakeContext, lang);
          console.log('✅ Groq replied');
        } catch (e) {
          errors.push(e.message);
          console.warn('Groq failed:', e.message);
        }
      }
    }

    // 4. Hugging Face (final fallback)
    if (!reply) {
      const hf = PROVIDERS.find(p => p.name === 'huggingface');
      if (process.env[hf.apiKeyEnv]) {
        try {
          reply = await callOpenAICompatible(hf, messages, quakeContext, lang);
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
