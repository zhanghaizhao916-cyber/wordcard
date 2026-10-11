# QA 测试报告 —— 四级背单词（CET4Words）v1.0.0

> 作者：zhanghiz
> 测试日期：2026-01-01（按 CHANGELOG 版本日期）
> 被测对象：`D:\AndroidProjects\CET4Words\release\cet4words-v1.0.0.apk` + 前端源码 + Java 壳
> 测试方式：独立实测（aapt2 / apksigner / node 脚本 / 静态审查），**未修改任何被测源码**

---

## 一、测试总览

| 维度 | 检查项 | 通过 | 失败 | 阻塞 |
|------|-------:|-----:|-----:|-----:|
| 1. APK 产物与版本 | 11 | 11 | 0 | 0 |
| 2. 词库数据（cet4.js / essays.js） | 16 | 16 | 0 | 0 |
| 3. JS 语法 + 算法逻辑 | 52 | 52 | 0 | 0 |
| 4. UI 铁律 + 对比度 | 12 | 12 | 0 | 0 |
| 5. DOM 接线 + 时区/外链 | 2（覆盖 55 个 DOM id + 2 项扫描） | 2 | 0 | 0 |
| **合计** | **93** | **93** | **0** | **0** |

**结论：功能无缺陷。** 未发现 P0/P1 级功能缺陷。发现 **1 项 P2 产物质量项**（见缺陷清单）。

---

## 二、各维度实测结果与证据

### 维度一：APK 产物与版本（独立核对，未采信自报）

命令输出证据：

1. **aapt2 dump badging**（`D:\devtools\android-sdk\build-tools\34.0.0\aapt2.exe dump badging release\cet4words-v1.0.0.apk`）：
   - `package: name='com.zhang.cet4words' versionCode='10000' versionName='1.0.0'` ✅
   - `sdkVersion:'24'`（minSdk 24）✅  `targetSdkVersion:'34'` ✅
   - `uses-permission: name='android.permission.INTERNET'` ✅
   - `application-label:'四级背单词'` ✅
   - `application-icon: 'res/mipmap-anydpi-v26/ic_launcher.xml'`（自适应图标存在）✅
   - `launchable-activity: 'com.zhang.cet4words.MainActivity'` ✅
   - 附加权限：`WRITE_EXTERNAL_STORAGE (maxSdkVersion=28)` + 隐式 `READ_EXTERNAL_STORAGE`（用于 API<29 的导出，API≥29 走 MediaStore，合理）✅

2. **apksigner verify**（JDK 17 环境）：`Verifies`，`v2 scheme: true`，单签名者 `CN=Android Debug`。**可正常安装** ✅

3. **版本号四处同步**：
   - `app/build.gradle.kts`：`versionCode = 10000` / `versionName = "1.0.0"` ✅
   - `CHANGELOG.md`：`## v1.0.0` ✅
   - APK 内实际值：`10000 / 1.0.0` ✅
   - `README.md`：`版本：v1.0.0（versionCode 10000）` ✅
   - **四处一致** ✅

4. **APK 内 assets/www 文件清单**（`unzip -l`）：15 个前端资产齐全，与源码一一对应、字节数一致：
   - `index.html`(9764) + `css/style.css`(14524) + `data/cet4.js`(1091242) + `data/essays.js`(12433) + `js/` 11 个模块（app/cards/essay/notebook/quiz/settings/srs/stats/store/tts/words）✅
   - 说明：任务描述写「js/ 12 个模块」，实测为 **11 个**；`index.html` 也恰好引用 11 个 js + 2 个 data + 1 个 css，总计 15 资产，**一致无缺失**。此为任务描述笔误，非产品缺陷。

> ⚠️ 附带发现（详见缺陷 P2-1）：`application-debuggable` 标志存在，且 APK 与 `app/build/outputs/apk/debug/app-debug.apk` **sha256/md5 完全一致**——交付的 `release\cet4words-v1.0.0.apk` 实为 **debug 变体的改名拷贝**。

---

### 维度二：词库数据（脚本 `tools/qa_check_data.js`，16/16 通过）

