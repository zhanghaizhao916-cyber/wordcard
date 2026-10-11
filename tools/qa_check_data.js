/* ============================================================
   qa_check_data.js —— QA 独立数据校验脚本（只读，不改源码）
   校验 data/cet4.js 与 data/essays.js：
     词数 / 字段齐全 / 重复 word / 音标乱码 / 例句结构
     essays 5 篇范文 / 50 条好词好句 / 中英齐全 / 无 emoji
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WWW = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');

function loadAssign(file) {
  const code = fs.readFileSync(path.join(WWW, file), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
  return sandbox.window;
}

function emojiRegex() {
  // 覆盖常见 emoji / 变体选择符 / 组合符号
  return /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;
}

const results = { pass: 0, fail: 0, errors: [] };
function check(name, ok, detail) {
  if (ok) { results.pass++; console.log('  [PASS] ' + name); }
  else { results.fail++; results.errors.push(name + (detail ? ' :: ' + detail : '')); console.log('  [FAIL] ' + name + (detail ? ' :: ' + detail : '')); }
}

function main() {
  console.log('== 词库 data/cet4.js ==');
  const w = loadAssign('data/cet4.js');
  const words = w.CET4_WORDS;
  check('CET4_WORDS 是数组', Array.isArray(words));
  const total = Array.isArray(words) ? words.length : 0;
  console.log('  词数 =', total);
  check('词数 ≈ 4522（4522 附近）', total >= 4500 && total <= 4550, '实际 ' + total);

  // 字段齐全
  let missingField = 0, transNotArr = 0, sentNotArr = 0, emptyPhonetic = 0, emptyWord = 0;
  const seen = new Set();
  let dupWord = 0;
  for (const e of words) {
    if (!e || typeof e !== 'object') { missingField++; continue; }
    if (!e.word || !String(e.word).trim()) emptyWord++;
    if (typeof e.word !== 'string') { /* word 非字符串 */ }
    if (!e.phonetic_us && !e.phonetic_uk) emptyPhonetic++;
    if (!Array.isArray(e.trans)) transNotArr++;
    if (!Array.isArray(e.sentences)) sentNotArr++;
    const key = String(e.word).toLowerCase();
    if (seen.has(key)) dupWord++;
    else seen.add(key);
    for (const t of (e.trans || [])) {
      if (t && t.pos === undefined && t.cn === undefined) missingField++;
    }
  }
  check('无空 word', emptyWord === 0, '空 word ' + emptyWord);
  check('无缺失音标（us/uk 至少一个）', emptyPhonetic === 0, '缺音标 ' + emptyPhonetic);
  check('trans 均为数组', transNotArr === 0, 'trans 非数组 ' + transNotArr);
  check('sentences 均为数组', sentNotArr === 0, 'sentences 非数组 ' + sentNotArr);
  check('无重复 word（按小写去重）', dupWord === 0, '重复 ' + dupWord);

  // 抽查 10 个随机词
  const sample = [];
  const idxs = new Set();
  const seed = total;
  while (sample.length < 10 && sample.length < total) {
    const i = Math.floor(Math.random() * total);
    if (idxs.has(i)) continue;
    idxs.add(i);
    sample.push(words[i]);
  }
  let sampleBad = 0;
  const sampleDetail = [];
  for (const e of sample) {
    const ok = e && e.word && (e.phonetic_us || e.phonetic_uk) && Array.isArray(e.trans) && e.trans.length > 0
      && Array.isArray(e.sentences) && e.trans.every(t => t && typeof t.cn === 'string' && t.cn.trim());
    if (!ok) { sampleBad++; sampleDetail.push(e && e.word); }
  }
  check('随机 10 词字段非空、trans 非空、sentences 结构正确', sampleBad === 0,
    '问题词: ' + sampleDetail.join(','));

  // 音标乱码检测：合法音标字符集（IPA + 常见注音符号 + 基本标点）
  const phoneticBad = [];
  const ipa = /[\u00C0-\u024F\u0250-\u02AF\u0300-\u036F\u1D00-\u1D7F\u1D80-\u1DBF\u2018\u2019\u201C\u201D,;:()ˈˌː.]/;
  // 更严格：出现“替换字符”或非 Latin/IPA 的乱码（如方块）
  const garbage = /[\uFFFD\u25A1\u25A0\u00BF\u00A1]/;
  let phTotal = 0, phGarbage = 0;
  for (const e of words) {
    for (const k of ['phonetic_us', 'phonetic_uk']) {
      const p = e[k];
      if (!p) continue;
      phTotal++;
      if (garbage.test(p)) { phGarbage++; if (phoneticBad.length < 5) phoneticBad.push(e.word + ':' + p); }
    }
  }
  check('音标无乱码（无替换字符/方块）', phGarbage === 0, '乱码示例: ' + phoneticBad.join(' | '));

  // 全库 emoji 检测（word/trans/sentences）
  const emo = emojiRegex();
  const emojiHits = [];
  const raw = JSON.stringify(words);
  emo.lastIndex = 0;
  let m;
  while ((m = emo.exec(raw)) !== null) {
    if (emojiHits.length < 5) emojiHits.push(m[0]);
  }
  check('词库无 emoji', emojiHits.length === 0, 'emoji: ' + emojiHits.join(' '));

  console.log('\n== 范文 data/essays.js ==');
  const ew = loadAssign('data/essays.js');
  const essays = ew.CET4_ESSAYS;
  check('CET4_ESSAYS 是对象', essays && typeof essays === 'object');
  const q = (essays && Array.isArray(essays.quotes)) ? essays.quotes : [];
  const es = (essays && Array.isArray(essays.essays)) ? essays.essays : [];
  check('范文正好 5 篇', es.length === 5, '实际 ' + es.length);
  check('好词好句正好 50 条', q.length === 50, '实际 ' + q.length);
  let qBad = 0, eBad = 0;
  for (const x of q) { if (!x || !x.en || !x.cn) qBad++; }
  for (const x of es) { if (!x || !x.id || !x.title || !x.en || !x.cn) eBad++; }
  check('好词好句中英字段齐全', qBad === 0, '缺字段 ' + qBad);
  check('范文中英字段齐全', eBad === 0, '缺字段 ' + eBad);
  const rawE = JSON.stringify(essays);
  emo.lastIndex = 0;
  const emojiHitsE = [];
  while ((m = emo.exec(rawE)) !== null) { if (emojiHitsE.length < 5) emojiHitsE.push(m[0]); }
  check('范文数据无 emoji', emojiHitsE.length === 0, 'emoji: ' + emojiHitsE.join(' '));

  console.log('\n========== 汇总 ==========');
  console.log('PASS:', results.pass, ' FAIL:', results.fail);
  if (results.errors.length) {
    console.log('失败项：');
    results.errors.forEach(e => console.log('  - ' + e));
  }
  process.exit(results.fail ? 1 : 0);
}

main();
