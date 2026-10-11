# QA 测试报告 —— 四级背单词（CET4Words）v1.1.0 UI 改版回归

> 作者：zhanghiz
> 被测对象：`D:\AndroidProjects\CET4Words` 源码 + `release\cet4words-v1.1.0.apk`（479,767 字节）
> 测试方式：**独立实测**（aapt2 / apksigner / node --check / headless Edge 真实渲染 E2E / WCAG 对比度复算），未修改任何被测源码
> 测试轮次：Round 1（发现 1×P1，路由 Engineer）→ Round 2（修复验证，**全过，判定 NoOne**）

---

## 一、测试总览

| 维度 | 检查项 | 通过 | 失败 | 说明 |
|------|-------:|-----:|-----:|------|
| 1. APK 产物与版本 | 11 | 10 | 1 | P2-1 遗留：release 包实为 debug 变体 |
| 2. DOM 接线与语法 | 21 | 21 | 0 | 新 3 id 接线正确、旧 id 已清除、13 个 JS 语法全过 |
| 3. 功能不回归（headless 真实渲染 E2E，45 断言） | 45 | 43 | 2 | **BUG-1（P1）：卡片翻面失效，答案未翻面即可见** |
| 4. UI 铁律与对比度 | 12 | 12 | 0 | 对比度独立复算全部达标、铁律 grep 全 0 |
| 5. 产物卫生 | 1 | 0 | 1 | P3-1：v1.0.0 备份 CSS 打进了 APK |
| **合计** | **90** | **86** | **4** | 去重后 **3 个独立问题**（1×P1、1×P2、1×P3） |

**本轮结论：发现 1 项 P1 源码缺陷（BUG-1 卡片翻面），判定路由 Engineer；修复后需 Round 2 回归。**

---

## 二、各维度实测结果与证据

### 维度一：APK 产物（独立核对，未采信自报）

1. **aapt2 dump badging**（`D:\devtools\android-sdk\build-tools\34.0.0\aapt2.exe dump badging release\cet4words-v1.1.0.apk`）：
   - `package: name='com.zhang.cet4words' versionCode='10100' versionName='1.1.0'` ✅
   - `sdkVersion:'24'`（minSdk 24）✅ `targetSdkVersion:'34'` ✅
   - `application-label:'四级背单词'` ✅
   - `launchable-activity: name='com.zhang.cet4words.MainActivity'` ✅
2. **apksigner verify**（JDK 17 @ `D:\devtools\jdk-17`）：`Verifies`，签名者 `CN=Android Debug`（SHA-256 `5b1ea0e0...`）→ **可安装** ✅
3. **版本四处同步**：
   - `app/build.gradle.kts:16-17`：`versionCode = 10100` / `versionName = "1.1.0"` ✅
   - `CHANGELOG.md`：`## v1.1.0（2026-01-01 改版）` ✅
   - `README.md:7`：`版本：v1.1.0（versionCode 10100）` ✅
   - APK 内实际值：`10100 / 1.1.0` ✅ —— **四处一致**
4. **APK 资产与源码一致性**（jar 解包 + diff）：`index.html / css/style.css / js/app.js / js/cards.js / js/settings.js / js/store.js` 与源码**逐字节一致** ✅
5. **v1.0.0 → v1.1.0 变更范围核对**（两版 APK 资产 diff，权威口径）：
   - 变更：`css/style.css`、`index.html`、`js/app.js`、`js/settings.js`、`js/store.js` —— 与自报一致 ✅
   - 未变更：`cards.js / quiz.js / notebook.js / essay.js / srs.js / stats.js / tts.js / words.js / data/*.js` ✅（「cards.js 未改」属实）
   - 新增：`css/style.css.v1.0.0-orig.css`（→ P3-1）
6. ❌ **P2-1（遗留）**：`release/cet4words-v1.1.0.apk` 与 `app/build/outputs/apk/debug/app-debug.apk` **sha256 完全一致**（`d1a7cb95e7ac7f14...`），aapt2 输出含 `application-debuggable` —— release 目录放的是 **debug 变体改名拷贝**。v1.0.0 QA 已报 P2-1，本轮未修复。

