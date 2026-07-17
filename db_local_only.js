// تخزين محلي فقط (بدون Supabase) — للاستخدام السريع/المؤقت
// يستخدم better-sqlite3 على قرص السيرفر
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

async function ensureSchema() {}
async function getClientByPhone(p) { return db.prepare('SELECT * FROM clients WHERE phone_id = ?').get(p); }
async function upsertClient({ id, name, phoneId, waToken, flow }) {
  db.prepare('INSERT INTO clients (id,name,phone_id,wa_token,flow) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=?,phone_id=?,wa_token=?,flow=?').run(id, name, phoneId, waToken, flow, name, phoneId, waToken, flow);
}
async function listClients() { return db.prepare('SELECT * FROM clients').all(); }
async function getQA(c) { return db.prepare('SELECT * FROM qa WHERE client_id = ?').all(c); }
async function insertQA({ clientId, question, keywords, reply }) {
  db.prepare('INSERT INTO qa (client_id,question,keywords,reply) VALUES (?,?,?,?)').run(clientId, question, keywords, reply);
}
async function logMsg(r) {
  db.prepare('INSERT INTO messages (client_id,from_num,direction,text,at) VALUES (?,?,?,?,?)').run(r.client_id, r.from_num, r.direction, r.text, r.at);
}
async function listMessages(l) { return db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT ?').all(l); }

module.exports = { USING_SUPABASE, ensureSchema, getClientByPhone, upsertClient, listClients, getQA, insertQA, logMsg, listMessages };
