const fs = require('fs');
const Fuse = require('fuse.js');
function findReply(rows, text) {
  const lower = text.toLowerCase();
  const wordToRows = {};
  for (const r of rows) {
    const keys = (r.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    for (const k of keys) {
      if (!wordToRows[k]) wordToRows[k] = [];
      wordToRows[k].push(r);
    }
  }
  let best = null;
  for (const k of Object.keys(wordToRows)) {
    if (k.length >= 3 && lower.includes(k)) {
      if (wordToRows[k].length === 1) {
        if (!best || k.length > best.klen) best = { r: wordToRows[k][0], klen: k.length };
      }
    }
  }
  if (best) return best.r.reply.slice(0, 40);
  const fuse = new Fuse(rows, { keys: ['question'], threshold: 0.5, ignoreLocation: true });
  const hit = fuse.search(text);
  if (hit.length && hit[0].score < 0.4) return hit[0].item.reply.slice(0, 40);
  return 'NO_MATCH';
}
const rows = JSON.parse(fs.readFileSync('qa_clean.json', 'utf8'));
const tests = ['كم مدة التوصيل','كيف أسترجع منتج','ايميل هالات','كم سعر التيشرت','هل يشتغلون الجمعة','سيارة للبيع','الشحنة وصلتني تالفة','ايش المنتجات'];
for (const t of tests) console.log(t + ' => ' + findReply(rows, t));
