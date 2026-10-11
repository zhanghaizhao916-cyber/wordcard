/* ============================================================
   guide.js —— 新手引导（手动翻页版）
   - 触发时机：首次启动（Store.getGuideSeen() 为 false）自动弹出；
     设置页「重新查看引导」可再次触发（Guide.reset()）。
   - 展示步骤：4 页，点「下一步」逐页查看，最后一页「开始使用」进入主界面；
     右上角「跳过」随时结束；底部圆点指示当前页。
   - 视觉动画：图标/标题入场动画（见 style.css guide-pop）。
   - 完成后写 cet4.guide_seen 标记，之后不再自动弹出。
   ============================================================ */
(function () {
  'use strict';

  var pages = [];
  var cur = 0;
  var bound = false;

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
    for (var k = 0; k < dots.length; k++) {
      dots[k].classList.toggle('active', k === cur);
    }
    var btn = Util.$('#guideNext');
    if (btn) btn.textContent = (cur === pages.length - 1) ? '开始使用' : '下一步';
    // 图标/标题入场动画
    var page = pages[cur];
    if (page) {
      var ico = page.querySelector('.guide-ico');
      var title = page.querySelector('.guide-title');
      if (ico) { ico.classList.remove('pop'); void ico.offsetWidth; ico.classList.add('pop'); }
      if (title) { title.classList.remove('pop'); void title.offsetWidth; title.classList.add('pop'); }
    }
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
