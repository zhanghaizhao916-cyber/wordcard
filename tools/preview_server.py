#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
四级背单词 App 前端预览服务（禁缓存版）
用法: python preview_server.py [端口] [目录]
默认: python preview_server.py 8899 D:/AndroidProjects/CET4Words/app/src/main/assets/www
启动后浏览器打开 http://127.0.0.1:<端口>/index.html
强制 no-cache，改完 CSS/JS 保存后刷新即可看到最新效果（无需清缓存）。
"""
import sys
import os
import functools
import http.server


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[preview] %s\n" % (fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'
    directory = os.path.abspath(directory)
    handler = functools.partial(NoCacheHandler, directory=directory)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    print('预览服务已启动: http://127.0.0.1:%d/index.html  (目录 %s, 禁缓存)' % (port, directory))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
