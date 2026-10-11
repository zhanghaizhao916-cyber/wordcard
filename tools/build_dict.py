#!/usr/bin/env python3
"""下载并清洗 CET4 / CET6 词库，生成内嵌数据文件 data/cet4.js 与 data/cet6.js。

数据源：GitHub kajweb/dict 仓库的 CET4_1/2/3、CET6_1/2/3 共六本词书
（每个 zip 里各含一个 JSON-Lines 文件，每行一个词条）。

流程：
  1. 下载指定词书 zip（优先用本机代理，若已缓存则跳过下载）
  2. 逐行解析、提取精简字段
  3. 按 word 去重（法语字母归一化 + 小写），重复词条保留更完整的那条
  4. 剔除「音标全空」或「释义为空」的脏数据
  5. 输出 window.CET4_WORDS / window.CET6_WORDS = [...]（无空白压缩）

纯标准库实现，无 pip 依赖。
用法：
  python tools/build_dict.py                      # 常规构建 CET4（默认，向后兼容）
  python tools/build_dict.py --book cet4          # 同上
  python tools/build_dict.py --book cet6          # 构建 CET6
  python tools/build_dict.py --book all           # 依次构建 CET4 + CET6
  python tools/build_dict.py --no-download        # 只使用 tools/tmp 下已缓存的 zip
  python tools/build_dict.py --proxy <url>        # 指定代理（默认 http://127.0.0.1:17891）
"""
import argparse
import json
import os
import re
import sys
import unicodedata
import zipfile
from urllib import request

# 六本词书在 kajweb/dict 仓库里的原始文件名（book 目录下）。
# inner 为 zip 内 JSON-Lines 文件名（若实际文件名不同会回退到 zip 内第一个 .json）。
BOOKS = {
    "cet4": [
        ("1521164649209_CET4_1.zip", "CET4_1.json"),
        ("1521164635506_CET4_2.zip", "CET4_2.json"),
        ("1521164643060_CET4_3.zip", "CET4_3.json"),
    ],
    "cet6": [
        ("1521164633851_CET6_3.zip", "CET6_3.json"),
        ("1521164668667_CET6_1.zip", "CET6_1.json"),
        ("1524052554766_CET6_2.zip", "CET6_2.json"),
    ],
}

# book -> (输出文件名, 全局变量名, 词数下限)
OUTPUTS = {
    "cet4": ("cet4.js", "CET4_WORDS", 3000),
    "cet6": ("cet6.js", "CET6_WORDS", 3000),
}

RAW_BASE = "https://raw.githubusercontent.com/kajweb/dict/master/book"
DEFAULT_PROXY = "http://127.0.0.1:17891"

HERE = os.path.dirname(os.path.abspath(__file__))
TMP_DIR = os.path.join(HERE, "tmp")
WWW_DATA = os.path.join(HERE, "..", "app", "src", "main", "assets", "www", "data")

_POS_RE = re.compile(r"^[a-zA-Z]+$")


def normalize_word(w):
    """法语字母归一化（é→e 等）+ 小写 + 去首尾空白。"""
    w = unicodedata.normalize("NFKD", w)
    w = "".join(ch for ch in w if not unicodedata.combining(ch))
    return w.strip().lower()


def download_book(zip_name, proxy):
    """下载单个词书 zip 到 tools/tmp，返回本地路径。"""
    os.makedirs(TMP_DIR, exist_ok=True)
    local = os.path.join(TMP_DIR, zip_name)
    if os.path.exists(local) and os.path.getsize(local) > 0:
        return local

    url = RAW_BASE + "/" + zip_name
    print("  下载 %s ..." % zip_name, flush=True)
    opener = request.build_opener()
    if proxy:
        opener = request.build_opener(
            request.ProxyHandler({"http": proxy, "https": proxy})
        )
    req = request.Request(url, headers={"User-Agent": "cet4words-build"})
    with opener.open(req, timeout=180) as resp:
        data = resp.read()
    with open(local, "wb") as f:
        f.write(data)
    print("  已保存 %s (%d bytes)" % (zip_name, len(data)), flush=True)
    return local


def pos_norm(pos):
    """把 'vt'/'v' 这类缺点的词性统一成 'vt.'/'v.'。"""
    pos = (pos or "").strip()
    if pos and _POS_RE.match(pos):
        pos = pos + "."
    return pos


def build_entry(obj):
    """从一条 kajweb/dict 词条里提取精简字段。"""
    head = (obj.get("headWord") or "").strip()
    c = obj.get("content", {}).get("word", {}).get("content", {}) or {}

    us = (c.get("usphone") or "").strip()
    uk = (c.get("ukphone") or "").strip()
    phone = (c.get("phone") or "").strip()
    if not us and phone:
        us = phone
    if not uk:
        uk = us or phone

    trans = []
    for t in c.get("trans") or []:
        cn = (t.get("tranCn") or "").strip()
        pos = pos_norm(t.get("pos"))
        if cn:
            trans.append({"pos": pos, "cn": cn})

    # 注：源数据的英文解释 tranOther 冗余且体积大，
    # 为把数据文件控制在 ~1.3MB 内，不输出 definition 字段。
    # 卡片背面 = 词性+中文释义 + 例句，已覆盖核心记忆信息。
    sentences = []
    sent_list = (c.get("sentence") or {}).get("sentences") or []
    if sent_list:
        s = sent_list[0]
        en = (s.get("sContent") or "").strip()
        cn = (s.get("sCn") or "").strip()
        if en:
            sentences.append({"en": en, "cn": cn})

    entry = {
        "word": head,
        "phonetic_us": us,
        "phonetic_uk": uk,
        "trans": trans,
        "sentences": sentences,
    }
    return entry


