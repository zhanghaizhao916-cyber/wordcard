/* ============================================================
   qa_check_logic.js —— QA 独立逻辑校验脚本（只读，不改源码）
   在 node 沙箱里加载真实源码 store.js/words.js/srs.js/stats.js，
   对核心纯函数做最小可运行验证：
     - SM-2 简化版状态转移 / 间隔 / next_review_at（本地日期，无 UTC 坑）
     - 每日队列（复习优先 + 间隔升序 + 补新词）
     - 打卡连续天数（断签重置）
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WWW = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');
const read = f => fs.readFileSync(path.join(WWW, f), 'utf8');

// 固定“今天” = 2026-01-10（本地），保证日期断言稳定
const TODAY = '2026-01-10';
function fakeDate(...args) {
  if (args.length === 0) return new Date(2026, 0, 10, 12, 0, 0);
  return new Date(...args);
}
fakeDate.now = () => new Date(2026, 0, 10, 12, 0, 0).getTime();
fakeDate.UTC = Date.UTC;
fakeDate.parse = Date.parse;

// localStorage 内存 mock
const mem = {};
const localStorageMock = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
};

// 关键：让 window 就是全局对象本身（浏览器里 window===globalThis），
// 这样源码里裸写的 Store/Util/Words 才能解析到 window.* 上挂的导出。
const sandbox = {
  localStorage: localStorageMock,
  document: { querySelector: () => null, addEventListener: () => {}, querySelectorAll: () => [] },
  Date: fakeDate,
  Map, Set, JSON, Math, String, Array, Object, console
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// 按真实 index.html 依赖顺序加载
['js/store.js', 'js/words.js', 'js/srs.js', 'js/stats.js'].forEach(f => {
  vm.runInContext(read(f), sandbox, { filename: f });
});
const w = sandbox.window;
const { Util, Store, Words, SRS, Stats } = w;

// 注入一个极小的测试词库
w.CET4_WORDS = [
  { word: 'alpha', phonetic_us: '/ælfə/', phonetic_uk: '/ɑːlfə/', trans: [{ pos: 'n.', cn: '阿尔法' }], sentences: [{ en: 'a', cn: '甲' }] },
  { word: 'beta', phonetic_us: '/beɪtə/', phonetic_uk: '/biːtə/', trans: [{ pos: 'n.', cn: '贝塔' }], sentences: [] },
  { word: 'gamma', phonetic_us: '/gæmə/', phonetic_uk: '/gɑːmə/', trans: [{ pos: 'n.', cn: '伽马' }], sentences: [] },
  { word: 'delta', phonetic_us: '/deltə/', phonetic_uk: '/deltə/', trans: [{ pos: 'n.', cn: '德尔塔' }], sentences: [] }
];
Words.buildIndex();

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  [PASS] ' + name); }
  else { fail++; errors.push(name + (detail ? ' :: ' + detail : '')); console.log('  [FAIL] ' + name + (detail ? ' :: ' + detail : '')); }
}

console.log('== SRS 间隔表 ==');
const exp = [0, 1, 2, 4, 7, 15, 30];
exp.forEach((d, i) => check('intervalFor(stage ' + i + ') = ' + d, SRS.intervalFor(i) === d, 'got ' + SRS.intervalFor(i)));
check('intervalFor 越界上 clamp 到 6（30）', SRS.intervalFor(99) === 30);
check('intervalFor 越界下 clamp 到 0（0）', SRS.intervalFor(-1) === 0);

console.log('\n== SRS applyFeedback 状态转移 ==');
mem['cet4.progress'] = JSON.stringify({});
// know: 新词 stage0 → stage1, next = 今天+1
let rec = SRS.applyFeedback('alpha', 'know');
check('know：stage0→1', rec.stage === 1, 'stage ' + rec.stage);
check('know：next_review_at = 今天+1（本地日期）', rec.next_review_at === '2026-01-11', rec.next_review_at);
check('know：状态 learning', rec.status === 'learning');

// 连续 know 到 stage6 → mastered
SRS.applyFeedback('alpha', 'know'); // 2
SRS.applyFeedback('alpha', 'know'); // 3
SRS.applyFeedback('alpha', 'know'); // 4
SRS.applyFeedback('alpha', 'know'); // 5
rec = SRS.applyFeedback('alpha', 'know'); // 6
check('know 累计到 stage6 → mastered', rec.stage === 6 && rec.status === 'mastered', 'stage ' + rec.stage + ' ' + rec.status);
check('stage6 间隔 30 天', rec.next_review_at === '2026-02-09', rec.next_review_at);
SRS.applyFeedback('alpha', 'know');
rec = SRS.applyFeedback('alpha', 'know');
check('stage6 再 know 不超 6', rec.stage === 6);

// forgot: 从 stage3 → stage0, lapses+1, next=今天
SRS.applyFeedback('beta', 'know'); // 1
SRS.applyFeedback('beta', 'know'); // 2
SRS.applyFeedback('beta', 'know'); // 3
rec = SRS.applyFeedback('beta', 'forgot');
check('forgot：stage→0', rec.stage === 0, 'stage ' + rec.stage);
check('forgot：lapses+1', rec.lapses === 1, 'lapses ' + rec.lapses);
check('forgot：next_review_at = 今天', rec.next_review_at === TODAY, rec.next_review_at);
check('forgot：状态回到 learning', rec.status === 'learning');

// fuzzy: stage 不变，只重算 next_review_at
SRS.applyFeedback('gamma', 'know'); // 1
SRS.applyFeedback('gamma', 'know'); // 2
rec = SRS.applyFeedback('gamma', 'fuzzy');
check('fuzzy：stage 不变（2）', rec.stage === 2, 'stage ' + rec.stage);
// stage 2 对应 INTERVALS[2]=2 天
check('fuzzy：重算间隔 2 天（本地日期）', rec.next_review_at === '2026-01-12', rec.next_review_at);

console.log('\n== 每日队列 buildQueue / dueWords / newWords ==');
mem['cet4.progress'] = JSON.stringify({
  // 已到期待复习：stage 间隔 1（今天+1 已过 → 昨天到期的模拟）
  'alpha': { status: 'learning', stage: 0, next_review_at: '2026-01-09', lapses: 0, last_review_at: '', last_feedback: '' },
  'beta': { status: 'learning', stage: 2, next_review_at: '2026-01-10', lapses: 0, last_review_at: '', last_feedback: '' },
  'gamma': { status: 'mastered', stage: 6, next_review_at: '2026-01-08', lapses: 0, last_review_at: '', last_feedback: '' }, // mastered 排除
  'delta': { status: 'learning', stage: 4, next_review_at: '2026-01-20', lapses: 0, last_review_at: '', last_feedback: '' } // 未到期
});
const due = SRS.dueWords();
check('dueWords 排除 mastered', due.indexOf('gamma') === -1, JSON.stringify(due));
check('dueWords 排除未到期(delta)', due.indexOf('delta') === -1, JSON.stringify(due));
check('dueWords 包含到期 alpha/beta', due.indexOf('alpha') >= 0 && due.indexOf('beta') >= 0, JSON.stringify(due));
check('dueWords 按间隔升序（alpha stage0 在 beta stage2 前）', due[0] === 'alpha' && due[1] === 'beta', JSON.stringify(due));

// buildQueue：混合 2 个到期复习词 + 2 个未学词
mem['cet4.progress'] = JSON.stringify({
  'alpha': { status: 'learning', stage: 0, next_review_at: TODAY, lapses: 0, last_review_at: '', last_feedback: '' },
  'beta': { status: 'learning', stage: 2, next_review_at: TODAY, lapses: 0, last_review_at: '', last_feedback: '' }
});
const q = SRS.buildQueue(2);
check('buildQueue 复习优先（review 含 alpha,beta，间隔升序）', q.review.length === 2 && q.review[0] === 'alpha' && q.review[1] === 'beta', JSON.stringify(q.review));
check('buildQueue 补新词（fresh 为未学词 gamma,delta，限 2）', q.fresh.length === 2 && q.fresh[0] === 'gamma' && q.fresh[1] === 'delta', JSON.stringify(q.fresh));
// 4 词里 alpha/beta 已入 progress，gamma/delta 未学；重置后仅 alpha 已学
mem['cet4.progress'] = JSON.stringify({ 'alpha': { status: 'learning', stage: 0, next_review_at: TODAY, lapses: 0 } });
const fresh = SRS.newWords(20);
check('newWords 返回未学词（beta/gamma/delta 共 3）', fresh.length === 3 && fresh[0] === 'beta', JSON.stringify(fresh));

console.log('\n== Words 索引/音标/发音地址 ==');
check('Words.count() = 4', Words.count() === 4);
check('Words.get 大小写不敏感', Words.get('ALPHA').word === 'alpha');
check('phonetic us 回落 uk', Words.phonetic(Words.get('alpha'), 'us') === '/ælfə/');
check('briefCn 拼接 pos+cn', Words.briefCn(Words.get('alpha')) === 'n. 阿尔法');
check('speechUrl 美音 type=2', Words.speechUrl('hello', 'us') === 'https://dict.youdao.com/dictvoice?audio=hello&type=2');
check('speechUrl 英音 type=1', Words.speechUrl('hello', 'uk') === 'https://dict.youdao.com/dictvoice?audio=hello&type=1');

console.log('\n== 打卡连续天数（stats.checkin 纯函数）==');
function blankStats() {
  return { total_learned: 0, total_reviewed: 0, streak_days: 0, total_checkin_days: 0, last_checkin_date: '', daily_new_count: 0, daily_review_count: 0 };
}
let s = blankStats();
Stats.checkin(s);
check('首次打卡 streak=1', s.streak_days === 1 && s.total_checkin_days === 1, JSON.stringify(s));
check('首次打卡记录今天', s.last_checkin_date === TODAY);

// 同日再次打卡 → 不重复累计
s = blankStats(); s.last_checkin_date = TODAY; s.streak_days = 3; s.total_checkin_days = 3;
Stats.checkin(s);
check('同日重复打卡不累计', s.streak_days === 3 && s.total_checkin_days === 3, JSON.stringify(s));

// 昨天打卡 → 连续 +1
s = blankStats(); s.last_checkin_date = '2026-01-09'; s.streak_days = 5; s.total_checkin_days = 5;
Stats.checkin(s);
check('连续（昨天）打卡 streak 6', s.streak_days === 6 && s.total_checkin_days === 6, JSON.stringify(s));

// 断签（前天）→ 重置为 1
s = blankStats(); s.last_checkin_date = '2026-01-07'; s.streak_days = 9; s.total_checkin_days = 9;
Stats.checkin(s);
check('断签重置 streak=1（不累加）', s.streak_days === 1 && s.total_checkin_days === 10, JSON.stringify(s));

console.log('\n========== 汇总 ==========');
console.log('PASS:', pass, ' FAIL:', fail);
errors.forEach(e => console.log('  - ' + e));
process.exit(fail ? 1 : 0);
