#!/usr/bin/env python3
"""Offline audio analysis / processing (numpy only).

  ana.py info a.wav [--win 0.25] [--from s] [--to s]   envelope, onsets, spectrum bands
  ana.py onsets a.wav [--thr 12]                       list of onset times with peak/decay
"""
import sys, wave
import numpy as np

SR = 44100
BAND = None


def _read_riff(path):
    import struct
    data = open(path, 'rb').read()
    assert data[:4] == b'RIFF' and data[8:12] == b'WAVE'
    i = 12
    ch = sr = bits = None
    pcm = None
    while i + 8 <= len(data):
        cid = data[i:i + 4]
        n = struct.unpack('<I', data[i + 4:i + 8])[0]
        body = data[i + 8:i + 8 + n]
        if cid == b'fmt ':
            _, ch, sr, _, _, bits = struct.unpack('<HHIIHH', body[:16])
        elif cid == b'data':
            pcm = body
        i += 8 + n + (n & 1)
    assert bits == 16
    x = np.frombuffer(pcm[: len(pcm) // (2 * ch) * 2 * ch], dtype='<i2').astype(np.float32) / 32768.0
    return x.reshape(-1, ch).T.copy(), sr


def read(path):
    try:
        w = wave.open(path, 'rb')
    except wave.Error:
        return _read_riff(path)
    ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
    raw = w.readframes(n)
    w.close()
    assert sw == 2
    x = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
    x = x.reshape(-1, ch).T.copy()
    return x, sr


def write(path, x, sr=SR):
    x = np.atleast_2d(x)
    y = np.clip(x.T, -1, 1)
    y = (y * 32767.0).round().astype('<i2')
    w = wave.open(path, 'wb')
    w.setnchannels(x.shape[0])
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes(y.tobytes())
    w.close()


def db(v):
    return 20 * np.log10(max(float(v), 1e-9))


def mono(x):
    return x.mean(axis=0)


def rms(x):
    return float(np.sqrt(np.mean(np.square(x)))) if x.size else 0.0


def short_term_max(x, sr, win=0.05):
    m = mono(x) if x.ndim > 1 else x
    n = int(win * sr)
    if len(m) < n:
        return rms(m)
    c = np.cumsum(np.concatenate([[0], m.astype(np.float64) ** 2]))
    e = (c[n:] - c[:-n]) / n
    return float(np.sqrt(e.max()))


def env(m, sr, win):
    n = max(1, int(win * sr))
    k = len(m) // n
    if k == 0:
        return np.array([rms(m)])
    return np.sqrt(np.mean(np.square(m[: k * n].reshape(k, n)), axis=1))


def bands(m, sr):
    if len(m) < 1024:
        return {}
    seg = m[: min(len(m), sr * 30)]
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / sr)
    tot = spec.sum() + 1e-20
    out = {}
    for lo, hi in [(0, 80), (80, 250), (250, 1000), (1000, 4000), (4000, 10000), (10000, 22050)]:
        out['%d-%d' % (lo, hi)] = round(100 * spec[(f >= lo) & (f < hi)].sum() / tot, 1)
    cen = float((spec * f).sum() / tot)
    # strongest peaks (tonal content)
    sm = np.convolve(spec, np.ones(5) / 5, mode='same')
    idx = np.argsort(sm[(f > 30) & (f < 8000)])[::-1]
    fsub = f[(f > 30) & (f < 8000)]
    peaks = []
    for i in idx:
        fr = fsub[i]
        if all(abs(fr - p) > max(8, p * 0.04) for p in peaks):
            peaks.append(fr)
        if len(peaks) >= 6:
            break
    return {'bands%': out, 'centroid': round(cen), 'peaksHz': [round(p) for p in peaks]}


def onsets(m, sr, thr=10.0, hop=0.005, min_gap=0.08):
    n = int(hop * sr)
    e = env(m, sr, hop)
    edb = 20 * np.log10(e + 1e-9)
    floor = np.percentile(edb, 20)
    out = []
    last = -1e9
    for i in range(3, len(edb)):
        base = edb[max(0, i - 6): i - 1].mean()
        if edb[i] - base > thr and edb[i] > floor + thr and (i - last) * hop > min_gap:
            out.append(i * hop)
            last = i
    return out, floor


def info(path, win=0.25, t0=None, t1=None):
    x, sr = read(path)
    if t0 is not None or t1 is not None:
        a = int((t0 or 0) * sr)
        b = int(t1 * sr) if t1 else x.shape[1]
        x = x[:, a:b]
    m = mono(x)
    if BAND:
        import proc
        lo, hi = BAND
        y = m[None, :]
        if lo > 0: y = proc.highpass(y, lo)
        if hi > 0: y = proc.lowpass(y, hi)
        m = y[0]
    dur = len(m) / sr
    print('%s  %.2fs  ch=%d  rms=%.1f  peak=%.1f  st50max=%.1f dBFS' % (path.split('/')[-1], dur, x.shape[0], db(rms(m)), db(np.abs(x).max()), db(short_term_max(x, sr))))
    if x.shape[0] == 2:
        l, r = x
        corr = float(np.corrcoef(l, r)[0, 1]) if rms(l) > 0 and rms(r) > 0 else 0
        print('  stereo corr=%.2f  L=%.1f R=%.1f' % (corr, db(rms(l)), db(rms(r))))
    print('  ', bands(m, sr))
    e = env(m, sr, win)
    edb = [int(round(db(v))) for v in e]
    # compact envelope: one value per window
    line = []
    for i, v in enumerate(edb):
        line.append('%d' % v)
    step = 20
    for i in range(0, len(line), step):
        print('  %6.2fs: %s' % (i * win, ' '.join(line[i:i + step])))
    on, floor = onsets(m, sr)
    print('  floor(p20, 5ms)=%.1f dB, onsets(%d): %s' % (floor, len(on), ' '.join('%.2f' % t for t in on[:60])))


if __name__ == '__main__':
    args = sys.argv[1:]
    cmd = args[0]
    opts = {}
    pos = []
    i = 1
    while i < len(args):
        if args[i].startswith('--'):
            opts[args[i][2:]] = float(args[i + 1])
            i += 2
        else:
            pos.append(args[i])
            i += 1
    if 'lo' in opts or 'hi' in opts:
        BAND = (opts.get('lo', 0), opts.get('hi', 0))
    if cmd == 'info':
        for p in pos:
            info(p, opts.get('win', 0.25), opts.get('from'), opts.get('to'))
    elif cmd == 'onsets':
        x, sr = read(pos[0])
        on, floor = onsets(mono(x), sr, opts.get('thr', 10))
        m = mono(x)
        for t in on:
            a = int(t * sr)
            seg = m[a: a + int(0.3 * sr)]
            print('%.3f peak=%.1f' % (t, db(np.abs(seg).max())))
