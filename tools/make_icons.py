# -*- coding: utf-8 -*-
"""生成「四级背单词」启动图标：蓝底 + 白色 'Word' 文字（Pillow 版）。

- 各密度 mipmap PNG：蓝底圆角（圆形）+ 白色 "Word" 居中（API 24/25 兜底图标）
- drawable/ic_launcher_word.png：透明底 + 白色 "Word"（adaptive icon 前景，API 26+）
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT_ROOT = r"D:\AndroidProjects\CET4Words\app\src\main\res"
BLUE = (37, 99, 235)      # #2563EB 标准蓝
WHITE = (255, 255, 255)
TEXT = "Word"


def find_font():
    for p in [r"C:\Windows\Fonts\arialbd.ttf",   # Arial Bold
              r"C:\Windows\Fonts\segoeuib.ttf",  # Segoe UI Bold
              r"C:\Windows\Fonts\segoeui.ttf",
              r"C:\Windows\Fonts\arial.ttf"]:
        if os.path.exists(p):
            return p
    return None


def draw_word(draw, size, text, font_path, color, ratio=0.72):
    """把 text 居中绘制，宽度约占 size * ratio。"""
    def w_at(fs):
        f = ImageFont.truetype(font_path, fs)
        b = draw.textbbox((0, 0), text, font=f)
        return b[2] - b[0]

    lo, hi = 1, size * 2
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if w_at(mid) <= size * ratio:
            lo = mid
        else:
            hi = mid - 1
    font = ImageFont.truetype(font_path, lo)
    b = draw.textbbox((0, 0), text, font=font)
    tw, th = b[2] - b[0], b[3] - b[1]
    x = (size - tw) / 2 - b[0]
    y = (size - th) / 2 - b[1]
    draw.text((x, y), text, fill=color, font=font)


def make_launcher(size, round_icon=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if round_icon:
        d.ellipse([0, 0, size - 1, size - 1], fill=BLUE)
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.18), fill=BLUE)
    fp = find_font()
    if fp:
        draw_word(d, size, TEXT, fp, WHITE)
    else:
        d.text((size * 0.2, size * 0.38), TEXT, fill=WHITE)
    return img


def make_foreground(size=432):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fp = find_font()
    if fp:
        draw_word(d, size, TEXT, fp, WHITE, ratio=0.62)
    else:
        d.text((size * 0.25, size * 0.40), TEXT, fill=WHITE)
    return img


def main():
    sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for dpi, size in sizes.items():
        out = os.path.join(OUT_ROOT, "mipmap-" + dpi)
        os.makedirs(out, exist_ok=True)
        make_launcher(size, False).save(os.path.join(out, "ic_launcher.png"))
        make_launcher(size, True).save(os.path.join(out, "ic_launcher_round.png"))
        print("generated", dpi, size)
    fg_path = os.path.join(OUT_ROOT, "drawable", "ic_launcher_word.png")
    make_foreground(432).save(fg_path)
    print("generated foreground", fg_path)
    print("done")


if __name__ == "__main__":
    main()
