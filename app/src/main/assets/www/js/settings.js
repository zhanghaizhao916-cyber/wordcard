/* ============================================================
   settings.js —— 设置页
   发音偏好 / 每日新词量 / 数据导入导出 / 关于（版本号读真实值）。
   ============================================================ */
(function () {
  'use strict';

  function render() {
    var s = Store.getSettings();

    var accChips = document.querySelectorAll('#accentChips .chip');
    for (var i = 0; i < accChips.length; i++) {
      accChips[i].classList.toggle('active', accChips[i].dataset.accent === s.accent);
    }

    var nChips = document.querySelectorAll('#dailyNewChips .chip');
    for (var j = 0; j < nChips.length; j++) {
      nChips[j].classList.toggle('active', parseInt(nChips[j].dataset.n, 10) === s.daily_new);
    }

    var input = Util.$('#dailyNewInput');
    if (input) input.value = s.daily_new;

    var themeChips = document.querySelectorAll('#themeChips .chip');
    for (var k = 0; k < themeChips.length; k++) {
      themeChips[k].classList.toggle('active', themeChips[k].dataset.theme === s.theme);
    }

    renderEstimate();
    renderBook();
    renderVersion();
  }

  function renderEstimate() {
    var s = Store.getSettings();
    var total = Words.currentTotal();
    var days = total ? Math.ceil(total / s.daily_new) : 0;
    var el = Util.$('#estimateDays');
    if (el) el.textContent = '按每天 ' + s.daily_new + ' 词，预计 ' + days + ' 天学完本词书（共 ' + total + ' 词）';
  }

  function renderBook() {
    var book = Words.bookMeta(Words.currentBook());
    var nameEl = Util.$('#settingsBookName');
    if (nameEl) nameEl.textContent = book ? book.name : '四级核心';

    var noteEl = Util.$('#dictNote');
    if (!noteEl) return;
    var ids = Words.BOOK_IDS || ['cet4_core', 'cet4_full', 'cet6_full'];
    var parts = [];
    for (var i = 0; i < ids.length; i++) {
      var m = Words.bookMeta(ids[i]);
      if (m) parts.push(m.name + ' ' + m.total + ' 词');
    }
    noteEl.textContent = '词库内嵌 ' + parts.join(' · ') + ' · 数据保存在本机，不联网上传';
  }

  function renderVersion() {
    var b = Util.bridge();
    var ver = '';
    if (b && b.appVersion) {
      try { ver = String(b.appVersion()); } catch (e) { ver = ''; }
    }
    Util.$('#verText').textContent = ver ? ('v' + ver) : 'v1.0.0';
  }

  function exportData() {
    var json = Store.exportAll();
    var name = 'cet4words-backup-' + Util.todayStr() + '.json';
    var b = Util.bridge();
    if (b && b.saveFile) {
      var res = '';
      try { res = String(b.saveFile(name, json)); } catch (e) { res = 'err:' + e; }
      if (res.indexOf('ok') === 0) { Util.toast('已导出到手机「下载」目录'); return; }
      Util.toast('导出失败：' + res.replace(/^err:/, ''));
      return;
    }
    var blob = new Blob([json], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    Util.toast('已导出备份文件');
  }

  function importData(text) {
    var n = Store.importAll(text);
    if (n < 0) { Util.toast('文件格式不对，解析失败'); return; }
    Stats.rollover();
    render();
    if (window.App && App.refreshHome) App.refreshHome();
    Util.toast(n ? ('已导入 ' + n + ' 类数据') : '没有可导入的数据');
  }

  function bind() {
    Util.$('#accentChips').addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (!c) return;
      var s = Store.getSettings();
      s.accent = c.dataset.accent;
      Store.setSettings(s);
      render();
      Util.toast(s.accent === 'uk' ? '已切换为英音' : '已切换为美音');
    });

    Util.$('#themeChips').addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (!c) return;
      var s = Store.getSettings();
      s.theme = c.dataset.theme;
      Store.setSettings(s);
      render();
      if (window.App && App.applyTheme) App.applyTheme();
      Util.toast(s.theme === 'dark' ? '已切换为深色模式' : '已切换为浅色模式');
    });

    Util.$('#dailyNewChips').addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (!c) return;
      var s = Store.getSettings();
      s.daily_new = parseInt(c.dataset.n, 10);
      Store.setSettings(s);
      render();
      if (window.App && App.refreshHome) App.refreshHome();
      Util.toast('每日新词量 ' + s.daily_new + ' 词');
    });

    var customInput = Util.$('#dailyNewInput');
    if (customInput) {
      // 回车即失焦，触发 change 完成校验
      customInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); customInput.blur(); }
      });
      customInput.addEventListener('change', function () {
        var raw = String(customInput.value).trim();
        var s = Store.getSettings();
        var n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
        if (raw === '' || isNaN(n) || n < 5 || n > 200) {
          customInput.value = s.daily_new;   // 非法输入回退到当前值
          Util.toast('请输入 5–200 的整数');
          return;
        }
        s.daily_new = n;
        Store.setSettings(s);
        render();
        if (window.App && App.refreshHome) App.refreshHome();
        Util.toast('每日新词量 ' + n + ' 词');
      });
    }

    Util.$('#bookSwitchBtn').addEventListener('click', function () {
      if (window.App && App.showBooks) App.showBooks();
    });

    Util.$('#guideAgainBtn').addEventListener('click', function () {
      if (window.Guide && Guide.reset) Guide.reset();
    });

    Util.$('#exportBtn').addEventListener('click', exportData);
    Util.$('#importBtn').addEventListener('click', function () { Util.$('#importFile').click(); });
    Util.$('#importFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { importData(String(r.result)); };
      r.readAsText(f);
      this.value = '';
    });
    Util.$('#clearBtn').addEventListener('click', function () {
      if (!confirm('确定清空全部学习数据吗？此操作不可撤销，建议先导出备份。')) return;
      Store.clearAll();
      Stats.rollover();
      render();
      if (window.App && App.refreshHome) App.refreshHome();
      Util.toast('已清空');
    });
  }

  bind();

  window.Settings = { render: render };
})();
