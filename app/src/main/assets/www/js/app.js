/* ============================================================
   app.js —— 入口：路由 + 底部导航 + 返回键 + 启动初始化
   ============================================================ */
(function () {
  'use strict';

  var PAGES = ['home', 'notebook', 'settings', 'books'];
  var returnPage = 'home';

  var REVIEW_ICON = '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>';
  var LEARN_ICON = '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    var now = new Date();
    var weekNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    Util.$('#homeDate').textContent = (now.getMonth() + 1) + '月' + now.getDate() + '日';
    Util.$('#homeWeek').textContent = weekNames[now.getDay()];

    var s = Stats.summary();
    var settings = Store.getSettings();
    var due = SRS.dueWords().length;

    var book = Words.bookMeta(Words.currentBook());
    Util.$('#homeBookName').textContent = book ? book.name : '四级核心';

    Util.$('#homeStreak').textContent = '连续打卡 ' + s.streak_days + ' 天';
    Util.$('#homeNewNum').textContent = s.daily_new_count;
    Util.$('#homeNewTotal').textContent = '/ ' + settings.daily_new;
    Util.$('#homeReviewTag').textContent = '待复习 ' + due + ' 词';
    Util.$('#statLearned').textContent = s.total_learned;
    Util.$('#statCheckin').textContent = s.total_checkin_days;
    Util.$('#statStreak').textContent = s.streak_days;

    // 本词书总进度条
    var prog = Store.getProgress();
    var learnedCount = Object.keys(prog).length;
    var total = Words.currentTotal();
    var pct = total ? Math.min(100, Math.round(learnedCount / total * 100)) : 0;
    Util.$('#homeProgressFill').style.width = pct + '%';
    Util.$('#homeProgressText').textContent = learnedCount + ' / ' + total + ' · ' + pct + '%';

    // 发布版（不含词库）提示
    Util.$('#dictEmpty').classList.toggle('hidden', Words.count() > 0);
  }

  function startLearn() {
    var settings = Store.getSettings();
    var stats = Stats.summary();
    var remaining = Math.max(0, settings.daily_new - stats.daily_new_count);
    if (remaining <= 0) { Util.toast('今日新词已学完，明天再来'); return; }
    var fresh = SRS.newWords(remaining);
    if (!fresh.length) { Util.toast('本词书已全部学完'); return; }
    Cards.start('learn', fresh);
  }

  function startReview() {
    var due = SRS.dueWords();
    if (!due.length) { Util.toast('今天没有待复习的单词'); return; }
    Cards.start('review', due);
  }

  /* ---------------- 路由 ---------------- */
  function navigate(page) {
    if (PAGES.indexOf(page) < 0) page = 'home';
    for (var i = 0; i < PAGES.length; i++) {
      Util.$('#page-' + PAGES[i]).classList.toggle('hidden', PAGES[i] !== page);
    }
    Util.$('#page-cards').classList.add('hidden');
    Util.$('#tabbar').classList.toggle('hidden', page === 'books');

    var tabs = document.querySelectorAll('.tab');
    for (var j = 0; j < tabs.length; j++) {
      tabs[j].classList.toggle('active', tabs[j].dataset.page === page);
    }

    if (page === 'home') renderHome();
    else if (page === 'notebook') Notebook.render();
    else if (page === 'settings') Settings.render();
    else if (page === 'books') Books.render();
    window.scrollTo(0, 0);
  }

  function showBooks() {
    navigate('books');
  }

  function showCards(mode) {
    returnPage = (mode === 'browse') ? 'notebook' : 'home';
    for (var i = 0; i < PAGES.length; i++) {
      Util.$('#page-' + PAGES[i]).classList.add('hidden');
    }
    Util.$('#tabbar').classList.add('hidden');
    Util.$('#page-cards').classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  function exitCards() {
    Util.$('#page-cards').classList.add('hidden');
    navigate(returnPage);
  }

  function refreshHome() {
    if (!Util.$('#page-home').classList.contains('hidden')) renderHome();
  }

  /* ---------------- 返回键 ---------------- */
  window.onAndroidBack = function () {
    if (Cards.onBack()) return true;                 // 卡片翻面 → 翻回正面
    if (Cards.isActive()) { App.exitCards(); return true; }
    if (!Util.$('#page-books').classList.contains('hidden')) {
      Books.onBack();
      return true;
    }
    if (!Util.$('#page-home').classList.contains('hidden')) return false; // 首页 → 退出
    App.navigate('home');
    return true;
  };

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        App.navigate(this.dataset.page);
      });
    }

    Util.$('#btnLearn').addEventListener('click', startLearn);
    Util.$('#btnReview').addEventListener('click', startReview);
    Util.$('#homeBookCapsule').addEventListener('click', function () { App.showBooks(); });

    // 首页两个按钮的线描图标
    Util.$('#btnLearnIco').innerHTML = Util.svg(LEARN_ICON);
    Util.$('#btnReviewIco').innerHTML = Util.svg(REVIEW_ICON);

    // 跨天检测：回到前台时刷新首页，重置今日计数
    var lastDay = Util.todayStr();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      var now = Util.todayStr();
      if (now !== lastDay) {
        lastDay = now;
        Stats.rollover();
      }
      refreshHome();
    });
    setInterval(function () {
      var now = Util.todayStr();
      if (now !== lastDay) {
        lastDay = now;
        Stats.rollover();
        refreshHome();
      }
    }, 60000);
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme() {
    var s = Store.getSettings();
    var theme = (s && s.theme === 'dark') ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#15171A' : '#FBF9F4');
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    Store.migrate();       // 首行：老数据迁移（幂等）
    Words.buildIndex();
    Stats.rollover();
    applyTheme();          // 应用主题（浅色/深色）
    bind();
    renderHome();
    Settings.render();
    Guide.init();          // 首次启动弹新手引导
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.App = {
    navigate: navigate,
    showCards: showCards,
    exitCards: exitCards,
    refreshHome: refreshHome,
    showBooks: showBooks,
    applyTheme: applyTheme
  };
})();
