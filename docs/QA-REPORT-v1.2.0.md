# QA 测试报告 v1.2.0 — 词书体系扩展

- **被测对象**：`CET4Words` 安卓「四级背单词」App，v1.2.0（versionCode 10200）
- **测试方式**：独立实测（不采信工程师自报），真实命令行 / Node 脚本 / headless Edge 渲染
- **测试时间**：2026-10-11
- **被测产物**：`release/cet4words-v1.2.0.apk`（896,336 字节）
- **测试环境**：Node v22.22.2、Python 3.13、JDK 17（D:\devtools\jdk-17）、Android SDK build-tools 34.0.0（D:\devtools\android-sdk）、Microsoft Edge（headless，Chromium 内核）

---

## 0. 结论先行（Routing Decision）

**判定：NoOne —— 无源码缺陷，v1.2.0 可交付。**

- 自动化用例合计 **71 个，全部通过（71 PASS / 0 FAIL）**，另含 UI 铁律与 APK 产物核对全部符合。
- 测试过程中发现 1 个**测试脚本自身的断言错误**（`document.querySelectorAll('.fb')` 误把生词本浏览按钮也计入「三档反馈」），已由 QA 自行修正（属测试缺陷，非源码缺陷），修正后复跑全绿。
- 无阻断性缺陷、无功能缺陷、无数据缺陷。

---

## 1. 测试总览

**自动化脚本断言合计 71 条，全部通过（71 PASS / 0 FAIL）：**

| 脚本 | 覆盖维度 | 断言数 | 通过 | 失败 |
| --- | --- | --- | --- | --- |
| `qa_verify_data.js` | 二、数据文件 | 15 | 15 | 0 |
| `qa_verify_migrate.js` | 三、schema 与迁移 | 24 | 24 | 0 |
| `qa_headless_edge.js` | 四、词书切换 + 五、功能回归 | 32 | 32 | 0 |
| **合计** | | **71** | **71** | **0** |

**非脚本命令核对项（全部符合）：**

- 一、APK 产物：`aapt2 dump badging` 6 字段（package/versionCode/versionName/label/minSdk/targetSdk）✅；`apksigner verify` 可安装 ✅；版本四处同步 ✅；APK 内 3 数据文件齐全 ✅；文件大小 896,336 字节 ✅。
- 六、UI 铁律：emoji/shadow/gradient/@import/serif 全 0 ✅；`node --check` 16 个 JS 全过 ✅。

> 说明：维度四（词书切换 19 条）+ 维度五（功能回归 13 条）合计 32 条，均在真实 headless Edge 中执行。

---

## 2. 维度一：APK 产物核对（独立）

使用 `aapt2 dump badging` + `apksigner verify` + Python `zipfile` 逐一实测：

```
aapt2 dump badging release/cet4words-v1.2.0.apk
  package: name='com.zhang.cet4words' versionCode='10200' versionName='1.2.0'
  sdkVersion:'24'   targetSdkVersion:'34'
  application-label:'四级背单词'
```

| 项 | 期望 | 实测 | 结果 |
| --- | --- | --- | --- |
| package | com.zhang.cet4words | com.zhang.cet4words | ✅ |
| versionCode | 10200 | 10200 | ✅ |
| versionName | 1.2.0 | 1.2.0 | ✅ |
| label | 四级背单词 | 四级背单词 | ✅ |
| minSdk | 24 | 24 | ✅ |
| targetSdk | 34 | 34 | ✅ |

- **apksigner verify**：`Verifies`，v2 scheme = true，exit 0 → 可安装。签名者为 Android Debug（与 README「release 复用 debug 签名便于侧载」一致，属既有已知约定，非 v1.2.0 缺陷）。
- **版本四处同步**（均一致）：
  - `app/build.gradle.kts:16-17` → `versionCode = 10200` / `versionName = "1.2.0"`
  - `CHANGELOG.md:3` → `## v1.2.0（2026-10-11）`
  - `README.md:7` → `版本：v1.2.0（versionCode 10200）`
  - APK 内 badging → `versionCode='10200' versionName='1.2.0'`
  - 另：关于页 `appVersion()`（MainActivity.java:223-229）读包信息 versionName，运行时即返回 1.2.0。
