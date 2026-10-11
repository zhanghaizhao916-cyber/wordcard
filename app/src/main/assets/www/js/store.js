/* ============================================================
   store.js —— 通用工具 + localStorage 封装 + 老数据迁移
   localStorage 统一前缀 cet4.，禁止在其它文件里散落裸 key。

   schema v2（词书体系）：
   - cet4.meta            { schema_version, current_book, migrated_from_v1 }
   - cet4.books.{bookId}  { progress, stats }   （每书独立进度/计数）
   - cet4.stats           全局打卡（仅 streak/checkin 三字段）
   - cet4.notebook / quiz_history / settings / essay_progress  全局共享
   - cet4.progress        仅迁移阶段读取（v1 老进度），迁移后 remove

   说明：bookId 常量在 words.js 的 BOOKS 中定义；因 store.js 先于 words.js
   加载（迁移需在 Words 注册前可用），此处保留一份相同 ID 列表用于存储层
   （迁移 / 清空 / 当前书合法性校验），两处必须保持一致。
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 通用工具 ---------------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return ymd(new Date()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(dateStr, n) {
    var d = parseYmd(dateStr);
    d.setDate(d.getDate() + n);
    return ymd(d);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel) { return document.querySelector(sel); }
  function bridge() {
    return (typeof window.AndroidBridge !== 'undefined') ? window.AndroidBridge : null;
  }
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1900);
  }
  // 线描图标（feather 风格），颜色跟随 currentColor，禁 emoji
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  window.Util = {
    pad: pad, ymd: ymd, todayStr: todayStr, parseYmd: parseYmd, addDays: addDays,
    esc: esc, $: $, bridge: bridge, toast: toast, svg: svg
  };

  /* ---------------- 存储 ---------------- */
  var KEYS = {
    meta: 'cet4.meta',
    bookPrefix: 'cet4.books.',
    stats: 'cet4.stats',               // 全局打卡（仅 streak/checkin）
    notebook: 'cet4.notebook',
    quiz_history: 'cet4.quiz_history',
    settings: 'cet4.settings',
    essay_progress: 'cet4.essay_progress',
    legacyProgress: 'cet4.progress',   // v1 老进度，仅迁移读取
  guide_seen: 'cet4.guide_seen'      // 新手引导是否已看（首次启动触发）
  };

  // 与 words.js 的 Words.BOOK_IDS 保持一致（存储层先行，需独立持有）
  var BOOK_IDS = ['cet4_core', 'cet4_full', 'cet6_full'];
  var DEFAULT_BOOK = 'cet4_core';

  function blankBookStats() {
    return {
      total_learned: 0,
      total_reviewed: 0,
      daily_new_count: 0,
      daily_review_count: 0,
      daily_date: ''
    };
  }

  function getJSON(key, fallback) {
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
    if (raw === null || raw === undefined) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }
  function setJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { Util.toast('保存失败，空间可能已满'); return false; }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* 忽略 */ }
  }

  function getMeta() { return getJSON(KEYS.meta, null); }
  function setMeta(m) { return setJSON(KEYS.meta, m); }

  function getCurrentBook() {
    var meta = getMeta();
    var id = (meta && meta.current_book) ? meta.current_book : DEFAULT_BOOK;
    if (BOOK_IDS.indexOf(id) < 0) id = DEFAULT_BOOK;
    return id;
  }
  function setCurrentBook(id) {
    if (BOOK_IDS.indexOf(id) < 0) id = DEFAULT_BOOK;
    var meta = getMeta() || {};
    meta.schema_version = 2;
    meta.current_book = id;
    return setJSON(KEYS.meta, meta);
  }

  function getBookData(id) {
    return getJSON(KEYS.bookPrefix + id, null);
  }
  function setBookData(id, data) {
    return setJSON(KEYS.bookPrefix + id, data);
  }

  function getBookProgress(id) {
    var d = getBookData(id);
    return (d && d.progress && typeof d.progress === 'object') ? d.progress : {};
  }
  function setBookProgress(id, p) {
    var d = getBookData(id) || {};
    d.progress = p;
    return setBookData(id, d);
  }
  function getBookStats(id) {
    var d = getBookData(id);
    return (d && d.stats && typeof d.stats === 'object') ? d.stats : blankBookStats();
  }
  function setBookStats(id, s) {
    var d = getBookData(id) || {};
    d.stats = s;
    return setBookData(id, d);
  }

  /** 老数据一次性迁移（幂等：schema_version>=2 直接跳过）。 */
  function migrate() {
    var meta = getMeta();
    if (meta && typeof meta.schema_version === 'number' && meta.schema_version >= 2) return;

    var legacyProgress = getJSON(KEYS.legacyProgress, null);
    var legacyStats = getJSON(KEYS.stats, null);   // v1 旧全局 stats 形状
    var isOldUser = (legacyProgress !== null && typeof legacyProgress === 'object');

    // 1) 初始化/补齐三本词书（已存在的保留，避免半迁移状态丢数据）
    for (var i = 0; i < BOOK_IDS.length; i++) {
      var id = BOOK_IDS[i];
      var d = getBookData(id);
      if (!d || typeof d !== 'object') {
        d = { progress: {}, stats: blankBookStats() };
      } else {
        if (!d.progress || typeof d.progress !== 'object') d.progress = {};
        if (!d.stats || typeof d.stats !== 'object') d.stats = blankBookStats();
      }
      setBookData(id, d);
    }

    if (isOldUser) {
      var s = (legacyStats && typeof legacyStats === 'object') ? legacyStats : {};
      // 2) 旧进度 + 学习/复习计数整体归入「四级完整」
      setBookData('cet4_full', {
        progress: legacyProgress,
        stats: {
          total_learned: s.total_learned || 0,
          total_reviewed: s.total_reviewed || 0,
          daily_new_count: s.daily_new_count || 0,
          daily_review_count: s.daily_review_count || 0,
          daily_date: s.last_checkin_date || ''
        }
      });
      // 3) 全局打卡 = 旧 stats 的 streak 三字段（旧 stats 就地覆写）
      setJSON(KEYS.stats, {
        streak_days: s.streak_days || 0,
        total_checkin_days: s.total_checkin_days || 0,
        last_checkin_date: s.last_checkin_date || ''
      });
      // 4) 删除旧 progress key
      remove(KEYS.legacyProgress);
    } else {
      // 新用户：确保全局打卡存在
      var g = getJSON(KEYS.stats, null);
      if (!g || typeof g !== 'object') {
        setJSON(KEYS.stats, { streak_days: 0, total_checkin_days: 0, last_checkin_date: '' });
      }
    }

    // 5) 写 meta 标记
    setJSON(KEYS.meta, {
      schema_version: 2,
      current_book: isOldUser ? 'cet4_full' : 'cet4_core',
      migrated_from_v1: isOldUser
    });
  }

  window.Store = {
    KEYS: KEYS,
    BOOK_IDS: BOOK_IDS,

    getMeta: getMeta,
    setMeta: setMeta,
    getCurrentBook: getCurrentBook,
    setCurrentBook: setCurrentBook,
    migrate: migrate,

    getBookProgress: getBookProgress,
    setBookProgress: setBookProgress,
    getBookStats: getBookStats,
    setBookStats: setBookStats,

    // 「当前书」兼容壳：srs/cards/quiz 均通过它读写进度，最小改动跟随词书切换
    getProgress: function () { return getBookProgress(getCurrentBook()); },
    setProgress: function (p) { return setBookProgress(getCurrentBook(), p); },

    getNotebook: function () { return getJSON(KEYS.notebook, {}); },
    setNotebook: function (n) { return setJSON(KEYS.notebook, n); },

    getQuizHistory: function () { return getJSON(KEYS.quiz_history, []); },
    addQuiz: function (rec) {
      var h = this.getQuizHistory();
      h.push(rec);
      return setJSON(KEYS.quiz_history, h);
    },

    // 全局打卡（仅 streak/total_checkin_days/last_checkin_date）
    getStats: function () { return getJSON(KEYS.stats, null); },
    setStats: function (s) { return setJSON(KEYS.stats, s); },

    getSettings: function () {
      var s = getJSON(KEYS.settings, null);
      if (!s || typeof s !== 'object') s = { accent: 'us', daily_new: 20, theme: 'light', order: 'shuffle' };
      if (s.accent !== 'us' && s.accent !== 'uk') s.accent = 'us';
      var dn = parseInt(s.daily_new, 10);
      if (isNaN(dn) || dn < 5 || dn > 200) dn = 20;
      s.daily_new = dn;
      if (s.theme !== 'light' && s.theme !== 'dark') s.theme = 'light';
      if (s.order !== 'shuffle' && s.order !== 'seq') s.order = 'shuffle';
      return s;
    },
    setSettings: function (s) { return setJSON(KEYS.settings, s); },

    getEssayProgress: function () { return getJSON(KEYS.essay_progress, {}); },
    setEssayProgress: function (p) { return setJSON(KEYS.essay_progress, p); },

    getGuideSeen: function () { return getJSON(KEYS.guide_seen, false); },
    setGuideSeen: function (v) { return setJSON(KEYS.guide_seen, v); },

    /** 导出全部数据为 JSON 字符串（v2 结构，备份用）。 */
    exportAll: function () {
      var books = {};
      for (var i = 0; i < BOOK_IDS.length; i++) {
        books[BOOK_IDS[i]] = getBookData(BOOK_IDS[i]);
      }
      var data = {
        version: 2,
        meta: getMeta(),
        books: books,
        stats: this.getStats(),
        notebook: this.getNotebook(),
        quiz_history: this.getQuizHistory(),
        settings: this.getSettings(),
        essay_progress: this.getEssayProgress()
      };
      return JSON.stringify(data, null, 2);
    },
    /** 从备份 JSON 导入，返回导入的类别数；数据非法返回 -1。 */
    importAll: function (text) {
      var d;
      try { d = JSON.parse(text); } catch (e) { return -1; }
      if (!d || typeof d !== 'object') return -1;
      var n = 0;
      if (d.meta && typeof d.meta === 'object') { setJSON(KEYS.meta, d.meta); n++; }
      if (d.books && typeof d.books === 'object') {
        var cnt = 0;
        for (var id in d.books) {
          if (d.books.hasOwnProperty(id) && BOOK_IDS.indexOf(id) >= 0
              && d.books[id] && typeof d.books[id] === 'object') {
            setBookData(id, d.books[id]);
            cnt++;
          }
        }
        if (cnt) n++;
      }
      if (d.stats && typeof d.stats === 'object') { this.setStats(d.stats); n++; }
      if (d.notebook && typeof d.notebook === 'object') { this.setNotebook(d.notebook); n++; }
      if (Array.isArray(d.quiz_history)) { setJSON(KEYS.quiz_history, d.quiz_history); n++; }
      if (d.settings && typeof d.settings === 'object') { this.setSettings(d.settings); n++; }
      if (d.essay_progress && typeof d.essay_progress === 'object') { this.setEssayProgress(d.essay_progress); n++; }
      return n;
    },
    /** 清空全部数据并重建干净 schema（二次确认由调用方完成）。 */
    clearAll: function () {
      for (var k in KEYS) { if (KEYS.hasOwnProperty(k)) remove(KEYS[k]); }
      for (var i = 0; i < BOOK_IDS.length; i++) remove(KEYS.bookPrefix + BOOK_IDS[i]);
      migrate();   // 重建三本空词书 + meta + 全局打卡
    }
  };
})();
