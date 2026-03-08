// api/rate.js - 获取汇率（via Yahoo Finance）
// 用法: /api/rate?from=HKD&to=CNY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600'); // 汇率缓存 1 小时

  const { from = 'HKD', to = 'CNY' } = req.query;
  if (from === to) return res.status(200).json({ rate: 1, from, to });

  try {
    const symbol = `${from}${to}=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    const data = await response.json();
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (!rate) return res.status(404).json({ error: '获取汇率失败' });
    return res.status(200).json({ rate, from, to });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
