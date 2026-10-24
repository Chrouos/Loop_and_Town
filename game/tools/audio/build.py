#!/usr/bin/env python3
"""Build the game's recorded audio: process sources (dl/<id>.wav) per spec_*.py, encode AAC into
game/public/audio, then regenerate the samples.ts manifest block and CREDITS.md.

  build.py [id ...]      build only these ids (default: all), then regenerate manifest/credits
"""
import json, os, re, subprocess, sys
import numpy as np
import ana, proc

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.abspath(os.path.join(HERE, '..', '..'))
PUB = os.path.join(GAME, 'public', 'audio')
WORK = os.path.join(HERE, 'out')
REPORT = os.path.join(HERE, 'report.json')
os.makedirs(WORK, exist_ok=True)
os.makedirs(os.path.join(PUB, 'sfx'), exist_ok=True)
os.makedirs(os.path.join(PUB, 'amb'), exist_ok=True)
SR = 44100
LOOP_PAD = 0.25

SFX = {}
AMB = {}


def sfx(id, variants, sources, gain=1.0, st=-20.0, peak=-3.0, note='', rate=None, jitter=None, wet=None, move=None, hp=None, fin=0.002, fout=0.03, trim_db=None, limit=None):
    """variants: list of callables returning a (1, n) float array."""
    SFX[id] = dict(variants=variants, sources=sources, gain=gain, st=st, peak=peak, note=note, rate=rate, jitter=jitter, wet=wet, move=move, hp=hp, fin=fin, fout=fout, trim_db=trim_db, limit=limit)


def amb(id, make, sources, rms=-34.0, note='', gain=1.0, extras=False, bitrate=96000, peak=-3.0, crest=None):
    """make: callable returning a seamless stereo loop body (2, n)."""
    AMB[id] = dict(make=make, sources=sources, rms=rms, note=note, gain=gain, extras=extras, bitrate=bitrate, peak=peak, crest=crest)


def encode(wav, m4a, bitrate):
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', str(bitrate), wav, m4a], check=True)


def measure_m4a(m4a):
    tmp = os.path.join(WORK, '_check.wav')
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', m4a, tmp], check=True)
    x, sr = ana.read(tmp)
    os.remove(tmp)
    return dict(dur=round(x.shape[1] / SR, 3), rms=round(ana.db(ana.rms(x)), 1), peak=round(ana.db(np.abs(x).max()), 1), st50=round(ana.db(ana.short_term_max(x, SR)), 1))


def build_sfx(id, s):
    files = []
    stats = []
    for i, v in enumerate(s['variants']):
        x = v().astype(np.float32)
        x = proc.channel(x, 'mono')
        if s['trim_db'] is not None:
            x = proc.trim(x, s['trim_db'])
        x = proc.dc(x)
        if s['hp']:
            x = proc.highpass(x, s['hp'])
        if s.get('limit'):
            # soften single spikes so the body of the sound reaches its loudness target
            c = ana.short_term_max(x, SR) * 10 ** (s['limit'] / 20)
            x = (np.tanh(x / c) * c).astype(np.float32)
        x = proc.fade(x, s['fin'], s['fout'])
        x = proc.norm_st(x, s['st'], s['peak'])
        name = '%s_%d' % (id, i + 1) if len(s['variants']) > 1 else id
        wav = os.path.join(WORK, name + '.wav')
        ana.write(wav, x)
        m4a = os.path.join(PUB, 'sfx', name + '.m4a')
        encode(wav, m4a, 96000)
        m = measure_m4a(m4a)
        m['bytes'] = os.path.getsize(m4a)
        m['file'] = 'sfx/%s.m4a' % name
        stats.append(m)
        files.append('sfx/%s.m4a' % name)
    return files, stats


def build_amb(id, a):
    body = a['make']().astype(np.float32)
    body = proc.channel(body, 'stereo')
    body = proc.dc(body)
    if a['crest']:
        # tame transients to at most `crest` dB over the bed's RMS (soft knee)
        c = ana.rms(body) * 10 ** (a['crest'] / 20)
        body = (np.tanh(body / c) * c).astype(np.float32)
    body = proc.norm_rms(body, a['rms'], a['peak'])
    L = body.shape[1] / SR
    x = proc.pad_loop(body, LOOP_PAD)
    wav = os.path.join(WORK, id + '.wav')
    ana.write(wav, x)
    m4a = os.path.join(PUB, 'amb', id + '.m4a')
    encode(wav, m4a, a['bitrate'])
    m = measure_m4a(m4a)
    m['bytes'] = os.path.getsize(m4a)
    m['file'] = 'amb/%s.m4a' % id
    m['loopStart'] = LOOP_PAD
    m['loopEnd'] = round(LOOP_PAD + L, 4)
    return m


