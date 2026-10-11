/* ============================================================
   books.js —— 词书选择页控制器
   三本词书列表（书名 / 词数 / 已学 / 待复习），当前书高亮。
   切换后写 Store.setCurrentBook 并回首页（触发全量刷新跟随）。
   ============================================================ */
(function () {
  'use strict';

  var CHECK = '<polyline points="20 6 9 17 4 12"/>';
  var BOOK_ICON = '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>'
    + '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>';

  function render() {
    var current = Words.currentBook();
    var items = Words.books();
    var html = items.map(function (b) {
      var learned = Object.keys(Store.getBookProgress(b.id)).length;
      var due = SRS.dueCount(b.id);
      var active = (b.id === current);
      return '<button class="book-item' + (active ? ' active' : '') + '" data-id="' + Util.esc(b.id) + '">'
        + '<span class="book-ico">' + Util.svg(BOOK_ICON) + '</span>'
        + '<span class="book-main">'
        + '<span class="book-name">' + Util.esc(b.name) + '</span>'
        + '<span class="book-meta">已学 ' + learned + ' / ' + b.total + ' · 待复习 ' + due + '</span>'
        + '</span>'
        + (active ? '<span class="book-check">' + Util.svg(CHECK) + '</span>' : '')
        + '</button>';
    }).join('');
    var el = Util.$('#booksList');
    if (el) el.innerHTML = html;
  }

  function switchBook(bookId) {
    if (!Words.bookMeta(bookId)) return;
    var current = Words.currentBook();
    if (bookId === current) {
      App.navigate('home');
      return;
    }
    Store.setCurrentBook(bookId);
    Util.toast('已切换词书');
    App.navigate('home');
  }

  function onBack() {
    App.navigate('home');
    return true;
  }

  function bind() {
    Util.$('#booksBack').addEventListener('click', onBack);
    Util.$('#booksList').addEventListener('click', function (e) {
      var b = e.target.closest('.book-item');
      if (!b) return;
      switchBook(b.dataset.id);
    });
  }

  bind();

  window.Books = { render: render, switch: switchBook, onBack: onBack };
})();
