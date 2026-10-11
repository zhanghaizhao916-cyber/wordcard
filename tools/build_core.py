#!/usr/bin/env python3
"""生成四级核心词单 data/cet4_core.js（window.CET4_CORE_WORDS）。

词频源：GitHub exam-data/CETVocabulary 仓库的 cet_full_list.json
（对象 {"四六级词汇词频排序表": [{序号, 词频, 六级, 单词, 释义, ...}]}）。

筛选规则：
  1. 「六级」字段为 None / 空串 / false / 0 视为四级词（'★' 视为六级，剔除）
  2. 单词需能在 data/cet4.js 中命中（复用 cet4.js 词条，不重复内嵌释义）
  3. 按词频排序表顺序（序号升序 = 词频由高到低）取前 N 个（默认 2000）

校验：
  - 核心词数 ∈ [1500, 2000]
  - 全部核心词都能在 cet4.js 命中

回退：词频源下载失败时，退化为「按 cet4.js 现有顺序取前 N 词」（并打印降级说明）。

纯标准库实现，无 pip 依赖。
用法：
  python tools/build_core.py                 # 常规构建（默认 2000 词）
  python tools/build_core.py --top 2000      # 指定词数
  python tools/build_core.py --no-download   # 只使用 tools/tmp 已缓存 json
  python tools/build_core.py --proxy <url>   # 指定代理（默认 http://127.0.0.1:17891）
"""
import argparse
import json
import os
import re
import sys
import unicodedata
from urllib import request

RAW_URL = "https://raw.githubusercontent.com/exam-data/CETVocabulary/master/cet_full_list.json"
DEFAULT_PROXY = "http://127.0.0.1:17891"

HERE = os.path.dirname(os.path.abspath(__file__))
TMP_DIR = os.path.join(HERE, "tmp")
CORE_JSON = os.path.join(TMP_DIR, "cet_full_list.json")
CET4_JS = os.path.join(HERE, "..", "app", "src", "main", "assets", "www", "data", "cet4.js")
OUT_PATH = os.path.join(HERE, "..", "app", "src", "main", "assets", "www", "data", "cet4_core.js")

MIN_CORE = 1500
MAX_CORE = 2000

_WORD_RE = re.compile(r'"word"\s*:\s*"([^"]+)"')


def normalize_word(w):
    """法语字母归一化 + 小写 + 去首尾空白（与 build_dict.py 保持一致）。"""
    w = unicodedata.normalize("NFKD", w)
    w = "".join(ch for ch in w if not unicodedata.combining(ch))
    return w.strip().lower()


def load_cet4_words():
    """从 data/cet4.js 提取词表（保持文件内顺序 + 去重小写集合）。"""
    text = open(CET4_JS, encoding="utf-8").read()
    words = _WORD_RE.findall(text)
    order = []
    seen = set()
    for w in words:
        key = normalize_word(w)
        if key and key not in seen:
            seen.add(key)
            order.append(key)
    return order, seen


def is_cet4_row(flag):
    """六级字段缺失/空串/false/0 → 四级词；'★' 等其它真值 → 六级词。"""
    if flag is None:
        return True
    if flag is False:
        return True
    if isinstance(flag, str):
        return flag.strip() == ""
    if isinstance(flag, (int, float)):
        return flag == 0
    return False


def download_core(proxy):
    os.makedirs(TMP_DIR, exist_ok=True)
    if os.path.exists(CORE_JSON) and os.path.getsize(CORE_JSON) > 0:
        return True
    print("  下载 cet_full_list.json ...", flush=True)
    opener = request.build_opener()
    if proxy:
        opener = request.build_opener(
            request.ProxyHandler({"http": proxy, "https": proxy})
        )
    req = request.Request(RAW_URL, headers={"User-Agent": "cet4words-build"})
    with opener.open(req, timeout=180) as resp:
        data = resp.read()
    with open(CORE_JSON, "wb") as f:
        f.write(data)
    print("  已保存 cet_full_list.json (%d bytes)" % len(data), flush=True)
    return True


def build_from_frequency(cet4_set):
    """从词频表构建核心词单，返回 string[]；数据源不可用返回 None。"""
    if not (os.path.exists(CORE_JSON) and os.path.getsize(CORE_JSON) > 0):
        return None
    try:
        d = json.load(open(CORE_JSON, encoding="utf-8"))
    except Exception:
        return None

    lst = d.get("四六级词汇词频排序表")
    if not isinstance(lst, list) or not lst:
        return None

    result = []
    for row in lst:
        if not isinstance(row, dict):
            continue
        if not is_cet4_row(row.get("六级")):
            continue
        w = normalize_word(str(row.get("单词") or ""))
        if not w:
            continue
        if w not in cet4_set:
            continue
        if w not in result:
            result.append(w)
    # 词频表已按词频降序（序号升序），此处无需重排
    return result


def build_fallback(cet4_order, top):
    """回退：按 cet4.js 现有顺序取前 top 词。"""
    return cet4_order[:top]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=2000, help="核心词数量（默认 2000）")
    ap.add_argument("--proxy", default=DEFAULT_PROXY, help="下载代理，空串表示直连")
    ap.add_argument("--no-download", action="store_true", help="只用 tools/tmp 已缓存文件")
    ap.add_argument("--out", default=OUT_PATH, help="输出 cet4_core.js 路径")
    args = ap.parse_args()

    proxy = "" if args.proxy in ("", "none", "off", "direct") else args.proxy
    top = args.top
    if top < 1:
        top = 2000
    top = min(top, MAX_CORE)  # 核心词上限 2000，保证「核心 ≈ 高频」定位

    cet4_order, cet4_set = load_cet4_words()
    print("==> cet4.js 词数：%d" % len(cet4_order), flush=True)

    degraded = False
    core = None
    if not args.no_download:
        try:
            ok = download_core(proxy)
            if not ok:
                print("!! 词频源下载失败", file=sys.stderr)
        except Exception as e:
            print("!! 词频源下载异常：%s" % e, file=sys.stderr)

    core = build_from_frequency(cet4_set)
    if core is None:
        degraded = True
        print("!! 词频源不可用，降级为「按 cet4.js 现有顺序取前 %d 词」" % top, file=sys.stderr)
        core = build_fallback(cet4_order, top)
    else:
        print("==> 词频源 CETVocabulary：命中四级词 %d 个" % len(core), flush=True)

    core = core[:top]

    # 校验
    n = len(core)
    ok = True
    if n < MIN_CORE:
        print("!! 核心词数 %d < %d，偏少" % (n, MIN_CORE), file=sys.stderr)
        ok = False
    if n > MAX_CORE:
        print("!! 核心词数 %d > %d，超上限" % (n, MAX_CORE), file=sys.stderr)
        ok = False

    missing = [w for w in core if w not in cet4_set]
    if missing:
        print("!! 有 %d 个核心词无法在 cet4.js 命中（示例：%s）"
              % (len(missing), missing[:5]), file=sys.stderr)
        ok = False

    body = json.dumps(core, ensure_ascii=False, separators=(",", ":"))
    content = "window.CET4_CORE_WORDS=" + body + ";\n"
    out_dir = os.path.dirname(args.out)
    os.makedirs(out_dir, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(content)

    size = os.path.getsize(args.out)
    print("==> 完成 cet4_core.js：%d 词，%d bytes (%.2f KB)"
          % (n, size, size / 1024), flush=True)
    print("==> 词频源：%s" % ("降级(按 cet4.js 顺序)" if degraded else "CETVocabulary"), flush=True)

    if not ok:
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()
