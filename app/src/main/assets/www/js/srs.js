/* ============================================================
   srs.js —— SM-2 简化版间隔重复算法
   stage 0~6，间隔 0/1/2/4/7/15/30 天。
   know → stage+1；fuzzy → stage 不变重算；forgot → stage=0 + lapses+1。
   每日队列 = 复习（next_review_at<=今天，按间隔升序）优先 + 补新词。
   复习/新词均按「当前书」取数；dueWordsFor/dueCount 供词书选择页逐书统计。
   ============================================================ */
(function () {
  'use strict';

  var INTERVALS = [0, 1, 2, 4, 7, 15, 30];

  function intervalFor(stage) {
    var s = Math.max(0, Math.min(6, stage || 0));
    return INTERVALS[s];
  }

  function newRecord() {
    return {
      status: 'learning',
      stage: 0,
      next_review_at: Util.todayStr(),
      lapses: 0,
      last_review_at: '',
      last_feedback: ''
    };
  }

  /**
   * 应用一次反馈并落库（写「当前书」进度）。
   * @param {string} word 单词
   * @param {string} fb   know / fuzzy / forgot
   */
  function applyFeedback(word, fb) {
    var p = Store.getProgress();
    var rec = p[word] || newRecord();
    var today = Util.todayStr();

    if (fb === 'know') {
      rec.stage = Math.min((rec.stage || 0) + 1, 6);
    } else if (fb === 'forgot') {
      rec.stage = 0;
      rec.lapses = (rec.lapses || 0) + 1;
    }
    // fuzzy：stage 不变，仅重算 next_review_at

    rec.status = (rec.stage >= 6) ? 'mastered' : 'learning';
    rec.last_review_at = today;
    rec.last_feedback = fb;
    rec.next_review_at = Util.addDays(today, intervalFor(rec.stage));

    p[word] = rec;
    Store.setProgress(p);
    return rec;
  }

  /** 指定词书的今日到期待复习单词（按间隔升序，间隔相同按 stage 升序）。 */
  function dueWordsFor(bookId) {
    var p = Store.getBookProgress(bookId);
    var today = Util.todayStr();
    var due = [];
    for (var w in p) {
      if (!p.hasOwnProperty(w)) continue;
      var r = p[w];
      if (r.status === 'mastered') continue;
      if (r.next_review_at && r.next_review_at <= today) {
        due.push({ word: w, record: r });
      }
    }
    due.sort(function (a, b) {
      var ia = intervalFor(a.record.stage), ib = intervalFor(b.record.stage);
      if (ia !== ib) return ia - ib;
      if ((a.record.stage || 0) !== (b.record.stage || 0)) return (a.record.stage || 0) - (b.record.stage || 0);
      return a.word < b.word ? -1 : 1;
    });
    return due.map(function (x) { return x.word; });
  }

  /** 当前书今日到期待复习单词。 */
  function dueWords() {
    return dueWordsFor(Store.getCurrentBook());
  }

  /** 指定词书待复习数（供词书选择页逐书展示，不切换当前书）。 */
  function dueCount(bookId) {
    return dueWordsFor(bookId).length;
  }

  /** 按当前书取 count 个尚未学习的新词（按设置「顺序 / 乱序」抽取）。 */
  function newWords(count) {
    var p = Store.getProgress();
    var wl = Words.currentList();
    var fresh = [];
    for (var i = 0; i < wl.length; i++) {
      var w = wl[i];
      if (!p[w]) fresh.push(w);
    }
    var s = Store.getSettings();
    var order = (s && s.order) ? s.order : 'shuffle';
    if (order !== 'seq') {
      // 乱序：Fisher-Yates 洗牌
      for (var j = fresh.length - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1));
        var t = fresh[j]; fresh[j] = fresh[k]; fresh[k] = t;
      }
    }
    // 顺序：保持词书顺序，不洗牌
    return fresh.slice(0, count);
  }

  /** 每日队列：复习优先，再补新词。 */
  function buildQueue(dailyNew) {
    var review = dueWords();
    var fresh = newWords(dailyNew);
    return { review: review, fresh: fresh };
  }

  window.SRS = {
    INTERVALS: INTERVALS,
    intervalFor: intervalFor,
    newRecord: newRecord,
    applyFeedback: applyFeedback,
    dueWords: dueWords,
    dueWordsFor: dueWordsFor,
    dueCount: dueCount,
    newWords: newWords,
    buildQueue: buildQueue
  };
})();
