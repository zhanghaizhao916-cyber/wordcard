package com.zhang.cet4words;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;

/**
 * 四级背单词 —— 外壳 Activity。
 *
 * 界面全部由打包在 assets/www 下的网页实现，本类只负责：
 *   1. 用 https://cet4words.local 这个虚拟域名把 assets 里的页面喂给 WebView（保证 localStorage 可靠持久化）
 *   2. 向网页暴露发音回退 / 版本号 / 导出文件 / 提示 几个桥接方法
 *   3. 处理返回键、文件选择
 */
public class MainActivity extends Activity {

    private static final String VHOST = "cet4words.local";
    private static final String START_URL = "https://" + VHOST + "/index.html";
    private static final int REQ_FILE = 1001;

    private WebView web;
    private TtsEngine tts;
    private ValueCallback<Uri[]> fileCallback;
    private boolean fallbackUsed = false;
    private long lastBackAt = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.setBackgroundColor(0xFFFFFFFF);

        web = new WebView(this);
        web.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(web);
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        // 允许访问 assets 里的本地文件：仅在虚拟域名加载失败时作为兜底路径使用
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        // 发音都是用户手势触发，保持默认即可；显式声明便于阅读理解
        s.setMediaPlaybackRequiresUserGesture(true);

        tts = new TtsEngine();
        tts.init(this);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!"https".equals(u.getScheme()) || !VHOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
                try {
                    InputStream is = getAssets().open("www" + path);
                    return new WebResourceResponse(mimeOf(path), "UTF-8", is);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                            new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        android.webkit.WebResourceError error) {
                // 兜底：虚拟域名万一没能拦截成功，改用 file:// 加载 assets 里的页面
                if (request.isForMainFrame() && !fallbackUsed) {
                    fallbackUsed = true;
                    view.loadUrl("file:///android_asset/www/index.html");
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    startActivityForResult(Intent.createChooser(i, "选择备份文件"), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                return true;
            }
        });

        applyLightBars();

        // 所有数据都在网页侧的 localStorage 里，页面重建后自己读回，无需恢复 WebView 状态
        web.loadUrl(START_URL);
    }

    /* ---------------- 生命周期 ---------------- */

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.evaluateJavascript(
                    "document.dispatchEvent(new Event('visibilitychange'))", null);
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("AndroidBridge");
            web.destroy();
            web = null;
        }
        if (tts != null) {
            tts.shutdown();
            tts = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript(
                "(typeof window.onAndroidBack === 'function') && window.onAndroidBack() === true",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (!"true".equals(value)) {
                            long now = System.currentTimeMillis();
                            if (now - lastBackAt < 1600) {
                                finish();
                            } else {
                                lastBackAt = now;
                                Toast.makeText(MainActivity.this, "再按一次退出", Toast.LENGTH_SHORT).show();
                            }
                        }
                    }
                });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /* ---------------- 桥接 ---------------- */

    private class Bridge {

        /** 系统 TTS 朗读回退。accent: us / uk。 */
        @JavascriptInterface
        public void speak(final String text, final String accent) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (tts != null) tts.speak(text, accent);
                }
            });
        }

        /** 真实版本号：直接从包信息读，避免和 build.gradle 里写的对不上。 */
        @JavascriptInterface
        public String appVersion() {
            try {
                return getPackageManager()
                        .getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "1.0.0";
            }
        }

        @JavascriptInterface
        public void toast(final String msg) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show();
                }
            });
        }

        /** 把 JSON 备份写到系统「下载」目录，返回 ok:... 或 err:... */
        @JavascriptInterface
        public String saveFile(String name, String content) {
            return FileExporter.save(MainActivity.this, name, content);
        }
    }

    /* ---------------- 工具 ---------------- */

    private void applyLightBars() {
        int bg = 0xFFFFFFFF;
        Window w = getWindow();
        w.setStatusBarColor(bg);
        w.setNavigationBarColor(bg);

        View decor = w.getDecorView();
        int flags = decor.getSystemUiVisibility();
        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        decor.setSystemUiVisibility(flags);

        if (web != null) web.setBackgroundColor(bg);
    }

    private static String mimeOf(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }
}
