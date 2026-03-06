/* ============================================================
   js/finance.js · 纯财务计算逻辑（不依赖网络、不操作DOM）
   ============================================================ */

/**
 * 计算资产统计数据
 * @param {Array} assets - 资产列表
 * @returns {{ byType, totalAssets, totalDebt, netWorth, debtRatio }}
 */
export function calcStats(assets) {
  const byType = { cash: 0, investment: 0, fixed: 0, debt: 0 };
  assets.forEach(a => {
    byType[a.type] = (byType[a.type] || 0) + Number(a.amount);
  });
  const totalAssets = byType.cash + byType.investment + byType.fixed;
  const totalDebt   = byType.debt;
  const netWorth    = totalAssets - totalDebt;
  const debtRatio   = totalAssets > 0
    ? (totalDebt / totalAssets * 100).toFixed(0)
    : 0;
  return { byType, totalAssets, totalDebt, netWorth, debtRatio };
}

/**
 * 计算某月的收支汇总
 * @param {Array}  rows  - 收支记录
 * @param {string} month - 月份 "YYYY-MM"
 */
export function calcCashflow(rows, month) {
  const filtered = month
    ? rows.filter(r => (r.date_month || r.date) === month)
    : rows;
  const income  = filtered
    .filter(r => r.type === 'income')
    .reduce((s, r) => s + Number(r.amount), 0);
  const expense = filtered
    .filter(r => r.type === 'expense')
    .reduce((s, r) => s + Number(r.amount), 0);
  const saving  = income - expense;
  const savRate = income > 0 ? ((saving / income) * 100).toFixed(0) : 0;
  return { month, income, expense, saving, savRate, rows: filtered };
}

/**
 * 计算财务健康分（0-100）
 * @param {object} stats    - calcStats 返回值
 * @param {Array}  cfRows   - 收支记录
 * @returns {number}
 */
export function calcHealthScore(stats, cfRows = []) {
  const dr = parseFloat(stats.debtRatio);
  const debtScore = dr === 0 ? 100 : dr <= 30 ? 80 : dr <= 50 ? 55 : 30;

  const typeCount = ['cash', 'investment', 'fixed']
    .filter(t => stats.byType[t] > 0).length;
  const diversityScore = typeCount * 33;

  const cashScore = stats.totalAssets > 0
    ? Math.min(100, (stats.byType.cash / stats.totalAssets) * 300)
    : 0;

  return Math.round(debtScore * 0.5 + diversityScore * 0.3 + cashScore * 0.2);
}

/**
 * 计算目标当前进度金额
 * @param {Array}  assets    - 资产列表
 * @param {string} assetType - 'all' | 'cash' | 'investment' | 'fixed'
 */
export function getGoalCurrentAmount(assets, assetType) {
  const stats = calcStats(assets);
  if (assetType === 'all')        return stats.netWorth;
  if (assetType === 'cash')       return stats.byType.cash;
  if (assetType === 'investment') return stats.byType.investment;
  if (assetType === 'fixed')      return stats.byType.fixed;
  return 0;
}

// ── 格式化工具 ───────────────────────────────────────────

/** 简短金额格式：¥4.6万 */
export function fmt(n) {
  if (Math.abs(n) >= 10000) return '¥' + (n / 10000).toFixed(1) + '万';
  return '¥' + Number(n).toLocaleString();
}

/** 完整金额格式：¥ 46,000 */
export function fmtFull(n) {
  return '¥ ' + Number(n).toLocaleString();
}

// ── 分类配置（只读数据，不是逻辑）────────────────────────

export const TYPE_CONFIG = {
  cash:       { label: '现金 & 存款', emoji: '💰', color: '#5cf0b0', iconBg: 'rgba(92,240,176,0.12)'  },
  investment: { label: '投资资产',    emoji: '📈', color: '#60d0f0', iconBg: 'rgba(96,208,240,0.12)'  },
  fixed:      { label: '固定资产',    emoji: '🏠', color: '#c8f050', iconBg: 'rgba(200,240,80,0.10)'  },
  debt:       { label: '负债',        emoji: '💳', color: '#ff6b6b', iconBg: 'rgba(255,107,107,0.10)' },
};

export const TYPE_ICONS = {
  cash:       ['🏦', '💵', '🏧', '💰', '🏛️'],
  investment: ['📊', '📈', '🔮', '💹', '🏦'],
  fixed:      ['🚗', '🏠', '🏢', '💎', '🖥️'],
  debt:       ['💳', '🏦', '📑', '🏧', '💸'],
};

export const CF_INCOME_CATS = [
  { id: 'salary',  label: '工资',    icon: '💼' },
  { id: 'side',    label: '兼职',    icon: '💡' },
  { id: 'invest',  label: '投资收益', icon: '📈' },
  { id: 'gift',    label: '红包礼金', icon: '🎁' },
  { id: 'other',   label: '其他收入', icon: '💰' },
];

export const CF_EXPENSE_CATS = [
  { id: 'housing',   label: '住房',  icon: '🏠' },
  { id: 'food',      label: '餐饮',  icon: '🍜' },
  { id: 'transport', label: '交通',  icon: '🚇' },
  { id: 'shopping',  label: '购物',  icon: '🛍️' },
  { id: 'medical',   label: '医疗',  icon: '🏥' },
  { id: 'education', label: '教育',  icon: '📚' },
  { id: 'entertain', label: '娱乐',  icon: '🎬' },
  { id: 'other',     label: '其他',  icon: '📦' },
];

export function getCfCat(type, id) {
  const list = type === 'income' ? CF_INCOME_CATS : CF_EXPENSE_CATS;
  return list.find(c => c.id === id) || { label: id, icon: '📌' };
}
