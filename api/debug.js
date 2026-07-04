export default async function handler(req, res) {
  const results = { env: {}, dns: {}, fetch: {}, error: null };

  // Check env vars (masked)
  results.env.HF_TOKEN_EXISTS = !!process.env.HF_TOKEN;
  results.env.HF_TOKEN_LENGTH = process.env.HF_TOKEN ? process.env.HF_TOKEN.length : 0;
  results.env.NODE_VERSION = process.version;

  const dns = await import('node:dns');

  // DNS tests
  for (const host of ['api-inference.huggingface.co', 'router.huggingface.co', 'huggingface.co']) {
    try {
      await dns.promises.lookup(host);
      results.dns[host] = 'ok';
    } catch (err) {
      results.dns[host] = err.message;
    }
  }

  // Fetch tests
  for (const url of ['https://google.com', 'https://huggingface.co', 'https://router.huggingface.co/v1/models']) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(url, {
        method: url.includes('v1/models') ? 'GET' : 'GET',
        headers: url.includes('router') ? { 'Authorization': 'Bearer ' + (process.env.HF_TOKEN || '') } : {},
        signal: controller.signal,
      });
      clearTimeout(t);
      results.fetch[url] = { status: r.status, ok: r.ok };
    } catch (err) {
      results.fetch[url] = 'FAILED: ' + err.message + ' (' + err.name + ')';
    }
  }

  res.status(200).json(results);
}
