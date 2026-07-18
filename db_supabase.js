// طبقة التخزين المحلية الدائمة — تُزرع تلقائياً من qa_clean.json عند الإقلاع.
// دائمة على Render: ملفات المشروع (مو /tmp) تصمد مع cold start، والـ seed يعيد تعبئة Q&A كل boot.
// لا تعتمد على أي قاعدة خارجية → صفر أخطاء اتصال/WebSocket/RLS.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'store.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { return null; }
}
function save(d) { try { fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); } catch (e) {} }

let _db = null;
function db() {
  if (_db) return _db;
  _db = load();
  if (!_db) _db = { clients: [], qa: [], messages: [], flows: {}, misses: {} };
  return _db;
}

function seedIfEmpty() {
  const d = db();
  // نتأكد من وجود عميل halat
  if (!d.clients.find(c => c.id === 'halat')) {
    d.clients.push({ id: 'halat', name: 'هالات', phone_id: '1270641526122813', wa_token: process.env.HALAT_WA_TOKEN || 'demo', flow: 'qa' });
  }
  // نزرع Q&A من الملف المحفوظ لو الجدول فاضي
  if (!d.qa.length) {
    try {
      const qa = JSON.parse(fs.readFileSync(path.join(__dirname, 'qa_clean.json'), 'utf8'));
      d.qa = qa.map(q => ({ client_id: q.client_id || 'halat', question: q.question, keywords: q.keywords, reply: q.reply }));
      console.log(`[DB] تم زرع ${d.qa.length} سؤال من qa_clean.json ✅`);
    } catch (e) { console.log('[DB] تعذّر زرع qa:', e.message); }
  }
  save(d);
  console.log(`[DB] جاهز: ${d.clients.length} عميل، ${d.qa.length} سؤال`);
}

// ---------- clients ----------
async function getClientByPhone(phoneId) {
  return db().clients.find(c => c.phone_id === phoneId) || null;
}
async function upsertClient({ id, name, phoneId, waToken, flow }) {
  const d = db();
  const i = d.clients.findIndex(c => c.id === id);
  const rec = { id, name, phone_id: phoneId, wa_token: waToken, flow };
  if (i >= 0) d.clients[i] = rec; else d.clients.push(rec);
  save(d);
}
async function listClients() { return db().clients; }

// ---------- qa ----------
async function getQA(clientId) { return db().qa.filter(q => q.client_id === clientId); }
async function insertQA({ clientId, question, keywords, reply }) {
  db().qa.push({ client_id: clientId, question, keywords, reply }); save(db());
}
async function clearQA(clientId) { const d = db(); d.qa = d.qa.filter(q => q.client_id !== clientId); save(d); }
async function deleteQA(clientId, question) { const d = db(); d.qa = d.qa.filter(q => !(q.client_id === clientId && q.question === question)); save(d); }

// ---------- messages ----------
async function logMsg(clientId, from, dir, text) {
  const d = db();
  d.messages.push({ client_id: clientId, from_num: from, direction: dir, text, at: new Date().toISOString() });
  if (d.messages.length > 200) d.messages = d.messages.slice(-200);
  save(d);
}
async function listMessages(limit = 50) { return db().messages.slice(-limit).reverse(); }
async function clearMessages() { const d = db(); d.messages = []; save(d); }

// ---------- flows (تدفق متعدد الخطوات) ----------
async function getFlow(num) {
  const f = db().flows[num];
  return f ? { step: f.step, order: f.order } : null;
}
async function setFlow(num, step, ord) {
  const ordVal = (ord && ord.length) ? ord : null;
  db().flows[num] = { step, order: ordVal }; save(db());
}
async function clearFlow(num) { const d = db(); delete d.flows[num]; save(d); }

// ---------- misses (عداد الفشل) ----------
async function getMiss(num) { return db().misses[num] || 0; }
async function setMiss(num, c) { db().misses[num] = c; save(db()); }
async function clearMiss(num) { const d = db(); delete d.misses[num]; save(d); }

module.exports = {
  ensureSchema: seedIfEmpty,
  getClientByPhone, upsertClient, listClients,
  getQA, insertQA, clearQA, deleteQA, logMsg, listMessages, clearMessages,
  getFlow, setFlow, clearFlow,
  getMiss, setMiss, clearMiss,
};
