// RX WA — منصة أتمتة واتساب (بدون LLM، بقاعدة بيانات Q&A ذكية)
// آمنة 100%: WhatsApp Cloud API الرسمي من ميتا (صفر خطر حظر)
// تخزين: Supabase (دائم + عربي صحيح) مع fallback محلي
// الواجهة: لوحة إدارة محمية بباسورد + inbox

const express = require('express');
const axios = require('axios');
const path = require('path');
const db = require('./db_supabase');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => { res.set('Content-Type', 'text/html; charset=utf-8'); next(); });

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'RxWa@2026!SecureVerify';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'RxWa@2026!Admin';
const API_VERSION = process.env.WA_API_VERSION || 'v19.0';

console.log(`[DB] Supabase ${db.USING_SUPABASE ? 'مفعّل ✅' : 'غير مهيأ — استخدام محلي ⚠️'}`);

// ---------- إضافة عميل تجريبي (هالات) أول مرة ----------
async function seedHalat() {
  const existing = await db.getClientByPhone(process.env.HALAT_PHONE_ID || '1270641526122813');
  if (existing) return;
  await db.upsertClient({
    id: 'halat', name: 'هالات',
    phoneId: process.env.HALAT_PHONE_ID || '1270641526122813',
    waToken: process.env.HALAT_WA_TOKEN || 'demo', flow: 'qa'
  });
  const seed = [
    ['كم مدة الشحن', 'شحن,توصيل,وصل,قديش,متى', '🚚 الشحن ياخذ 2-5 أيام عمل داخل السعودية.'],
    ['وين أقدر أدفع', 'دفع,فلوس,سعر,باقة,مدى', '💳 نقبل مدى / تحويل / Apple Pay.'],
    ['كيف أرجع الطلب', 'إرجاع,استرجاع,غير,تغيير', '↩️ الإرجاع متاح خلال 14 يوم من الاستلام.'],
    ['ايش المنتجات', 'منتج,طلب,شراء,بضاعة,هالات', '🐾 تلقى كل منتجاتنا هنا: https://halat.sa'],
    ['تواصل مع موظف', 'موظف,اتصال,إدارة,مساعدة', '🙋 فريق هالات يتواصل معاك قريباً. أو تواصل على 966579591669.']
  ];
  for (const [q, k, r] of seed) await db.insertQA({ clientId: 'halat', question: q, keywords: k, reply: r });
}

// ---------- مطابقة الجواب (كلمات مفتاحية + تشابه دلالي) ----------
const Fuse = require('fuse.js');
async function findReply(client, text) {
  const rows = await db.getQA(client.id);
  if (!rows.length) return null;
  const lower = text.toLowerCase();
  for (const r of rows) {
    const keys = (r.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
    if (keys.some(k => lower.includes(k))) return r.reply;
  }
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
      db.getClientByPhone(phoneId).then(client => {
        if (!client) return;
        for (const m of (value.messages || [])) {
          const from = m.from;
          const text = (m.text && m.text.body || '').trim();
          db.logMsg(client.id, from, 'in', text);
          handleMessage(client, from, text);
        }
      });
    }
  }
});

// ---------- إرسال ----------
async function sendText(client, to, text) {
  await db.logMsg(client.id, to, 'out', text);
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
  if (!text || /^(مرحبا|السلام|قائمة|السلام عليكم|start)/.test(lower)) {
    return sendText(client, from,
      `👋 أهلاً وسهلاً في *${client.name}*!\n\nاكتب سؤالك وسنرد عليك تلقائياً، أو اكتب "موظف" للتواصل مع أحد الفريق.`);
  }
  if (lower.includes('موظف') || lower.includes('اتصال')) {
    return sendText(client, from, '🙋 فريقنا يتواصل معاك قريباً. أو تواصل على 966579591669.');
  }
  const reply = await findReply(client, text);
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

app.get('/health', (req, res) => res.status(200).send('OK'));

// ---------- لوحة الإدارة ----------
app.get('/admin', checkAuth, (req, res) => adminHtml());

app.post('/admin/client', checkAuth, async (req, res) => {
  const { id, name, phoneId, waToken, flow } = req.body;
  if (!id || !phoneId || !waToken) return res.status(400).send('missing fields');
  await db.upsertClient({ id, name, phoneId, waToken, flow: flow || 'qa' });
  res.redirect('/admin');
});

app.post('/admin/qa', checkAuth, async (req, res) => {
  const { client_id, question, keywords, reply } = req.body;
  if (!client_id || !question || !reply) return res.status(400).send('missing fields');
  await db.insertQA({ clientId: client_id, question, keywords, reply });
  res.redirect('/admin');
});

app.get('/admin/api/messages', checkAuth, async (req, res) => {
  const rows = await db.listMessages(50);
  res.json(rows);
});

async function adminHtml() {
  const clients = await db.listClients();
  const qaRowsData = [];
  for (const c of clients) { const q = await db.getQA(c.id); qaRowsData.push(...q); }
  const clientOpts = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const qaRows = qaRowsData.map(r => `<tr><td>${r.client_id}</td><td>${r.question}</td><td>${r.keywords}</td><td>${r.reply}</td></tr>`).join('') || '<tr><td colspan="4">لا يوجد</td></tr>';
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
(async () => {
  await db.ensureSchema().catch(() => {});
  await seedHalat().catch(e => console.log('seed error:', e.message));
  app.listen(PORT, async () => {
    const cs = await db.listClients();
    console.log(`🚀 RX WA شغّالة على ${PORT} — العملاء:`, cs.map(c => c.id).join(', '));
  });
})();