| 检查项 | 结果 |
|--------|------|
| CET4_WORDS 为数组，词数 | **4522**（与自报一致）✅ |
| 无空 word | ✅ |
| 无缺失音标（us/uk 至少一个） | ✅ |
| trans 均为数组 | ✅ |
| sentences 均为数组 | ✅ |
| 无重复 word（按小写去重） | ✅（去重后 4522） |
| 随机 10 词字段非空、trans 非空、sentences 结构正确 | ✅ |
| 音标无乱码（无 U+FFFD 替换符 / 方块） | ✅ |
| 词库无 emoji | ✅ |
| 范文正好 5 篇 | ✅（essay_1 ~ essay_5） |
| 好词好句正好 50 条 | ✅（q01 ~ q50） |
| 好词好句中英字段齐全 | ✅ |
| 范文中英字段齐全 | ✅ |
| 范文数据无 emoji | ✅ |

---

### 维度三：JS 语法与逻辑

#### 3.1 语法校验（`node --check`）
全部 **13 个 JS 文件通过**：`js/` 11 个模块 + `data/cet4.js` + `data/essays.js` ✅

#### 3.2 逻辑审查（脚本 `tools/qa_check_logic.js`，39/39 通过，加载**真实源码**在沙箱内运行）

1. **SM-2 算法（js/srs.js）**：
   - 间隔表 stage 0~6 = `0/1/2/4/7/15/30` 天 ✅；越界上下 clamp ✅
   - `know` → stage+1（封顶 6，到 6 转 `mastered`）✅
   - `forgot` → stage=0 + lapses+1 + next=今天 ✅
   - `fuzzy` → stage 不变、仅重算 next ✅
   - **`next_review_at` 使用本地日期**：`Util.todayStr()`/`addDays()` 全走本地 `getFullYear/getMonth/getDate`，全仓库 grep 无 `toISOString/toUTCString/getUTC*`，**无 UTC 跨天坑** ✅

2. **每日队列（js/words.js + js/srs.js）**：
   - `dueWords()`：`next_review_at <= 今天` 且排除 `mastered`，按间隔升序 ✅
   - `buildQueue()`：复习优先 + 补新词 ✅；`newWords()` 按词书顺序取未学词、限 `daily_new` 上限 ✅

3. **发音回退（js/tts.js）**：
   - 有道 `<audio>` 优先 → `onerror` / 3s 看门狗未 playing / `play()` promise 失败 → `AndroidBridge.speak` 回退 ✅
   - `fallbackOnce[word|accent]` 防死循环（同词只回退一次）✅
   - 竞态处理正确（3s 先到则 `cleanup()` 暂停在线音频，`onplaying` 再触发直接 return，不会双音）✅

4. **测试（js/quiz.js）**：
   - 四选一计分（`chosen === correctCn`）、拼写计分（大小写不敏感 trim）✅
   - 错词清单 + 错词一键入生词本（去重）✅
   - 抽题随机且不重复（`shuffle` + `seen` 去重，不足从全词库补）✅

5. **打卡（js/stats.js）**：
   - 同日不重复累计；昨天→连续+1；断签→重置为 1（不累加）；`total_checkin_days` 恒累加 ✅

#### 3.3 DOM 接线交叉校验（`tools/qa_check_dom.js`）
55 个 JS 引用的 DOM id 全部可解析：49 个静态 id 命中；其余 12 个为**动态拼接（`page-*`）或 innerHTML 动态生成后立即查询**（cardWord/cardSpeak/quizSpeak/quizOptions/spellInput/spellSubmit/spellFeedback/addWrongBtn/retryBtn/essayBack/memBtn），**查询均发生在 innerHTML 写入之后**，无运行时 null 崩溃风险 ✅

---

### 维度四：UI 铁律与可访问性（静态检查，全部达标）

| 铁律项 | grep/扫描结果 |
|--------|--------------|
| emoji | 0（全仓库仅代码注释中的 `→` 箭头 U+2192，非 emoji、不渲染）✅ |
| box-shadow | 0 ✅ |
| linear/radial/conic-gradient | 0 ✅ |
| cubic-bezier | 0（仅 `transition:opacity .15s linear` 一处，符合「linear/硬切」）✅ |
| @import | 0 ✅ |
| 外链字体 / @font-face / .woff/.ttf | 0 ✅ |
| 字体栈 | `system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`，系统字体、无 serif ✅ |

