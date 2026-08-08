#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量上传素材到抖音云对象存储（火山引擎 TOS，S3 兼容协议）
官方文档「多端场景文件上传到对象存储的最佳实践」：个人开发者也可用 AK/SK 直传。

用法:
  TOS_AK=xxx TOS_SK=xxx TOS_BUCKET=xxx \
    /Users/renlinggao/.venv/tos-upload/bin/python scripts/upload_tos.py [清单文件]

参数:
  清单文件默认 /tmp/jxsg_assets_used.txt（每行一个相对项目根的路径，如 assets/hero/liubei.png）
  TOS_BUCKET = 抖音云环境 ID（桶名=环境ID），jxsg 为 tt6c721acff217307301-env-zx1ots0q58

特点: 8 线程并发 / 每文件失败重试 3 次 / 进度+汇总
"""
import concurrent.futures as cf
import mimetypes
import os
import sys
import time

import tos

ENDPOINT = 'tos-cn-beijing.volces.com'
REGION = 'cn-beijing'
ROOT = '/Users/renlinggao/miniprograms/jxsg'
DEFAULT_LIST = '/tmp/jxsg_assets_used.txt'
WORKERS = 8
RETRIES = 3


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    list_path = args[0] if args else DEFAULT_LIST
    ak = os.environ.get('TOS_AK')
    sk = os.environ.get('TOS_SK')
    bucket = os.environ.get('TOS_BUCKET')
    if not (ak and sk and bucket):
        print('缺少配置：export TOS_AK / TOS_SK / TOS_BUCKET（桶=环境ID）')
        sys.exit(1)
    if not os.path.isfile(list_path):
        print(f'清单不存在: {list_path}')
        sys.exit(1)

    files = [l.strip() for l in open(list_path, encoding='utf-8') if l.strip()]
    client = tos.TosClientV2(ak, sk, ENDPOINT, REGION)

    def upload_one(rel):
        fp = os.path.join(ROOT, rel)
        if not os.path.isfile(fp):
            return rel, 'SKIP missing'
        ctype = mimetypes.guess_type(fp)[0] or 'application/octet-stream'
        with open(fp, 'rb') as f:
            content = f.read()
        last_err = ''
        for attempt in range(RETRIES):
            try:
                client.put_object(bucket, rel, content=content, content_type=ctype,
                                  acl=tos.ACLType.ACL_Public_Read,
                                  cache_control='public, max-age=31536000, immutable')
                return rel, f'OK {len(content)}B'
            except Exception as e:
                last_err = str(e)[:120]
        return rel, f'FAIL {last_err}'

    ok = fail = 0
    t0 = time.time()
    with cf.ThreadPoolExecutor(WORKERS) as ex:
        for i, (rel, msg) in enumerate(ex.map(upload_one, files), 1):
            if msg.startswith(('OK', 'SKIP')):
                ok += 1
            else:
                fail += 1
            print(f'[{i}/{len(files)}] {msg}  {rel}', flush=True)
    print(f'\ndone: ok={ok} fail={fail} total={len(files)} elapsed={time.time() - t0:.1f}s')


if __name__ == '__main__':
    main()
