export default async function handler(req, res) {
  const results = { env: {}, fetch: null, error: null };

  // Check env vars (masked)
  results.env.HF_TOKEN_EXISTS = !!process.env.HF_TOKEN;
  results.env.HF_TOKEN_LENGTH = process.env.HF_TOKEN ? process.env.HF_TOKEN.length : 0;
  results.env.NODE_VERSION = process.version;

  // Test fetch to Hugging Face
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const testRes = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + (process.env.HF_TOKEN || ''),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: 'hello', parameters: { max_new_tokens: 5, return_full_text: false } }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    results.fetch = {
      status: testRes.status,
      ok: testRes.ok,
      statusText: testRes.statusText,
    };
  } catch (err) {
    results.fetch = null;
    results.error = err.message;
    results.errorName = err.name;
  }

  res.status(200).json(results);
}
