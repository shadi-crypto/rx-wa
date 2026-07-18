const https = require('https');
function test(text) {
  return new Promise(r => {
    const body = JSON.stringify({ client_id: 'halat', text });
    const req = https.request({
      host: 'wasilah-wa.onrender.com', path: '/test-reply', method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r(d)); });
    req.write(body); req.end();
  });
}
(async () => {
  const tests = ['السلام عليكم','كم مدة التوصيل','كم سعر التيشرت','هل تخزنون بيانات بطاقتي','عندي شكوى','هل يشتغلون الجمعة','المنتج نفد من المخزون','وش القانون المطبق','فيه خصم','تواصل مع موظف'];
  for (const t of tests) { const r = await test(t); console.log(t, '=>', r.slice(0, 60)); }
})();
