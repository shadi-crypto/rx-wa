// وسيلة — منصة أتمتة واتساب متعددة العملاء (multi-tenant)
// آمن 100%: WhatsApp Cloud API الرسمي من ميتا (صفر خطر حظر)
// كل عميل: رقم WABA خاص + أتمتة مخصصة + توكن محفوظ بسرية
// فيه لوحة إدارة (admin) + inbox + حفظ دائم للبيانات

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'RxWa@2026!SecureVerify';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'RxWa@2026!Admin';
const API_VERSION = process.env.WA_API_VERSION || 'v19.0';
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// ---------- تحميل العملاء من ملف (دائم) ----------
function loadClients() {
  try { return JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf8')); }
  catch { return {}; }
}
function saveClients(c) { fs.writeFileSync(CLIENTS_FILE, JSON.stringify(c, null, 2)); }
let CLIENTS = loadClients();

// ---------- حفظ الرسائل (inbox) ----------
function logMessage(clientId, from, dir, text) {
  let msgs = [];
  try { msgs = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch {}
  msgs.push({ clientId, from, dir, text, at: new Date().toISOString() });
  if (msgs.length > 1000) msgs = msgs.slice(-1000);
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msgs));
}

// ---------- webhook verification (تفعيل ميتا) ----------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ---------- استقبال الرسائل ----------
app.post('/webhook', (req, res) => {
  res.sendStatus(200); // رد فوري لميتا (مطلوب)
  const body = req.body;
  if (!body || body.object !== 'whatsapp_business_account') return;
  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      const value = change.value || {};
      const phoneId = value.metadata && value.metadata.phone_number_id;
      const client = Object.values(CLIENTS).find(c => c.phoneId === phoneId);
      if (!client) continue; // عميل غير معروف
      for (const m of (value.messages || [])) {
        const from = m.from;
        const text = (m.text && m.text.body || '').toLowerCase().trim();
        logMessage(client.id, from, 'in', m.text ? m.text.body : '');
        try { handleMessage(client, from, text); } catch (e) { console.error('handle error:', e.message); }
      }
    }
  }
});

// ---------- إرسال رسالة (لكل عميل توكنه الخاص) ----------
async function sendText(client, to, text) {
  logMessage(client.id, to, 'out', text);
  if (!client.waToken || !client.phoneId) {
    console.log(`[ROUTE] ${client.name} (${client.flow}) -> ${to}: ${text}`);
    return;
  }
  const url = `https://graph.facebook.com/${API_VERSION}/${client.phoneId}/messages`;
  try {
    await axios.post(url, {
      messaging_product: 'whatsapp',
      to, type: 'text', text: { body: text }
    }, { headers: { Authorization: `Bearer ${client.waToken}` } });
  } catch (e) {
    console.error(`send error (${client.name}):`, e.response && e.response.data || e.message);
  }
}

// ---------- محرك الأتمتة المخصص لكل عميل ----------
async function handleMessage(client, from, text) {
  console.log(`[ROUTE] ${client.name} (flow=${client.flow}) <- from ${from}: "${text}"`);
  if (client.flow === 'halat') return halatFlow(client, from, text);
  return genericFlow(client, from, text);
}

// ====== أتمتة هالات (متجر زد) ======
async function halatFlow(client, from, text) {
  if (!text || /^(مرحبا|السلام|قائمة|السلام عليكم)/.test(text)) {
    return sendText(client, from, '👋 أهلاً وسهلاً في *هالات*!\n\nاختر:\n1️⃣ منتجاتنا\n2️⃣ متابعة طلبي\n3️⃣ الأسئلة الشائعة\n4️⃣ موظف');
  }
  if (text.startsWith('1')) return sendText(client, from, '🐾 منتجاتنا: https://halat.sa\nاكتب 2 لمتابعة طلبك.');
  if (text.startsWith('2')) return sendText(client, from, '📦 أرسل رقم طلبك (مثل #1234).');
  if (text.startsWith('3')) return sendText(client, from, '❓ الشحن 2-5 أيام • الدفع مدامي/تحويل/Apple Pay • الإرجاع 14 يوم. اكتب 4.');
  if (text.startsWith('4')) return sendText(client, from, '🙋 فريقنا يتواصل معاك قريباً. أو 966579591669.');
  return sendText(client, from, '🤖 اكتب "قائمة" للخيارات.');
}

