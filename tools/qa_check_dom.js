/* qa_check_dom.js —— 校验 JS 引用的 DOM id 均存在于 index.html（防运行时 null 崩溃） */
'use strict';
const fs = require('fs');
const path = require('path');
const WWW = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');

const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
const htmlIds = new Set();
const reId = /id="([^"]+)"/g;
let m;
while ((m = reId.exec(html))) htmlIds.add(m[1]);

const files = fs.readdirSync(path.join(WWW, 'js')).map(f => path.join(WWW, 'js', f));
const refRe = /(?:\$\(|querySelector(?:All)?\(|getElementById\()['"]#([A-Za-z0-9_-]+)/g;
const used = new Set();
const missing = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  refRe.lastIndex = 0;
  let mm;
  while ((mm = refRe.exec(s))) {
    const id = mm[1];
    used.add(id);
    if (!htmlIds.has(id)) missing.add(path.basename(f) + ':' + id);
  }
}
console.log('JS 引用 DOM id 数:', used.size);
console.log('index.html 定义 id 数:', htmlIds.size);
if (missing.size) {
  console.log('缺失（JS 引用但 HTML 未定义）:');
  [...missing].sort().forEach(x => console.log('  ' + x));
  process.exit(1);
} else {
  console.log('所有 JS 引用的 DOM id 均在 HTML 中存在 ✓');
}
