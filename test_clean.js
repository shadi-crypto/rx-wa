const https = require('https');
function webhookSim(text, from, hasImage) {
  return new Promise(r => {
    const msg = hasImage ? { from, image: { id: 'x' } } : { from, text: { body: text } };
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: '1270641526122813' }, messages: [msg] } }] }] });
    const req = https.request({ host: 'wasilah-wa.onrender.com', path: '/webhook?hub.mode=subscribe&hub.verify_token=RxWa@2026!SecureVerify&hub.challenge=OK', method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>r()); });
    req.write(body); req.end();
  });
}
function getLastOut() {
  return new Promise(r => {
    const req = https.request({ host: 'wasilah-wa.onrender.com', path: '/admin/api/messages', method: 'GET', auth: 'admin:RxWa@2026!Admin' }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ const m=JSON.parse(d).filter(x=>x.direction==='out'); r(m.length?m[m.length-1].text:'NO OUT'); }catch(e){r('ERR');} }); });
    req.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const cases = [
    ['96771000001', 'كم مدة التوصيل', 'الشحن'],
    ['96771000002', 'كيف أسترجع منتج', 'الاسترجاع'],
    ['96771000003', 'ايميل هالات', 'الإيميل'],
    ['96771000004', 'كم سعر التيشرت', 'التيشرت'],
    ['96771000005', 'هل يشتغلون الجمعة', 'الجمعة'],
    ['96771000006', 'سيارة للبيع', 'غير مفهوم'],
    ['96771000007', 'أبي أعرف أسرار الكون', 'غير مفهوم 3']
  ];
  for (const [from, t, note] of cases) {
    await webhookSim(t, from);
    await wait(1500);
    const out = await getLastOut();
    const ok = (note === 'غير مفهوم' && out.includes('ما قدرت')) || (note === 'غير مفهوم 3' && out.includes('موظف')) || (!note.includes('غير مفهوم') && !out.includes('ما قدرت') && !out.includes('NO OUT') && !out.includes('ERR'));
    console.log((ok?'✅':'❌') + ' ' + note + ' | "' + t + '" => ' + out.slice(0,55));
  }
  console.log('--- تدفق التلف ---');
  await webhookSim('الشحنة وصلتني تالفة', '96771000099');
  await wait(1200); console.log('1:', (await getLastOut()).slice(0,55));
  await webhookSim('#1234', '96771000099');
  await wait(1200); console.log('2:', (await getLastOut()).slice(0,55));
  await webhookSim('هذي صورة المنتج', '96771000099', true);
  await wait(1200); console.log('3:', (await getLastOut()).slice(0,55));
})();
