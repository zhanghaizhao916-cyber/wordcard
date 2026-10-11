/* ============================================================
   stats.js —— 学习统计 + 打卡 + 连续天数
   拆分：全局 cet4.stats 仅承载打卡（streak/total_checkin_days/last_checkin_date）；
   每书 cet4.books.{id}.stats 承载学习/复习计数（total_learned/total_reviewed/
   daily_new_count/daily_review_count/daily_date）。
   当日完成 >=1 词（新学或复习）即打卡（全局一天一次）。
   ============================================================ */
(function () {
  'use strict';

  function blankBookStats() {
    return {
      total_learned: 0,
      total_reviewed: 0,
      daily_new_count: 0,
      daily_review_count: 0,
      daily_date: ''
    };
  }

  function blankGlobal() {
    return { streak_days: 0, total_checkin_days: 0, last_checkin_date: '' };
  }

  /** 全局打卡统计（补全默认字段）。 */
  function getGlobal() {
    var s = Store.getStats();
    if (!s || typeof s !== 'object') s = blankGlobal();
    var b = blankGlobal();
    for (var k in b) {
      if (b.hasOwnProperty(k) && s[k] === undefined) s[k] = b[k];
    }
    return s;
  }

  /** 指定词书的学习计数（缺省=当前书，补全默认字段）。 */
  function getBookStats(bookId) {
    var id = bookId || Words.currentBook();
    var s = Store.getBookStats(id);
    if (!s || typeof s !== 'object') s = blankBookStats();
    var b = blankBookStats();
    for (var k in b) {
      if (b.hasOwnProperty(k) && s[k] === undefined) s[k] = b[k];
    }
    return s;
  }

  /** 跨天：重置三本词书的「今日」计数。 */
  function rollover() {
    var today = Util.todayStr();
    var changed = false;
    var ids = (window.Words && Words.BOOK_IDS) ? Words.BOOK_IDS : ['cet4_core', 'cet4_full', 'cet6_full'];
    for (var i = 0; i < ids.length; i++) {
      var s = Store.getBookStats(ids[i]);
      if (!s || typeof s !== 'object') s = blankBookStats();
      if (s.daily_date !== today) {
        s.daily_new_count = 0;
        s.daily_review_count = 0;
        s.daily_date = today;
        Store.setBookStats(ids[i], s);
        changed = true;
      }
    }
    return changed;
  }

  /** 记录一次打卡（仅当今天尚未打过卡时推进 streak / total_checkin_days）。 */
  function checkin(g) {
    var today = Util.todayStr();
    if (g.last_checkin_date === today) return;
    var yesterday = Util.addDays(today, -1);
    if (g.last_checkin_date === yesterday) {
      g.streak_days = (g.streak_days || 0) + 1;
    } else {
      g.streak_days = 1;
    }
    g.total_checkin_days = (g.total_checkin_days || 0) + 1;
    g.last_checkin_date = today;
  }

  function recordLearn(n) {
    n = n || 1;
    rollover();
    var id = Words.currentBook();
    var bs = getBookStats(id);
    bs.total_learned = (bs.total_learned || 0) + n;
    bs.daily_new_count = (bs.daily_new_count || 0) + n;
    Store.setBookStats(id, bs);

    var g = getGlobal();
    checkin(g);
    Store.setStats(g);
    return { book: bs, global: g };
  }

  function recordReview(n) {
    n = n || 1;
    rollover();
    var id = Words.currentBook();
    var bs = getBookStats(id);
    bs.total_reviewed = (bs.total_reviewed || 0) + n;
    bs.daily_review_count = (bs.daily_review_count || 0) + n;
    Store.setBookStats(id, bs);

    var g = getGlobal();
    checkin(g);
    Store.setStats(g);
    return { book: bs, global: g };
  }

  /** 首页统计快照（当前书计数 + 全局打卡）。 */
  function summary() {
    var bs = getBookStats();
    var g = getGlobal();
    var today = Util.todayStr();
    return {
      total_learned: bs.total_learned || 0,
      total_reviewed: bs.total_reviewed || 0,
      streak_days: g.streak_days || 0,
      total_checkin_days: g.total_checkin_days || 0,
      daily_new_count: bs.daily_new_count || 0,
      daily_review_count: bs.daily_review_count || 0,
      checked_in_today: g.last_checkin_date === today
    };
  }

  window.Stats = {
    blankBookStats: blankBookStats,
    getGlobal: getGlobal,
    getBookStats: getBookStats,
    rollover: rollover,
    checkin: checkin,
    recordLearn: recordLearn,
    recordReview: recordReview,
    summary: summary
  };
})();
