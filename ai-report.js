// api/ai-report.js - Vercel Serverless Function
// 代理 Claude API，解决浏览器跨域问题
// 用法: POST /api/ai-report  body: { prompt: "..." }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: '缺少 prompt 参数' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API Key 未配置，请在 Vercel 环境变量中添加 ANTHROPIC_API_KEY' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // 用 Haiku，速度快成本低
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'Claude API 错误: ' + err });
    }

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || '';

    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: '服务器错误: ' + err.message });
  }
}
