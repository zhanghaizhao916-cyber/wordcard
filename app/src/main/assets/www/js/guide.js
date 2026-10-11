/* ============================================================
   guide.js —— 新手引导（自动播放动画版）
   - 触发时机：首次启动（Store.getGuideSeen() 为 false）自动弹出；
     设置页「重新查看引导」可再次触发（Guide.reset()）。
   - 展示步骤：4 页自动轮播，每页停留约 2.6 秒，顶部进度条随播放前进；
     也可点「下一步」提前切换、左右滑动翻页、右上角「跳过」结束。
   - 视觉动画：进度条自动填充、图标/标题入场动画（见 style.css）。
   - 完成后写 cet4.guide_seen 标记，之后不再自动弹出。
   ============================================================ */
(function () {
  'use strict';

  var pages = [];
  var cur = 0;
  var startX = null;
  var autoTimer = null;
  var bound = false;
  var AUTO_MS = 2600;   // 每页自动播放停留时长

  function init(force) {
    if (!force && Store.getGuideSeen()) return;   // 已看过且非强制，不触发
    var guide = Util.$('#guide');
    if (!guide) return;
    pages = guide.querySelectorAll('.guide-page');
    if (!pages.length) return;
    buildDots();
    bind();
    showPage(0);
    guide.classList.remove('hidden');
  }

  function showPage(i) {
    cur = Math.max(0, Math.min(pages.length - 1, i));
    for (var j = 0; j < pages.length; j++) {
      pages[j].classList.toggle('active', j === cur);
    }
    var dots = document.querySelectorAll('#guideDots .guide-dot');
    for (var j = 0; j < dots.length; j++) {
      dots[j].classList.toggle('active', j === cur);
    }
    var btn = Util.$('#guideNext');
    if (btn) btn.textContent = (cur === pages.length - 1) ? '开始使用' : '下一步';
    restartProgress();
    restartAuto();
  }

  /** 重启动画：进度条重新从 0 填充、图标重新入场。 */
  function restartProgress() {
    var fill = Util.$('#guideProgressFill');
    if (fill) {
      fill.classList.remove('run');
      void fill.offsetWidth;      // 强制 reflow，使动画重新触发
      fill.classList.add('run');
    }
    var page = pages[cur];
    if (page) {
      var ico = page.querySelector('.guide-ico');
      var title = page.querySelector('.guide-title');
      if (ico) { ico.classList.remove('pop'); void ico.offsetWidth; ico.classList.add('pop'); }
      if (title) { title.classList.remove('pop'); void title.offsetWidth; title.classList.add('pop'); }
    }
  }

  function restartAuto() {
    stopAuto();
    autoTimer = setTimeout(function () {
      if (cur >= pages.length - 1) close();
      else showPage(cur + 1);
    }, AUTO_MS);
  }

  function stopAuto() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  function buildDots() {
    var box = Util.$('#guideDots');
    if (!box) return;
    box.innerHTML = '';
    for (var i = 0; i < pages.length; i++) {
      var d = document.createElement('span');
      d.className = 'guide-dot';
      box.appendChild(d);
    }
  }

  function close() {
    stopAuto();
    Store.setGuideSeen(true);
    var guide = Util.$('#guide');
    if (guide) guide.classList.add('hidden');
  }

  function next() {
    stopAuto();
    if (cur >= pages.length - 1) { close(); return; }
    showPage(cur + 1);
  }

  function bind() {
    if (bound) return;
    bound = true;
    Util.$('#guideSkip').addEventListener('click', close);
    Util.$('#guideNext').addEventListener('click', next);
  }

  window.Guide = {
    init: init,
    /** 重新查看引导（设置页入口）：清除标记并强制展示。 */
    reset: function () { Store.setGuideSeen(false); init(true); }
  };
})();
