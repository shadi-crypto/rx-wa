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
function listMessages(l) { return P(db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT ?').all(l)); }
function clearQA(c) { db.prepare('DELETE FROM qa WHERE client_id = ?').run(c); return P(); }
function deleteQA(c, q) { db.prepare('DELETE FROM qa WHERE client_id = ? AND question = ?').run(c, q); return P(); }

module.exports = { USING_SUPABASE, ensureSchema, getClientByPhone, upsertClient, listClients, getQA, insertQA, logMsg, listMessages, clearQA, deleteQA };
