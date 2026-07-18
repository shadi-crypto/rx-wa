const https = require('https');
const fs = require('fs');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jbXZ1dmlqcXF6b3ZocHJqbWhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDMxNzk0NSwiZXhwIjoyMDk5ODkzOTQ1fQ.awkH8jVWQyUZfjYECSMRdsIm3fDy-EgZsSlxuyt7eQ0';

function w(t, from, img) {
  return new Promise(r => {
    const m = img ? { from, image: { id: 'x' } } : { from, text: { body: t } };
    const b = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: '1270641526122813' }, messages: [m] } }] }] });
    const q = https.request({ host: 'wasilah-wa.onrender.com', path: '/webhook?hub.mode=subscribe&hub.verify_token=RxWa@2026!SecureVerify&hub.challenge=OK', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r()); });
    q.write(b); q.end();
  });
}
function supa(path) {
  return new Promise(r => {
    const q = https.request({ host: 'ocmvuvijqqzovhprjmhb.supabase.co', path: '/rest/v1/' + path, method: 'GET', headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r(d)); });
    q.end();
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const num = '966' + Date.now().toString().slice(-9);

(async () => {
  const out = ['NUM: ' + num];
  await w('الشحنة وصلتني تالفة', num); await wait(2500);
  out.push('Supabase flows after step1: ' + await supa('flows?num=eq.' + num));
  await w('#1234', num); await wait(2500);
  out.push('Supabase flows after step2: ' + await supa('flows?num=eq.' + num));
  fs.writeFileSync('flow_supa2.txt', out.join('\n'));
  console.log(out.join('\n'));
})();