// ====== أتمتة عامة (نموذج لأي عميل جديد) ======
async function genericFlow(client, from, text) {
  if (!text || /^(مرحبا|السلام|قائمة|السلام عليكم)/.test(text)) {
    return sendText(client, from, `👋 أهلاً بك في *${client.name}*!\n\nاكتب 1 للمساعدة.`);
  }
  if (text.startsWith('1')) return sendText(client, from, '🙋 أحد فريقنا يتواصل معاك.');
  return sendText(client, from, '🤖 اكتب "قائمة" للخيارات.');
}

// ---------- حماية اللوحة بباسورد ----------
function checkAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const expected = 'Basic ' + Buffer.from('admin:' + ADMIN_PASSWORD).toString('base64');
  if (auth === expected) return next();
  res.set('WWW-Authenticate', 'Basic realm="Wasilah Admin"');
  return res.status(401).send('🔒 مصرح فقط');
}

// ---------- لوحة الإدارة ----------
app.get('/admin', checkAuth, (req, res) => res.send(adminHtml()));
app.post('/admin/client', checkAuth, (req, res) => {
  const { id, name, phoneId, waToken, flow } = req.body;
  if (!id || !phoneId || !waToken) return res.status(400).send('missing fields');
  CLIENTS[id] = { id, name, phoneId, waToken, flow: flow || 'generic' };
  saveClients(CLIENTS);
  res.redirect('/admin');
});

app.get('/admin/api/messages', (req, res) => {
  let msgs = [];
  try { msgs = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch {}
  res.json(msgs.slice(-50).reverse());
});

function adminHtml() {
  const clients = Object.values(CLIENTS)
    .map(c => `<li><b>${c.name}</b> — flow: ${c.flow} — phone: ${c.phoneId}</li>`)
    .join('') || '<li>لا يوجد عملاء بعد</li>';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <title>وسيلة — لوحة الإدارة</title>
  <style>body{font-family:Tahoma,Segoe UI,sans-serif;background:#FBF7F0;color:#1F2933;padding:30px;max-width:760px;margin:auto}
  input,select{padding:9px;margin:5px 0;width:100%;box-sizing:border-box;border:1px solid #ECE3D5;border-radius:8px}
  .card{background:#fff;border:1px solid #ECE3D5;border-radius:14px;padding:22px;margin-bottom:20px}
  button{background:#25D366;color:#fff;border:0;padding:11px 22px;border-radius:8px;cursor:pointer;font-weight:700}
  h1{font-size:26px}h3{margin-top:0}li{margin:4px 0}</style></head>
  <body>
  <h1>💬 وسيلة — لوحة الإدارة</h1>
  <div class="card"><h3>العملاء المسجلون</h3><ul>${clients}</ul></div>
  <div class="card"><h3>إضافة عميل جديد</h3>
  <form method="POST" action="/admin/client">
    <input name="id" placeholder="معرف فريد (مثال: halat)" required>
    <input name="name" placeholder="اسم العميل (مثال: هالات)" required>
    <input name="phoneId" placeholder="Phone ID من ميتا" required>
    <input name="waToken" placeholder="WhatsApp Token من ميتا" required>
    <select name="flow"><option value="generic">عام</option><option value="halat">هالات (متجر)</option></select>
    <button>إضافة العميل</button>
  </form></div>
  <div class="card"><h3>أحدث الرسائل (Inbox)</h3>
  <p><a href="/admin/api/messages">عرض JSON</a></p>
  <div id="msgs"></div>
  <script>fetch('/admin/api/messages').then(r=>r.json()).then(d=>{
    document.getElementById('msgs').innerHTML = d.map(m=>
      '<div style="border-bottom:1px solid #eee;padding:6px 0"><b>'+m.clientId+'</b> ['+m.dir+'] '+m.from+': '+m.text+'<br><small>'+m.at+'</small></div>'
    ).join('') || 'لا رسائل بعد';
  });</script></div>
  </body></html>`;
}

// ---------- تشغيل ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 وسيلة multi-tenant شغّالة على ${PORT} — العملاء: ${Object.keys(CLIENTS).join(', ') || 'لا يوجد'}`));
