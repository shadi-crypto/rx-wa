const https = require('https');
const KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jbXZ1dmlqcXF6b3ZocHJqbWhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjYwNzIwMCwiZXhwIjoyMDY4MTgzMjAwfQ.dummy';
const URL = process.env.SUPABASE_URL || 'https://ocmvuvijqqzovhprjmhb.supabase.co';
function req(path, method, body) {
  return new Promise((resolve) => {
    const b = body ? JSON.stringify(body) : null;
    const o = { host: URL.replace('https://', ''), path, method, headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' } };
    if (b) o.headers['Content-Length'] = Buffer.byteLength(b);
    const r = https.request(o, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve({ code: res.statusCode, d: JSON.parse(d) }); } catch (e) { resolve({ code: res.statusCode, d }); } }); });
    r.on('error', e => resolve({ code: 0, d: e.message }));
    if (b) r.write(b); r.end();
  });
}
(async () => {
  console.log('clients:', JSON.stringify(await req('/rest/v1/clients?select=*', 'GET')));
  console.log('qa count:', JSON.stringify(await req('/rest/v1/qa?select=count', 'GET')));
  console.log('insert test:', JSON.stringify(await req('/rest/v1/qa', 'POST', { client_id: 'halat', question: 'TEST_Q', keywords: 'test', reply: 'TEST_R' })));
  console.log('qa after insert:', JSON.stringify(await req('/rest/v1/qa?select=count', 'GET')));
  console.log('delete test:', JSON.stringify(await req('/rest/v1/qa?question=eq.TEST_Q', 'DELETE')));
})();
