/* ============================================================
   guide.js —— 新手引导（仅首次启动触发）
   检测 Store.getGuideSeen()，未看过则弹出引导 overlay，
   支持「跳过 / 下一步 / 开始使用」+ 圆点指示 + 左右滑动切换。
   完成后写 cet4.guide_seen 标记，之后不再弹出。
   ============================================================ */
(function () {
  'use strict';

  var pages = [];
  var cur = 0;
  var startX = null;

  function init() {
    if (Store.getGuideSeen()) return;   // 已看过，不触发
    var guide = Util.$('#guide');
    if (!guide) return;
    pages = guide.querySelectorAll('.guide-page');
    if (!pages.length) return;
    buildDots();
    showPage(0);
    guide.classList.remove('hidden');
    bind();
  }

  function showPage(i) {
    cur = Math.max(0, Math.min(pages.length - 1, i));
    var track = Util.$('#guideTrack');
    if (track) track.style.transform = 'translateX(' + (-cur * 100) + '%)';
    var dots = document.querySelectorAll('#guideDots .guide-dot');
    for (var j = 0; j < dots.length; j++) {
      dots[j].classList.toggle('active', j === cur);
    }
    var btn = Util.$('#guideNext');
    if (btn) btn.textContent = (cur === pages.length - 1) ? '开始使用' : '下一步';
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
    Store.setGuideSeen(true);
    var guide = Util.$('#guide');
    if (guide) guide.classList.add('hidden');
  }

  function next() {
    if (cur >= pages.length - 1) { close(); return; }
    showPage(cur + 1);
  }

  function bind() {
    Util.$('#guideSkip').addEventListener('click', close);
    Util.$('#guideNext').addEventListener('click', next);
    var track = Util.$('#guideTrack');
    if (!track) return;
    track.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length) startX = e.touches[0].clientX;
    }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = (e.changedTouches && e.changedTouches.length)
        ? e.changedTouches[0].clientX - startX : 0;
      if (dx < -40) showPage(cur + 1);
      else if (dx > 40) showPage(cur - 1);
      startX = null;
    }, { passive: true });
  }

  window.Guide = { init: init };
})();
