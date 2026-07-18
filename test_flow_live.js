const https = require('https');
const fs = require('fs');

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
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const m = JSON.parse(d).filter(x => x.direction === 'out' && x.text && x.from_num === from); r(m.length ? m[m.length - 1].text : 'NO OUT'); } catch (e) { r('ERR'); } });
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const num = '966' + Date.now().toString().slice(-9); // رقم فريد كل مرة

(async () => {
  const out = [];
  out.push('TEST NUMBER: ' + num);
  await w('الشحنة وصلتني تالفة', num); await wait(2500);
  out.push('1 (طلب الرقم): ' + (await last(num)).slice(0, 60));
  await w('#1234', num); await wait(2500);
  out.push('2 (طلب الصورة): ' + (await last(num)).slice(0, 60));
  await w('هذي صورة', num, true); await wait(2500);
  out.push('3 (تأكيد): ' + (await last(num)).slice(0, 60));
  // اختبار الثبات: ننتظر 3 ثواني ثم نبعث رسالة ثانية (نفس الرقم) — لازم يكمل التدفق مو يرجع للبداية
  await wait(3000);
  await w('رقم طلبي صح', num); await wait(2500);
  out.push('4 (بعد انتظار + رسالة): ' + (await last(num)).slice(0, 60));
  fs.writeFileSync('flow_result.txt', out.join('\n'));
  console.log(out.join('\n'));
})();
