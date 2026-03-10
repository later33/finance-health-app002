/* ============================================================
   supabase.js · 数据层（只负责和数据库通信，不含计算逻辑）
   计算逻辑全部在 finance.js
   ============================================================ */

const SUPABASE_URL = 'https://wnktdhmcaevynmvwifoe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5Inbgq67GDKwpQP7iWMb1w_zWSuqE-C';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' }
});

// ── 认证 ─────────────────────────────────────────────────
async function getUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function requireAuth() {
  const user = await getUser();
  if (!user) { window.location.href = 'auth.html'; return null; }
  return user;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'auth.html';
}

// ── 资产 ─────────────────────────────────────────────────
async function dbLoadAssets() {
  const { data, error } = await sb.from('assets').select('*').order('created_at');
  if (error) { console.error(error); return []; }
  return data;
}

async function dbAddAsset(entry) {
  const user = await getUser();
  const { data, error } = await sb.from('assets').insert({
    user_id: user.id, type: entry.type, name: entry.name,
    note: entry.note || '', amount: entry.amount, icon: entry.icon || '💰'
  }).select().single();
  if (error) { console.error(error); return null; }
  await dbSaveSnapshot();
  return data;
}

async function dbDeleteAsset(id) {
  const { error } = await sb.from('assets').delete().eq('id', id);
  if (error) console.error(error);
  await dbSaveSnapshot();
}


// ── 持仓同步到资产 ──────────────────────────────────────
async function dbSyncHoldingsAsset(amountCNY) {
  const user = await getUser();
  if (!user) return;

  // 查找已有的同步记录
  const { data: existing } = await sb.from('assets')
    .select('id')
    .eq('user_id', user.id)
    .eq('note', '__holdings_sync__')
    .single();

  if (existing) {
    // 更新金额
    await sb.from('assets').update({ amount: amountCNY }).eq('id', existing.id);
  } else {
    // 首次创建
    await sb.from('assets').insert({
      user_id: user.id,
      type:    'investment',
      name:    '证券持仓',
      note:    '__holdings_sync__',
      amount:  amountCNY,
      icon:    '📊',
    });
  }
  await dbSaveSnapshot();
}

// ── 净资产快照 ───────────────────────────────────────────
async function dbSaveSnapshot() {
  const user   = await getUser();
  const assets = await dbLoadAssets();
  const stats  = calcStats(assets);
  const label  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD（按天）
  // 同一天内更新则覆盖
  await sb.from('net_worth_history').delete().eq('user_id', user.id).eq('date_label', label);
  await sb.from('net_worth_history').insert({ user_id: user.id, date_label: label, net_worth: stats.netWorth });
}

async function dbLoadHistory() {
  const { data, error } = await sb.from('net_worth_history').select('*').order('date_label', { ascending: true }).limit(90);
  if (error) { console.error(error); return []; }
  return data.map(r => ({
    date: r.date_label.slice(5).replace('-', '/'), // MM/DD
    fullDate: r.date_label,
    netWorth: r.net_worth
  }));
}

// ── 收支 ─────────────────────────────────────────────────
async function dbLoadCashflow(month) {
  let q = sb.from('cashflow').select('*').order('created_at');
  if (month) q = q.eq('date_month', month);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return data;
}

async function dbAddCashflow(entry) {
  const user = await getUser();
  const { data, error } = await sb.from('cashflow').insert({
    user_id: user.id, type: entry.type, category: entry.category,
    name: entry.name, amount: entry.amount, icon: entry.icon || '💰', date_month: entry.date
  }).select().single();
  if (error) { console.error(error); return null; }
  return data;
}

async function dbDeleteCashflow(id) {
  const { error } = await sb.from('cashflow').delete().eq('id', id);
  if (error) console.error(error);
}

// ── 持仓同步到资产 ────────────────────────────────────────
// 用 note='__holdings_sync__' 标记这条自动同步的资产
async function dbSyncHoldingsAsset() {
  const user = await getUser();
  if (!user) return;

  // 加载持仓
  const { data: holdings } = await sb.from('holdings').select('code,shares,current_price');

  // 判断原始货币
  function origCur(code) {
    if (!code) return 'CNY';
    const c = code.trim().toUpperCase();
    if (/\.HK$/.test(c)) return 'HKD';
    if (/^[A-Z]{1,5}$/.test(c)) return 'USD';
    if (/^[A-Z]{1,4}[-\.][A-Z]{1,2}$/.test(c)) return 'USD';
    return 'CNY';
  }

  // 汇率：优先用缓存，否则用兜底
  let rates = { CNY:1, HKD:0.92, USD:7.24 };
  try {
    const cached = JSON.parse(sessionStorage.getItem('fx_rates') || 'null');
    if (cached) rates = cached;
  } catch(e) {}

  // 计算持仓总值（CNY）
  const totalCNY = (holdings || []).reduce((sum, h) => {
    return sum + Number(h.shares) * Number(h.current_price) * rates[origCur(h.code)];
  }, 0);

  // 查找已有的同步记录
  const { data: existing } = await sb.from('assets')
    .select('id')
    .eq('user_id', user.id)
    .eq('note', '__holdings_sync__')
    .maybeSingle();

  if (totalCNY <= 0) {
    // 没有持仓就删除同步记录
    if (existing) await sb.from('assets').delete().eq('id', existing.id);
    return;
  }

  const amount = Math.round(totalCNY * 100) / 100;

  if (existing) {
    await sb.from('assets').update({ amount }).eq('id', existing.id);
  } else {
    await sb.from('assets').insert({
      user_id: user.id,
      type: 'investment',
      name: '证券持仓',
      note: '__holdings_sync__',
      amount,
      icon: '📊',
    });
  }
}
