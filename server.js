// RX WA — منصة أتمتة واتساب (بدون LLM، بقاعدة بيانات Q&A ذكية)
// آمنة 100%: WhatsApp Cloud API الرسمي من ميتا (صفر خطر حظر)
// كل عميل: رقم WABA خاص + قاعدة أسئلة/أجوبة خاصة + تشابه دلالي (يفهم اللهجة)
// الواجهة: لوحة إدارة محمية بباسورد + inbox

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'RxWa@2026!SecureVerify';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'RxWa@2026!Admin';
const API_VERSION = process.env.WA_API_VERSION || 'v19.0';
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'wasilah.db'));
db.pragma('journal_mode = WAL');
db.pragma('encoding = "UTF-8"');
app.use((req, res, next) => { res.set('Content-Type', 'text/html; charset=utf-8'); next(); });

// ---------- جداول قاعدة البيانات ----------
db.prepare(`CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, name TEXT, phone_id TEXT UNIQUE, wa_token TEXT, flow TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS qa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT,
  question TEXT,
  keywords TEXT,
  reply TEXT,
  FOREIGN KEY(client_id) REFERENCES clients(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT, from_num TEXT, direction TEXT, text TEXT, at TEXT
)`).run();

// ---------- إضافة عميل تجريبي (هالات) أول مرة ----------
const halatExists = db.prepare('SELECT id FROM clients WHERE id = ?').get('halat');
if (!halatExists) {
  db.prepare('INSERT INTO clients (id,name,phone_id,wa_token,flow) VALUES (?,?,?,?,?)').run(
    'halat', 'هالات', process.env.HALAT_PHONE_ID || 'HALATID',
    process.env.HALAT_WA_TOKEN || 'demo', 'qa'
  );
  // أسئلة هالات الافتراضية (تقدر تعدلها من اللوحة)
  const seed = [
    ['كم مدة الشحن', 'شحن,توصيل,وصل,قديش,متى', '🚚 الشحن ياخذ 2-5 أيام عمل داخل السعودية.'],
    ['وين أقدر أدفع', 'دفع,فلوس,سعر,باقة,مدى', '💳 نقبل مدى / تحويل / Apple Pay.'],
    ['كيف أرجع الطلب', 'إرجاع,استرجاع,غير,تغيير', '↩️ الإرجاع متاح خلال 14 يوم من الاستلام.'],
    ['ايش المنتجات', 'منتج,طلب,شراء,بضاعة,هالات', '🐾 تلقى كل منتجاتنا هنا: https://halat.sa'],
    ['تواصل مع موظف', 'موظف,اتصال,إدارة,مساعدة', '🙋 فريق هالات يتواصل معاك قريباً. أو تواصل على 966579591669.']
  ];
  const ins = db.prepare('INSERT INTO qa (client_id,question,keywords,reply) VALUES (?,?,?,?)');
  for (const [q, k, r] of seed) ins.run('halat', q, k, r);
}

// ---------- أدوات ----------
function getClientByPhone(phoneId) {
  return db.prepare('SELECT * FROM clients WHERE phone_id = ?').get(phoneId);
}
function logMsg(clientId, from, dir, text) {
  db.prepare('INSERT INTO messages (client_id,from_num,direction,text,at) VALUES (?,?,?,?,?)')
    .run(clientId, from, dir, text, new Date().toISOString());
}

// ---------- مطابقة الجواب (كلمات مفتاحية + تشابه دلالي) ----------
const Fuse = require('fuse.js');
function findReply(client, text) {
  const rows = db.prepare('SELECT * FROM qa WHERE client_id = ?').all(client.id);
  if (!rows.length) return null;
  const lower = text.toLowerCase();
  // 1) مطابقة كلمات مفتاحية (سريعة ودقيقة)
  for (const r of rows) {
    const keys = (r.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
    if (keys.some(k => lower.includes(k))) return r.reply;
  }
  // 2) تشابه دلالي (يفهم صيغ مختلفة)
  const fuse = new Fuse(rows, { keys: ['question', 'keywords'], threshold: 0.5 });
  const hit = fuse.search(text);
  if (hit.length) return hit[0].item.reply;
  return null;
}

// ---------- webhook verification ----------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// ---------- استقبال الرسائل ----------
app.post('/webhook', (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (!body || body.object !== 'whatsapp_business_account') return;
  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      const value = change.value || {};
      const phoneId = value.metadata && value.metadata.phone_number_id;
      const client = getClientByPhone(phoneId);
      if (!client) continue;
      for (const m of (value.messages || [])) {
        const from = m.from;
        const text = (m.text && m.text.body || '').trim();
        logMsg(client.id, from, 'in', text);
        handleMessage(client, from, text);
      }
    }
  }
});

