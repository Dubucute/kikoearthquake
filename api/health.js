// ─── Health check — test all configured AI providers ─────────

const PROVIDERS = [
  { name: 'nvidia',       envKey: 'NVIDIA_API_KEY',              url: 'https://integrate.api.nvidia.com/v1/models' },
  { name: 'groq',         envKey: 'GROQ_API_KEY',                url: 'https://api.groq.com/openai/v1/models' },
  { name: 'google',       envKey: 'GOOGLE_AI_STUDIO_API_KEY',     url: 'https://generativelanguage.googleapis.com/v1beta/models', extraKey: 'GEMINI_API_KEY' },
  { name: 'huggingface',  envKey: 'HF_TOKEN',                    url: 'https://router.huggingface.co/v1/models' },
];

export default async function handler(req, res) {
  const results = [];

  for (const p of PROVIDERS) {
    const key = process.env[p.envKey] || (p.extraKey && process.env[p.extraKey]);
    if (!key) {
      results.push({ provider: p.name, configured: false, status: 'skipped — no key' });
      continue;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(p.url, {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      results.push({
        provider: p.name,
        configured: true,
        status: response.ok ? 'ok' : `error ${response.status}`,
      });
    } catch (err) {
      results.push({
        provider: p.name,
        configured: true,
        status: err.name === 'AbortError' ? 'timeout' : `error — ${err.message}`,
      });
    }
  }

  const allOk = results.every(r => r.status === 'ok' || r.status.startsWith('skipped'));

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(allOk ? 200 : 200).json({
    healthy: allOk,
    providers: results,
    timestamp: new Date().toISOString(),
  });
}
