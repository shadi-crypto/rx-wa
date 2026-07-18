const http = require('http');
const fs = require('fs');
const QA = JSON.parse(fs.readFileSync('qa_clean.json', 'utf8'));
function w(t, from, img) { return new Promise(r => { const m = img ? { from, image: { id: 'x' } } : { from, text: { body: t } }; const b = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: '1270641526122813' }, messages: [m] } }] }] }); const q = http.request({ host: 'localhost', port: 3001, path: '/webhook?hub.mode=subscribe&hub.verify_token=RxWa@2026!SecureVerify&hub.challenge=OK', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r()); }); q.write(b); q.end(); }); }
function last(from) { return new Promise(r => { const q = http.request({ host: 'localhost', port: 3001, path: '/admin/api/messages?from=' + encodeURIComponent(from), method: 'GET', auth: 'admin:RxWa@2026!Admin' }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const m = JSON.parse(d).filter(x => x.direction === 'out' && x.text && x.from_num === from); r(m.length ? m[0].text : 'NO OUT'); } catch (e) { r('ERR'); } }); }); q.end(); }); }
const wait = ms => new Promise(r => setTimeout(r, ms));
let c = 0; const num = () => '966' + (Date.now() + (c++ * 11)).toString().slice(-8);
(async () => {
  const sample = QA.filter((_, i) => i % 6 === 0).slice(0, 8);
  let pass = 0, fail = 0, fails = [];
  for (const q of sample) { const n = num(); await w(q.question, n); await wait(800); const got = await last(n); const ok = (got || '').includes((q.reply || '').slice(0, 20).replace(/[*_~`#]/g, '')); if (ok) pass++; else { fail++; fails.push(`FAIL "${q.question}" -> "${got.slice(0, 30)}"`); } }
  console.log(`Q&A: ${pass}/${sample.length} صح`);
  fails.forEach(f => console.log('  ' + f));
  const fn = num(); await w('الشحنة وصلتني تالفة', fn); await wait(1000); const s1 = await last(fn); await w('#1234', fn); await wait(1000); const s2 = await last(fn); await w('هذي صورة', fn, true); await wait(1000); const s3 = await last(fn);
  console.log(`تدفق: 1="${s1.slice(0, 25)}" 2="${s2.slice(0, 25)}" 3="${s3.slice(0, 30)}"`);
  console.log(`تدفق ${s1.includes('رقم طلبك') && s2.includes('صورة') && s3.includes('استلمنا') ? '✅' : '❌'}`);
  const mn = num(); let lr = ''; for (let i = 1; i <= 3; i++) { await w('زركشة بلابلا ' + i, mn); await wait(800); lr = await last(mn); }
  console.log(`موظف: "${lr.slice(0, 40)}" ${lr.includes('موظف') || lr.includes('966579591669') ? '✅' : '❌'}`);
})();