- **APK 内 assets/www/data 三文件齐全**（Python zipfile 列出）：
  - `assets/www/data/cet4.js`（1,091,242 B）
  - `assets/www/data/cet4_core.js`（18,216 B）
  - `assets/www/data/cet6.js`（1,033,207 B）
  - 另有 `essays.js`（12,433 B）与全部 `js/*.js`（含新增 `books.js`）。
- **APK 文件大小**：896,336 字节，与自报一致 ✅。

---

## 3. 维度二：数据文件抽查（独立脚本 `tools/tmp/qa_verify_data.js`）

- `data/cet4.js`：4522 词 ✅；字段 `word/phonetic_us/phonetic_uk/trans/sentences` 齐全（missing=0）✅；无重复 word（unique=4522）✅。
- `data/cet4_core.js`：**2000 词单** ✅；全部为字符串 ✅；**全部能在 cet4.js 命中（0 missing）** ✅；无重复（unique=2000）✅。
- `data/cet6.js`：**3976 词（≥3000）** ✅；字段与 cet4.js 完全一致 ✅；无重复 word ✅；抽查 10 词（index 0/1/100/500/1000/1500/2000/2500/3000/末位）字段非空、无乱码、无 mojibake ✅。
- **window 变量名与 index.html 引入顺序一致**：
  - `cet4.js` → `window.CET4_WORDS`
  - `cet4_core.js` → `window.CET4_CORE_WORDS`
  - `cet6.js` → `window.CET6_WORDS`
  - `essays.js` → `window.CET4_ESSAYS`
  - index.html 引入顺序：`cet4.js → cet4_core.js → cet6.js → essays.js`，与 `words.js` 期望的 `CET4_WORDS/CET4_CORE_WORDS/CET6_WORDS`、`essay.js` 期望的 `CET4_ESSAYS` 一一对应 ✅。

---

## 4. 维度三：localStorage schema 与迁移（独立重写 `tools/tmp/qa_verify_migrate.js`）

不采信工程师 `test_migrate.js`，直接加载被测 `store.js` 源码（仅 mock localStorage/document/window），4 大场景 24 条断言全过：

1. **老用户迁移**：老 `cet4.progress`（2 词）+ 旧 `cet4.stats`（streak=5 + total_learned=30 等混合字段）→ 迁移后：
   - `cet4.books.cet4_full.progress` 含 2 词 ✅
   - `cet4_full.stats.total_learned=30 / total_reviewed=15 / daily_new_count=20 / daily_review_count=10 / daily_date=last_checkin_date` ✅
   - 全局 `cet4.stats` 仅保留 `{streak_days:5, total_checkin_days:12, last_checkin_date}`（`total_learned` 已移除）✅
   - `meta.current_book=cet4_full`、`schema_version=2`、`migrated_from_v1=true` ✅
   - 旧 `cet4.progress` key 已删除 ✅；`cet4_core`/`cet6_full` 为空书 ✅
2. **新用户**：无旧 key → `current_book=cet4_core`、`migrated_from_v1=false`、三本空书、全局打卡默认三字段 ✅
3. **幂等**：迁移两次，前后 localStorage 全量 snapshot 完全一致 ✅
4. **getProgress/setProgress 兼容壳**：确证指向「当前书」——切到 cet6_full 后读到空 progress，写 `{b}` 落在 cet6_full，切回 cet4_core 读到之前的 `{a}`（不串书）✅

---

## 5. 维度四：词书切换功能（headless Edge 真实渲染 `tools/tmp/qa_headless_edge.js`）

通过 CDP 驱动本机 Edge 加载 `www/index.html`（HTTP 服务保证 localStorage 可靠），逐项真实点击/断言：

