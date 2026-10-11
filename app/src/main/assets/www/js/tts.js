/* ============================================================
   tts.js —— 发音双通道
   有道在线 <audio>（dictvoice）优先；onerror 或 3s 未 playing 则回退
   AndroidBridge.speak（系统 TTS）。同一单词只回退一次，避免死循环。
   ============================================================ */
(function () {
  'use strict';

  // 已经回退过的单词（word|accent）：本会话内再读该词直接走系统 TTS，
  // 不再傻等 3 秒在线超时。
  var fallbackOnce = {};

  function bridge() {
    return (typeof window.AndroidBridge !== 'undefined') ? window.AndroidBridge : null;
  }

  function nativeSpeak(word, accent) {
    var b = bridge();
    if (b && b.speak) {
      try { b.speak(word, accent); } catch (e) { /* 忽略 */ }
    }
  }

  /**
   * 朗读单词。
   * @param {string} word   单词
   * @param {string} accent us / uk
   */
  function speak(word, accent) {
    word = word || '';
    accent = accent || 'us';
    if (!word) return;

    var key = word + '|' + accent;
    if (fallbackOnce[key]) {
      nativeSpeak(word, accent);
      return;
    }

    var url = Words.speechUrl(word, accent);
    var a = new Audio();
    var done = false;
    var timer = null;

    function cleanup() {
      if (timer) clearTimeout(timer);
      timer = null;
      try { a.pause(); } catch (e) { /* 忽略 */ }
      a.src = '';
      a.onplaying = a.onerror = a.onended = null;
    }

    function fallback() {
      if (done) return;
      done = true;
      fallbackOnce[key] = true;
      cleanup();
      nativeSpeak(word, accent);
    }

    // 3 秒看门狗：没等到 playing 就判定在线失败
    timer = setTimeout(fallback, 3000);

    a.onplaying = function () {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      timer = null;
    };
    a.onerror = function () { fallback(); };
    a.onended = function () {
      done = true;
      cleanup();
    };

    a.src = url;
    var p;
    try { p = a.play(); } catch (e) { fallback(); return; }
    if (p && p.catch) p.catch(function () { fallback(); });
  }

  window.TTS = { speak: speak };
})();