### 维度二：DOM 接线与语法

1. **新增 3 id 接线**（grep 行号证据）：
   - `index.html:27` `<span class="hero-num" id="homeNewNum">0</span>`
   - `index.html:28` `<span class="hero-total" id="homeNewTotal">/ 20</span>`
   - `index.html:31` `<span class="hero-tag" id="homeReviewTag">待复习 0 词</span>`
   - `app.js:25-27` renderHome 内 `Util.$('#homeNewNum'/'#homeNewTotal'/'#homeReviewTag')` 写入
   - 拼写完全一致，无悬空 ✅
2. **旧 id 清除**：全 www 目录 grep `homeNew|homeReview` 仅命中上述 6 行新 id；E2E 实测 `#homeNew` / `#homeReview` 均 `null` ✅
3. **node --check**：13/13 通过（js 11 个 + data 2 个）✅
4. **脚本加载顺序**（headless 实测 `document.scripts`）：
   `cet4.js > essays.js > store.js > words.js > srs.js > tts.js > stats.js > cards.js > quiz.js > notebook.js > essay.js > settings.js > app.js` —— 与要求的 data→store→…→app 完全一致 ✅（证据：`docs/qa-evidence-v1.1.0/script-order.pdf`）
5. **首页 Hero 结构**：`.hero` / `.hero-btn`（通栏白底实心）/ `.ghost-btn`（描边）/ `.stat-grid .stat`×3 / `#tabbar .tab`×5 全部存在 ✅

### 维度三：功能不回归（headless Edge 真实渲染 E2E，45 断言）

测试方法：以真实 `index.html` + 真实 `style.css` + 全部真实 JS（含 4522 词库）在 headless Edge（`--headless=new`）加载运行，用脚本驱动真实 DOM 事件（`click` / `change`），全程截图与文本留证（`docs/qa-evidence-v1.1.0/e2e-log.pdf`）。本轮未降级。

| # | 断言 | 结果 |
|---|------|:----:|
| T1 | 词库 4522 词、App/Cards/Store/Settings/Stats/SRS/Words/TTS/Util 全局齐备 | ✅ |
| T2 | renderHome 实写：`homeDate=10月10日`、`homeNewNum=0`、`homeNewTotal=/ 20`、`homeReviewTag=待复习 0 词`、三统计卡 0/0/0 | ✅ |
| T3 | 旧 id `#homeNew`/`#homeReview` 不存在 | ✅ |
| T4 | `Store.KEYS` 6 个 key 全部 `cet4.` 前缀（progress/notebook/quiz_history/stats/settings/essay_progress）——旧数据 key 未变 | ✅ |
| T5 | Hero/通栏按钮/描边按钮/3 统计卡/5 底部导航齐备 | ✅ |
| T6 | 脚本加载顺序一致 | ✅ |
| T7 | 点「开始学习」→ 卡片页打开、tabbar 隐藏、进度 `1 / 20`、正面渲染单词 `abruptly`、反面内容非空 | ✅ |
| **T8** | **翻面**：`.flipped` class 切换正常；FLIPPED 后 `front.display=none`、`back` 占满 526px 全宽 | ⚠️ 机制在，见 BUG-1 |
| **T8** | **未翻面默认态：`front.display=flex rect=263x825@22` 且 `back.display=flex rect=263x825@285`——正反两面并排同时可见** | ❌ BUG-1 |
| T9 | 收藏星标：`#cardStar.active` 切换 + `Store.getNotebook()` 写入 | ✅ |
| T10 | 三反馈按钮 `data-fb=forgot,fuzzy,know`（与 index.html:173-175、cards.js:188-192 绑定一致）；点「认识」→ 进度 `2 / 20`、progress 记录 `stage=1 fb=know` | ✅ |
| T11 | 退出卡片页回首页，`homeNewNum=1`（当日计数已刷新） | ✅ |
| T12 | 无到期词点「开始复习」→ toast「今天没有待复习的单词」 | ✅ |
| T13 | 自定义输入 33 → `daily_new=33`，回首页 **`homeNewTotal=/ 33`（分母跟随）** | ✅ |
| T14 | 非法值 300/4/abc → 回退 33 且输入框还原；边界 200/5 → 均接受（范围 5–200 校验完整，store.js:94-96 + settings.js:89-110） | ✅ |
| T15 | 快捷档 chip「50」仍生效且 active 高亮 | ✅ |

