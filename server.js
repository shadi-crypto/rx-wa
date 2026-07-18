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
app.use(express.json({ type: ['application/json', 'text/plain'] }));
app.use(express.urlencoded({ extended: true, type: 'application/x-www-form-urlencoded' }));
app.use((req, res, next) => { res.set('Content-Type', 'text/html; charset=utf-8'); next(); });

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'RxWa@2026!SecureVerify';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'RxWa@2026!Admin';
const API_VERSION = process.env.WA_API_VERSION || 'v19.0';

console.log(`[DB] Supabase ${db.USING_SUPABASE ? 'مفعّل ✅' : 'غير مهيأ — استخدام محلي ⚠️'}`);

// ---------- إضافة عميل تجريبي (هالات) أول مرة ----------
const OLD_DEFAULTS = ['كم مدة الشحن','وين أقدر أدفع','كيف أرجع الطلب','ايش المنتجات','تواصل مع موظف'];
async function seedHalat() {
  const existing = await db.getClientByPhone(process.env.HALAT_PHONE_ID || '1270641526122813');
  if (existing) {
    // نظّف الأسئلة الافتراضية القديمة (المتداخلة) عشان ما تتداخل مع بنك الأسئلة النظيف
    for (const q of OLD_DEFAULTS) { try { await db.deleteQA('halat', q); } catch (e) {} }
    return;
  }
  await db.upsertClient({
    id: 'halat', name: 'هالات',
    phoneId: process.env.HALAT_PHONE_ID || '1270641526122813',
    waToken: process.env.HALAT_WA_TOKEN || 'demo', flow: 'qa'
  });
}

