package com.zhang.cet4words;

import android.content.Context;
import android.speech.tts.TextToSpeech;

import java.util.Locale;

/**
 * 系统 TTS 封装。
 *
 * 职责：在「有道在线发音」失败 / 断网时，用安卓自带的 TextToSpeech 朗读英文单词。
 * 所有方法都应在主线程调用（由 MainActivity 的 Bridge.speak 用 runOnUiThread 保证）。
 * 处理「TTS 尚未初始化完成」的情况：先把文本记下来，初始化成功后再补播。
 */
public final class TtsEngine implements TextToSpeech.OnInitListener {

    private TextToSpeech tts;
    private boolean ready = false;
    private String pendingText = null;
    private String pendingAccent = "us";

    /** 创建引擎并开始异步初始化。 */
    public void init(Context ctx) {
        if (tts != null) return;
        tts = new TextToSpeech(ctx.getApplicationContext(), this);
    }

    @Override
    public void onInit(int status) {
        ready = (status == TextToSpeech.SUCCESS);
        if (ready && pendingText != null) {
            String text = pendingText;
            String accent = pendingAccent;
            pendingText = null;
            pendingAccent = "us";
            speak(text, accent);
        }
    }

    /**
     * 朗读一段英文文本。
     *
     * @param text   要朗读的单词或句子
     * @param accent 口音：{@code us} 美音 / {@code uk} 英音，其它值一律按美音处理
     */
    public void speak(String text, String accent) {
        if (text == null || text.trim().isEmpty()) return;
        if (tts == null || !ready) {
            pendingText = text;
            pendingAccent = ("uk".equals(accent)) ? "uk" : "us";
            return;
        }

        Locale target = "uk".equals(accent) ? Locale.UK : Locale.US;
        int result = tts.setLanguage(target);
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            // 个别设备缺英音 TTS 数据，回落到美音
            tts.setLanguage(Locale.US);
        }
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null,
                "cet4-" + System.currentTimeMillis());
    }

    /** 释放引擎，退出 Activity 时调用。 */
    public void shutdown() {
        if (tts != null) {
            try {
                tts.stop();
            } catch (Exception ignored) {
            }
            try {
                tts.shutdown();
            } catch (Exception ignored) {
            }
            tts = null;
        }
        ready = false;
        pendingText = null;
    }
}
