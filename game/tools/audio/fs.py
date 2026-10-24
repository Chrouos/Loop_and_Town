#!/usr/bin/env python3
"""Freesound helper: throttled search (CC0 only), sound-page license check, HQ preview download.

  fs.py search "query" [--dur 0-10] [--sort dl|rating|rel] [--n 15]
  fs.py page <id>               (verify CC0, print tags/description)
  fs.py get <id> [<id> ...]     (download HQ preview -> dl/<id>.mp3 and dl/<id>.wav)
"""
import html, json, os, re, subprocess, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
DL = os.path.join(HERE, 'dl')
META = os.path.join(HERE, 'meta.json')
STAMP = os.path.join(HERE, '.last_request')
os.makedirs(CACHE, exist_ok=True)
os.makedirs(DL, exist_ok=True)
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'


def load_meta():
    if os.path.exists(META):
        with open(META) as f:
            return json.load(f)
    return {}


def save_meta(m):
    with open(META, 'w') as f:
        json.dump(m, f, indent=1, ensure_ascii=False)


def throttle():
    try:
        last = float(open(STAMP).read())
    except Exception:
        last = 0
    wait = 1.25 - (time.time() - last)
    if wait > 0:
        time.sleep(wait)
    open(STAMP, 'w').write(str(time.time()))


def fetch(url, binary=False):
    throttle()
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else data.decode('utf-8', 'replace')


def cached_fetch(url, key):
    path = os.path.join(CACHE, re.sub(r'[^A-Za-z0-9_.-]', '_', key)[:180] + '.html')
    if os.path.exists(path):
        return open(path, encoding='utf-8').read()
    s = fetch(url)
    open(path, 'w', encoding='utf-8').write(s)
    return s


def attr(block, name):
    m = re.search(r'data-%s="([^"]*)"' % name, block)
    return html.unescape(m.group(1)) if m else ''


def parse_results(s):
    out = []
    blocks = s.split('<div class="bw-search__result"')[1:]
    for b in blocks:
        sid = attr(b, 'sound-id')
        if not sid:
            continue
        r = {
            'id': int(sid),
            'user': attr(b, 'username'),
            'uid': int(attr(b, 'user-id') or 0),
            'title': attr(b, 'title'),
            'dur': float(attr(b, 'duration') or 0),
            'sr': attr(b, 'samplerate'),
            'dl': int(attr(b, 'num-downloads') or 0),
        }
        m = re.search(r'aria-label="Average rating of ([0-9.]+)"', b)
        r['rating'] = float(m.group(1)) if m else 0.0
        m = re.search(r'bw-rating__count[^>]*>\((\d+)\)', b)
        r['nrat'] = int(m.group(1)) if m else 0
        m = re.search(r'title="License: ([^"]+)"', b)
        r['lic'] = m.group(1) if m else '?'
        m = re.search(r'overflow-hidden v-spacing-1" title="(.*?)">', b, re.S)
        r['desc'] = html.unescape(m.group(1)).replace('\n', ' ')[:300] if m else ''
        r['tags'] = re.findall(r'href="/browse/tags/([^/]+)/"', b)
        m = re.search(r'title="Geotag: ([^"]+)"', b)
        r['geo'] = html.unescape(m.group(1)) if m else ''
        m = re.search(r'title="Pack: ([^"]+)"', b)
        r['pack'] = html.unescape(m.group(1)) if m else ''
        out.append(r)
    return out


SORTS = {'dl': 'Downloads (most first)', 'rating': 'Rating (highest first)', 'rel': 'Automatic by relevance', 'long': 'Duration (longest first)'}


