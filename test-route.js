// سكربت اختبار: يشغّل السيرفر داخلياً ويختبر التوجيه متعدد العملاء
process.env.HALAT_PHONE_ID = 'HALATID';
process.env.HALAT_WA_TOKEN = 'demo';
process.env.DEMO_PHONE_ID = 'DEMOID';
process.env.DEMO_WA_TOKEN = 'demo';
process.env.PORT = '3200';

const axios = require('axios');
require('./server.js');

const payload = (phoneId, from, text) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneId }, messages: [{ from, text: { body: text } }] } }] }]
});

(async () => {
  await new Promise(r => setTimeout(r, 600));
  try {
    await axios.post('http://localhost:3200/webhook', payload('HALATID', '966500000001', 'السلام عليكم'), { headers: { 'Content-Type': 'application/json' } });
    await axios.post('http://localhost:3200/webhook', payload('DEMOID', '966500000002', 'مرحبا'), { headers: { 'Content-Type': 'application/json' } });
    await axios.post('http://localhost:3200/webhook', payload('OTHER', '966500000003', 'hi'), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) { console.log('post error (ignored):', e.message); }
  await new Promise(r => setTimeout(r, 400));
  console.log('--- TEST DONE ---');
  process.exit(0);
})();