// ---------- مطابقة الجواب (كلمات مفتاحية + تشابه دلالي) ----------
const Fuse = require('fuse.js');
async function findReply(client, text) {
  const rows = await db.getQA(client.id);
  if (!rows.length) return null;
  const lower = text.toLowerCase();
  // المرحلة 1: fuse على السؤال نفسه (الأدق دلالياً)
  const fuse = new Fuse(rows, { keys: ['question'], threshold: 0.5, ignoreLocation: true, minMatchCharLength: 2 });
  const hit = fuse.search(text);
  if (hit.length && hit[0].score < 0.45) return hit[0].item.reply;
  // المرحلة 2: كلمة مفتاحية فريدة (سؤال واحد فقط) — الوزن = طول الكلمة
  const wordToRows = {};
  for (const r of rows) {
    const keys = (r.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    for (const k of keys) { if (!wordToRows[k]) wordToRows[k] = []; wordToRows[k].push(r); }
  }
  let best = null, bestLen = 0;
  for (const k of Object.keys(wordToRows)) {
    if (k.length >= 3 && lower.includes(k) && wordToRows[k].length === 1 && k.length > bestLen) {
      bestLen = k.length; best = wordToRows[k][0];
    }
  }
  if (best) return best.reply;
  return null;
}

// ---------- اختبار بدون رقم (يرد على نص مباشرة) ----------
app.post('/test-reply', async (req, res) => {
  const { client_id, text } = req.body;
  const clients = await db.listClients();
  const c = clients.find(x => x.id === (client_id || 'halat')) || clients[0];
  if (!c) return res.status(404).send('no client');
  const rows = await db.getQA(c.id);
  const reply = await findReply(c, text);
  res.json({ clientId: c.id, rowsCount: rows.length, firstKeys: rows[0] ? rows[0].keywords : null, sampleRow: rows[2] || null, reply: reply || 'NO_MATCH' });
});

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
          const hasImage = !!(m.image || m.document || m.video);
          db.logMsg(client.id, from, 'in', text || '[صورة]');
          handleMessage(client, from, text, hasImage);
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
async function handleMessage(client, from, text, hasImage) {
  console.log(`[ROUTE] ${client.name} <- ${from}: "${text}"`);
  const lower = text.toLowerCase();

  // ===== تدفق التلف/الكسر (مخزن في Supabase — دائم، يصمد مع cold start) =====
  const flow = await db.getFlow(from);
  if (flow && flow.step) {
    if (lower.includes('إلغاء') || lower.includes('موظف') || lower.includes('اتصال')) {
      await db.clearFlow(from); await db.clearMiss(from);
      return sendText(client, from, '🙋 تم إلغاء الطلب. تتواصل معاك هالات على 966579591669.');
    }
    if (flow.step === 'await_order') {
      await db.setFlow(from, 'await_photo', text.trim());
      return sendText(client, from, '📸 ممتاز. الآن أرسل **صورة واضحة للتلف** (التقط صورة للمنتج التالف) ونرفع بلاغ التعويض لك.');
    }
    if (flow.step === 'await_photo') {
      if (!hasImage) return sendText(client, from, '📸 نحتاج صورة للتلف عشان نرفع البلاغ. أرسل صورة واضحة للمنتج.');
      await db.clearFlow(from); await db.clearMiss(from);
      return sendText(client, from, `✅ استلمنا بلاغك (رقم الطلب: ${flow.order} + الصورة). فريق هالات يراجع ويتواصل معاك خلال 24 ساعة. أو تواصل مباشرة 966579591669.`);
    }
  }

  if (!text || /^(مرحبا|السلام|قائمة|السلام عليكم|start)/.test(lower)) {
    await db.clearMiss(from);
    return sendText(client, from,
      `👋 أهلاً وسهلاً في *${client.name}*!\\\\n\\\\nاكتب سؤالك وسنرد عليك تلقائياً، أو اكتب "موظف" للتواصل مع أحد الفريق.`);
  }
  if (lower.includes('موظف') || lower.includes('اتصال')) {
    await db.clearMiss(from);
    return sendText(client, from, '🙋 فريقنا يتواصل معاك قريباً. أو تواصل على 966579591669.');
  }
  // يبدأ تدفق التلف؟
  if (lower.includes('تالف') || lower.includes('كسر') || lower.includes('تلف') || lower.includes('ضرر') || lower.includes('مكسور')) {
    await db.setFlow(from, 'await_order', '');
    await db.clearMiss(from);
    return sendText(client, from, '⚠️ نأسف للإزعاج! لرفع بلاغ تعويض، أرسل **رقم طلبك** (مثلاً #1234).');
  }
  const reply = await findReply(client, text);
  if (reply) {
    await db.clearMiss(from);
    return sendText(client, from, reply);
  }
  // لم نجد إجابة — نزيد العداد
  const miss = (await db.getMiss(from) || 0) + 1;
  await db.setMiss(from, miss);
  if (miss >= 3) {
    await db.clearMiss(from);
    return sendText(client, from, '🙋 يبدو أن سؤالك خارج نطاق المعرفة الحالية. تواصل مباشرة مع موظف هالات على 966579591669 أو info@Halat.sa وسيساعدونك فوراً.');
  }
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
app.get('/debug-db', (req, res) => res.json({ usingSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY && process.env.SUPABASE_KEY.length >= 40), hasUrl: !!process.env.SUPABASE_URL, hasKey: !!process.env.SUPABASE_KEY }));

// ---------- لوحة الإدارة ----------
app.get('/admin', checkAuth, async (req, res) => res.send(await adminHtml()));

app.post('/admin/client', checkAuth, async (req, res) => {
  const { id, name, phoneId, waToken, flow } = req.body;
  if (!id || !phoneId || !waToken) return res.status(400).send('missing fields');
  await db.upsertClient({ id, name, phoneId, waToken, flow: flow || 'qa' });
  res.redirect('/admin');
});

app.post('/admin/qa', checkAuth, async (req, res) => {
  let rows = req.body;
  if (!Array.isArray(rows)) rows = [rows];
  for (const r of rows) {
    const { client_id, question, keywords, reply } = r;
    if (!client_id || !question || !reply) continue;
    await db.insertQA({ clientId: client_id, question, keywords, reply });
  }
  res.redirect('/admin');
});

app.post('/admin/qa/clear', checkAuth, async (req, res) => {
  const { client_id } = req.body;
  await db.clearQA(client_id || 'halat');
  res.redirect('/admin');
});

// حذف سؤال واحد (أخف من clear — ما يطيح السيرفر)
app.post('/admin/qa/delete', checkAuth, async (req, res) => {
  const { client_id, question } = req.body;
  await db.deleteQA(client_id || 'halat', question);
  res.redirect('/admin');
});

app.get('/admin/api/messages', checkAuth, async (req, res) => {
  try {
    const rows = await db.listMessages(50);
    res.json(rows);
  } catch (e) { res.json([]); }
});

// مسح الرسائل (للاختبار)
app.post('/admin/api/clear-messages', checkAuth, async (req, res) => {
  try { await db.clearMessages(); res.json({ ok: true }); } catch (e) { res.json({ ok: false }); }
});

// تشخيص: حالة الملف + تدفق التلف
app.get('/admin/api/debug-flow', checkAuth, async (req, res) => {
  const flow = await db.getFlow('96771000099');
  const fs = require('fs');
  let fileOk = false, fileLen = 0;
  try { const s = fs.statSync('/tmp/store.json'); fileOk = true; fileLen = s.size; } catch (e) {}
  res.json({ flow, fileOk, fileLen, dbFile: '/tmp/store.json' });
});

app.get('/admin/api/qa', checkAuth, async (req, res) => {
  const clients = await db.listClients();
  const all = [];
  for (const c of clients) { const q = await db.getQA(c.id); all.push(...q); }
  // نطبع توزيع client_id
  const dist = {};
  for (const r of all) dist[r.client_id] = (dist[r.client_id]||0)+1;
  res.json({ count: all.length, clientIds: dist, sample: all.slice(0,2).map(r => ({ cid: r.client_id, q: r.question })) });
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
