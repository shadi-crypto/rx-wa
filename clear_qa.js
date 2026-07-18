const db = require('./db_local_only');
(async () => {
  try {
    await db.deleteAllQA('halat');
    console.log('تم مسح كل أسئلة halat');
  } catch (e) { console.log('خطأ:', e.message); }
  process.exit(0);
})();