def load_report():
    if os.path.exists(REPORT):
        return json.load(open(REPORT))
    return reindex()


def reindex():
    """Rebuild the report (it is not in git) from the manifest in samples.ts and the files on disk,
    so building a few ids never loses the others."""
    src = open(os.path.join(GAME, 'src', 'audio', 'samples.ts')).read()
    block = re.search(r'// <generated manifest>\n(.*?)// </generated manifest>', src, re.S).group(1)
    sfx_part, amb_part = block.split('AMBIENCE_SAMPLES')
    rep = {'sfx': {}, 'amb': {}}
    for id, files in re.findall(r"^  ([a-z0-9_]+): \{ files: \[([^\]]*)\]", sfx_part, re.M):
        stats = []
        for f in re.findall(r"'([^']+)'", files):
            m = measure_m4a(os.path.join(PUB, f))
            m['bytes'] = os.path.getsize(os.path.join(PUB, f))
            m['file'] = f
            stats.append(m)
        rep['sfx'][id] = {'files': [m['file'] for m in stats], 'stats': stats}
    for id, f, a, b in re.findall(r"^  ([a-z0-9_]+): \{ files: \['([^']+)'\].*?loopStart: ([0-9.]+), loopEnd: ([0-9.]+)", amb_part, re.M):
        m = measure_m4a(os.path.join(PUB, f))
        m.update(bytes=os.path.getsize(os.path.join(PUB, f)), file=f, loopStart=float(a), loopEnd=float(b))
        rep['amb'][id] = m
    print('report.json was missing: reindexed %d sfx ids and %d beds from samples.ts' % (len(rep['sfx']), len(rep['amb'])))
    return rep


def ts_num(v):
    s = ('%.3f' % v).rstrip('0').rstrip('.')
    return s if s else '0'


def write_manifest(rep):
    lines = ['export const SFX_SAMPLES: Partial<Record<SfxId, SfxSample>> = {']
    for id in sorted(rep['sfx']):
        if id not in SFX:
            continue
        s = SFX[id]
        r = rep['sfx'][id]
        parts = ['files: [%s]' % ', '.join("'%s'" % f for f in r['files']), 'gain: %s' % ts_num(s['gain'])]
        if s['rate']:
            parts.append('rate: %s' % ts_num(s['rate']))
        if s['jitter'] is not None:
            parts.append('jitter: %s' % ts_num(s['jitter']))
        if s['wet']:
            parts.append('wet: %s' % ts_num(s['wet']))
        if s['move']:
            parts.append('move: [%s]' % ', '.join(ts_num(v) for v in s['move']))
        lines.append('  %s: { %s },' % (id, ', '.join(parts)))
    lines.append('};')
    lines.append('')
    lines.append('export const AMBIENCE_SAMPLES: Partial<Record<AmbienceId, AmbienceSample>> = {')
    for id in sorted(rep['amb']):
        if id not in AMB:
            continue
        a = AMB[id]
        r = rep['amb'][id]
        parts = ["files: ['%s']" % r['file'], 'gain: %s' % ts_num(a['gain']), 'loop: true', 'loopStart: %s' % ts_num(r['loopStart']), 'loopEnd: %s' % ts_num(r['loopEnd'])]
        if a['extras']:
            parts.append('extras: true')
        lines.append('  %s: { %s },' % (id, ', '.join(parts)))
    lines.append('};')
    p = os.path.join(GAME, 'src', 'audio', 'samples.ts')
    src = open(p).read()
    new = re.sub(r'// <generated manifest>\n.*?// </generated manifest>', '// <generated manifest>\n' + '\n'.join(lines) + '\n// </generated manifest>', src, flags=re.S)
    open(p, 'w').write(new)


def license_of(m):
    """'CC0', or the attribution license recorded by hand in meta.json (`page_lic`) after reading the page."""
    lic = 'CC0' if m.get('page_cc0') else m.get('page_lic')
    assert lic, 'license not verified for %s' % m.get('id')
    return lic


def credit_line(sid, meta):
    m = meta[str(sid)]
    license_of(m)
    return '%s by %s, %s' % (m['title'], m['user'], m['url'])


