/* ============================================================
   words.js —— 词库索引与查询 + 词书注册表（单一事实源）
   数据来自 <script> 写入的 window.CET4_WORDS / window.CET4_CORE_WORDS / window.CET6_WORDS。

   关键约定：
   - 全局词条 Map = CET4 + CET6 合并（小写键），Words.get() 跨书解析无歧义。
   - 所有「按当前书」取数（SRS 新词 / 测试出题与选项）一律走 Words.currentList()。
   - Words.all() 仅表示全局合并词条（关于页/展示），不再用于出题。
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 词书注册表（唯一维护点） ----------------
     shuffled: true 表示「乱序版词书」—— 词单在 buildIndex 时洗牌一次（会话内固定）。
     同名 base 词书（顺序版 / 乱序版）共享学习进度（进度桶由 store.js 的 BOOK_BASE 映射）。 */
  var BOOKS = [
    { id: 'cet4_core', name: '四级核心', rawList: 'CET4_CORE_WORDS', entriesSource: 'CET4_WORDS' },
    { id: 'cet4_core_shuf', name: '四级核心·乱序', rawList: 'CET4_CORE_WORDS', entriesSource: 'CET4_WORDS', shuffled: true },
    { id: 'cet4_full', name: '四级完整', rawList: 'CET4_WORDS', entriesSource: 'CET4_WORDS' },
    { id: 'cet4_full_shuf', name: '四级完整·乱序', rawList: 'CET4_WORDS', entriesSource: 'CET4_WORDS', shuffled: true },
    { id: 'cet6_full', name: '六级完整', rawList: 'CET6_WORDS', entriesSource: 'CET6_WORDS' },
    { id: 'cet6_full_shuf', name: '六级完整·乱序', rawList: 'CET6_WORDS', entriesSource: 'CET6_WORDS', shuffled: true }
  ];
  var BOOK_IDS = BOOKS.map(function (b) { return b.id; });

  var list = [];          // 全局合并词条数组（CET4 + CET6，按小写去重）
  var map = new Map();    // 小写 word -> entry
  var bookLists = {};     // bookId -> string[]（有序词单，懒构建缓存）

  function findBook(id) {
    for (var i = 0; i < BOOKS.length; i++) {
      if (BOOKS[i].id === id) return BOOKS[i];
    }
    return null;
  }

  function buildIndex() {
    var c4 = (window.CET4_WORDS && Array.isArray(window.CET4_WORDS)) ? window.CET4_WORDS : [];
    var c6 = (window.CET6_WORDS && Array.isArray(window.CET6_WORDS)) ? window.CET6_WORDS : [];

    map = new Map();
    list = [];
    for (var i = 0; i < c4.length; i++) {
      var w = c4[i];
      if (w && w.word) {
        var key = String(w.word).toLowerCase();
        if (!map.has(key)) { map.set(key, w); list.push(w); }
      }
    }
    for (var j = 0; j < c6.length; j++) {
      var w6 = c6[j];
      if (w6 && w6.word) {
        var key6 = String(w6.word).toLowerCase();
        if (!map.has(key6)) { map.set(key6, w6); list.push(w6); }
      }
    }

    // 预构建各书词单（按 rawList 顺序，仅保留真实存在的词条）
    bookLists = {};
    for (var b = 0; b < BOOKS.length; b++) {
      var bl = buildBookList(BOOKS[b]);
      if (BOOKS[b].shuffled) {
        // 乱序版：Fisher-Yates 洗牌一次（本次会话内固定顺序）
        for (var j = bl.length - 1; j > 0; j--) {
          var k = Math.floor(Math.random() * (j + 1));
          var t = bl[j]; bl[j] = bl[k]; bl[k] = t;
        }
      }
      bookLists[BOOKS[b].id] = bl;
    }
  }

  function buildBookList(book) {
    var raw = window[book.rawList];
    var res = [];
    var seen = {};
    if (!raw || !Array.isArray(raw)) return res;
    for (var i = 0; i < raw.length; i++) {
      var item = raw[i];
      var word = (typeof item === 'string') ? item : (item && item.word);
      if (!word) continue;
      var key = String(word).toLowerCase();
      if (seen[key]) continue;
      seen[key] = 1;
      if (map.has(key)) res.push(key);
    }
    return res;
  }

  function get(word) {
    if (!map.size && list.length) buildIndex();
    if (!map.size) buildIndex();
    if (word === null || word === undefined) return null;
    return map.get(String(word).toLowerCase()) || null;
  }

  function all() { return list; }
  function count() { return list.length; }

  function books() {
    return BOOKS.map(function (b) {
      return { id: b.id, name: b.name, total: bookList(b.id).length };
    });
  }

  function bookMeta(id) {
    var b = findBook(id);
    if (!b) return null;
    return { id: b.id, name: b.name, total: bookList(b.id).length };
  }

  function bookList(id) {
    var b = findBook(id);
    if (!b) return [];
    if (bookLists[id]) return bookLists[id];
    bookLists[id] = buildBookList(b);
    return bookLists[id];
  }

  function currentBook() {
    var id = (window.Store && Store.getCurrentBook) ? Store.getCurrentBook() : 'cet4_core';
    return findBook(id) ? id : 'cet4_core';
  }

  function currentList() { return bookList(currentBook()); }
  function currentTotal() { return currentList().length; }

  /** 取指定口音的音标，缺失时回落到另一口音。 */
  function phonetic(entry, accent) {
    if (!entry) return '';
    var p = (accent === 'uk') ? entry.phonetic_uk : entry.phonetic_us;
    if (!p) p = entry.phonetic_us || entry.phonetic_uk || '';
    return p || '';
  }

  /** 中文释义，多词性用「；」连接（用于列表/选项）。 */
  function briefCn(entry) {
    if (!entry || !entry.trans || !entry.trans.length) return '';
    return entry.trans.map(function (t) {
      return (t.pos ? t.pos + ' ' : '') + t.cn;
    }).join('；');
  }

  /** 英文解释（可能为空，数据文件不含该字段）。 */
  function definition(entry) {
    return (entry && entry.definition) ? entry.definition : '';
  }

  /** 例句数组 [{en, cn}]，可能为空。 */
  function sentences(entry) {
    return (entry && Array.isArray(entry.sentences)) ? entry.sentences : [];
  }

  /** 有道发音地址：type=1 英音 / type=2 美音。 */
  function speechUrl(word, accent) {
    var type = (accent === 'uk') ? 1 : 2;
    return 'https://dict.youdao.com/dictvoice?audio='
      + encodeURIComponent(word) + '&type=' + type;
  }

  window.Words = {
    BOOKS: BOOKS,
    BOOK_IDS: BOOK_IDS,
    buildIndex: buildIndex,
    get: get,
    all: all,
    count: count,
    books: books,
    bookMeta: bookMeta,
    bookList: bookList,
    currentBook: currentBook,
    currentList: currentList,
    currentTotal: currentTotal,
    phonetic: phonetic,
    briefCn: briefCn,
    definition: definition,
    sentences: sentences,
    speechUrl: speechUrl
  };
})();