#### ❌ BUG-1（P1 · 功能）：背词卡「翻面」失效 —— 未翻面时答案（释义+例句）已可见，翻面后正面反而消失

- **位置**：`app/src/main/assets/www/css/style.css:340-349`
  - 行 340-344 `.flashcard{...display:flex; align-items:stretch...}`（row flex 容器）
  - 行 346 `.card-front{display:flex; ...}`
  - **行 347 `.card-back{display:flex; flex-direction:column; justify-content:center}` ← 默认未隐藏（应为 `display:none`）**
  - 行 348-349 `.flashcard.flipped .card-front{display:none}` / `.flashcard.flipped .card-back{display:flex}`
- **现象**：`.flashcard` 是 row flex，`.card-front`/`.card-back` 均 `display:flex` 且各 `width:100%`，flex 收缩后两面**并排各占一半同时可见**；点卡片翻面后正面 `display:none`、反面占满。即：用户从第一张卡起就能直接看到释义和例句，「先回想再看答案」的学习流程完全不成立。
- **证据（headless Edge 实测，真实源码渲染）**：
  - 未翻面：`front.display=flex rect=263x825@22`，`back.display=flex rect=263x825@285`（263+263≈526 卡宽，左右并排）
  - 翻面后：`front.display=none`，`back rect=526x825@172` 全宽
  - 截图 `docs/qa-evidence-v1.1.0/bug1-real-unflipped.png`：同屏可见左「abruptly + 美/英音标」、右「adv. 突然地 + The path ends off abruptly. 这条路突然到头了。」
  - 隔离复现 `docs/qa-evidence-v1.1.0/bug1-css-probe.png`（仅真实 CSS + 同构 DOM）
- **定性**：该段 CSS 与 v1.0.0 原版（`style.css.v1.0.0-orig.css:286-295`）逐字相同 → **历史遗留缺陷，非 v1.1.0 改版引入的回归**；但 v1.1.0 承诺「功能不回归」并自报卡片页 DOM 本就符合版式 A，实测不成立。上轮 QA 冒烟降级为静态推演（只查了 DOM/事件存在），未能覆盖 computed style，本轮真实渲染暴露。
- **修复建议**：`style.css:347` 改为 `.card-back{display:none; flex-direction:column; justify-content:center}`（保留行 349 的 `.flipped` 时 `display:flex`）。一处改动，cards.js 无需动。

### 维度四：UI 铁律与配色对比度（独立复算）

1. **对比度独立计算**（WCAG 2.x 相对亮度公式，Python 复算，非采信自报）：

| 组合 | 独立复算值 | 工程师自报 | 阈值 4.5:1 |
|------|-------:|-------:|:----:|
| 白字 #FFFFFF 压 --accent #2F4B6E（Hero 主卡） | **8.93** | 8.93 | ✅ |
| #2F4B6E 压暖白 #FBF9F4 | **8.48** | 8.48 | ✅ |
| 次级 #6B6560 压暖白 #FBF9F4 | **5.46** | 5.46 | ✅ |
| 墨黑 #1F1D1A 压暖白 #FBF9F4 | 15.98 | — | ✅ |
| 通栏白底按钮 #2F4B6E 字压 #FFFFFF | **8.93** | — | ✅ |
| Hero 内 opacity .85 次级白字（混合后 #E0E4E9）压 #2F4B6E | 6.99 | — | ✅ |

   四组关键组合与自报**完全吻合**，Hero 实色卡与白底通栏按钮均达标。
2. **铁律 grep**（全 www 目录）：`box-shadow` 0、`linear-gradient/radial-gradient` 0（Hero 为实色 `background:var(--accent)`，非渐变）、`@import` 0、`text-shadow` 0、实际 emoji 字符 0（Unicode 码点扫描 U+1F000–U+1FAFF / U+2600–U+27BF 等区间，命中 0 文件）、`font-family` 仅 `system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif`，无 serif ✅（`style.css:11-23` 变量区实证）

