/* ============================================================
   cards.js —— 背单词卡片页
   正面：单词 + 美/英音标；反面：词性+中文释义 + 例句。
   翻面 / 发音 / 收藏 / 三档反馈 / 切词。
   ============================================================ */
(function () {
  'use strict';

  var SPEAKER = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>'
    + '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>'
    + '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>';

  var queue = [];
  var index = 0;
  var mode = 'learn';     // learn | review | browse
  var flipped = false;
  var requeued = {};      // 本会话内已因「不认识」重排过的词，避免死循环
  var flashing = false;   // 「不认识」翻面后中文释义闪烁期标记
  var flashTimer = null;  // 闪烁定时器
  var busy = false;       // 认识/模糊翻面展示 1s 期间标记
  var busyTimer = null;   // 认识/模糊 1s 自动跳定时器

  function accent() {
    var s = Store.getSettings();
    return (s && s.accent === 'uk') ? 'uk' : 'us';
  }

  function currentWord() { return queue[index]; }

  function isStarred(w) { return !!Store.getNotebook()[w]; }

  function setFlipped(f) {
    flipped = f;
    var card = Util.$('#flashCard');
    if (card) card.classList.toggle('flipped', f);
  }

  function transHTML(entry) {
    if (!entry || !entry.trans || !entry.trans.length) {
      return '<div class="muted">暂无释义</div>';
    }
    return entry.trans.map(function (t) {
      return '<div class="trans-line"><span class="pos">' + Util.esc(t.pos) + '</span>'
        + '<span class="cn">' + Util.esc(t.cn) + '</span></div>';
    }).join('');
  }

  function render() {
    var w = currentWord();
    var entry = Words.get(w);
    if (!w) return;

    Util.$('#cardProgress').textContent = (index + 1) + ' / ' + queue.length;
    Util.$('#cardStar').classList.toggle('active', isStarred(w));

    var us = Words.phonetic(entry, 'us');
    var uk = Words.phonetic(entry, 'uk');
    var ph = '';
    if (us) ph += '<span class="ph">美 /' + Util.esc(us) + '/</span>';
    if (uk) ph += '<span class="ph">英 /' + Util.esc(uk) + '/</span>';

    Util.$('#cardFront').innerHTML =
      '<div class="word-row">'
      + '<h1 class="word" id="cardWord">' + Util.esc(w) + '</h1>'
      + '<button class="speak-btn" id="cardSpeak" aria-label="发音">' + Util.svg(SPEAKER) + '</button>'
      + '</div>'
      + (ph ? '<div class="phonetics">' + ph + '</div>' : '');

    var back = '<div class="trans-list">' + transHTML(entry) + '</div>';
    var def = Words.definition(entry);
    if (def) back += '<div class="def">' + Util.esc(def) + '</div>';
    var sents = Words.sentences(entry);
    if (sents.length) {
      back += '<div class="sentence">'
        + '<div class="sent-en">' + Util.esc(sents[0].en) + '</div>'
        + (sents[0].cn ? '<div class="sent-cn">' + Util.esc(sents[0].cn) + '</div>' : '')
        + '</div>';
    }
    Util.$('#cardBack').innerHTML = back;

    setFlipped(false);

    // 学习/复习显示三档反馈，浏览生词本显示上/下一张
    Util.$('#cardsActions').classList.toggle('hidden', mode === 'browse');
    Util.$('#cardsBrowse').classList.toggle('hidden', mode !== 'browse');

    var wordEl = Util.$('#cardWord');
    var speakEl = Util.$('#cardSpeak');
    if (wordEl) wordEl.addEventListener('click', function (e) { e.stopPropagation(); speakCurrent(); });
    if (speakEl) speakEl.addEventListener('click', function (e) { e.stopPropagation(); speakCurrent(); });
  }

  function speakCurrent() {
    var w = currentWord();
    if (w) TTS.speak(w, accent());
  }

  function toggleStar() {
    var w = currentWord();
    if (!w) return;
    var nb = Store.getNotebook();
    var now;
    if (nb[w]) { delete nb[w]; now = false; }
    else { nb[w] = { added_at: Date.now() }; now = true; }
    Store.setNotebook(nb);
    Util.$('#cardStar').classList.toggle('active', now);
  }

  function feedback(fb) {
    var w = currentWord();
    if (!w) return;

    // 「认识/模糊」翻面展示 1s 期间：再次点击任意按钮 → 立即打断并跳下一词
    if (busy) {
      clearTimeout(busyTimer);
      busy = false;
      busyTimer = null;
      next();
      return;
    }

    // 正面（未翻面）
    if (!flipped) {
      if (fb === 'forgot' && mode !== 'browse') {
        // 第一次点「不认识」：翻面看中文释义并闪烁 0.8s，不记录、不翻页
        setFlipped(true);
        startFlash();
        return;
      }
      // 「认识」/「模糊」：翻面看中文 + 记录，展示 1s 后自动进下一词
      setFlipped(true);
      commit(w, fb);
      busy = true;
      busyTimer = setTimeout(function () { busy = false; busyTimer = null; next(); }, 1000);
      return;
    }

    // 反面（已翻面）
    if (fb === 'forgot' && flashing) {
      // 闪烁期间再点「不认识」：忽略，防连点误判
      return;
    }
    // 反面：认识/模糊/不认识 都记录并跳词
    stopFlash();
    commit(w, fb);
    next();
  }

  function commit(w, fb) {
    var p = Store.getProgress();
    var isNew = !p[w];          // 首次学习（此前无进度记录）
    SRS.applyFeedback(w, fb);

    if (isNew) Stats.recordLearn(1);
    else Stats.recordReview(1);

    // 不认识：本会话内重排一次，当天再出现
    if (fb === 'forgot' && mode !== 'browse' && !requeued[w]) {
      requeued[w] = true;
      queue.splice(Math.min(index + 1, queue.length), 0, w);
    }
  }

  function startFlash() {
    stopFlash();
    flashing = true;
    var back = Util.$('#cardBack');
    if (back) back.classList.add('flash');
    flashTimer = setTimeout(function () {
      flashing = false;
      if (back) back.classList.remove('flash');
    }, 800);
  }

  function stopFlash() {
    if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
    flashing = false;
    var back = Util.$('#cardBack');
    if (back) back.classList.remove('flash');
  }

  function next() {
    if (mode === 'browse') {
      if (index < queue.length - 1) { index++; render(); }
      else { App.exitCards(); }
      return;
    }
    index++;
    if (index >= queue.length) {
      App.exitCards();
      App.refreshHome();
      Util.toast('本次学习完成');
    } else {
      render();
    }
  }

  function prev() {
    if (mode !== 'browse') return;
    if (index > 0) { index--; render(); }
  }

  /**
   * 进入卡片页。
   * @param {string} m         learn / review / browse
   * @param {string[]} ws      单词数组
   * @param {number} startIdx  起始下标（生词本浏览定位用，默认 0）
   */
  function start(m, ws, startIdx) {
    mode = m;
    queue = ws || [];
    index = (typeof startIdx === 'number' && startIdx >= 0 && startIdx < queue.length) ? startIdx : 0;
    flipped = false;
    requeued = {};
    stopFlash();
    busy = false;
    if (busyTimer) { clearTimeout(busyTimer); busyTimer = null; }
    if (!queue.length) {
      Util.toast('没有需要学习的单词');
      return;
    }
    App.showCards(mode);
    updateQueueInfo();
    render();
  }

  /** 卡片页顶部：标明本次学习队列的新词 / 待复习词数。 */
  function updateQueueInfo() {
    var el = Util.$('#cardsInfo');
    if (!el) return;
    if (mode === 'browse') { el.classList.add('hidden'); return; }
    var prog = Store.getProgress();
    var nw = 0, rv = 0;
    for (var i = 0; i < queue.length; i++) {
      if (prog[queue[i]]) rv++; else nw++;
    }
    el.classList.remove('hidden');
    el.textContent = '新词 ' + nw + ' 个 · 待复习 ' + rv + ' 个';
  }

  function isActive() {
    var page = Util.$('#page-cards');
    return page && !page.classList.contains('hidden');
  }

  /** 返回键处理：卡片翻面时先翻回正面，返回 true。 */
  function onBack() {
    if (isActive() && flipped) {
      setFlipped(false);
      return true;
    }
    return false;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    Util.$('#cardExit').addEventListener('click', function () { App.exitCards(); });
    Util.$('#cardStar').addEventListener('click', toggleStar);
    Util.$('#flashCard').addEventListener('click', function (e) {
      // 点词或喇叭是发音，不翻面
      if (e.target.closest('.speak-btn') || e.target.closest('#cardWord')) return;
      setFlipped(!flipped);
    });
    Util.$('#cardsActions').addEventListener('click', function (e) {
      var b = e.target.closest('.fb');
      if (!b) return;
      feedback(b.dataset.fb);
    });
    Util.$('#browsePrev').addEventListener('click', prev);
    Util.$('#browseNext').addEventListener('click', next);
  }

  bind();

  window.Cards = { start: start, isActive: isActive, onBack: onBack };
})();
