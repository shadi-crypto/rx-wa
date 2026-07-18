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
  const tests = [
    'السلام عليكم',
    'مرحبا',
    'كم مدة التوصيل',
    'الشحنة وصلتني تالفة',
    'كيف أسترجع منتج',
    'كم سعر الهودي',
    'عندكم منتجات قطط',
    'ايش الكوكيز',
    'كيف أحذف حسابي',
    'ايش أوقات العمل',
    'هل يشتغلون الجمعة',
    'ايميل هالات',
    'رقم واتساب الدعم',
    'فيه خصم',
    'المتجر للأطفال',
    'ما فهمت شي عن السيارات'
  ];
  let ok = 0;
  for (const t of tests) {
    const r = await test(t);
    const good = r !== 'NO_MATCH';
    if (good) ok++;
    console.log((good ? '✅' : '❌') + ' ' + t + ' => ' + r.slice(0, 55));
  }
  console.log('\n=== النتيجة: ' + ok + '/' + tests.length + ' ردت صح ===');
})();
