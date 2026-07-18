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
let counter = 0;
const num = () => '966' + (Date.now() + (counter++ * 11)).toString().slice(-8);

(async () => {
  const out = [];
  // ننظف الرسائل أولاً عشان الفلتر يضبط
  await new Promise(r => { const q = https.request({ host: 'wasilah-wa.onrender.com', path: '/admin/api/clear-messages', method: 'POST', auth: 'admin:RxWa@2026!Admin' }, res => { res.on('data', () => {}); res.on('end', () => r()); }); q.end(); });
  await wait(1000);

  // ===== 1) Q&A — نجرب عيّنة ممثلة (10 أسئلة) بدل 47 لتفادي امتلاء الـ 50 =====
  const sample = QA.filter((_, i) => i % 5 === 0).slice(0, 10);
  let pass = 0, fail = 0;
  for (const q of sample) {
    const n = num();
    await new Promise(r => { const q2 = https.request({ host: 'wasilah-wa.onrender.com', path: '/admin/api/clear-messages', method: 'POST', auth: 'admin:RxWa@2026!Admin' }, res => { res.on('data', () => {}); res.on('end', () => r()); }); q2.end(); });
    await wait(400);
    await w(q.question, n); await wait(1500);
    const got = await last(n);
    const ok = (got || '').includes((q.reply || '').slice(0, 20).replace(/[*_~`#]/g, ''));
    if (ok) pass++; else { fail++; out.push(`  FAIL: "${q.question}" -> "${got.slice(0,40)}"`); }
  }
  out.push(`Q&A sample (10): ${pass} صح، ${fail} فشل`);

  // ===== 2) تدفق التلف =====
  const fn = num();
  await new Promise(r => { const q = https.request({ host: 'wasilah-wa.onrender.com', path: '/admin/api/clear-messages', method: 'POST', auth: 'admin:RxWa@2026!Admin' }, res => { res.on('data', () => {}); res.on('end', () => r()); }); q.end(); });
  await wait(400);
  await w('الشحنة وصلتني تالفة', fn); await wait(1500);
  const s1 = await last(fn);
  await w('#1234', fn); await wait(1500);
  const s2 = await last(fn);
  await w('هذي صورة', fn, true); await wait(1500);
  const s3 = await last(fn);
  out.push(`تدفق التلف: 1="${s1.slice(0,25)}" | 2="${s2.slice(0,25)}" | 3="${s3.slice(0,25)}"`);
  out.push(`تدفق التلف ${norm(s1).includes('رقم طلبك') && norm(s2).includes('صورة') && norm(s3).includes('استلمنا') ? '✅ شغّال' : '❌ فشل'}`);

  // ===== 3) عداد الفشل -> موظف =====
  const mn = num();
  await new Promise(r => { const q = https.request({ host: 'wasilah-wa.onrender.com', path: '/admin/api/clear-messages', method: 'POST', auth: 'admin:RxWa@2026!Admin' }, res => { res.on('data', () => {}); res.on('end', () => r()); }); q.end(); });
  await wait(400);
  let lastReply = '';
  for (let i = 1; i <= 3; i++) {
    await w('كلمات عشوائية ' + i + ' زركشة بلابلا', mn); await wait(1200);
    lastReply = await last(mn);
    await new Promise(r => { const q = https.request({ host: 'wasilah-wa.onrender.com', path: '/admin/api/clear-messages', method: 'POST', auth: 'admin:RxWa@2026!Admin' }, res => { res.on('data', () => {}); res.on('end', () => r()); }); q.end(); });
    await wait(300);
  }
  out.push(`عداد الفشل: "${lastReply.slice(0,40)}"`);
  out.push(`عداد الفشل ${norm(lastReply).includes('موظف') || norm(lastReply).includes('966579591669') ? '✅ يرجع للموظف' : '❌ ما رجع'}`);

  fs.writeFileSync('all_test_result.txt', out.join('\n'));
  console.log(out.join('\n'));
})();
function norm(s) { return (s || '').replace(/[*_~`#]/g, '').replace(/\s+/g, ' ').trim(); }
