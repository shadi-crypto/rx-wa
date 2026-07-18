const fs = require('fs');
const https = require('https');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const auth = 'admin:RxWa@2026!Admin';
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
  // 1) امسح القديم
  await req({ host: 'wasilah-wa.onrender.com', path: '/admin/qa/clear', method: 'POST' }, { client_id: 'halat' });
  console.log('مسح القديم تم');
  // 2) أضف الجديد
  let ok = 0, fail = 0;
  for (const q of data) {
    const c = await req({ host: 'wasilah-wa.onrender.com', path: '/admin/qa', method: 'POST' }, q);
    if (c.code === 302) ok++; else { fail++; console.log('FAIL', c.code, q.question); }
  }
  console.log('DONE ok=' + ok + ' fail=' + fail + ' total=' + data.length);
})();
