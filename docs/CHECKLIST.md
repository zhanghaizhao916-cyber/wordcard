# 发布自检清单

## 版本四处同步
- [x] `app/build.gradle.kts`：versionCode 10000 / versionName "1.0.0"
- [x] `CHANGELOG.md`：v1.0.0 新增记录
- [x] `README.md`：版本说明
- [x] 构建后 `aapt2 dump badging` 核对（`tools/verify_apk.py`）

## 图标与资源
- [x] 应用名「四级背单词」（`res/values/strings.xml`）
- [x] 自适应图标（`mipmap-anydpi-v26` + drawable 矢量背景/前景）
- [x] 各密度 PNG 兜底图标（`mipmap-{m,h,x,xx,xxx}dpi`，`tools/make_icons.py` 生成）

## 权限
- [x] `INTERNET`（仅在线发音需要）
- [x] `WRITE_EXTERNAL_STORAGE`（maxSdk 28，数据导出需要）

## 离线可用
- [x] 词库 `data/cet4.js` 内嵌（4522 词，`<script>` 引入，非 fetch）
- [x] 页面 / 样式 / JS 全部离线打包于 `assets/www/`
- [x] 断网下除在线发音外全部功能可用；发音自动回退系统 TTS

## 前端一致性
- [x] localStorage 6 个 key 前缀 `cet4.`（progress/notebook/quiz_history/stats/settings/essay_progress）
- [x] 词库字段与前端读取一致（word/phonetic_us/phonetic_uk/trans/sentences）
- [x] AndroidBridge 方法名（speak/appVersion/toast/saveFile）与前端调用一致
- [x] 无外链资源（`http://`/`https://` 仅出现在有道发音 URL 与动态 `<audio>` src）
- [x] 无外链字体 `@import`、无 emoji

## 返回键与 TTS
- [x] 返回键 `evaluateJavascript(window.onAndroidBack)`，翻面→退出卡片→回首页→再按退出
- [x] TTS 在 Bridge.speak 内 `runOnUiThread` 调用
