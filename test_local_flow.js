const http = require('http');
function w(t, from, img) {
  return new Promise(r => {
    const m = img ? { from, image: { id: 'x' } } : { from, text: { body: t } };
    const b = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: '1270641526122813' }, messages: [m] } }] }] });
    const q = http.request({ host: 'localhost', port: 3000, path: '/webhook?hub.mode=subscribe&hub.verify_token=RxWa@2026!SecureVerify&hub.challenge=OK', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r()); });
    q.write(b); q.end();
  });
}
function last(from) {
  return new Promise(r => {
    const q = http.request({ host: 'localhost', port: 3000, path: '/admin/api/messages', method: 'GET', auth: 'admin:RxWa@2026!Admin' }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { const m = JSON.parse(d).filter(x => x.direction === 'out' && x.text); r(m.length ? m[m.length - 1].text : 'NO OUT'); } catch (e) { r('ERR'); }
      });
    });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const num = '966700' + Date.now().toString().slice(-6);
(async () => {
  const out = ['LOCAL NUM: ' + num];
  await w('الشحنة وصلتني تالفة', num); await wait(2000); out.push('1: ' + (await last(num)).slice(0, 50));
  await w('#1234', num); await wait(2000); out.push('2: ' + (await last(num)).slice(0, 50));
  await w('هذي صورة', num, true); await wait(2000); out.push('3: ' + (await last(num)).slice(0, 50));
  require('fs').writeFileSync('local_flow.txt', out.join('\n'));
  console.log(out.join('\n'));
})();
