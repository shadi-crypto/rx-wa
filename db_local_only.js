// تخزين محلي في ملف JSON (يشتغل على Render حتى مع readonly filesystem)
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
let DATA = load();

const P = (v) => Promise.resolve(v);
const USING_SUPABASE = false;

function ensureSchema() { return P(); }
function getClientByPhone(p) { return P(DATA.clients.find(c => c.phone_id === p)); }
function upsertClient({ id, name, phoneId, waToken, flow }) {
  const i = DATA.clients.findIndex(c => c.id === id);
  const rec = { id, name, phone_id: phoneId, wa_token: waToken, flow };
  if (i >= 0) DATA.clients[i] = rec; else DATA.clients.push(rec);
  save(DATA); return P();
}
function listClients() { return P(DATA.clients); }
function getQA(c) { return P(DATA.qa.filter(q => q.client_id === c)); }
function insertQA({ clientId, question, keywords, reply }) {
  DATA.qa.push({ client_id: clientId, question, keywords, reply });
  save(DATA); return P();
}
function logMsg(clientId, fromNum, direction, text) {
  DATA.messages.push({ client_id: clientId, from_num: fromNum, direction, text: text || '', at: new Date().toISOString() });
  if (DATA.messages.length > 200) DATA.messages = DATA.messages.slice(-200);
  save(DATA); return P();
}
function listMessages(l) { return P(DATA.messages.slice(-l).reverse()); }
function clearQA(c) { DATA.qa = DATA.qa.filter(q => q.client_id !== c); save(DATA); return P(); }
function deleteQA(c, q) { DATA.qa = DATA.qa.filter(x => !(x.client_id === c && x.question === q)); save(DATA); return P(); }
function clearMessages() { DATA.messages = []; save(DATA); return P(); }

function getFlow(n) { return P(DATA.flows[n] ? DATA.flows[n] : null); }
function setFlow(n, step, ord) { DATA.flows[n] = { step, order: ord }; save(DATA); return P(); }
function clearFlow(n) { delete DATA.flows[n]; save(DATA); return P(); }
function getMiss(n) { return P(DATA.misses[n] || 0); }
function setMiss(n, c) { DATA.misses[n] = c; save(DATA); return P(); }
function clearMiss(n) { delete DATA.misses[n]; save(DATA); return P(); }

module.exports = { USING_SUPABASE, ensureSchema, getClientByPhone, upsertClient, listClients, getQA, insertQA, logMsg, listMessages, clearQA, deleteQA, getFlow, setFlow, clearFlow, getMiss, setMiss, clearMiss };
