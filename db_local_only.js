// تخزين محلي في ملف JSON (يقرأ/يكتب الملف في كل عملية — يصمد مع cold start على Render)
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {} }
const DB_FILE = path.join(DATA_DIR, 'store.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { return { clients: [], qa: [], messages: [], flows: {}, misses: {} }; }
}
function save(d) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); } catch (e) { console.error('save error:', e.message); }
}
// كل عملية تقرأ من الملف مباشرة (مو من ذاكرة)
function D() { return load(); }

const P = (v) => Promise.resolve(v);
const USING_SUPABASE = false;

function ensureSchema() { return P(); }
function getClientByPhone(p) { return P(D().clients.find(c => c.phone_id === p)); }
function upsertClient({ id, name, phoneId, waToken, flow }) {
  const d = D(); const i = d.clients.findIndex(c => c.id === id);
  const rec = { id, name, phone_id: phoneId, wa_token: waToken, flow };
  if (i >= 0) d.clients[i] = rec; else d.clients.push(rec);
  save(d); return P();
}
function listClients() { return P(D().clients); }
function getQA(c) { return P(D().qa.filter(q => q.client_id === c)); }
function insertQA({ clientId, question, keywords, reply }) {
  const d = D(); d.qa.push({ client_id: clientId, question, keywords, reply });
  save(d); return P();
}
function logMsg(clientId, fromNum, direction, text) {
  const d = D(); d.messages.push({ client_id: clientId, from_num: fromNum, direction, text: text || '', at: new Date().toISOString() });
  if (d.messages.length > 200) d.messages = d.messages.slice(-200);
  save(d); return P();
}
function listMessages(l) { return P(D().messages.slice(-l).reverse()); }
function clearQA(c) { const d = D(); d.qa = d.qa.filter(q => q.client_id !== c); save(d); return P(); }
function deleteQA(c, q) { const d = D(); d.qa = d.qa.filter(x => !(x.client_id === c && x.question === q)); save(d); return P(); }
function clearMessages() { const d = D(); d.messages = []; save(d); return P(); }

function getFlow(n) { const d = D(); return P(d.flows[n] ? d.flows[n] : null); }
function setFlow(n, step, ord) { const d = D(); d.flows[n] = { step, order: ord }; save(d); return P(); }
function clearFlow(n) { const d = D(); delete d.flows[n]; save(d); return P(); }
function getMiss(n) { const d = D(); return P(d.misses[n] || 0); }
function setMiss(n, c) { const d = D(); d.misses[n] = c; save(d); return P(); }
function clearMiss(n) { const d = D(); delete d.misses[n]; save(d); return P(); }

module.exports = { USING_SUPABASE, ensureSchema, getClientByPhone, upsertClient, listClients, getQA, insertQA, logMsg, listMessages, clearQA, deleteQA, clearMessages, getFlow, setFlow, clearFlow, getMiss, setMiss, clearMiss };