1. 首页 Hero 区存在 `#homeBookCapsule`「当前词书」胶囊，新用户默认显示「四级核心」✅
2. 点击胶囊 → 进入全屏 `#page-books`（非隐藏）、底部导航隐藏 ✅
3. 选择页三行（cet4_core / cet4_full / cet6_full），当前书 `cet4_core` 带 `.active` 高亮 ✅；三行分别显示「已学 0 / 2000 · 待复习 0」「…/4522…」「…/3976…」✅
4. 切换 cet6_full → 回首页，首页书名变为「六级完整」，`Words.currentBook()=cet6_full`，`Words.currentList().length=3976` ✅
5. **严格当前书**：切到六级后 `Words.currentList()` 与 `cet6_full` 词表完全一致（3976 词，不混入四级；cet6 独有 2112 词 / cet4 独有 2658 词，互不干扰）✅；实际跑一题四选一，题干词 `instruct` 属 cet6，三个干扰项释义（「v. 强迫」「n. 抓，划痕」「adj. 巨大的， 庞大的」）均可在 cet6 内解析，无四级混入 ✅（代码依据：quiz.js:44 `sampleWords` 与 quiz.js:56 `makeOptions` 均走 `Words.currentList()`）
6. **生词本跨书**：在四级核心真实「开始学习→收藏」首词 `a`，切到六级后进生词本，该词仍显示且能解析释义「art. 一(个)；每一(个)」✅

---

## 6. 维度五：功能回归

1. **卡片翻面**：初始未翻面（无 `flipped` 类）→ 点击翻面 → 再点翻回 ✅；「不认识」未翻面时自动翻面显示释义（v1.1.1 修复未回退）✅；三档反馈按钮（`#cardsActions .fb[data-fb]`）3 个 ✅
2. **每日新词量 5~200**：`getSettings()` 对 300→20、1→20 钳制，5/200 边界有效 ✅；settings.js 输入框 change 校验同规则（代码核对 settings.js:112-127）
3. **打卡全局一天一次 + 计数按书隔离**：当天首次学习 `streak=1/total_checkin=1`；同日再学不重复打卡（仍 1）；切到六级再学，cet6 计数独立 +1，全局打卡不变（仍 1）✅

---

## 7. 维度六：UI 铁律（grep + node --check）

对 `app/src/main/assets/www` 全量扫描：

| 铁律 | 结果 |
| --- | --- |
| emoji（脚本扫描 1F000-1FAFF 等区间） | 0 ✅ |
| `box-shadow` | 0 ✅ |
| `linear-gradient` / `radial-gradient` | 0 ✅ |
| `@import` 外链字体 | 0 ✅ |
| `font-family` 含 serif | 0（仅 `sans-serif`）✅ |
| 词书选择页沿用纸墨暖白 | ✅（`.book-item.active` 用 `--accent` #2F4B6E + `--accent-soft` #ECF0F4 + 暖白 `--bg` #FBF9F4，白面细线，无阴影渐变） |

- `node --check`：12 个 JS + 4 个 data JS 全部语法通过 ✅

---

## 8. 缺陷清单

**无源码缺陷。**

测试过程中唯一一次 FAIL 为 QA 自身断言错误（误用 `.fb` 选择器把 2 个浏览按钮计入三档反馈），属测试脚本缺陷，QA 已自行修正并复跑通过，非被测源码问题，不计入缺陷。

---

## 9. 智能路由判定

| 项 | 内容 |
| --- | --- |
| 判定 | **NoOne** |
| 结论 | 全量 71 用例通过，无源码缺陷，v1.2.0 可交付 |

## 10. 附：QA 独立测试脚本（可复跑）

- `tools/tmp/qa_verify_data.js` —— 数据文件独立校验（15 断言）
- `tools/tmp/qa_verify_migrate.js` —— 迁移独立重写测试（24 断言）
- `tools/tmp/qa_headless_edge.js` —— headless Edge 真实渲染（32 断言）
