/* ============================================================
   notebook.js —— 生词本
   收藏词列表、移除、点击进入卡片浏览、空状态线描 SVG。
   ============================================================ */
(function () {
  'use strict';

  var BOOKMARK = '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>';
  var TRASH = '<polyline points="3 6 5 6 21 6"/>'
    + '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';

  function words() {
    return Object.keys(Store.getNotebook());
  }

  function render() {
    var ws = words();
    Util.$('#notebookCount').textContent = ws.length ? (ws.length + ' 词') : '';

    var el = Util.$('#notebookList');
    if (!ws.length) {
      el.innerHTML = '<div class="empty">'
        + '<div class="empty-ico">' + Util.svg(BOOKMARK) + '</div>'
        + '<div class="empty-t">暂无收藏词</div>'
        + '<div class="empty-d">在卡片页点右上角星标，把重点词收进来</div>'
        + '</div>';
      return;
    }

    el.innerHTML = ws.map(function (w) {
      var entry = Words.get(w);
      var cn = entry ? Words.briefCn(entry) : '';
      return '<div class="nb-item" data-word="' + Util.esc(w) + '">'
        + '<div class="nb-main">'
        + '<div class="nb-word">' + Util.esc(w) + '</div>'
        + (cn ? '<div class="nb-cn">' + Util.esc(cn) + '</div>' : '')
        + '</div>'
        + '<button class="nb-remove" data-word="' + Util.esc(w) + '" aria-label="移除">' + Util.svg(TRASH) + '</button>'
        + '</div>';
    }).join('');
  }

  function remove(w) {
    var nb = Store.getNotebook();
    delete nb[w];
    Store.setNotebook(nb);
    render();
    Util.toast('已移除');
  }

  function bind() {
    Util.$('#notebookList').addEventListener('click', function (e) {
      var rm = e.target.closest('.nb-remove');
      if (rm) {
        e.stopPropagation();
        remove(rm.dataset.word);
        return;
      }
      var item = e.target.closest('.nb-item');
      if (!item) return;
      var ws = words();
      var idx = ws.indexOf(item.dataset.word);
      Cards.start('browse', ws, idx < 0 ? 0 : idx);
    });
  }

  bind();

  window.Notebook = { render: render };
})();
