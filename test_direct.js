const https = require('https');
function testReply(text) {
  return new Promise(r => {
    const body = JSON.stringify({ client_id: 'halat', text });
    const req = https.request({ host: 'wasilah-wa.onrender.com', path: '/test-reply', method: 'POST', auth: 'admin:RxWa@2026!Admin', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ r(JSON.parse(d).reply||'NO_MATCH'); }catch(e){r('ERR');} }); });
    req.write(body); req.end();
  });
}
const cases = [
  ['كم مدة التوصيل', 'الشحن'],
  ['كيف أسترجع منتج', 'الاسترجاع'],
  ['ايميل هالات', 'الإيميل'],
  ['كم سعر التيشرت', 'التيشرت'],
  ['هل يشتغلون الجمعة', 'الجمعة'],
  ['سيارة للبيع', 'NO_MATCH']
];
(async () => {
  for (const [q, exp] of cases) {
    const r = await testReply(q);
    const ok = exp === 'NO_MATCH' ? r.includes('NO_MATCH') || r.includes('ما قدرت') : !r.includes('NO_MATCH') && !r.includes('ERR');
    console.log((ok?'✅':'❌') + ' ' + q + ' => ' + r.slice(0,45));
  }
})();
