// طبقة قاعدة البيانات باستخدام Supabase (دائم، يصمد مع cold start على Render المجاني)
// يقرأ المتغيرات من البيئة: SUPABASE_URL + SUPABASE_KEY
// لو Supabase فشل/معطل → يرجع تلقائياً للتخزين المحلي (JSON fallback)
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// نقرأ المفتاح في كل عملية (lazy) — ما نخزّنه عشان نتجنب تجمّده على null
function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key || key.length < 40) return null;
  try {
    // نعطّل realtime (ما نحتاجه) عشان نتجنب خطأ WebSocket
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { enabled: false },
    });
  } catch (e) {
    console.error('[SUPABASE] خطأ إنشاء العميل:', e.message);
    return null;
  }
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
    if (error) { console.log('[SUPABASE] تحذير: شغّل schema.sql. الخطأ:', error.message); return; }
    console.log('[SUPABASE] الاتصال ناجح ✅');
    // نشتغّل عميل halat الافتراضي تلقائياً
    const { data: existing } = await sb.from('clients').select('id').eq('id', 'halat').single();
    if (!existing) {
      const { error: e2 } = await sb.from('clients').insert({
        id: 'halat', name: 'هالات', phone_id: '1270641526122813',
        wa_token: process.env.HALAT_WA_TOKEN || 'demo', flow: 'qa'
      });
      if (e2) console.log('[SUPABASE] تعذّر إنشاء halat:', e2.message);
      else console.log('[SUPABASE] تم إنشاء عميل halat تلقائياً ✅');
    }
    // لو جدول qa فاضي → نزرع من qa_clean.json تلقائياً (ما يحتاج seed يدوي)
    const { count } = await sb.from('qa').select('*', { count: 'exact', head: true }).eq('client_id', 'halat');
    if (!count) {
      let qa = [];
      try { qa = JSON.parse(fs.readFileSync(__dirname + '/qa_clean.json', 'utf8')); } catch (e) {}
      if (qa.length) {
        const { error: e3 } = await sb.from('qa').insert(qa.map(q => ({ client_id: q.client_id || 'halat', question: q.question, keywords: q.keywords, reply: q.reply })));
        if (e3) console.log('[SUPABASE] تعذّر زرع qa:', e3.message);
        else console.log(`[SUPABASE] تم زرع ${qa.length} سؤال تلقائياً ✅`);
      }
    } else {
      console.log(`[SUPABASE] qa فيه ${count} سؤال`);
    }
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
  if (sb) { try { await sb.from('qa').insert({ client_id: clientId, question, keywords, reply }); return; } catch (e) { console.error('[QA] insert error:', e.message); } }
  const d = D(); d.qa.push({ client_id: clientId, question, keywords, reply }); save(d);
}
async function clearQA(clientId) {
  const sb = getClient();
  if (sb) { try { await sb.from('qa').delete().eq('client_id', clientId); return; } catch (e) {} }
  const d = D(); d.qa = d.qa.filter(q => q.client_id !== clientId); save(d);
}
async function deleteQA(clientId, question) {
  const sb = getClient();
  if (sb) { try { await sb.from('qa').delete().eq('client_id', clientId).eq('question', question); return; } catch (e) {} }
  const d = D(); d.qa = d.qa.filter(q => !(q.client_id === clientId && q.question === question)); save(d);
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
async function clearMessages() {
  const sb = getClient();
  if (sb) { try { await sb.from('messages').delete().neq('id', 0); return; } catch (e) {} }
  const d = D(); d.messages = []; save(d);
}

// ---------- flows (تدفق متعدد الخطوات) ----------
async function getFlow(num) {
  const sb = getClient();
  if (sb) { try { const { data } = await sb.from('flows').select('*').eq('num', num).single(); if (data) return { step: data.step, order: data.ord }; } catch (e) { console.error('[FLOW] getFlow error:', e.message); } }
  const f = D().flows[num]; return f ? { step: f.step, order: f.order } : null;
}
async function setFlow(num, step, ord) {
  const sb = getClient();
  const ordVal = (ord && ord.length) ? ord : null;
  if (sb) { try { const { error } = await sb.from('flows').upsert({ num, step, ord: ordVal }); if (error) console.error('[FLOW] setFlow error:', error.message); return; } catch (e) { console.error('[FLOW] setFlow throw:', e.message); } }
  const d = D(); d.flows[num] = { step, order: ordVal }; save(d);
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
  getQA, insertQA, clearQA, deleteQA, logMsg, listMessages, clearMessages,
  getFlow, setFlow, clearFlow,
  getMiss, setMiss, clearMiss,
};
