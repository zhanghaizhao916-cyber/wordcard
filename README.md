# 单词卡（CET4Words）

一个离线可用、极简无干扰的安卓背单词应用。基于 WebView 混合架构，内置三本四六级词书，按艾宾浩斯间隔重复科学安排复习。

## 功能特性

- **三本词书**：四级核心（2000 高频词）、四级完整（4522 词）、六级完整（3976 词），可自由切换、进度独立
- **背单词卡片**：翻面看释义、点词发音、收藏，认识 / 模糊 / 不认识三档反馈
- **乱序学习**：新词随机抽取，避免按字母序连背
- **间隔重复**：SM-2 简化版，按词书独立排期复习
- **生词本**：跨词书共享收藏
- **学习统计**：连续打卡、本词书总进度条、预计学完天数
- **发音**：有道在线发音，断网自动回退系统 TTS
- **深色模式** + **新手引导**
- **完全离线**：数据保存在本机，不联网、不上传

## 快速开始

### 方式一：直接安装 APK

从 [Releases](../../releases) 下载最新版 `cet4words-vX.X.X.apk`，传到手机安装即可（需允许「未知来源」）。

### 方式二：从源码构建

环境要求：JDK 17、Android SDK、Gradle 8.7。

```powershell
.\build-apk.ps1              # 私用版（含词库，构建完即用）
.\build-apk.ps1 -NoDict      # 发布版（不含词库，规避版权风险）
.\build-apk.ps1 -Release     # release 包（复用 debug 签名）
```

- **私用版**：默认含词库，构建完可直接安装使用。
- **发布版**（`-NoDict`）：不含词库，避免分发版权受限数据；安装后需按上文「词库」章节生成词库后重新构建。

产物：`app\build\outputs\apk\debug\app-debug.apk`

## 词库

> 词库数据文件**不随仓库分发**（来源许可证不明或受限），Clone 后需运行脚本自行生成。

| 词书 | 词数 | 数据文件 | 来源与许可证 |
| --- | --- | --- | --- |
| 四级核心 | 2000 | `data/cet4_core.js` | [exam-data/CETVocabulary](https://github.com/exam-data/CETVocabulary)（CC BY-NC-SA 4.0，仅供学习） |
| 四级完整 | 4522 | `data/cet4.js` | [kajweb/dict](https://github.com/kajweb/dict)（爬取有道词典，许可证不明，仅供学习） |
| 六级完整 | 3976 | `data/cet6.js` | [kajweb/dict](https://github.com/kajweb/dict)（同上） |

生成方式：

```bash
python tools/build_dict.py --book all   # 生成四级完整 + 六级完整
python tools/build_core.py               # 生成四级核心词单
```

- 两个脚本均为纯标准库、无第三方依赖，需 Python 3。
- 访问 GitHub 需代理（默认 `http://127.0.0.1:17891`，可用 `--proxy ""` 直连）。
- 已下载过的可用 `--no-download` 复用 `tools/tmp` 缓存。

> 词库数据仅供个人学习研究使用；本项目源码采用 MIT 许可，但词库数据不在该许可范围内。

## 目录结构

```
├── app/
│   ├── build.gradle.kts                    # 应用配置（版本号在此）
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/zhang/cet4words/       # Java 壳（MainActivity / TtsEngine / FileExporter）
│       ├── res/                            # 资源与自适应图标
│       └── assets/www/                     # 前端（index.html / css / js / data）
├── tools/                                  # 词库生成、图标生成、APK 校验等脚本
├── docs/                                   # PRD / 架构设计 / 发布自检清单
├── build-apk.ps1                           # 一键构建脚本
├── CHANGELOG.md                            # 版本更新日志
└── LICENSE                                 # MIT 许可证
```

## 技术说明

- **架构**：纯 Java 单 Activity 外壳（零 AndroidX / Kotlin / 第三方运行时依赖）+ 离线 HTML/CSS/JS。
- **数据存储**：WebView localStorage（虚拟域名 `https://cet4words.local` 保证可靠持久化），设置页支持 JSON 导入导出。
- **发音**：有道 dictvoice（`type=1` 英音 / `type=2` 美音），加载失败或 3 秒未播放时回退系统 TextToSpeech。

## 贡献

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/xxx`
3. 提交更改：`git commit -m "feat: 功能说明"`
4. 推送到分支：`git push origin feature/xxx`
5. 提交 Pull Request

提交信息请遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范（`feat` / `fix` / `style` / `refactor` / `docs` / `chore`）。

## 许可证

本项目采用 [MIT License](LICENSE)，版权归 zhanghiz 所有。
