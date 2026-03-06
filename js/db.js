/* ============================================================
   js/db.js · 数据库操作层（只负责和 Supabase 通信）
   ============================================================ */

import { calcStats } from './finance.js';

const SUPABASE_URL = 'https://wnktdhmcaevynmvwifoe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5Inbgq67GDKwpQP7iWMb1w_zWSuqE-C';

const { createClient } = supabase;
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// ── 认证 ─────────────────────────────────────────────────

export async function getUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) { window.location.href = 'auth.html'; return null; }
  return user;
}

export async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'auth.html';
}

// ── 资产 ─────────────────────────────────────────────────

export async function dbLoadAssets() {
  const { data, error } = await sb.from('assets').select('*').order('created_at');
  if (error) { console.error(error); return []; }
  return data;
}

export async function dbAddAsset(entry) {
  const user = await getUser();
  const { data, error } = await sb.from('assets').insert({
    user_id: user.id,
    type:    entry.type,
    name:    entry.name,
    note:    entry.note || '',
    amount:  entry.amount,
    icon:    entry.icon || '💰',
  }).select().single();
  if (error) { console.error(error); return null; }
  await dbSaveSnapshot();
  return data;
}

export async function dbDeleteAsset(id) {
  const { error } = await sb.from('assets').delete().eq('id', id);
  if (error) console.error(error);
  await dbSaveSnapshot();
}

// ── 净资产快照 ────────────────────────────────────────────

export async function dbSaveSnapshot() {
  const user   = await getUser();
  const assets = await dbLoadAssets();
  const stats  = calcStats(assets);
  const label  = new Date().toISOString().slice(0, 7);
  await sb.from('net_worth_history').delete()
    .eq('user_id', user.id).eq('date_label', label);
  await sb.from('net_worth_history').insert({
    user_id:    user.id,
    date_label: label,
    net_worth:  stats.netWorth,
  });
}

export async function dbLoadHistory() {
  const { data, error } = await sb
    .from('net_worth_history').select('*')
    .order('date_label').limit(12);
  if (error) { console.error(error); return []; }
  return data.map(r => ({
    date:     r.date_label.slice(5).replace('-', '/') + '月',
    netWorth: r.net_worth,
  }));
}

// ── 收支 ─────────────────────────────────────────────────

export async function dbLoadCashflow(month) {
  let q = sb.from('cashflow').select('*').order('created_at');
  if (month) q = q.eq('date_month', month);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return data;
}

export async function dbAddCashflow(entry) {
  const user = await getUser();
  const { data, error } = await sb.from('cashflow').insert({
    user_id:    user.id,
    type:       entry.type,
    category:   entry.category,
    name:       entry.name,
    amount:     entry.amount,
    icon:       entry.icon || '💰',
    date_month: entry.date,
  }).select().single();
  if (error) { console.error(error); return null; }
  return data;
}

export async function dbDeleteCashflow(id) {
  const { error } = await sb.from('cashflow').delete().eq('id', id);
  if (error) console.error(error);
}

// ── 目标 ─────────────────────────────────────────────────

export async function dbLoadGoals() {
  const { data, error } = await sb.from('goals').select('*').order('created_at');
  if (error) { console.error(error); return []; }
  return data;
}

export async function dbSaveGoal(goal, editId = null) {
  const user = await getUser();
  if (editId) {
    const { error } = await sb.from('goals').update({
      emoji: goal.emoji, name: goal.name,
      target_amount: goal.target_amount,
      deadline: goal.deadline || null,
      asset_type: goal.asset_type,
    }).eq('id', editId);
    if (error) console.error(error);
  } else {
    const { error } = await sb.from('goals').insert({
      user_id: user.id, ...goal
    });
    if (error) console.error(error);
  }
}

export async function dbDeleteGoal(id) {
  const { error } = await sb.from('goals').delete().eq('id', id);
  if (error) console.error(error);
}
