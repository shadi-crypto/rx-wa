const https = require('https');
const fs = require('fs');

const QA = JSON.parse(fs.readFileSync('qa_clean.json', 'utf8'));

function w(t, from, img) {
  return new Promise(r => {
    const m = img ? { from, image: { id: 'x' } } : { from, text: { body: t } };
    const b = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: '1270641526122813' }, messages: [m] } }] }] });
    const q = https.request({ host: 'wasilah-wa.onrender.com', path: '/webhook?hub.mode=subscribe&hub.verify_token=RxWa@2026!SecureVerify&hub.challenge=OK', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r()); });
    q.write(b); q.end();
  });
}
function last(from) {
  return new Promise(r => {
    const q = https.request({ host: 'wasilah-wa.onrender.com', path: '/admin/api/messages?from=' + encodeURIComponent(from), method: 'GET', auth: 'admin:RxWa@2026!Admin' }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const m = JSON.parse(d).filter(x => x.direction === 'out' && x.text && x.from_num === from); r(m.length ? m[0].text : 'NO OUT'); } catch (e) { r('ERR'); } });
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').replace(/[*_~`#]/g, '').replace(/\s+/g, ' ').trim();
let counter = 0;
const num = () => '966' + (Date.now() + (counter++ * 7)).toString().slice(-8);

(async () => {
  const out = [];
  // ===== 1) Q&A لكل الـ 47 =====
  let pass = 0, fail = 0;
  for (const q of QA) {
    const n = num();
    await w(q.question, n); await wait(700);
    const got = await last(n);
    const ok = norm(got).includes(norm(q.reply).slice(0, 25));
    if (ok) pass++; else { fail++; out.push(`  Q&A FAIL: "${q.question}" -> "${got.slice(0,40)}"`); }
  }
  out.push(`Q&A: ${pass}/${QA.length} صح، ${fail} فشل`);

  // ===== 2) تدفق التلف متعدد الخطوات =====
  const fn = num();
  await w('الشحنة وصلتني تالفة', fn); await wait(1500);
  const s1 = await last(fn);
  await w('#1234', fn); await wait(1500);
  const s2 = await last(fn);
  await w('هذي صورة', fn, true); await wait(1500);
  const s3 = await last(fn);
  out.push(`تدفق التلف: 1="${s1.slice(0,30)}" | 2="${s2.slice(0,30)}" | 3="${s3.slice(0,30)}"`);
  out.push(`تدفق التلف ${norm(s1).includes('رقم طلبك') && norm(s2).includes('صورة') && norm(s3).includes('استلمنا') ? '✅ شغّال' : '❌ فشل'}`);

  // ===== 3) عداد الفشل -> موظف =====
  const mn = num();
  let lastReply = '';
  for (let i = 1; i <= 3; i++) {
    await w('كلمات عشوائية ' + i + ' زركشة بلابلا', mn); await wait(1200);
    lastReply = await last(mn);
  }
  out.push(`عداد الفشل (3 رسائل): "${lastReply.slice(0,50)}"`);
  out.push(`عداد الفشل ${norm(lastReply).includes('موظف') || norm(lastReply).includes('966579591669') ? '✅ يرجع للموظف' : '❌ ما رجع للموظف'}`);

  fs.writeFileSync('all_test_result.txt', out.join('\n'));
  console.log(out.join('\n'));
})();