// ---------- إرسال ----------
async function sendText(client, to, text) {
  logMsg(client.id, to, 'out', text);
  if (!client.wa_token || client.wa_token === 'demo' || !client.phone_id) {
    console.log(`[ROUTE] ${client.name} -> ${to}: ${text}`);
    return;
  }
  const url = `https://graph.facebook.com/${API_VERSION}/${client.phone_id}/messages`;
  try {
    await axios.post(url, { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
      { headers: { Authorization: `Bearer ${client.wa_token}` } });
  } catch (e) { console.error('send error:', e.response && e.response.data || e.message); }
}

// ---------- محرك الرد ----------
async function handleMessage(client, from, text) {
  console.log(`[ROUTE] ${client.name} <- ${from}: "${text}"`);
  const lower = text.toLowerCase();
  // تحية / قائمة
  if (!text || /^(مرحبا|السلام|قائمة|السلام عليكم|start)/.test(lower)) {
    return sendText(client, from,
      `👋 أهلاً وسهلاً في *${client.name}*!\n\nاكتب سؤالك وسنرد عليك تلقائياً، أو اكتب "موظف" للتواصل مع أحد الفريق.`);
  }
  if (lower.includes('موظف') || lower.includes('اتصال')) {
    return sendText(client, from, '🙋 فريقنا يتواصل معاك قريباً. أو تواصل على 966579591669.');
  }
  // بحث في قاعدة الأسئلة
  const reply = findReply(client, text);
  if (reply) return sendText(client, from, reply);
  return sendText(client, from, '🤖 ما قدرت أفهم سؤالك. اكتب كلمات أوضح، أو "موظف" للتواصل المباشر.');
}

// ---------- حماية اللوحة ----------
function checkAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const expected = 'Basic ' + Buffer.from('admin:' + ADMIN_PASSWORD).toString('base64');
  if (auth === expected) return next();
  res.set('WWW-Authenticate', 'Basic realm="RX WA Admin"');
  return res.status(401).send('🔒 مصرح فقط');
}

// ---------- مسار فحص الصحة (مفتوح لـ Render) ----------
app.get('/health', (req, res) => res.status(200).send('OK'));

// ---------- لوحة الإدارة ----------
app.get('/admin', checkAuth, (req, res) => res.send(adminHtml()));

app.post('/admin/client', checkAuth, (req, res) => {
  const { id, name, phoneId, waToken, flow } = req.body;
  if (!id || !phoneId || !waToken) return res.status(400).send('missing fields');
  db.prepare(`INSERT INTO clients (id,name,phone_id,wa_token,flow) VALUES (?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=?, phone_id=?, wa_token=?, flow=?`)
    .run(id, name, phoneId, waToken, flow || 'qa', name, phoneId, waToken, flow || 'qa');
  res.redirect('/admin');
});

app.post('/admin/qa', checkAuth, (req, res) => {
  const { client_id, question, keywords, reply } = req.body;
  if (!client_id || !question || !reply) return res.status(400).send('missing fields');
  db.prepare('INSERT INTO qa (client_id,question,keywords,reply) VALUES (?,?,?,?)')
    .run(client_id, question, keywords, reply);
  res.redirect('/admin');
});

app.get('/admin/api/messages', checkAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 50').all();
  res.json(rows);
});

function adminHtml() {
  const clients = db.prepare('SELECT * FROM clients').all();
  const qa = db.prepare('SELECT * FROM qa ORDER BY client_id').all();
  const clientOpts = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const qaRows = qa.map(r => `<tr><td>${r.client_id}</td><td>${r.question}</td><td>${r.keywords}</td><td>${r.reply}</td></tr>`).join('') || '<tr><td colspan="4">لا يوجد</td></tr>';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>RX WA — لوحة التحكم</title>
  <style>body{font-family:Tahoma,Segoe UI,sans-serif;background:#FBF7F0;color:#1F2933;padding:24px;max-width:900px;margin:auto}
  input,select,textarea{padding:9px;margin:5px 0;width:100%;box-sizing:border-box;border:1px solid #ECE3D5;border-radius:8px}
  .card{background:#fff;border:1px solid #ECE3D5;border-radius:14px;padding:20px;margin-bottom:18px}
  button{background:#25D366;color:#fff;border:0;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:700}
  h1{font-size:24px}h3{margin-top:0}table{width:100%;border-collapse:collapse}td,th{border:1px solid #eee;padding:6px;text-align:right;font-size:13px}</style></head>
  <body>
  <h1>💬 RX WA — لوحة التحكم</h1>
  <div class="card"><h3>إضافة عميل جديد</h3>
    <form method="POST" action="/admin/client">
      <input name="id" placeholder="معرف (halat)" required>
      <input name="name" placeholder="الاسم (هالات)" required>
      <input name="phoneId" placeholder="Phone ID من ميتا" required>
      <input name="waToken" placeholder="Token من ميتا" required>
      <input name="flow" placeholder="qa" value="qa">
      <button>إضافة</button>
    </form></div>
  <div class="card"><h3>إضافة سؤال/جواب (Q&A)</h3>
    <form method="POST" action="/admin/qa">
      <select name="client_id">${clientOpts}</select>
      <input name="question" placeholder="السؤال (مثال: كم مدة الشحن)">
      <input name="keywords" placeholder="كلمات مفتاحية (شحن,توصيل,وصل) — مفصولة بفواصل">
      <textarea name="reply" placeholder="الرد"></textarea>
      <button>إضافة سؤال</button>
    </form></div>
  <div class="card"><h3>قاعدة الأسئلة الحالية</h3>
    <table><tr><th>عميل</th><th>سؤال</th><th>كلمات</th><th>رد</th></tr>${qaRows}</table></div>
  <div class="card"><h3>أحدث المحادثات</h3><div id="msgs"></div>
    <script>fetch('/admin/api/messages').then(r=>r.json()).then(d=>{
      document.getElementById('msgs').innerHTML = d.map(m=>
        '<div style="border-bottom:1px solid #eee;padding:5px 0"><b>'+m.client_id+'</b> ['+m.direction+'] '+m.from_num+': '+m.text+'</div>'
      ).join('') || 'لا رسائل';
    });</script></div>
  </body></html>`;
}

// ---------- تشغيل ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 RX WA شغّالة على ${PORT} — العملاء:`, db.prepare('SELECT id FROM clients').all().map(c=>c.id).join(', ')));