def completeness(e):
    score = 0
    if e.get("phonetic_us"):
        score += 1
    if e.get("phonetic_uk"):
        score += 1
    if e.get("definition"):
        score += 1
    if e.get("sentences"):
        score += 2
    return score


def resolve_inner_name(zf, inner_name):
    """返回 zip 内实际存在的 JSON-Lines 文件名（优先 inner_name，回退到第一个 .json）。"""
    names = zf.namelist()
    if inner_name in names:
        return inner_name
    for n in names:
        if n.lower().endswith(".json") and not n.lower().endswith(".zip"):
            return n
    return None


def parse_book(local, inner_name):
    """解析一个 zip，返回 (词条列表, 原始行数)。"""
    entries = []
    raw = 0
    with zipfile.ZipFile(local) as z:
        actual = resolve_inner_name(z, inner_name)
        if actual is None:
            print("  !! %s 内未找到 JSON-Lines 文件" % local, file=sys.stderr)
            return entries, 0
        data = z.read(actual).decode("utf-8", errors="replace")
    for line in data.splitlines():
        line = line.strip()
        if not line:
            continue
        raw += 1
        try:
            obj = json.loads(line)
        except Exception:
            continue
        word = (obj.get("headWord") or "").strip()
        if not word:
            continue
        entries.append(build_entry(obj))
    return entries, raw


def build_book(book_id, proxy, no_download, out_path):
    """构建单本词书数据文件，返回词数。"""
    out_name, var_name, min_words = OUTPUTS[book_id]
    out_path = out_path or os.path.join(WWW_DATA, out_name)

    print("==> 准备词书 %s" % book_id, flush=True)
    book_files = []
    for zip_name, inner_name in BOOKS[book_id]:
        local = os.path.join(TMP_DIR, zip_name)
        if no_download:
            if not (os.path.exists(local) and os.path.getsize(local) > 0):
                print("  缺少缓存文件 %s，跳过" % zip_name, flush=True)
                continue
        else:
            try:
                local = download_book(zip_name, proxy)
            except Exception as e:
                print("  下载失败 %s：%s" % (zip_name, e), flush=True)
                if os.path.exists(local) and os.path.getsize(local) > 0:
                    print("  改用本地缓存", flush=True)
                else:
                    continue
        book_files.append((local, inner_name))

    if not book_files:
        print("!! 没有可用词书，无法生成 %s" % out_name, file=sys.stderr)
        return 0

    print("==> 解析清洗", flush=True)
    seen = {}   # 归一化 word -> entry
    order = []  # 首次出现顺序（保持词书顺序 = 学习顺序）
    raw_total = 0
    dropped_dirty = 0
    merged_dup = 0

    for local, inner_name in book_files:
        entries, raw = parse_book(local, inner_name)
        raw_total += raw
        for e in entries:
            key = normalize_word(e["word"])
            if not key:
                dropped_dirty += 1
                continue
            # 剔除：音标全空 或 释义为空
            if not (e["phonetic_us"] or e["phonetic_uk"]):
                dropped_dirty += 1
                continue
            if not e["trans"]:
                dropped_dirty += 1
                continue

            e["word"] = key
            if key not in seen:
                seen[key] = e
                order.append(key)
            else:
                merged_dup += 1
                if completeness(e) > completeness(seen[key]):
                    seen[key] = e  # 原位替换，保留首次出现顺序

    words = [seen[k] for k in order]
    print("  原始词条：%d" % raw_total, flush=True)
    print("  去重合并：%d（重复词条数）" % merged_dup, flush=True)
    print("  剔除脏数据：%d" % dropped_dirty, flush=True)
    print("  最终词数：%d" % len(words), flush=True)

    if len(words) < min_words:
        print("!! %s 词数不足 %d（实际 %d），请检查数据源"
              % (book_id, min_words, len(words)), file=sys.stderr)
        return 0

    print("==> 写 %s" % os.path.abspath(out_path), flush=True)
    body = json.dumps(words, ensure_ascii=False, separators=(",", ":"))
    content = "window.%s=%s;\n" % (var_name, body)
    out_dir = os.path.dirname(out_path)
    os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)

    size = os.path.getsize(out_path)
    print("==> 完成 %s：%d 词，%d bytes (%.2f MB)"
          % (out_name, len(words), size, size / 1024 / 1024), flush=True)
    if size > 1_500_000:
        print("!! 警告：%s 超过 1.5MB，请检查体积控制" % out_name, file=sys.stderr)
    return len(words)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--proxy", default=DEFAULT_PROXY, help="下载代理，空串表示直连")
    ap.add_argument("--no-download", action="store_true", help="只用 tools/tmp 已缓存文件")
    ap.add_argument("--book", default="cet4", choices=["cet4", "cet6", "all"],
                    help="构建哪本词书（默认 cet4）")
    ap.add_argument("--out", default=None, help="覆盖输出文件路径（仅单书时有效）")
    args = ap.parse_args()

    proxy = "" if args.proxy in ("", "none", "off", "direct") else args.proxy

    books = ["cet4", "cet6"] if args.book == "all" else [args.book]
    if args.book == "all" and args.out:
        print("--book all 不支持 --out，请分别指定", file=sys.stderr)
        sys.exit(1)

    ok = True
    for bid in books:
        n = build_book(bid, proxy, args.no_download, args.out)
        if n <= 0:
            ok = False
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
