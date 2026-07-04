export default async function handler(req, res) {
  const results = { env: {}, chatTest: {} };

  results.env.HF_TOKEN_EXISTS = !!process.env.HF_TOKEN;
  results.env.HF_TOKEN_LENGTH = process.env.HF_TOKEN ? process.env.HF_TOKEN.length : 0;
  results.env.NODE_VERSION = process.version;

  // Test chat completions with Qwen
  for (const model of ['Qwen/Qwen2.5-7B-Instruct', 'moonshotai/Kimi-K2-Instruct-0905']) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      const r = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + (process.env.HF_TOKEN || ''),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say hello in 2 words' }],
          max_tokens: 20,
        }),
        signal: controller.signal,
      });
      clearTimeout(t);
      const text = await r.text();
      results.chatTest[model] = {
        status: r.status,
        ok: r.ok,
        body: text.slice(0, 300),
      };
    } catch (err) {
      results.chatTest[model] = 'FAILED: ' + err.message;
    }
  }

  res.status(200).json(results);
}
