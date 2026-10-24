"""Find isolated events (steps, taps, clinks) in a recording and cut them out."""
import numpy as np
import ana
import proc

SR = 44100


def envdb(m, hop=0.002):
    n = int(hop * SR)
    k = len(m) // n
    e = np.sqrt(np.mean(m[: k * n].reshape(k, n) ** 2, axis=1))
    return 20 * np.log10(e + 1e-9)


def find(x, hp=150, thr=14, min_gap=0.12, hop=0.002, a=0.0, b=None):
    """Onset list [(t, peak_db, floor_before_db)] on a highpassed mono envelope."""
    m = proc.channel(x, 'mono')
    if hp:
        m = proc.highpass(m, hp)
    m = m[0]
    i0 = int(a * SR)
    i1 = len(m) if b is None else int(b * SR)
    m = m[i0:i1]
    e = envdb(m, hop)
    floor = np.percentile(e, 25)
    out = []
    last = -1e9
    for i in range(3, len(e) - 1):
        if e[i] > floor + thr and e[i] - e[max(0, i - 3)] > 8 and (i - last) * hop > min_gap:
            # walk to the local peak
            j = i
            while j + 1 < len(e) and e[j + 1] > e[j]:
                j += 1
            pre = e[max(0, i - int(0.08 / hop)): max(1, i - 2)]
            out.append((a + i * hop, float(e[j]), float(pre.min() if len(pre) else floor)))
            last = i
    return out, float(floor)


def cut_events(x, n, pre=0.01, max_len=0.6, min_len=0.06, decay_db=36, hp=150, thr=14, min_gap=0.12, a=0.0, b=None, prefer='loud', skip=(), fixed=None):
    """Return up to n mono event clips, each from just before an onset until it decays by decay_db
    (or the next onset / max_len). Picks the loudest well-isolated events."""
    on, floor = find(x, hp=hp, thr=thr, min_gap=min_gap, a=a, b=b)
    m = proc.channel(x, 'mono')
    hpm = proc.highpass(m, hp)[0] if hp else m[0]
    e = envdb(hpm)
    cands = []
    for k, (t, pk, before) in enumerate(on):
        if k in skip:
            continue
        nxt = on[k + 1][0] if k + 1 < len(on) else t + max_len + 0.5
        s = max(0.0, t - pre)
        # end: first point after the peak where envelope is decay_db below the peak, held 20 ms
        i = int(t / 0.002)
        end = min(nxt - 0.01, t + max_len)
        j = i if not fixed else len(e)
        if fixed:
            end = min(nxt - 0.01, t + fixed)
        while j < len(e) and j * 0.002 < end:
            if e[j] < pk - decay_db:
                end = j * 0.002 + 0.02
                break
            j += 1
        if end - s < min_len:
            continue
        isolation = pk - before
        cands.append((s, end, pk, isolation))
    if prefer == 'loud':
        cands.sort(key=lambda c: -(c[2] + 0.5 * c[3]))
    elif prefer == 'isolated':
        cands.sort(key=lambda c: -c[3])
    chosen = sorted(cands[:n], key=lambda c: c[0])
    clips = []
    for s, end, pk, iso in chosen:
        c = proc.seg(m, s, end)
        clips.append((c, s, end, pk, iso))
    return clips