def search(q, dur=None, sort='rel', n=15, page=1):
    f = 'license:"Creative Commons 0"'
    if dur:
        lo, hi = dur.split('-')
        f += ' duration:[%s TO %s]' % (lo, hi)
    params = {'q': q, 'f': f, 's': SORTS[sort]}
    if page > 1:
        params['page'] = str(page)
    url = 'https://freesound.org/search/?' + urllib.parse.urlencode(params)
    s = cached_fetch(url, 'search_%s_%s_%s_%s' % (q, dur, sort, page))
    res = parse_results(s)
    meta = load_meta()
    for r in res:
        meta.setdefault(str(r['id']), {}).update(r)
    save_meta(meta)
    for r in res[:n]:
        print('%7d %-18s %6.1fs dl=%-6d %.1f(%d) %s | %s' % (r['id'], r['user'][:18], r['dur'], r['dl'], r['rating'], r['nrat'], 'CC0' if 'Commons 0' in r['lic'] else r['lic'], r['title'][:70]))
        print('        tags: %s' % ' '.join(r['tags'][:14]))
        if r['desc']:
            print('        desc: %s' % r['desc'][:150])
        if r['geo']:
            print('        geo: %s' % r['geo'][:60])


def page(sid):
    meta = load_meta()
    m = meta.get(str(sid))
    if not m:
        print('unknown id (search first)', sid)
        return
    url = 'https://freesound.org/people/%s/sounds/%s/' % (urllib.parse.quote(m['user']), sid)
    s = cached_fetch(url, 'page_%s' % sid)
    lic = re.findall(r'(creativecommons\.org/[a-z/]*[0-9.]+/?|Creative Commons 0|Attribution[ A-Za-z]*\b)', s)
    cc0 = 'creativecommons.org/publicdomain/zero/1.0' in s
    other = [l for l in set(lic) if 'licenses/by' in l]
    m['page_cc0'] = bool(cc0 and not other)
    m['url'] = url
    tags = re.findall(r'href="/browse/tags/([^/]+)/"', s)
    dm = re.search(r'<div id="soundDescriptionSection"[^>]*>(.*?)</div>', s, re.S) or re.search(r'class="sound-description[^"]*"[^>]*>(.*?)</div>', s, re.S)
    desc = re.sub('<[^>]+>', ' ', dm.group(1)) if dm else ''
    m['page_desc'] = ' '.join(html.unescape(desc).split())[:800]
    m['page_tags'] = tags
    meta[str(sid)] = m
    save_meta(meta)
    print('%s  CC0=%s other=%s' % (url, m['page_cc0'], other))
    print('  tags:', ' '.join(tags))
    print('  desc:', m['page_desc'][:600])


def get(sid):
    meta = load_meta()
    m = meta.get(str(sid))
    if not m:
        print('unknown id', sid)
        return
    mp3 = os.path.join(DL, '%s.mp3' % sid)
    wav = os.path.join(DL, '%s.wav' % sid)
    if not os.path.exists(mp3):
        url = 'https://cdn.freesound.org/previews/%d/%s_%s-hq.mp3' % (int(sid) // 1000, sid, m['uid'])
        throttle()
        tmp = mp3 + '.part'
        r = subprocess.run(['curl', '-s', '-f', '-L', '-A', UA, '--retry', '3', '--speed-limit', '2000', '--speed-time', '30', '-o', tmp, url])
        if r.returncode != 0:
            print('FAILED', sid, r.returncode)
            return
        os.rename(tmp, mp3)
    if not os.path.exists(wav):
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', mp3, wav], check=True)
    print('ok', sid, os.path.getsize(mp3), m['title'][:60])


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'search':
        args = sys.argv[2:]
        q = args[0]
        dur = None
        sort = 'rel'
        n = 15
        pg = 1
        i = 1
        while i < len(args):
            if args[i] == '--dur':
                dur = args[i + 1]; i += 2
            elif args[i] == '--sort':
                sort = args[i + 1]; i += 2
            elif args[i] == '--n':
                n = int(args[i + 1]); i += 2
            elif args[i] == '--page':
                pg = int(args[i + 1]); i += 2
            else:
                i += 1
        search(q, dur, sort, n, pg)
    elif cmd == 'page':
        for sid in sys.argv[2:]:
            page(sid)
    elif cmd == 'get':
        for sid in sys.argv[2:]:
            get(sid)
