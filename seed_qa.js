const fs = require('fs');
const https = require('https');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const auth = 'admin:RxWa@2026!Admin';
const wait = ms => new Promise(r => setTimeout(r, ms));
function req(opts, body) {
  return new Promise((resolve, reject) => {
    const b = body ? JSON.stringify(body) : null;
    const o = Object.assign({ auth, headers: { 'Content-Type': 'application/json; charset=utf-8' } }, opts);
    if (b) o.headers['Content-Length'] = Buffer.byteLength(b);
    const r = https.request(o, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ code: res.statusCode, d })); });
    r.on('error', reject); if (b) r.write(b); r.end();
  });
}
(async () => {
  await req({ host: 'wasilah-wa.onrender.com', path: '/admin/qa/clear', method: 'POST' }, { client_id: 'halat' });
  console.log('مسح القديم تم');
  let ok = 0, fail = 0;
  for (const q of data) {
    const c = await req({ host: 'wasilah-wa.onrender.com', path: '/admin/qa', method: 'POST' }, q);
    if (c.code === 302) ok++; else { fail++; console.log('FAIL', c.code, q.question); }
    await wait(300); // انتظر بين كل طلب عشان ما نطيح بـ 502
  }
  console.log('DONE ok=' + ok + ' fail=' + fail + ' total=' + data.length);
})();
