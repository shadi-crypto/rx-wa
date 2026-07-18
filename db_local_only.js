// تخزين محلي فقط (بدون Supabase) — كل الدوال ترجع Promise (آمن مع await)
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

const USING_SUPABASE = false;
const P = (v) => Promise.resolve(v);

function ensureSchema() { return P(); }
function getClientByPhone(p) { return P(db.prepare('SELECT * FROM clients WHERE phone_id = ?').get(p)); }
function upsertClient({ id, name, phoneId, waToken, flow }) {
  db.prepare('INSERT INTO clients (id,name,phone_id,wa_token,flow) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=?,phone_id=?,wa_token=?,flow=?').run(id, name, phoneId, waToken, flow, name, phoneId, waToken, flow);
  return P();
}
function listClients() { return P(db.prepare('SELECT * FROM clients').all()); }
function getQA(c) { return P(db.prepare('SELECT * FROM qa WHERE client_id = ?').all(c)); }
function insertQA({ clientId, question, keywords, reply }) {
  db.prepare('INSERT INTO qa (client_id,question,keywords,reply) VALUES (?,?,?,?)').run(clientId, question, keywords, reply);
  return P();
}
function logMsg(r) {
  db.prepare('INSERT INTO messages (client_id,from_num,direction,text,at) VALUES (?,?,?,?,?)').run(r.client_id, r.from_num, r.direction, r.text, r.at);
  return P();
}
function listMessages(l) {
  try {
    db.prepare(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, from_num TEXT, direction TEXT, text TEXT, at TEXT)`).run();
    return P(db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT ?').all(l));
  } catch (e) { console.error('listMessages:', e.message); return P([]); }
}
function clearQA(c) { db.prepare('DELETE FROM qa WHERE client_id = ?').run(c); return P(); }
function deleteQA(c, q) { db.prepare('DELETE FROM qa WHERE client_id = ? AND question = ?').run(c, q); return P(); }

// تخزين حالة المحادثة (تدفق التلف + عداد الفشل) — دائم مع السيرفر
try {
  db.prepare(`CREATE TABLE IF NOT EXISTS flows (num TEXT PRIMARY KEY, step TEXT, ord TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS misses (num TEXT PRIMARY KEY, count INTEGER)`).run();
} catch (e) { console.error('flows/misses table error:', e.message); }
function getFlow(n) { const r = db.prepare('SELECT * FROM flows WHERE num = ?').get(n); return P(r ? { step: r.step, order: r.ord } : null); }
function setFlow(n, step, ord) { db.prepare('INSERT INTO flows (num,step,ord) VALUES (?,?,?) ON CONFLICT(num) DO UPDATE SET step=?,ord=?').run(n, step, ord, step, ord); return P(); }
function clearFlow(n) { db.prepare('DELETE FROM flows WHERE num = ?').run(n); return P(); }
function getMiss(n) { const r = db.prepare('SELECT * FROM misses WHERE num = ?').get(n); return P(r ? r.count : 0); }
function setMiss(n, c) { db.prepare('INSERT INTO misses (num,count) VALUES (?,?) ON CONFLICT(num) DO UPDATE SET count=?').run(n, c, c); return P(); }
function clearMiss(n) { db.prepare('DELETE FROM misses WHERE num = ?').run(n); return P(); }

module.exports = { USING_SUPABASE, ensureSchema, getClientByPhone, upsertClient, listClients, getQA, insertQA, logMsg, listMessages, clearQA, deleteQA, getFlow, setFlow, clearFlow, getMiss, setMiss, clearMiss };
