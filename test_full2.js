const https = require('https');
function webhookSim(text, hasImage) {
  return new Promise(r => {
    const msg = hasImage ? { from: '491771673764', image: { id: 'x' } } : { from: '491771673764', text: { body: text } };
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: '1270641526122813' }, messages: [msg] } }] }] });
    const req = https.request({ host: 'wasilah-wa.onrender.com', path: '/webhook?hub.mode=subscribe&hub.verify_token=RxWa@2026!SecureVerify&hub.challenge=OK', method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>r()); });
    req.write(body); req.end();
  });
}
function getOut() {
  return new Promise(r => {
    const req = https.request({ host: 'wasilah-wa.onrender.com', path: '/admin/api/messages', method: 'GET', auth: 'admin:RxWa@2026!Admin' }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ const m=JSON.parse(d).filter(x=>x.direction==='out'); r(m.length?m[m.length-1].text.slice(0,65):'NO OUT'); }catch(e){r('ERR');} }); });
    req.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const cases = [
    ['الشحنة وصلتني تالفة', false, 'تدفق التلف: يطلب رقم الطلب'],
    ['#1234', false, 'يرد يطلب صورة'],
    ['هذي صورة المنتج', true, 'يرد تأكيد البلاغ'],
    ['كم مدة التوصيل', false, 'يرد الشحن صح'],
    ['كيف أسترجع منتج', false, 'يرد الاسترجاع صح'],
    ['ايميل هالات', false, 'يرد الإيميل صح'],
    ['سيارة للبيع', false, 'غير مفهوم #1'],
    ['متى موعد ماتش الهلال', false, 'غير مفهوم #2'],
    ['أبي أعرف أسرار الكون', false, 'غير مفهوم #3 -> موظف']
  ];
  for (const [t, img, note] of cases) {
    await webhookSim(t, img);
    await wait(1500);
    const out = await getOut();
    console.log(note + ' | => ' + out);
  }
})();
