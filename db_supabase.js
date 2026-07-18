// طبقة قاعدة البيانات باستخدام Supabase (دائم، يصمد مع cold start على Render المجاني)
// يقرأ المتغيرات من البيئة: SUPABASE_URL + SUPABASE_KEY
// لو Supabase فشل/معطل → يرجع تلقائياً للتخزين المحلي (JSON fallback)
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// نقرأ المفتاح في كل عملية (lazy) عشان نتجنب سقوط السيرفر لو المتغير انحدّث بعد التشغيل
function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key || key.length < 40) return null;
  try { return createClient(url, key, { auth: { persistSession: false } }); }
  catch (e) { return null; }
}

// ---------- fallback محلي (JSON على /tmp) ----------
const DB_FILE = '/tmp/store.json';
function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { return { clients: [], qa: [], messages: [], flows: {}, misses: {} }; }
}
function save(d) { try { fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); } catch (e) {} }
const D = () => load();

async function ensureSchema() {
  const sb = getClient();
  if (!sb) { console.log('[DB] وضع محلي (بدون Supabase)'); return; }
  try {
    const { error } = await sb.from('clients').select('id').limit(1);
    if (error) console.log('[SUPABASE] تحذير: شغّل schema.sql. الخطأ:', error.message);
    else console.log('[SUPABASE] الاتصال ناجح ✅');
  } catch (e) { console.log('[SUPABASE] خطأ اتصال — محلي:', e.message); }
}

// ---------- clients ----------
async function getClientByPhone(phoneId) {
  const sb = getClient();
  if (sb) { try { const { data } = await sb.from('clients').select('*').eq('phone_id', phoneId).single(); if (data) return data; } catch (e) {} }
  return D().clients.find(c => c.phone_id === phoneId) || null;
}
async function upsertClient({ id, name, phoneId, waToken, flow }) {
  const sb = getClient();
  if (sb) { try { await sb.from('clients').upsert({ id, name, phone_id: phoneId, wa_token: waToken, flow }); return; } catch (e) {} }
  const d = D(); const i = d.clients.findIndex(c => c.id === id);
  const rec = { id, name, phone_id: phoneId, wa_token: waToken, flow };
  if (i >= 0) d.clients[i] = rec; else d.clients.push(rec); save(d);
}
async function listClients() {
  const sb = getClient();
  if (sb) { try { const { data } = await sb.from('clients').select('*'); if (data) return data; } catch (e) {} }
  return D().clients;
}

// ---------- qa ----------
async function getQA(clientId) {
  const sb = getClient();
  if (sb) { try { const { data } = await sb.from('qa').select('*').eq('client_id', clientId); if (data) return data; } catch (e) {} }
  return D().qa.filter(q => q.client_id === clientId);
}
async function insertQA({ clientId, question, keywords, reply }) {
  const sb = getClient();
  if (sb) { try { await sb.from('qa').insert({ client_id: clientId, question, keywords, reply }); return; } catch (e) {} }
  const d = D(); d.qa.push({ client_id: clientId, question, keywords, reply }); save(d);
}

// ---------- messages ----------
async function logMsg(clientId, from, dir, text) {
  const sb = getClient();
  const row = { client_id: clientId, from_num: from, direction: dir, text, at: new Date().toISOString() };
  if (sb) { try { await sb.from('messages').insert(row); return; } catch (e) {} }
  const d = D(); d.messages.push(row); if (d.messages.length > 200) d.messages = d.messages.slice(-200); save(d);
}
async function listMessages(limit = 50) {
  const sb = getClient();
  if (sb) { try { const { data } = await sb.from('messages').select('*').order('id', { ascending: false }).limit(limit); if (data) return data; } catch (e) {} }
  return D().messages.slice(-limit).reverse();
}

// ---------- flows (تدفق متعدد الخطوات) ----------
async function getFlow(num) {
  const sb = getClient();
  if (sb) { try { const { data } = await sb.from('flows').select('*').eq('num', num).single(); if (data) return { step: data.step, order: data.ord }; } catch (e) {} }
  const f = D().flows[num]; return f ? { step: f.step, order: f.order } : null;
}
async function setFlow(num, step, ord) {
  const sb = getClient();
  if (sb) { try { await sb.from('flows').upsert({ num, step, ord: ord || null }); return; } catch (e) {} }
  const d = D(); d.flows[num] = { step, order: ord }; save(d);
}
async function clearFlow(num) {
  const sb = getClient();
  if (sb) { try { await sb.from('flows').delete().eq('num', num); return; } catch (e) {} }
  const d = D(); delete d.flows[num]; save(d);
}

// ---------- misses (عداد الفشل) ----------
async function getMiss(num) {
  const sb = getClient();
  if (sb) { try { const { data } = await sb.from('misses').select('*').eq('num', num).single(); if (data) return data.count; } catch (e) {} }
  return D().misses[num] || 0;
}
async function setMiss(num, c) {
  const sb = getClient();
  if (sb) { try { await sb.from('misses').upsert({ num, count: c }); return; } catch (e) {} }
  const d = D(); d.misses[num] = c; save(d);
}
async function clearMiss(num) {
  const sb = getClient();
  if (sb) { try { await sb.from('misses').delete().eq('num', num); return; } catch (e) {} }
  const d = D(); delete d.misses[num]; save(d);
}

module.exports = {
  ensureSchema,
  getClientByPhone, upsertClient, listClients,
  getQA, insertQA, logMsg, listMessages,
  getFlow, setFlow, clearFlow,
  getMiss, setMiss, clearMiss,
};