def write_credits(rep):
    meta = json.load(open(os.path.join(HERE, 'meta.json')))
    out = ['# Audio credits', '',
           'Every recording here is from [Freesound](https://freesound.org). Most are **CC0 1.0 (public domain dedication)**,',
           'which does not require credit (it is given anyway). Lines marked **CC BY** are Creative Commons Attribution:',
           'they may be used commercially, but the credit on that line must ship with the game.',
           'Sources are HQ previews unless a line says it was made from the original file.',
           'All files were trimmed / faded / level-normalized and re-encoded to AAC (.m4a); ambience beds were turned',
           'into seamless loops with a baked crossfade. Further processing is noted per line.', '',
           'Format: `file` — id — "title" by author — source URL — license — processing.', '', '## One-shots (`sfx/`)', '']
    for id in sorted(rep['sfx']):
        if id not in SFX:
            continue
        s = SFX[id]
        r = rep['sfx'][id]
        srcs = '; '.join('"%s" by %s — %s' % (meta[str(x)]['title'], meta[str(x)]['user'], meta[str(x)]['url']) for x in s['sources'])
        lic = ' + '.join(sorted({license_of(meta[str(x)]) for x in s['sources']}))
        n = len(r['files'])
        for i, (f, st) in enumerate(zip(r['files'], r['stats'])):
            var = ('variant %d of %d: ' % (i + 1, n)) if n > 1 else ''
            out.append('- `%s` — %s — %s — %s — %s%s (%.2f s; RMS %.1f dBFS, peak %.1f dBFS, loudest 50 ms %.1f dBFS)' % (f, id, srcs, lic, var, s['note'] or 'trimmed, faded, normalized', st['dur'], st['rms'], st['peak'], st['st50']))
    out += ['', '## Ambience beds (`amb/`)', '']
    for id in sorted(rep['amb']):
        if id not in AMB:
            continue
        a = AMB[id]
        r = rep['amb'][id]
        srcs = '; '.join('"%s" by %s — %s' % (meta[str(x)]['title'], meta[str(x)]['user'], meta[str(x)]['url']) for x in a['sources'])
        lic = ' + '.join(sorted({license_of(meta[str(x)]) for x in a['sources']}))
        out.append('- `%s` — %s — %s — %s — %s (loop %.1f s, RMS %.1f dBFS, peak %.1f dBFS)' % (r['file'], id, srcs, lic, a['note'] or 'seamless loop', r['loopEnd'] - r['loopStart'], r['rms'], r['peak']))
    for s in list(SFX.values()) + list(AMB.values()):
        for x in s['sources']:
            license_of(meta[str(x)])
    open(os.path.join(PUB, 'CREDITS.md'), 'w').write('\n'.join(out) + '\n')


def main():
    import spec  # noqa: F401  (registers SFX / AMB)
    only = set(sys.argv[1:])
    rep = load_report()
    for id, s in SFX.items():
        if only and id not in only:
            continue
        files, stats = build_sfx(id, s)
        rep['sfx'][id] = {'files': files, 'stats': stats}
        print('sfx %-18s %s' % (id, ' | '.join('%.2fs rms %.1f pk %.1f st %.1f %dB' % (m['dur'], m['rms'], m['peak'], m['st50'], m['bytes']) for m in stats)))
    for id, a in AMB.items():
        if only and id not in only:
            continue
        m = build_amb(id, a)
        rep['amb'][id] = m
        print('amb %-18s %.1fs loop  rms %.1f pk %.1f  %dkB' % (id, m['loopEnd'] - m['loopStart'], m['rms'], m['peak'], m['bytes'] // 1024))
    # drop entries no longer in the spec, and the files only they used
    dropped = set()
    for kind, table in (('sfx', SFX), ('amb', AMB)):
        for id in list(rep[kind]):
            if id not in table:
                r = rep[kind].pop(id)
                dropped.update(r['files'] if kind == 'sfx' else [r['file']])
    keep = set()
    for r in rep['sfx'].values():
        keep.update(r['files'])
    for r in rep['amb'].values():
        keep.add(r['file'])
    for f in sorted(dropped - keep):
        if os.path.exists(os.path.join(PUB, f)):
            os.remove(os.path.join(PUB, f))
            print('removed', f)
    # anything else unreferenced is only reported: a missing report must never delete files
    for kind in ('sfx', 'amb'):
        for f in sorted(os.listdir(os.path.join(PUB, kind))):
            if '%s/%s' % (kind, f) not in keep:
                print('warning: %s/%s is not in the manifest (left in place)' % (kind, f))
    json.dump(rep, open(REPORT, 'w'), indent=1)
    write_manifest(rep)
    write_credits(rep)
    total = sum(os.path.getsize(os.path.join(PUB, k, f)) for k in ('sfx', 'amb') for f in os.listdir(os.path.join(PUB, k)))
    print('total %.2f MB (%d sfx ids, %d beds)' % (total / 1e6, len(rep['sfx']), len(rep['amb'])))


if __name__ == '__main__':
    import build  # run inside the module that spec.py registers into
    build.main()