### 维度五：产物卫生

- ❌ **P3-1**：`css/style.css.v1.0.0-orig.css`（14,524 字节，v1.0.0 备份）被一并打进 APK `assets/www/css/`，`index.html` 无任何引用 → 死文件增大安装包。建议移出 `www/`（放 `docs/` 或删除）。

---

## 三、缺陷清单

| ID | 级别 | 位置 | 现象 | 证据 | 修复建议 |
|----|:----:|------|------|------|---------|
| BUG-1 | **P1** | `app/src/main/assets/www/css/style.css:347`（关联 340-349、cards.js 未变） | 背词卡未翻面时正面与反面（释义+例句）**并排同时可见**；翻面后正面消失。翻面学习语义不成立 | headless 实测：unflipped `front 263px@22 + back 263px@285` 并排；截图 `docs/qa-evidence-v1.1.0/bug1-real-unflipped.png`、`bug1-css-probe.png` | 行 347 改 `.card-back{display:none; flex-direction:column; justify-content:center}`，保留 `.flipped` 时 `display:flex` |
| P2-1 | P2（遗留，v1.0.0 已报） | `release/cet4words-v1.1.0.apk` | release 包仍为 **debug 变体改名拷贝**：与 `app-debug.apk` sha256 一致（`d1a7cb95...`）、`application-debuggable` | sha256sum + aapt2 输出 | 交付前跑 `assembleRelease`（`.\build-apk.ps1 -Release` 并核对产物 hash 不同、无 debuggable）；对外发布换独立 keystore |
| P3-1 | P3 | `app/src/main/assets/www/css/style.css.v1.0.0-orig.css` | v1.0.0 备份 CSS 打进 APK，无引用，白占 14.5KB | APK 解包清单 | 移出 `www/` 或删除 |

---

## 四、智能路由判定（Round 1 · 历史记录）

**判定：Engineer（存在 1 项 P1 源码缺陷 BUG-1）。**

- BUG-1 为 `style.css` 源码缺陷（测试断言依据 PRD「翻面：正面单词音标 → 翻面看释义例句」的正确行为，实测答案提前泄漏），**测试用例无误**，须由工程师修复。
- P2-1 属打包流程遗留（v1.0.0 已报未修）、P3-1 属产物卫生，一并随修复单处理。
- ~~修复后 QA 将执行 Round 2 回归~~ → Round 2 已完成，见「六、Round 2 回归」。

---

## 五、测试产物（已落盘，可复跑）

- `docs/qa-evidence-v1.1.0/bug1-real-unflipped.png` —— 真实 App 渲染下未翻面即见答案（关键证据）
- `docs/qa-evidence-v1.1.0/bug1-css-probe.png` —— 真实 style.css 隔离复现（含 computed style 数据）
- `docs/qa-evidence-v1.1.0/e2e-log.pdf` —— 45 断言全量 E2E 日志（T1–T15）
- `docs/qa-evidence-v1.1.0/script-order.pdf` —— 脚本加载顺序核验

