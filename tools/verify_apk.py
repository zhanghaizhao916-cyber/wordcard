#!/usr/bin/env python3
"""用 aapt2 dump badging 核对 APK 的包名 / versionCode / versionName。

用法：
  python tools/verify_apk.py <apk路径>
"""
import os
import re
import subprocess
import sys


def find_aapt2():
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if not sdk:
        sdk = r"D:\devtools\android-sdk"
    bt = os.path.join(sdk, "build-tools")
    candidates = []
    if os.path.isdir(bt):
        for name in sorted(os.listdir(bt), reverse=True):
            p = os.path.join(bt, name, "aapt2.exe")
            if os.path.exists(p):
                candidates.append(p)
    if not candidates:
        return None
    return candidates[0]


def main():
    if len(sys.argv) < 2:
        print("用法：python tools/verify_apk.py <apk路径>")
        sys.exit(1)
    apk = os.path.abspath(sys.argv[1])
    if not os.path.exists(apk):
        print("找不到 APK：%s" % apk, file=sys.stderr)
        sys.exit(2)

    aapt2 = find_aapt2()
    if not aapt2:
        print("找不到 aapt2，请确认 ANDROID_HOME 指向 Android SDK", file=sys.stderr)
        sys.exit(3)

    out = subprocess.run(
        [aapt2, "dump", "badging", apk],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    text = out.stdout + out.stderr

    pkg = re.search(r"package: name='([^']+)'", text)
    vc = re.search(r"versionCode='(\d+)'", text)
    vn = re.search(r"versionName='([^']+)'", text)
    label = re.search(r"application-label:'([^']+)'", text)

    print("APK: %s" % apk)
    print("package     : %s" % (pkg.group(1) if pkg else "?"))
    print("versionCode : %s" % (vc.group(1) if vc else "?"))
    print("versionName : %s" % (vn.group(1) if vn else "?"))
    print("label       : %s" % (label.group(1) if label else "?"))

    ok = True
    if not pkg or pkg.group(1) != "com.zhang.cet4words":
        print("!! 包名不符，期望 com.zhang.cet4words")
        ok = False
    if not vc or vc.group(1) != "10200":
        print("!! versionCode 不符，期望 10200")
        ok = False
    if not vn or vn.group(1) != "1.2.0":
        print("!! versionName 不符，期望 1.2.0")
        ok = False

    print("RESULT: %s" % ("PASS" if ok else "FAIL"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
