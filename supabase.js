/* supabase.js - 数据层 */
const SUPABASE_URL = 'https://wnktdhmcaevynmvwifoe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5Inbgq67GDKwpQP7iWMb1w_zWSuqE-C';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' }
});

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
async function dbLoadAssets() {
  const { data, error } = await sb.from('assets').select('*').order('created_at');
  if (error) { console.error(error); return []; }
  return data;
}
async function dbAddAsset(entry) {
  const user = await getUser();
  const { data, error } = await sb.from('assets').insert({ user_id: user.id, type: entry.type, name: entry.name, note: entry.note||'', amount: entry.amount, icon: entry.icon||'💰' }).select().single();
  if (error) { console.error(error); return null; }
  await dbSaveSnapshot(); return data;
}
async function dbDeleteAsset(id) {
  const { error } = await sb.from('assets').delete().eq('id', id);
  if (error) console.error(error);
  await dbSaveSnapshot();
}
async function dbSaveSnapshot() {
  const user = await getUser(); const assets = await dbLoadAssets(); const stats = calcStats(assets);
  const label = new Date().toISOString().slice(0,7);
  await sb.from('net_worth_history').delete().eq('user_id', user.id).eq('date_label', label);
  await sb.from('net_worth_history').insert({ user_id: user.id, date_label: label, net_worth: stats.netWorth });
}
async function dbLoadHistory() {
  const { data, error } = await sb.from('net_worth_history').select('*').order('date_label').limit(12);
  if (error) { console.error(error); return []; }
  return data.map(r => ({ date: r.date_label.slice(5).replace('-','/')+'月', netWorth: r.net_worth }));
}
async function dbLoadCashflow(month) {
  let q = sb.from('cashflow').select('*').order('created_at');
  if (month) q = q.eq('date_month', month);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return data;
}
async function dbAddCashflow(entry) {
  const user = await getUser();
  const { data, error } = await sb.from('cashflow').insert({ user_id: user.id, type: entry.type, category: entry.category, name: entry.name, amount: entry.amount, icon: entry.icon||'💰', date_month: entry.date }).select().single();
  if (error) { console.error(error); return null; }
  return data;
}
async function dbDeleteCashflow(id) {
  const { error } = await sb.from('cashflow').delete().eq('id', id);
  if (error) console.error(error);
}
function calcStats(assets) {
  const byType = { cash:0, investment:0, fixed:0, debt:0 };
  assets.forEach(a => { byType[a.type] = (byType[a.type]||0) + Number(a.amount); });
  const totalAssets = byType.cash+byType.investment+byType.fixed;
  const totalDebt = byType.debt; const netWorth = totalAssets-totalDebt;
  const debtRatio = totalAssets>0 ? (totalDebt/totalAssets*100).toFixed(0) : 0;
  return { byType, totalAssets, totalDebt, netWorth, debtRatio };
}
function calcCashflow(rows, month) {
  const filtered = month ? rows.filter(r=>(r.date_month||r.date)===month) : rows;
  const income = filtered.filter(r=>r.type==='income').reduce((s,r)=>s+Number(r.amount),0);
  const expense = filtered.filter(r=>r.type==='expense').reduce((s,r)=>s+Number(r.amount),0);
  const saving = income-expense; const savRate = income>0 ? ((saving/income)*100).toFixed(0) : 0;
  return { month, income, expense, saving, savRate, rows: filtered };
}
function fmt(n) { if(Math.abs(n)>=10000) return '¥'+(n/10000).toFixed(1)+'万'; return '¥'+Number(n).toLocaleString(); }
function fmtFull(n) { return '¥ '+Number(n).toLocaleString(); }
const TYPE_CONFIG = {
  cash:       { label:'现金 & 存款', emoji:'💰', color:'#5cf0b0', iconBg:'rgba(92,240,176,0.12)'  },
  investment: { label:'投资资产',    emoji:'📈', color:'#60d0f0', iconBg:'rgba(96,208,240,0.12)'  },
  fixed:      { label:'固定资产',    emoji:'🏠', color:'#c8f050', iconBg:'rgba(200,240,80,0.10)'  },
  debt:       { label:'负债',        emoji:'💳', color:'#ff6b6b', iconBg:'rgba(255,107,107,0.10)' },
};
const TYPE_ICONS = {
  cash:['🏦','💵','🏧','💰','🏛️'], investment:['📊','📈','🔮','💹','🏦'],
  fixed:['🚗','🏠','🏢','💎','🖥️'], debt:['💳','🏦','📑','🏧','💸'],
};
const CF_INCOME_CATS = [
  {id:'salary',label:'工资',icon:'💼'},{id:'side',label:'兼职',icon:'💡'},
  {id:'invest',label:'投资收益',icon:'📈'},{id:'gift',label:'红包礼金',icon:'🎁'},{id:'other',label:'其他收入',icon:'💰'},
];
const CF_EXPENSE_CATS = [
  {id:'housing',label:'住房',icon:'🏠'},{id:'food',label:'餐饮',icon:'🍜'},
  {id:'transport',label:'交通',icon:'🚇'},{id:'shopping',label:'购物',icon:'🛍️'},
  {id:'medical',label:'医疗',icon:'🏥'},{id:'education',label:'教育',icon:'📚'},
  {id:'entertain',label:'娱乐',icon:'🎬'},{id:'other',label:'其他',icon:'📦'},
];
function getCfCat(type, id) {
  const list = type==='income' ? CF_INCOME_CATS : CF_EXPENSE_CATS;
  return list.find(c=>c.id===id) || {label:id, icon:'📌'};
}
