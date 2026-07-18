const https = require('https');
function webhookSim(text) {
  return new Promise(r => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: '1270641526122813' }, messages: [{ from: '491771673764', text: { body: text } }] } }] }] });
    const req = https.request({ host: 'wasilah-wa.onrender.com', path: '/webhook?hub.mode=subscribe&hub.verify_token=RxWa@2026!SecureVerify&hub.challenge=OK', method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(d)); });
    req.write(body); req.end();
  });
}
function getOut() {
  return new Promise(r => {
    const auth = 'admin:RxWa@2026!Admin';
    const req = https.request({ host: 'wasilah-wa.onrender.com', path: '/admin/api/messages', method: 'GET', auth, headers: {} }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ const m=JSON.parse(d).filter(x=>x.direction==='out'); r(m.length?m[m.length-1].text.slice(0,60):'NO OUT'); }catch(e){r('ERR');} }); });
    req.end();
  });
}
(async () => {
  const cases = [
    ['الشحنة وصلتني تالفة', 'يجب يرد عن التعويض/تالف'],
    ['كيف أسترجع منتج', 'يجب يرد عن الاسترجاع'],
    ['ايميل هالات', 'يجب يرد الإيميل'],
    ['سيارة للبيع', 'غير مفهوم #1'],
    ['متى موعد ماتش الهلال', 'غير مفهوم #2'],
    ['أبي أعرف أسرار الكون', 'غير مفهوم #3 -> موظف']
  ];
  for (const [t, note] of cases) {
    await webhookSim(t);
    await new Promise(r => setTimeout(r, 1500));
    const out = await getOut();
    console.log(note + ' | "' + t + '" => ' + out);
  }
})();