复跑要点：aapt2/apksigner 路径 `D:\devtools\android-sdk\build-tools\34.0.0\`，JAVA_HOME=D:\devtools\jdk-17；headless 渲染用 `msedge.exe --headless=new --screenshot/--print-to-pdf`（`--dump-dom` 在本机不产出，已用 PDF 文本提取替代）。

---

## 六、Round 2 回归（修复验证 · 全过）

> 被测对象：工程师修复后重新打包的 `release\cet4words-v1.1.0.apk`（479,681 字节，sha256 `82361b35...`）
> 测试方法与 Round 1 相同（headless Edge 真实渲染 E2E + 独立工具核对），未修改任何被测源码。
> 工程师修复自报：① style.css `.card-back` 默认 `display:none`；② `.orig` 备份移出 www（→ docs/backup）；③ CHANGELOG 补「修复」条目；④ 重打包。

### 6.1 翻面专项（BUG-1 验证）✅ 修复成立

| 状态 | front (#cardFront) | back (#cardBack) | 结论 |
|------|--------------------|------------------|------|
| 未翻面 DEFAULT | `display:flex rect=526x1425@172`（全宽可见） | `display:none rect=0x0@0`（不可见） | ✅ 仅见正面 |
| 翻面 FLIPPED | `display:none rect=0x0@0` | `display:flex rect=526x1425@172`（全宽可见） | ✅ 仅见反面 |
| 再翻回 UNFLIPPED | `display:flex` | `display:none` | ✅ 可逆 |

- 源码实证：`style.css:347` `.card-back{display:none; flex-direction:column; justify-content:center}`，行 348-349 `.flipped` 规则保留，cards.js 未动。
- 截图证据：`docs/qa-evidence-v1.1.0/r2-flip-unflipped-fixed.png`（未翻面仅「abruptly + 音标」，对比 Round 1 的 bug1-real-unflipped.png 双面泄漏）、`r2-flip-flipped-fixed.png`（翻面后仅「adv. 突然地 + 例句」）。

### 6.2 全量 E2E 复跑（45 断言）✅ 45/45 通过

T1–T15 全部通过（日志：`docs/qa-evidence-v1.1.0/r2-e2e-log.pdf`）。要点：
- renderHome 实写 homeNewNum/homeNewTotal/homeReviewTag 正常；旧 id 仍不存在；脚本顺序 ok=true。
- 学习流程：进卡片（1/20）→ data-fb forgot/fuzzy/know → know 后 `2/20` + progress `stage=1 fb=know` → 退出回首页 `homeNewNum=1`。
- 收藏/生词本、无到期复习 toast 均正常。
- 每日新词量：33 生效且首页分母 `/ 33`；非法 300/4/abc 回退；边界 5/200 通过；chip50 正常。
- Store 6 key 全 `cet4.` 前缀。

### 6.3 语法 / DOM / 铁律复测 ✅

- `node --check`：13/13 通过。
- DOM 接线 grep：新 3 id 仅命中 index.html:27/28/31 与 app.js:25-27，无悬空引用。
- 铁律：emoji 码点扫描 0 文件；box-shadow/linear-gradient/radial-gradient/@import/text-shadow/serif 全 0。配色变量（:root 11-23 行）未变，Round 1 对比度结论（8.93/8.48/5.46/15.98，均 ≥4.5）继续有效。

### 6.4 重打包核对 ✅

- aapt2 badging：`versionCode='10100' versionName='1.1.0'`、label 四级背单词、minSdk 24 ✅
- apksigner verify：`Verifies` ✅
- APK 内资产：`assets/www/css/` 仅 `style.css`，**无 .orig 文件**（P3-1 修复确认，www/css 下也已无该文件，备份移至 docs/backup/）✅
- APK 内 style.css 与源码**逐字节一致**，且含修复行（APK 解包后 grep：`347:.card-back{display:none; ...}`）✅
- CHANGELOG v1.1.0 新增「### 修复：背词卡片翻面失效」条目 ✅

### 6.5 Round 2 缺陷清单

| ID | 级别 | 状态 | 说明 |
|----|:----:|------|------|
| BUG-1 | P1 | **已修复验证通过** | 翻面失效，见 6.1 |
| P3-1 | P3 | **已修复验证通过** | .orig 已移出 www 与 APK |
| P2-1 | P2（遗留） | **仍未修复**（本轮修复范围外） | 新 APK sha256 仍与 `app-debug.apk` 一致（`82361b35...`），badging 仍含 `application-debuggable` —— release 目录放的仍是 debug 变体改名拷贝。可安装可用，仅影响发布质量；对外发布前需跑 `assembleRelease` + 独立 keystore。作为 Known Issue 记录。 |

### 6.6 Round 2 智能路由判定

**Round 2 总览：60 项检查（翻面专项 6 + E2E 45 + 语法/DOM/铁律复测 6 + 重打包核对 5 - 少量合并计数），全部通过，0 失败。**

**判定：NoOne —— 无源码缺陷，可交付 v1.1.0。**（P2-1 为发布流程 Known Issue，不阻塞侧载交付，建议在对外发布前修复并复验。）
