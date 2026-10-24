"""Processing primitives (numpy only) used by build.py."""
import os
import subprocess
import numpy as np
import ana

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
_cache = {}


def src(sid):
    """Source <sid> as 44.1 kHz audio. dl/<sid>.wav is only a cache: when it is missing it is made
    from a hand-downloaded original in originals/ (named <sid>__author__title.ext, as Freesound names them)."""
    if sid not in _cache:
        wav = os.path.join(HERE, 'dl', '%s.wav' % sid)
        if not os.path.exists(wav):
            orig = os.path.join(HERE, 'originals')
            found = [f for f in (os.listdir(orig) if os.path.isdir(orig) else []) if f.startswith('%s__' % sid)]
            if not found:
                raise FileNotFoundError('%s: no dl/%s.wav and no originals/%s__*; fetch it with fs.py get %s' % (sid, sid, sid, sid))
            os.makedirs(os.path.dirname(wav), exist_ok=True)
            subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', os.path.join(orig, found[0]), wav], check=True)
        x, sr = ana.read(wav)
        assert sr == SR
        _cache[sid] = x
    return _cache[sid].copy()


def seg(x, a=0.0, b=None):
    n = x.shape[1]
    i = int(round(a * SR))
    j = n if b is None else min(n, int(round(b * SR)))
    return x[:, i:j].copy()


def channel(x, mode):
    """'mono' (mid), 'L', 'R', 'stereo' (unchanged), 'louder'."""
    if mode == 'stereo':
        return x if x.shape[0] == 2 else np.vstack([x[0], x[0]])
    if x.shape[0] == 1:
        return x
    if mode == 'L':
        return x[0:1]
    if mode == 'R':
        return x[1:2]
    if mode == 'louder':
        return x[0:1] if ana.rms(x[0]) >= ana.rms(x[1]) else x[1:2]
    return x.mean(axis=0, keepdims=True)


def _fft_filter(x, H):
    out = np.empty_like(x)
    for c in range(x.shape[0]):
        n = x.shape[1]
        pad = min(n, SR // 2)
        y = np.concatenate([x[c, :pad][::-1], x[c], x[c, -pad:][::-1]])  # reflect padding
        F = np.fft.rfft(y)
        f = np.fft.rfftfreq(len(y), 1 / SR)
        F *= H(np.maximum(f, 1e-3))
        out[c] = np.fft.irfft(F, len(y))[pad:pad + n]
    return out


def highpass(x, fc, order=4):
    return _fft_filter(x, lambda f: 1 / np.sqrt(1 + (fc / f) ** (2 * order)))


def lowpass(x, fc, order=4):
    return _fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def shelf(x, fc, gain_db, kind='low'):
    g = 10 ** (gain_db / 20)
    if kind == 'low':
        return _fft_filter(x, lambda f: 1 + (g - 1) / (1 + (f / fc) ** 4))
    return _fft_filter(x, lambda f: 1 + (g - 1) / (1 + (fc / f) ** 4))


def resample(x, rate):
    """Varispeed: rate < 1 lowers the pitch and lengthens (like playbackRate)."""
    if abs(rate - 1) < 1e-6:
        return x
    n = x.shape[1]
    m = int(n / rate)
    t = np.arange(m) * rate
    out = np.empty((x.shape[0], m), dtype=np.float32)
    for c in range(x.shape[0]):
        out[c] = np.interp(t, np.arange(n), x[c])
    if rate > 1:
        out = lowpass(out, SR / 2 / rate * 0.95, order=8)
    return out


def fade(x, fin=0.005, fout=0.05, curve='cos'):
    x = x.copy()
    n = x.shape[1]
    a = min(n // 2, int(fin * SR))
    b = min(n // 2, int(fout * SR))
    if a > 0:
        w = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a)) if curve == 'cos' else np.linspace(0, 1, a)
        x[:, :a] *= w
    if b > 0:
        w = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b)) if curve == 'cos' else np.linspace(1, 0, b) ** 2
        x[:, n - b:] *= w
    return x


def expfade_tail(x, start, end_db=-60.0):
    """Exponential fade from `start` seconds to the end (reaching end_db)."""
    x = x.copy()
    i = int(start * SR)
    n = x.shape[1] - i
    if n > 0:
        x[:, i:] *= 10 ** (np.linspace(0, end_db, n) / 20)
    return x


