#!/usr/bin/env python3
"""Configure FlowSeat DNS using a narrowly scoped Cloudflare API token.

No external dependencies. Token is entered without echo and stored outside Git.
Default mode is read-only; --apply adds missing expected records only.
"""
import argparse
import getpass
import json
import os
from pathlib import Path
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request

DOMAIN = 'siabuilt.com'
ACCOUNT = 'fbf20d660397a192c21f387fd02bd7d8'
TOKEN_FILE = Path.home() / '.config/flowseat/cloudflare-token'
EXPECTED = [
    {'type': 'A', 'name': DOMAIN, 'content': '162.159.143.30', 'ttl': 1, 'proxied': False},
    {'type': 'A', 'name': DOMAIN, 'content': '172.66.3.26', 'ttl': 1, 'proxied': False},
    {'type': 'TXT', 'name': '_openai-site-verification.' + DOMAIN,
     'content': 'openai-site-verification=gesNjIOzRcJ-L7zoC8VKXYqGwvS8KgHEiG1dVpR7jVU', 'ttl': 1},
    {'type': 'TXT', 'name': '_cf-custom-hostname.' + DOMAIN,
     'content': 'a90d8825-a345-4a5e-b4bd-54c9aaa095f4', 'ttl': 1},
]


def api(token, path, data=None):
    request = urllib.request.Request(
        'https://api.cloudflare.com/client/v4/' + path,
        data=None if data is None else json.dumps(data).encode(),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        method='GET' if data is None else 'POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            body = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('Cloudflare 拒绝请求（HTTP %s），请核对令牌权限和有效期。' % error.code) from None
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise RuntimeError('无法安全连接或读取 Cloudflare API；没有关闭证书验证。') from None
    if not body.get('success'):
        raise RuntimeError('Cloudflare API 未确认成功；已停止操作。')
    return body


def zone_id(token):
    query = urllib.parse.urlencode({'name': DOMAIN, 'account.id': ACCOUNT})
    zones = api(token, 'zones?' + query)['result']
    matches = [z for z in zones if z.get('name') == DOMAIN and z.get('account', {}).get('id') == ACCOUNT]
    if len(matches) != 1 or matches[0].get('status') != 'active':
        raise RuntimeError('未找到指定账号下唯一且 active 的 siabuilt.com；请核对 Zone Read 权限及资源范围。')
    return matches[0]['id']


def records(token, zone):
    result = []
    page = 1
    while True:
        body = api(token, 'zones/%s/dns_records?per_page=100&page=%s' % (zone, page))
        result.extend(body['result'])
        if page >= body.get('result_info', {}).get('total_pages', 1):
            return result
        page += 1
        if page > 100:
            raise RuntimeError('记录数量超出本脚本检查范围，停止写入。')


def missing_records(current):
    missing = []
    for wanted in EXPECTED:
        same_name = [r for r in current if r.get('name', '').rstrip('.').lower() == wanted['name']]
        if wanted['type'] == 'A':
            allowed = {r['content'] for r in EXPECTED if r['type'] == 'A'}
            if any(r.get('type') in ('AAAA', 'CNAME') or
                   (r.get('type') == 'A' and (r.get('content') not in allowed or r.get('proxied') is not False))
                   for r in same_name):
                raise RuntimeError('根域存在其他指向或代理状态冲突；不会覆盖已有记录。')
        elif any(r.get('type') != 'TXT' or r.get('content') != wanted['content'] for r in same_name):
            raise RuntimeError('验证记录存在冲突；不会覆盖已有记录：' + wanted['name'])
        if not any(r.get('type') == wanted['type'] and r.get('content') == wanted['content'] for r in same_name):
            missing.append(wanted)
    return missing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--configure', action='store_true', help='安全输入并保存域名限定令牌')
    parser.add_argument('--apply', action='store_true', help='添加缺失记录；不更新或删除已有记录')
    parser.add_argument('--prompt-token', action='store_true', help='隐藏输入一次性令牌，仅在内存中使用')
    args = parser.parse_args()
    if args.configure and args.apply:
        parser.error('先单独配置，再执行 --apply')
    if args.configure and args.prompt_token:
        parser.error('--configure 与 --prompt-token 不能同时使用')
    if args.configure:
        token = getpass.getpass('粘贴 Cloudflare API Token（不显示输入）：').strip()
        if not token or any(c.isspace() for c in token):
            raise RuntimeError('令牌为空或包含空白字符。')
        zone_id(token)
        TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        if TOKEN_FILE.is_symlink():
            raise RuntimeError('令牌路径是符号链接，拒绝写入。')
        fd = os.open(TOKEN_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'w') as target:
            os.fchmod(target.fileno(), 0o600)
            target.write(token)
        print('已验证域名读取权限，令牌已保存到本机私有配置目录；未修改 DNS。请回复助手“已配置”。')
        return
    if args.prompt_token:
        token = getpass.getpass('输入一次性 API Token（隐藏输入，不保存）：').strip()
        if not token or any(c.isspace() for c in token):
            raise RuntimeError('令牌为空或包含空白字符。')
    else:
        if not TOKEN_FILE.exists() or TOKEN_FILE.is_symlink():
            raise RuntimeError('请先使用 --configure 配置令牌。')
        if stat.S_IMODE(TOKEN_FILE.stat().st_mode) & 0o077:
            raise RuntimeError('令牌文件权限过宽，请设为 600 后继续。')
        token = TOKEN_FILE.read_text().strip()
    zone = zone_id(token)
    pending = missing_records(records(token, zone))
    print('已核对指定域名；需新增 %s 条记录。' % len(pending))
    for record in pending:
        print('%s %s → %s' % (record['type'], record['name'], record['content']))
    if not args.apply:
        print('只读检查完成，未写入 DNS。')
        return
    for record in pending:
        api(token, 'zones/%s/dns_records' % zone, record)
        print('已新增：%s %s' % (record['type'], record['name']))
    if missing_records(records(token, zone)):
        raise RuntimeError('写入后的回读尚未确认全部记录，请重新检查。')
    print('四条记录已全部回读核验。未改动其他子域；公网解析和证书仍需后续验证。')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError) as error:
        print('停止：' + str(error), file=sys.stderr)
        sys.exit(1)
    except (KeyboardInterrupt, EOFError):
        print('\n已取消。', file=sys.stderr)
        sys.exit(1)
