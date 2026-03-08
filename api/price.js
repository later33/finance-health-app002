// api/price.js - Vercel Serverless Function
// 代理 Yahoo Finance，解决浏览器跨域问题
// 用法: /api/price?symbol=AAPL 或 /api/price?symbol=0700.HK

export default async function handler(req, res) {
  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: '缺少 symbol 参数' });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: '获取数据失败' });
    }

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta) {
      return res.status(404).json({ error: '未找到该股票代码' });
    }

    // 只返回需要的字段
    return res.status(200).json({
      symbol:        meta.symbol,
      price:         meta.regularMarketPrice,
      prevClose:     meta.chartPreviousClose,
      change:        meta.regularMarketPrice - meta.chartPreviousClose,
      changePct:     ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100).toFixed(2),
      currency:      meta.currency,
      marketState:   meta.marketState, // REGULAR / PRE / POST / CLOSED
      exchangeName:  meta.exchangeName,
    });

  } catch (err) {
    return res.status(500).json({ error: '服务器错误: ' + err.message });
  }
}
