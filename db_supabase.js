// طبقة قاعدة البيانات باستخدام Supabase (بديل عن SQLite)
// تقرأ المتغيرات من البيئة: SUPABASE_URL + SUPABASE_KEY
// آمن: لو Supabase فشل/معطل → يرجع تلقائياً للتخزين المحلي (fallback)
const { createClient } = require('supabase');

const sbUrl = process.env.SUPABASE_URL;
const sbKey = process.env.SUPABASE_KEY;

let sb = null;
if (sbUrl && sbKey && sbKey.startsWith('sb_') && sbKey.length > 20) {
  try {
    sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
  } catch (e) {
    console.log('[SUPABASE] فشل إنشاء العميل — استخدام محلي:', e.message);
    sb = null;
  }
}

const USING_SUPABASE = !!sb;

async function ensureSchema() {
  if (!USING_SUPABASE) return;
  try {
    const { error } = await sb.from('clients').select('id').limit(1);
    if (error) console.log('[SUPABASE] تحذير: تأكد من تشغيل schema.sql. الخطأ:', error.message);
    else console.log('[SUPABASE] الاتصال ناجح ✅');
  } catch (e) {
    console.log('[SUPABASE] خطأ اتصال — سيُستخدم التخزين المحلي:', e.message);
  }
}

// ---------- clients ----------
async function getClientByPhone(phoneId) {
  if (USING_SUPABASE) {
    try {
      const { data } = await sb.from('clients').select('*').eq('phone_id', phoneId).single();
      return data;
    } catch (e) { console.log('[SUPABASE] getClientByPhone فشل، محلي:', e.message); }
  }
  return localFallback.getClientByPhone(phoneId);
}

async function upsertClient({ id, name, phoneId, waToken, flow }) {
  if (USING_SUPABASE) {
    try {
      await sb.from('clients').upsert({ id, name, phone_id: phoneId, wa_token: waToken, flow });
      return;
    } catch (e) { console.log('[SUPABASE] upsertClient فشل، محلي:', e.message); }
  }
  localFallback.upsertClient({ id, name, phoneId, waToken, flow });
}

async function listClients() {
  if (USING_SUPABASE) {
    try {
      const { data } = await sb.from('clients').select('*');
      return data || [];
    } catch (e) { console.log('[SUPABASE] listClients فشل، محلي:', e.message); }
  }
  return localFallback.listClients();
}

// ---------- qa ----------
async function getQA(clientId) {
  if (USING_SUPABASE) {
    try {
      const { data } = await sb.from('qa').select('*').eq('client_id', clientId);
      return data || [];
    } catch (e) { console.log('[SUPABASE] getQA فشل، محلي:', e.message); }
  }
  return localFallback.getQA(clientId);
}

async function insertQA({ clientId, question, keywords, reply }) {
  if (USING_SUPABASE) {
    try {
      await sb.from('qa').insert({ client_id: clientId, question, keywords, reply });
      return;
    } catch (e) { console.log('[SUPABASE] insertQA فشل، محلي:', e.message); }
  }
  localFallback.insertQA({ clientId, question, keywords, reply });
}

// ---------- messages ----------
async function logMsg(clientId, from, dir, text) {
  const row = { client_id: clientId, from_num: from, direction: dir, text, at: new Date().toISOString() };
  if (USING_SUPABASE) {
    try {
      await sb.from('messages').insert(row);
      return;
    } catch (e) { /* صامت — نروح للفولباك */ }
  }
  localFallback.logMsg(row);
}

async function listMessages(limit = 50) {
  if (USING_SUPABASE) {
    try {
      const { data } = await sb.from('messages').select('*').order('id', { ascending: false }).limit(limit);
      return data || [];
    } catch (e) { console.log('[SUPABASE] listMessages فشل، محلي:', e.message); }
  }
  return localFallback.listMessages(limit);
}

// ---------- fallback محلي (لو ما فيه Supabase أو فشل) ----------
const localFallback = (() => {
  const Database = require('better-sqlite3');
  const fs = require('fs');
  const path = require('path');
  const DATA_DIR = path.join(__dirname, 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, 'wasilah.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('encoding = "UTF-8"');
  db.prepare(`CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT, phone_id TEXT UNIQUE, wa_token TEXT, flow TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS qa (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, question TEXT, keywords TEXT, reply TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, from_num TEXT, direction TEXT, text TEXT, at TEXT)`).run();
  return {
    getClientByPhone: (p) => db.prepare('SELECT * FROM clients WHERE phone_id = ?').get(p),
    upsertClient: ({ id, name, phoneId, waToken, flow }) => db.prepare('INSERT INTO clients (id,name,phone_id,wa_token,flow) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=?,phone_id=?,wa_token=?,flow=?').run(id, name, phoneId, waToken, flow, name, phoneId, waToken, flow),
    listClients: () => db.prepare('SELECT * FROM clients').all(),
    getQA: (c) => db.prepare('SELECT * FROM qa WHERE client_id = ?').all(c),
    insertQA: ({ clientId, question, keywords, reply }) => db.prepare('INSERT INTO qa (client_id,question,keywords,reply) VALUES (?,?,?,?)').run(clientId, question, keywords, reply),
    logMsg: (r) => db.prepare('INSERT INTO messages (client_id,from_num,direction,text,at) VALUES (?,?,?,?,?)').run(r.client_id, r.from_num, r.direction, r.text, r.at),
    listMessages: (l) => db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT ?').all(l),
  };
})();

module.exports = {
  USING_SUPABASE, ensureSchema,
  getClientByPhone, upsertClient, listClients,
  getQA, insertQA, logMsg, listMessages,
};
