export default async function handler(req, res) {
  const results = { env: {}, dns: null, fetchHF: null, fetchGoogle: null, error: null };

  // Check env vars (masked)
  results.env.HF_TOKEN_EXISTS = !!process.env.HF_TOKEN;
  results.env.HF_TOKEN_LENGTH = process.env.HF_TOKEN ? process.env.HF_TOKEN.length : 0;
  results.env.NODE_VERSION = process.version;

  // Test 1: DNS resolution
  try {
    const dns = await import('node:dns');
    await dns.promises.lookup('api-inference.huggingface.co');
    results.dns = 'ok';
  } catch (err) {
    results.dns = err.message;
  }

  // Test 2: Fetch to Google (basic connectivity)
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const r = await fetch('https://google.com', { signal: controller.signal });
    clearTimeout(t);
    results.fetchGoogle = { status: r.status, ok: r.ok };
  } catch (err) {
    results.fetchGoogle = 'FAILED: ' + err.message + ' (' + err.name + ')';
  }

  // Test 3: Fetch to Hugging Face
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    const testRes = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + (process.env.HF_TOKEN || ''),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: 'hello', parameters: { max_new_tokens: 5, return_full_text: false } }),
      signal: controller.signal,
    });
    clearTimeout(t);
    results.fetchHF = { status: testRes.status, ok: testRes.ok, statusText: testRes.statusText };
  } catch (err) {
    results.fetchHF = 'FAILED: ' + err.message + ' (' + err.name + ')';
  }

  res.status(200).json(results);
}
