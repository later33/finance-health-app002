// api/ai-report.js - Vercel Serverless Function
// 代理 DeepSeek API，API Key 只存在服务器端，不暴露给浏览器
// 用法: POST /api/ai-report  body: { prompt: "..." }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理预检请求
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

  // 限制长度，防止滥用
  if (prompt.length > 4000) {
    return res.status(400).json({ error: 'prompt 过长' });
  }

  // 从 Vercel 环境变量读取 DeepSeek API Key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API Key 未配置，请在 Vercel 环境变量中添加 DEEPSEEK_API_KEY' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'DeepSeek API 错误: ' + err });
    }

    const data = await response.json();
    // DeepSeek 用 OpenAI 格式返回
    const text = data.choices?.[0]?.message?.content || '';

    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: '服务器错误: ' + err.message });
  }
}
