# 单词卡（CET4Words）

一个离线可用、极简无干扰、能科学安排复习的安卓背单词工具（WebView 混合应用）。

- 应用名：单词卡
- 包名：`com.zhang.cet4words`
- 版本：v1.6.1（versionCode 10601）
- minSdk 24 / targetSdk 34
- 形态：纯 Java 单 Activity 外壳（零 AndroidX / Kotlin / 第三方运行时依赖）+ 离线 HTML/CSS/JS

## 功能

- 今日学习首页（打卡 / 本词书总进度条 / 统计）
- 三本词书：四级核心（2000 高频词）/ 四级完整（4522 词）/ 六级完整（3976 词），词书切换独立进度
- 背单词卡片（翻面、发音、收藏、认识 / 模糊 / 不认识三档反馈）
- 乱序学习（新词随机抽取）
- 有道在线发音 + 系统 TTS 回退
- 生词本（跨词书共享）
- 设置（发音偏好 / 每日新词量 + 预计天数 / 词书 / 深色模式 / 数据导入导出）
- 新手引导（首次启动）
- SM-2 简化版间隔重复排期（按词书独立队列）

## 目录结构

```
settings.gradle.kts / build.gradle.kts / gradle.properties / local.properties
build-apk.ps1                     # 一键构建脚本
app/build.gradle.kts              # 应用配置（版本号在这里）
app/src/main/AndroidManifest.xml
app/src/main/java/com/zhang/cet4words/   # Java 壳（MainActivity/TtsEngine/FileExporter）
app/src/main/res/                 # 资源 + 自适应图标
app/src/main/assets/www/          # 前端（index.html / css / js / data）
tools/build_dict.py               # 下载并清洗 CET4 / CET6 词库 → data/cet4.js / cet6.js
tools/build_core.py               # 词频表 → 四级核心词单 data/cet4_core.js
tools/verify_apk.py               # aapt2 核对 APK 版本信息
tools/make_icons.py               # 生成启动图标 PNG（纯标准库）
docs/                             # PRD / 架构设计 / 发布自检清单
```

## 构建

环境（本机已就绪）：JDK 17、Android SDK、Gradle 8.7、依赖缓存走阿里云镜像。

```powershell
.\build-apk.ps1            # 出 debug 包（默认）
.\build-apk.ps1 -Release   # 出 release 包（复用 debug 签名）
```

产物：`app\build\outputs\apk\debug\app-debug.apk`（debug）或 `...\release\app-release.apk`。

> 构建前会清空代理环境变量，依赖走阿里云国内镜像，无需 VPN。

## 词库（不随仓库分发，需自行生成）

> ⚠️ 词库数据文件（`data/cet4.js` / `cet6.js` / `cet4_core.js`）**不包含在本仓库**，
> 因为其来源许可证不明或受限（见下表）。Clone 后需运行脚本自行生成。

三本词书：

| 词书 | 词数 | 数据文件 | 来源与许可证 |
| --- | --- | --- | --- |
| 四级核心 | 2000 | `data/cet4_core.js` | [`exam-data/CETVocabulary`](https://github.com/exam-data/CETVocabulary)（数据 CC BY-NC-SA 4.0，仅供学习） |
| 四级完整 | 4522 | `data/cet4.js` | [`kajweb/dict`](https://github.com/kajweb/dict)（爬取自有道词典，许可证不明，仅供学习） |
| 六级完整 | 3976 | `data/cet6.js` | [`kajweb/dict`](https://github.com/kajweb/dict)（同上） |

### 如何生成 / 导入词库

```bash
# 1. 生成四级完整 + 六级完整（下载 kajweb/dict 词书，需能访问 GitHub）
python tools/build_dict.py --book all

# 2. 生成四级核心词单（下载 CETVocabulary 词频表）
python tools/build_core.py
```

- 两个脚本均为纯标准库、无第三方依赖，需要 Python 3。
- 国内访问 GitHub 需开代理（默认 `http://127.0.0.1:17891`，可用 `--proxy` 指定，`--proxy ""` 直连）。
- 已下载过的可用 `--no-download` 复用 `tools/tmp` 缓存。
- 清洗规则：按 word 去重、法语字母归一化、精简字段、每词 1 例句、剔除音标/释义缺失的脏数据。

> **版权提示**：上述词库数据仅供个人学习研究使用；本项目**源码**采用 MIT 许可，但**词库数据不在该许可范围内**，请自行评估使用风险。

## 数据说明

- 全部学习数据保存在本机 WebView 的 localStorage（虚拟域名 `https://cet4words.local` 保证可靠持久化），不联网、不上传。
- 设置页支持导出 / 导入 JSON 备份到手机「下载」目录。

## 发音

- 在线：有道 dictvoice，`type=1` 英音 / `type=2` 美音。
- 回退：`<audio>` 加载失败或 3 秒未播放时，自动切到安卓系统 TextToSpeech；同一单词只回退一次。

## 许可证

本项目采用 [MIT License](LICENSE)，版权归 [zhanghiz](https://github.com/zhanghiz) 所有。
