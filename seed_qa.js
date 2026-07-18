const fs = require('fs');
const https = require('https');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const auth = 'admin:RxWa@2026!Admin';
function post(body) {
  return new Promise((resolve, reject) => {
    const b = JSON.stringify(body);
    const req = https.request({
      host: 'wasilah-wa.onrender.com', path: '/admin/qa', method: 'POST', auth,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.write(b); req.end();
  });
}
(async () => {
  let ok = 0, fail = 0;
  for (const q of data) {
    const c = await post(q);
    if (c === 302) ok++; else { fail++; console.log('FAIL', c, q.question); }
  }
  console.log('DONE ok=' + ok + ' fail=' + fail + ' total=' + data.length);
})();
