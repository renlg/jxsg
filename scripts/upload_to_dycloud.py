#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
上传素材到抖音云对象存储（经 upload-asset 云函数中转，个人开发者无 AK/SK 的方案）

用法:
  python3 scripts/upload_to_dycloud.py --probe          # 探测云函数环境（凭证/桶信息）
  python3 scripts/upload_to_dycloud.py [清单文件]       # 批量上传，默认 /tmp/jxsg_assets_used.txt

环境变量:
  DYCLOUD_UPLOAD_URL  云函数 HTTP 地址（部署绑定后设置）
"""
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.request

URL = os.environ.get('DYCLOUD_UPLOAD_URL', '')
ROOT = '/Users/renlinggao/miniprograms/jxsg'
DEFAULT_LIST = '/tmp/jxsg_assets_used.txt'


def post(payload):
    body = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode('utf-8'))


def probe():
    res = post({})
    print(json.dumps(res, ensure_ascii=False, indent=1)[:3000])


def upload(list_path):
    files = [l.strip() for l in open(list_path, encoding='utf-8') if l.strip()]
    ok = fail = 0
    t0 = time.time()
    for i, rel in enumerate(files, 1):
        fp = os.path.join(ROOT, rel)
        if not os.path.isfile(fp):
            print(f'[{i}/{len(files)}] SKIP missing: {rel}')
            continue
        with open(fp, 'rb') as f:
            data = base64.b64encode(f.read()).decode('ascii')
        ctype = mimetypes.guess_type(fp)[0] or 'application/octet-stream'
        try:
            res = post({'path': rel, 'data': data, 'contentType': ctype})
            if res.get('code') == 0:
                ok += 1
                print(f'[{i}/{len(files)}] OK  {rel} ({res.get("data", {}).get("bytes", "?")}B)')
            else:
                fail += 1
                print(f'[{i}/{len(files)}] FAIL {rel} :: {str(res.get("message"))[:200]}')
        except Exception as e:
            fail += 1
            print(f'[{i}/{len(files)}] ERR  {rel} :: {str(e)[:200]}')
        time.sleep(0.05)
    print(f'\ndone: ok={ok} fail={fail} total={len(files)} elapsed={time.time() - t0:.1f}s')


if __name__ == '__main__':
    if not URL:
        print('先部署 upload-asset 云函数并绑定 HTTP 触发，然后: export DYCLOUD_UPLOAD_URL=<云函数地址>')
        sys.exit(1)
    if len(sys.argv) > 1 and sys.argv[1] == '--probe':
        probe()
    else:
        upload(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_LIST)