def trim(x, thr_db=-50.0, pre=0.004, post=0.02, rel=True, hop=0.002):
    """Trim leading/trailing parts quieter than thr (relative to peak when rel)."""
    m = np.abs(x).max(axis=0)
    ref = m.max() if rel else 1.0
    thr = ref * 10 ** (thr_db / 20)
    idx = np.where(m > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pre * SR))
    b = min(x.shape[1], idx[-1] + int(post * SR))
    return x[:, a:b]


def gain_db(x, d):
    return x * 10 ** (d / 20)


def norm_st(x, target_db, peak_max_db=-1.0):
    """Normalize so the loudest 50 ms window hits target_db; never exceed peak_max_db."""
    st = ana.short_term_max(x, SR)
    g = 10 ** (target_db / 20) / max(st, 1e-9)
    pk = np.abs(x).max() * g
    lim = 10 ** (peak_max_db / 20)
    if pk > lim:
        g *= lim / pk
    return x * g


def norm_rms(x, target_db, peak_max_db=-1.0):
    r = ana.rms(x)
    g = 10 ** (target_db / 20) / max(r, 1e-9)
    pk = np.abs(x).max() * g
    lim = 10 ** (peak_max_db / 20)
    if pk > lim:
        g *= lim / pk
    return x * g


def soft_limit(x, ceiling_db=-1.0):
    c = 10 ** (ceiling_db / 20)
    return np.tanh(x / c) * c


def loopify(x, length, xfade):
    """Seamless loop of `length` seconds from x (which must be >= length + xfade long).

    The material before the loop's first sample is crossfaded (equal power) into its tail, so
    sample[-1] flows into sample[0].
    """
    L = int(length * SR)
    F = int(xfade * SR)
    assert x.shape[1] >= L + F, (x.shape[1] / SR, length, xfade)
    head = x[:, :F]
    body = x[:, F:F + L].copy()
    t = np.linspace(0, 1, F)
    body[:, L - F:] = body[:, L - F:] * np.sqrt(1 - t) + head * np.sqrt(t)
    return body


def pad_loop(body, pad):
    """Wrap a seamless loop with `pad` seconds of its own tail before and its head after, so the
    player can loop [pad, pad+len] and still be seamless if the decoder shifts samples a little."""
    P = int(pad * SR)
    return np.concatenate([body[:, -P:], body, body[:, :P]], axis=1)


def concat(parts, gap=0.0):
    ch = max(p.shape[0] for p in parts)
    parts = [p if p.shape[0] == ch else np.vstack([p[0]] * ch) for p in parts]
    g = np.zeros((ch, int(gap * SR)), dtype=np.float32)
    out = []
    for i, p in enumerate(parts):
        if i:
            out.append(g)
        out.append(p)
    return np.concatenate(out, axis=1)


def mix(a, b, at=0.0, gb=1.0):
    """Mix b into a starting at `at` seconds (extends a if needed)."""
    ch = max(a.shape[0], b.shape[0])
    if a.shape[0] < ch:
        a = np.vstack([a[0]] * ch)
    if b.shape[0] < ch:
        b = np.vstack([b[0]] * ch)
    i = int(at * SR)
    n = max(a.shape[1], i + b.shape[1])
    out = np.zeros((ch, n), dtype=np.float32)
    out[:, :a.shape[1]] += a
    out[:, i:i + b.shape[1]] += b * gb
    return out


def envelope(x, pts):
    """Multiply by a piecewise-linear gain envelope given as [(sec, gain_db), ...]."""
    n = x.shape[1]
    t = np.arange(n) / SR
    ts = [p[0] for p in pts]
    gs = [10 ** (p[1] / 20) for p in pts]
    return x * np.interp(t, ts, gs)


def varispeed_ramp(x, r0, r1):
    """Playback-rate ramp from r0 to r1 across the output (pitch glide), like a tape speeding up."""
    n = x.shape[1]
    m = int(n / ((r0 + r1) / 2))
    rates = np.linspace(r0, r1, m)
    pos = np.cumsum(rates) - rates[0]
    pos = pos[pos < n - 1]
    out = np.empty((x.shape[0], len(pos)), dtype=np.float32)
    for c in range(x.shape[0]):
        out[c] = np.interp(pos, np.arange(n), x[c])
    return out


def dc(x):
    return x - x.mean(axis=1, keepdims=True)