**对比度（WCAG 公式计算）：**

| 组合 | 对比度 | 阈值 4.5:1 |
|------|-------:|:----------:|
| 白字压 --accent(#1A6DF0) | **4.677** | ✅ 达标 |
| --accent(#1A6DF0) 压白底 | **4.677** | ✅ 达标 |
| --fg-2(#666) 压白底 | **5.742** | ✅ 达标 |
| --fg(#111) 压白底 | 18.883 | ✅ 远超 |
| --danger(#C0392B) 压白底 | 5.438 | ✅ 达标 |

---

### 维度五：功能冒烟（降级说明）

本环境无 Android 模拟器/真机，且未启用 agent-browser 对裸 WebView（缺 AndroidBridge、localStorage 走 file:// 语义）做真实渲染冒烟。**已明确降级为静态推演**，替代证据：
- 脚本加载顺序与 `index.html` `<script>` 顺序一致（数据 → store → words → srs → tts → stats → cards → quiz → notebook → essay → settings → app）✅
- 底部导航 5 入口（今日学习/生词本/测试/范文/设置）DOM 齐备、`app.js navigate()` 路由闭环 ✅
- 卡片页翻面（`.flashcard.flipped`）、三反馈按钮（不认识/模糊/认识）DOM + 事件齐备 ✅
- 生词本空状态（`.empty` 线描 SVG「暂无收藏词」）齐备 ✅

---

## 三、缺陷清单

| ID | 级别 | 位置 | 现象 | 证据 | 修复建议 |
|----|:----:|------|------|------|---------|
| P2-1 | P2（产物质量，非功能缺陷） | `release\cet4words-v1.0.0.apk` / `app\build\outputs\apk\` | 交付的「release」APK 实为 **debug 变体改名拷贝**，`application-debuggable=true`，签名 `CN=Android Debug` | ① sha256/md5 与 `app-debug.apk` 完全一致（`e1095e07...` / `a79ed6d2...`）；② `output-metadata.json` `variantName:"debug"`；③ `app/build/outputs/apk/` 下无 `release/` 目录；④ aapt2 输出 `application-debuggable` | 正式交付时执行 `.\build-apk.ps1 -Release` 产出真正的 `assembleRelease`（build.gradle.kts 已配 release buildType + debug 签名，`isMinifyEnabled=false` 但 release 默认非 debuggable）；如需对外发布应改用独立 release keystore 并关闭 debuggable |

**说明**：P2-1 不影响安装与功能（debug 变体可正常侧载运行），仅影响发布质量（debugeable 暴露调试接口、debug 签名不具发布身份）。首版侧载场景可接受，但应记录并修复发布流程。

---

## 四、智能路由判定

**判定：NoOne（无源码缺陷，可交付）。**

- 全部 93 项检查通过，SRS/队列/TTS 回退/测试/打卡等核心算法经真实源码沙箱实测正确，无源码 bug。
- 唯一问题 P2-1 属**产物打包流程**（release 目录放的是 debug 变体），不涉及被测源码逻辑改动；按 QA 角色「禁止修改被测源码、只报告」的约束，此问题**移交打包/发布环节处理**（非 Alex 源码缺陷、非测试误判），故路由 **NoOne** 并附「发布前需补跑 assembleRelease」的交付备注。

---

## 五、测试产物（已落盘，可复跑）

- `tools/qa_check_data.js` —— 词库/范文数据校验（16 项）
- `tools/qa_check_logic.js` —— SRS/words/stats 核心逻辑沙箱实测（39 项）
- `tools/qa_check_dom.js` —— JS↔DOM id 交叉校验（55 个 id）
- 复跑：`node tools/qa_check_data.js && node tools/qa_check_logic.js && node tools/qa_check_dom.js`

（上述脚本均为只读校验，不改动任何被测源码。）
