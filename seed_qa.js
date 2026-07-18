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
  // إيقاظ
  for (let i = 0; i < 4; i++) { await req({ host: 'wasilah-wa.onrender.com', path: '/health', method: 'GET' }); await wait(2000); }
  let ok = 0, fail = 0;
  let first = true;
  for (const q of data) {
    let c;
    const maxRetry = first ? 8 : 5;
    for (let attempt = 0; attempt < maxRetry; attempt++) {
      c = await req({ host: 'wasilah-wa.onrender.com', path: '/admin/qa', method: 'POST' }, q);
      if (c.code !== 502) break;
      await wait(1500);
    }
    first = false;
    if (c.code === 302) ok++; else { fail++; console.log('FAIL', c.code, q.question); }
    await wait(500);
  }
  console.log('DONE ok=' + ok + ' fail=' + fail + ' total=' + data.length);
})();
