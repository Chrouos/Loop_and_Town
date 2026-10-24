"""What each game sound is made of. Times are seconds in the source recording (dl/<id>.wav)."""
import numpy as np
import proc
import events
from proc import src, seg, channel, highpass, lowpass, fade, mix, envelope, resample, loopify, concat
from build import sfx, amb

SR = 44100


def M(x):
    return channel(x, 'mono')


def cut(sid, a, b, ch='mono'):
    return channel(seg(src(sid), a, b), ch)


def ev(sid, n, max_crest=None, **kw):
    """n isolated events (mono clips) from a recording, as variant callables. With max_crest, events
    whose peak stands more than max_crest dB over their loudest 50 ms are skipped (pure clicks)."""
    import ana
    found = []

    def clips():
        # cut on first use, so importing spec.py does not need every source in dl/
        if not found:
            got = events.cut_events(src(sid), n + (3 if max_crest else 0), **kw)
            if max_crest:
                ok = [c for c in got if ana.db(np.abs(c[0]).max()) - ana.db(ana.short_term_max(c[0], SR)) <= max_crest]
                got = (ok or got)[:n]
            if len(got) < n:
                raise ValueError('%s: only %d of %d events found' % (sid, len(got), n))
            found.append(got)
        return found[0]
    return [(lambda i=i: clips()[i][0]) for i in range(n)]


def bed(sid, a, length, xfade=3.0, ch='stereo', hp=None, lp=None):
    """Seamless loop of `length` s starting at a (needs xfade s of material before... after a)."""
    def make():
        x = channel(seg(src(sid), a, a + length + xfade), ch)
        if hp:
            x = highpass(x, hp)
        if lp:
            x = lowpass(x, lp)
        return loopify(x, length, xfade)
    return make


def wide_mono(sid, a, length, xfade=3.0, hp=None, lp=None, offset=None):
    """Pseudo-stereo bed from a mono source: L and R are the same seamless loop, offset in time."""
    def make():
        m = channel(seg(src(sid), a, a + length + xfade), 'mono')
        if hp:
            m = highpass(m, hp)
        if lp:
            m = lowpass(m, lp)
        body = loopify(m, length, xfade)[0]
        k = int((offset or length / 2) * SR)
        return np.vstack([body, np.roll(body, k)])
    return make


# ================================================================ the clock tower bell
# Kalomina 611469: a church bell tolling 12 times; the 12th strike (50.45 s) rings out ~15 s.
# Played at rate 0.84 (about 3 semitones down) for a larger, darker bell.
sfx('bell_toll', [lambda: cut('611469', 50.40, 65.3)], [611469], st=-18, rate=0.84, jitter=0.004, fout=1.5,
    note='12th (last) strike of the 12-toll recording with its full natural decay; played at rate 0.84 for a bigger, darker bell')
sfx('bell_toll_far', [lambda: lowpass(cut('611469', 50.40, 65.3), 1400, order=2)], [611469], st=-27, rate=0.84, jitter=0.004, fin=0.02, fout=1.5, wet=0.6,
    note='same strike as bell_toll, low-passed at 1.4 kHz with a softened attack; rate 0.84')

# ================================================================ weather beds
amb('rain', bed('522113', 1000.0, 60.0, 3.0, hp=150), [522113], rms=-34, bitrate=128000, extras=True,
    note='60 s from 16:40 of steady rain over a small Taiwanese city at night, heard from a 9th-floor window (the steadiest minute of the 22-minute recording), high-passed at 150 Hz to drop traffic rumble and thunder; made from the original file')
amb('rain_on_window', bed('569313', 60.0, 50.0, 3.0, hp=60), [569313], rms=-36, bitrate=128000, extras=True,
    note='50 s from 1:00 of rain pattering on a metal roof and dripping onto tin window sills, windows slightly open '
         '(from the original 96 kHz FLAC; the thunder at 0:42 is left out, extras add their own), high-passed at 60 Hz')

# ================================================================ train
amb('train_interior', bed('197124', 5.0, 60.0, 3.0, hp=30), [197124], rms=-34, extras=False,
    note='60 s inside an empty passenger car moving slowly, high-passed at 30 Hz')
sfx('train_brake', [lambda: cut('25824', 3.6, 13.6)], [25824], st=-20, fin=0.3, fout=1.2, jitter=0.02,
    note='an old tram slowing down with its brake squealing, 3.6–13.6 s')
sfx('bus_hiss', [lambda: cut('140036', 0.0, 2.4)], [140036], st=-20, fout=0.5,
    note='train air-brake depressurization, first 2.4 s')

# ================================================================ old station hall, sea, insects
amb('old_station_hall', bed('240895', 30.0, 60.0, 3.0, hp=40), [240895], rms=-38, extras=True,
    note='60 s of an abandoned warehouse (white noise of wind, distant metal), high-passed at 40 Hz')
amb('sea_far', bed('578524', 20.0, 60.0, 4.0, lp=1600), [578524], rms=-35, bitrate=96000, extras=True,
    note='60 s of calm ocean waves, low-passed at 1.6 kHz to put them at a distance')
amb('night_insects', bed('175020', 1.0, 55.0, 3.0, hp=300), [175020], rms=-37, bitrate=128000, extras=True,
    note='55 s of field crickets around midnight, high-passed at 300 Hz')

# ================================================================ clocks
def tick_loop(sid, a=0.0, b=None, ch='mono', hp=None, lp=None, total=60.0, gap=0.03, xf=0.02):
    """A seamless `total`-second loop of one clock: cut between two tick onsets whose distance is
    closest to a divisor of `total`, nudge its speed (<1 %) to fit exactly, then tile."""
    x = channel(seg(src(sid), a, b), ch)
    if hp:
        x = highpass(x, hp)
    if lp:
        x = lowpass(x, lp)
    on, _ = events.find(x, hp=800, thr=10, min_gap=0.08)
    ts = [t for t, _, _ in on if t > gap + xf + 0.05]
    avail = x.shape[1] / SR
    best = None
    for L in [total / k for k in range(1, 40)]:
        if L > avail - 0.2 or L < 3:
            continue
        for i, ti in enumerate(ts):
            for tj in ts[i + 1:]:
                d = tj - ti
                if abs(d - L) / L < 0.01:
                    err = abs(d - L)
                    if best is None or L > best[0] + 1e-9 or (abs(L - best[0]) < 1e-9 and err < best[3]):
                        best = (L, ti, tj, err)
        if best:
            break
    assert best, sid
    L, ti, tj, _ = best
    s = seg(x, ti - gap - xf, tj - gap)
    s = resample(s, (tj - ti) / L)  # exactly L seconds (+xf)
    need = int(round((L + xf) * SR))
    s = s[:, :need] if s.shape[1] >= need else np.pad(s, ((0, 0), (0, need - s.shape[1])))
    body = loopify(s, L, xf)
    reps = int(round(total / L))
    return np.tile(body, (1, reps))


def tick_level(x):
    """Reference level of a tick track: 99.5th percentile of its 2 ms envelope."""
    e = events.envdb(channel(x, 'mono')[0])
    return np.percentile(e, 99.5)


def place(x, pan, db):
    """Constant-power pan of a mono track to stereo, scaled so its ticks sit at `db`."""
    m = channel(x, 'mono')[0]
    m = m * 10 ** ((db - tick_level(m[None, :])) / 20)
    th = (pan + 1) * np.pi / 4
    return np.vstack([m * np.cos(th), m * np.sin(th)])


CLOCKS = [
    # source, segment, channel, hp, lp, pan, tick level (dB)
    ('657255', 0, None, 'L', 120, None, -0.6, -14),   # old pendulum clock (the tall one)
    ('164080', 0, None, 'mono', 300, 6000, 0.5, -20),  # pendulum clock (fridge removed)
    ('234268', 0, 7.45, 'mono', 150, None, 0.2, -18),  # 100-year-old Finnish wall clock
    ('170445', 0, None, 'mono', 150, 7000, -0.2, -23), # wall clock, very close
    ('434841', 0, None, 'mono', 200, None, 0.8, -19),  # kitchen wall clock
    ('380782', 0, None, 'louder', 300, None, -0.9, -21),
    ('211192', 0, None, 'mono', 150, None, 0.35, -21),  # small clock with a little room
    ('417593', 0, None, 'mono', 150, None, -0.4, -23),  # plastic desk clock
    ('490325', 0, None, 'mono', 300, 9000, 0.65, -27),  # mechanical timer, fast ticks
    ('847217', 1.3, 36.0, 'mono', 800, None, 0.05, -26), # antique pocket watch
]


def clock_shop():
    out = None
    for sid, a, b, ch, hp, lp, pan, db in CLOCKS:
        t = place(tick_loop(sid, a, b, ch, hp, lp), pan, db)
        out = t if out is None else out[:, :t.shape[1]] + t[:, :out.shape[1]]
    return out


amb('clock_shop', clock_shop, [int(c[0]) for c in CLOCKS], rms=-34, peak=-6, extras=True, bitrate=128000,
    note='mix of ten separate clock recordings, each cut on tick boundaries, speed-nudged <1 % and tiled into a 60 s loop, panned across the room')

sfx('watch_tick', [lambda: highpass(cut('847217', 40.0, 43.2), 600)], [847217], st=-22, peak=-8, fin=0.25, fout=0.5,
    note='3.2 s of an antique pocket watch ticking (second watch), high-passed at 600 Hz')
sfx('clock_wind', [lambda: highpass(cut('847217', 73.1, 75.3), 300), lambda: highpass(cut('847217', 76.0, 78.1), 300)], [847217], st=-22, peak=-8, trim_db=-45, fout=0.15,
    note='two short passages of an antique pocket watch being wound')
sfx('clock_chime', [lambda: highpass(cut('234268', 11.55, 19.0), 80)], [234268], st=-21, fout=1.5,
    note='the last three strikes of a 100-year-old Finnish wall clock chiming six, with their decay')

# ================================================================ town & interiors
def layered(*parts):
    """parts: (make, gain_db) — mix seamless loops of equal length."""
    def make():
        out = None
        for mk, db in parts:
            x = channel(mk(), 'stereo') * 10 ** (db / 20)
            out = x if out is None else out[:, :x.shape[1]] + x[:, :out.shape[1]]
        return out
    return make


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def norm_to(mk, db):
    def make():
        x = mk()
        return x * 10 ** ((db - rms_db(x)) / 20)
    return make


amb('street_morning', bed('241135', 14.5, 48.0, 3.0, hp=150), [241135], rms=-36, extras=True,
    note='48 s of a small quiet street at 10 AM (birds, a few cars and pedestrians), recorded from a parked car; high-passed at 150 Hz')
amb('street_evening', bed('733843', 0.5, 30.0, 3.0, hp=80), [733843], rms=-39, extras=True,
    note='30 s of a quiet street in Bangkok at night (distant traffic, pedestrians), high-passed at 80 Hz')
amb('tower_square_night', bed('196768', 2.0, 40.0, 3.0, hp=60), [196768], rms=-41, extras=True,
    note='40 s of a Taipei alley at night with little traffic, high-passed at 60 Hz')
amb('town_square', bed('119934', 1.0, 52.0, 3.0, hp=60), [119934], rms=-37, extras=True,
    note='52 s of a town square, high-passed at 60 Hz')
amb('construction_far', bed('650696', 30.0, 60.0, 3.0, hp=80, lp=1800), [650696], rms=-40, crest=18, extras=True,
    note='60 s of hammering and banging on a construction site, low-passed at 1.8 kHz to push it far away')
amb('platform', bed('620099', 20.0, 60.0, 3.0, hp=100), [620099], rms=-40, extras=True,
    note='60 s of wind over an open field (dry grass), high-passed at 100 Hz; station life comes from the procedural events')
amb('old_house', bed('129443', 20.0, 60.0, 3.0, hp=60), [129443], rms=-42, extras=True,
    note='60 s of quiet room tone in a small kitchen at 6 AM (fluorescent lamp, faint traffic and birds outside)')
amb('house_night', layered((norm_to(bed('237399', 1.0, 44.0, 3.0, hp=40), -40), 0),
                           (norm_to(bed('175020', 5.0, 44.0, 3.0, hp=300, lp=2500), -40), -11)),
    [237399, 175020], rms=-41, extras=True,
    note='44 s: a fridge humming in the room, plus crickets outside low-passed at 2.5 kHz as if through a window, 11 dB down')
amb('hospital', layered((norm_to(bed('383486', 3.5, 35.0, 3.0, hp=60), -40), 0),
                        (norm_to(wide_mono('557013', 10.0, 35.0, 3.0, hp=100, lp=500), -40), -15)),
    [383486, 557013], rms=-39, extras=True,
    note='35 s: fluorescent lamps humming in an empty hospital corridor, plus a Hong Kong hospital waiting room low-passed at 500 Hz, 15 dB down (unintelligible murmur through walls)')
amb('police_office', bed('797668', 1.0, 45.0, 3.0, hp=120), [797668], rms=-39, extras=True,
    note='45 s of a rotating office fan, high-passed at 120 Hz')
amb('library', bed('620683', 110.0, 60.0, 3.0, hp=60), [620683], rms=-42, extras=False,
    note='60 s of a quiet university library (pages, pens, chairs, ventilation; no voices)')
amb('maintenance_tunnel', bed('144559', 30.0, 60.0, 3.0, hp=60), [144559], rms=-37, extras=True,
    note='60 s of an electrical power transformer humming near train lines')
amb('room_tone', bed('489443', 20.0, 60.0, 3.0, hp=40), [489443], rms=-48, extras=False,
    note='60 s of plain room tone, high-passed at 40 Hz')
amb('cafe', wide_mono('370973', 20.0, 60.0, 3.0, hp=80), [370973], rms=-37, extras=True,
    note='60 s of a Czech cafeteria (diffuse walla, no single voice on top; mono, spread to stereo by offsetting the loop between channels), high-passed at 80 Hz')
amb('restaurant', bed('347016', 2.0, 55.0, 3.0, hp=80, lp=7000), [347016], rms=-37, extras=True,
    note='55 s of a busy restaurant in suburban Shanghai (diners, plates, glasses), high-passed at 80 Hz, low-passed at 7 kHz')

# ================================================================ one-shots: people & movement
def C(sid, a, b):
    return lambda: cut(sid, a, b)


sfx('step', ev('205817', 4, a=0.5, b=50, hp=150, max_len=0.32, decay_db=34, min_gap=0.25, fixed=0.28), [205817], st=-20, limit=10, peak=-6, hp=60, fout=0.04,
    note='4 single footsteps (shoes on a pavement at night, MKH60) cut from a walk')
sfx('step_heels', ev('343390', 3, a=5.4, b=17.5, hp=150, max_len=0.3, decay_db=30, min_gap=0.25, fixed=0.28), [343390], st=-21, limit=14, peak=-5, hp=80, fout=0.04,
    note='3 single high-heel steps on concrete')
sfx('step_run', [C('134991', 0.33, 1.40), C('134991', 2.20, 3.30)], [134991], st=-20, peak=-6, hp=60, fout=0.08,
    note='two ~1 s runs of four quick footsteps')
sfx('step_wet', ev('376809', 3, a=0.0, b=45, hp=150, max_len=0.45, decay_db=28, min_gap=0.3, fixed=0.4), [376809], st=-21, peak=-5, limit=13, hp=60, fout=0.05,
    note='3 single steps through wet gravel and puddles (MKH815)')
sfx('cane_tap', ev('393434', 4, a=0.5, b=27, hp=300, max_len=0.22, decay_db=30, min_gap=0.25, fixed=0.18), [393434], st=-20, peak=-3, hp=150, fout=0.03,
    note='4 single taps of a white cane on a city pavement, cut from a blind person walking')
sfx('door_open', [C('344360', 0.70, 2.40)], [344360], st=-22, fout=0.15, note='handle and opening swing of a door')
sfx('door_close', [C('402466', 0.08, 1.78)], [402466], st=-20, hp=50, peak=-6, fin=0.015, fout=0.22,
    note='a heavy wooden door quietly closing: movement, frame contact and settling retained as one 1.7 s action; sub-50 Hz rumble removed')
sfx('door_creak', [C('219499', 0.30, 1.00), C('377552', 0.0, 0.90)], [219499, 377552], st=-21, limit=14, fout=0.08,
    note='two old wooden door creaks')
sfx('door_slam', [C('395653', 2.72, 4.30)], [395653], st=-17, fout=0.4, note='a door slammed shut')
sfx('shop_bell', [C('494565', 0.25, 2.30), C('494565', 2.55, 4.45), C('494565', 4.45, 6.70)], [494565], st=-21, fout=0.35,
    note='three rings of a bell on a shop door')
sfx('key_jingle', [lambda: lowpass(cut('565909', 0.53, 1.18), 4800, order=2), lambda: lowpass(cut('565909', 2.40, 3.03), 4800, order=2), lambda: lowpass(cut('565909', 3.80, 4.62), 4800, order=2)], [565909], st=-22, hp=200, limit=12, peak=-6, fin=0.008, fout=0.08, jitter=0.015,
    note='three dense rattles of fourteen old keys on a ring; low-passed at 4.8 kHz to soften the thin, chime-like top end, retaining short metal contacts')
sfx('lock_turn', [C('615287', 3.40, 4.72)], [615287], st=-21, hp=100, limit=12, peak=-6, fin=0.01, fout=0.12, jitter=0.01,
    note='a real key-operated door lock: short handling/turning movement into a firm mechanical clack; replaces the electronic hotel-card deadbolt')
sfx('chair_scrape', [C('219677', 0.25, 1.50), C('219677', 2.25, 3.20)], [219677], st=-21, fout=0.1, note='a wooden chair moved on the floor (two takes)')
sfx('drawer', [C('486081', 0.0, 1.1)], [486081], st=-21, fout=0.1, note='a wooden drawer opening')
sfx('cloth_rustle', [C('19291', 0.48, 1.15), C('19291', 1.15, 1.98)], [19291], st=-24, fout=0.08, note='two short cloth rustles (sleeve)')
sfx('cough', [C('722623', 3.80, 4.22), C('722623', 8.95, 9.30), C('722623', 20.44, 20.98)], [722623], st=-21, hp=120, fout=0.06,
    note='three single unprocessed coughs (audience-ambience recording)')
sfx('kid_laugh', [C('365632', 0.2, 1.25), C('365632', 1.95, 3.35)], [365632], st=-22, fout=0.15, note='two short bursts of a young child laughing')
sfx('radio_noise', [C('345101', 3.5, 8.0)], [345101], st=-26, hp=200, fin=0.4, fout=0.6,
    note='4.5 s of real static from a car radio tuned between stations (the broadcast itself is only text)')
sfx('gasp_crowd', [C('439258', 5.45, 8.30)], [439258], st=-20, fout=0.5, note='a small crowd gasping')

# ================================================================ one-shots: objects
sfx('paper_rustle', [C('181774', 0.65, 1.50), C('181774', 1.65, 2.55)], [181774], st=-22, limit=14, fout=0.1, note='two paper rustles')
sfx('page_turn', ev('164806', 3, a=0.5, b=7.5, hp=150, max_len=0.7, decay_db=28, min_gap=0.5, fixed=0.5), [164806], st=-22, fout=0.08, note='3 page turns of a book')
sfx('envelope', [C('632116', 1.55, 3.30)], [632116], st=-22, fout=0.2, note='a paper envelope opened and a letter pulled out')
sfx('pen_scratch', [C('333935', 9.10, 10.79), C('333935', 13.14, 14.79), C('333935', 24.96, 26.46)], [333935], st=-22, hp=200, limit=12, fin=0.05, fout=0.2,
    note='three passages of handwriting with a pencil on paper, close mic')
sfx('braille_stylus', [C('673782', 1.06, 2.56), C('673782', 30.96, 32.04), C('673782', 41.56, 42.24)], [673782], st=-22, hp=1000, limit=12, fin=0.01, fout=0.08,
    note='punching braille dots with a slate and stylus (the hardest punches of the recording, high-passed at 1 kHz to drop hiss)')
sfx('cup_set', [C('460241', 1.90, 2.55), C('460242', 0.98, 1.55), C('206171', 0.10, 0.62), C('206171', 1.25, 1.85)], [460241, 460242, 206171], st=-21, peak=-6, fout=0.08,
    note='four porcelain cups set down on saucers/tables')
sfx('spoon_stir', [C('352872', 0.60, 2.50), C('352872', 8.30, 10.30)], [352872], st=-22, fout=0.2, note='a spoon stirring in a cup (two takes)')
sfx('coffee_grind', [C('32913', 3.80, 7.40)], [32913], st=-21, fin=0.05, fout=0.4, note='a barista grinding beans in a coffee shop')
sfx('steam_hiss', [C('718196', 0.0, 2.6)], [718196], st=-22, fin=0.1, fout=0.4, note='milk being frothed with an espresso machine steam wand')
sfx('kettle', [C('239005', 7.0, 12.0)], [239005], st=-22, fin=0.4, fout=0.6, note='a kettle rumbling towards the boil')
sfx('glass_clink', [C('119839', 3.0, 4.4), C('119839', 4.5, 5.95), C('119839', 6.0, 7.4)], [119839], st=-21, peak=-6, fout=0.2, note='three glass clinks')
sfx('camera_shutter', [C('637342', 2.60, 2.86), C('637342', 5.83, 6.10)], [637342], st=-20, peak=-4, hp=300, fout=0.03,
    note='two releases of a Minolta XE-7 35mm film SLR (mirror and curtain clacks), close')
sfx('strap_click', [lambda: np.pad(fade(cut('822397', 0.0, 0.2), 0.002, 0.04), ((0, 0), (0, int(0.08 * SR)))), C('649853', 0.15, 0.45)], [822397, 649853], st=-23, limit=14, peak=-9, fout=0.03,
    note='a small metal clasp and a buckle clip; clasp has a 40 ms release plus 80 ms of padding to retain the AAC tail')
sfx('typing', [C('331656', 1.0, 3.4), C('331656', 8.0, 10.4)], [331656], st=-22, limit=14, fout=0.15, note='typing on a mechanical keyboard (two passages)')
sfx('phone_buzz', [C('349483', 0.0, 1.65)], [349483], st=-21, fout=0.06, note='a mobile phone vibrating once on a table')
sfx('phone_ring', [C('406235', 0.0, 2.6)], [406235], st=-21, fout=0.3, note='one ring of an old-fashioned telephone bell')
sfx('recorder_click', [C('494605', 0.64, 1.05), C('541643', 4.55, 4.82), C('541643', 9.97, 10.20)], [494605, 541643], st=-21, hp=150, limit=14, peak=-4, fout=0.04,
    note='keys of small handheld cassette recorders: the stiff record key of a Sony TCM-16 (press and latch) and two key presses of a portable Sony')
sfx('tape_rewind', [C('545835', 3.0, 5.4)], [545835], st=-22, fin=0.15, fout=0.3, note='a cassette tape rewinding')
sfx('static_burst', ev('454259', 3, a=0.0, b=12.8, hp=200, thr=10, max_len=0.9, decay_db=30, min_gap=0.8, fixed=0.55), [454259], st=-22, fout=0.08,
    note='three short bursts of TV/radio static while changing channels')

# ================================================================ one-shots: town
sfx('car_pass', [C('465397', 3.0, 8.5), C('171447', 0.0, 5.4)], [465397, 171447], st=-21, fin=0.4, fout=0.6, move=(-70, 70, 2.2),
    note='two recorded car pass-bys (mono); the engine also moves them across their direction')
sfx('bicycle_bell', [C('378912', 0.25, 1.95), C('378912', 2.50, 4.40)], [378912], st=-21, fout=0.3, note='a bicycle bell ringing (two rings)')
sfx('ball_bounce', ev('378355', 3, a=0.0, b=5.6, hp=100, max_len=0.6, decay_db=30, min_gap=0.8, fixed=0.5), [378355], st=-20, limit=14, peak=-3, fout=0.05,
    note='three bounces of a football on the ground')
sfx('construction_drill', [C('104817', 3.0, 8.0)], [104817], st=-22, fin=0.15, fout=0.5, note='a drill going into a concrete wall')
sfx('hammer', [C('337816', 0.0, 1.55), C('337816', 1.28, 2.90)], [337816], st=-20, peak=-5, fout=0.15, note='hammering a nail into a board (two passages)')
sfx('dog_bark', [C('449490', 0.28, 0.85), C('449490', 4.00, 4.50), C('449490', 7.08, 8.04)], [449490], st=-21, hp=150, fout=0.1,
    note='single barks and a double bark of a medium-size dog (not aggressive)')
sfx('seagull', ev('353416', 2, a=2.5, b=33, hp=800, max_len=1.6, decay_db=22, min_gap=1.0, fixed=1.2), [353416], st=-21, hp=500, fout=0.2,
    note='two seagull calls (beach background high-passed away at 500 Hz)')
sfx('crow', ev('56233', 3, a=6.0, b=30, hp=300, max_len=1.0, decay_db=24, min_gap=0.6), [56233], st=-21, hp=200, fout=0.1,
    note='three crow caws from a field recording')
sfx('siren_far', [C('469363', 8.0, 15.0)], [469363], st=-24, fin=0.8, fout=1.2, note='7 s of a distant ambulance siren')
sfx('train_door', [C('209969', 13.40, 15.40)], [209969], st=-20, fout=0.25, note='a train door closing (from inside)')

# ================================================================ weather & electrical & anomaly
amb('research_facility', bed('474832', 200.0, 60.0, 3.0, hp=50), [474832], rms=-38, extras=True,
    note='60 s of an air-conditioned engineering lab full of servers (fans, hum), high-passed at 50 Hz')
amb('wind_open', bed('165526', 15.0, 50.0, 3.0, hp=60), [165526], rms=-36, extras=True,
    note='50 s of wind blowing and howling on a mountain top at night (Schoeps MS), high-passed at 60 Hz')

sfx('thunder_far', [C('581125', 3.3, 11.3)], [581125], st=-22, fin=0.5, fout=1.5, jitter=0.05, note='a distant roll of thunder')


def gust(a, b):
    return lambda: envelope(cut('344887', a, b), [(0, -40), (1.2, 0), (b - a - 1.8, -1), (b - a, -40)])


sfx('wind_gust', [gust(3.0, 7.0), gust(11.5, 15.5)], [344887], st=-22, fin=0.05, fout=0.3, note='two 4 s gusts shaped out of a strong-wind recording (swell in, fall away)')
sfx('light_buzz', [C('125064', 0.20, 2.60)], [125064], st=-21, fout=0.6, note='the buzzing starter of a faulty fluorescent tube and its hum')
sfx('power_up', [C('351430', 0.25, 4.0)], [351430], st=-21, fout=1.0, note='a neon lamp switched on: click, flicker, then hum')
sfx('spark', ev('396470', 3, a=0.0, b=11.5, hp=2000, max_len=0.3, decay_db=26, min_gap=0.25, fixed=0.25), [396470], st=-22, fout=0.04,
    note='three short electric spark crackles')
sfx('blackout', [C('131599', 0.15, 2.0)], [131599], st=-18, fout=0.5, note='a large breaker switch thrown')


def crash():
    boom = cut('653294', 0.0, 4.6)
    debris = cut('703247', 0.0, 4.6)
    return mix(boom, debris * 0.7, at=0.03)


sfx('metal_crash', [crash], [653294, 703247], st=-17, fout=0.8,
    note='layered: a big structure collision heard from inside (low boom) + big falling debris (metal clatter), 4.6 s')
sfx('thud', [C('673424', 1.10, 2.10)], [673424], st=-19, fout=0.3, note='a heavy body falling onto a floor')
sfx('glass_break', [C('448004', 0.15, 3.0)], [448004], st=-19, fout=0.5, note='a window breaking')
sfx('heartbeat', ev('273150', 3, a=0.0, b=12.0, hp=30, thr=14, max_len=0.6, min_gap=0.9, fixed=0.6), [273150], st=-20, fout=0.08,
    note='three single lub-dub heartbeats')


def hum(r0, r1, env, a=30.0, dur=6.0, bright=True):
    def make():
        x = cut('144559', a, a + dur)
        y = proc.varispeed_ramp(x, r0, r1)
        n = y.shape[1]
        if bright:
            # open up from a dark hum to the full, gritty one
            dark = lowpass(y, 260, order=2)
            w = np.linspace(0, 1, n) ** 1.5
            y = dark * (1 - w) + y * w
            y = np.tanh(y * 3.0) / 3.0
        else:
            dark = lowpass(y, 260, order=2)
            w = np.linspace(1, 0, n) ** 0.7
            y = dark * (1 - w) + y * w
        return envelope(y, env)
    return make


sfx('hum_rise', [hum(0.8, 1.02, [(0, -60), (0.6, -18), (3.0, -4.4), (4.2, 0), (4.5, -60), (8, -60)])], [144559], st=-20, fout=0.05, jitter=0.01, trim_db=-50,
    note='a transformer hum, sped up from 0.8x to 1.02x (pitch rising ~4 semitones), brightening and swelling for 4.2 s, then cut')
sfx('hum_fall', [hum(1.0, 0.7, [(0, 0), (0.4, -2), (2.4, -14), (3.6, -60), (8, -60)], bright=False)], [144559], st=-20, fout=0.05, jitter=0.01, trim_db=-50,
    note='the same transformer hum slowing from 1.0x to 0.7x, darkening and dying away over 3.6 s')

sfx('umbrella', [C('201538', 3.13, 4.10)], [201538], st=-21, hp=100, limit=14, peak=-6, fout=0.2,
    note='an umbrella snapped open; leading silence shortened and sub-100 Hz handling rumble removed')
sfx('lighter', [C('146064', 5.0, 6.3)], [146064], st=-22, fout=0.25, note='the wheel of a Zippo lighter struck and lit')
sfx('wave', [C('578524', 3.5, 9.5)], [578524], st=-21, fin=0.8, fout=1.5, jitter=0.06, note='one calm ocean wave breaking and fizzing out')
sfx('rain_burst', [lambda: envelope(cut('56311', 30.0, 36.5), [(0, -40), (1.5, 0), (4.3, 0), (6.5, -40)])], [56311], st=-21, fin=0.05, fout=0.3,
    note='6.5 s of heavy rain with a swell in and fall away envelope')

# ================================================================ second pass: sounds that were still synthesized
# Kept as synthesis on purpose (see sounds.ts): phone_notify, phone_hangup (electronic signals), tinnitus (a tone heard
# inside the head), silence_drop (abstract, timed with the engine's ambience duck). Record what is physical; synthesize
# what is electronic or abstract.
sfx('train_horn', [C('574427', 0.3, 8.2)], [574427], st=-20, fin=0.3, fout=1.5, hp=120, jitter=0.03,
    note='one long blast of a very distant train horn (stereo spaced EM172s, birds underneath), 0.3–8.2 s, high-passed at 120 Hz')
sfx('station_chime', [C('816010', 4.45, 8.6)], [816010], st=-21, fin=0.005, fout=0.4, jitter=0, wet=0.3,
    note='a two-note (G–E) public-address chime, the second of the four in the recording')
sfx('truck_reverse', [C('567294', 10.95, 13.65)], [567294], st=-21, fin=0.1, fout=0.35, hp=150, jitter=0.01,
    note='three reversing beeps of a truck in an urban alley at 6 am, engine underneath (stereo EM172s), 10.95–13.65 s')
sfx('relay_click', ev('807384', 3, a=3.0, b=20.0, hp=300, thr=18, max_len=0.25, decay_db=30, min_gap=0.15), [807384], st=-21, peak=-4, limit=12, fout=0.03,
    note='single clicks of a Siemens motor contactor closing and opening, cut from a longer take')
sfx('tools_clink', [C('849365', 1.46, 1.74), C('849365', 12.75, 12.98), C('395886', 3.08, 3.58)], [849365, 395886], st=-23, peak=-6, hp=200, fout=0.04,
    note='a small metal piece set down on a metal workbench: a warm ring (washer) and two brighter, longer tinks')
sfx('box_open', [C('470630', 0.80, 1.75), C('792553', 0.15, 1.10), C('185054', 0.85, 2.10)], [470630, 792553, 185054], st=-21, peak=-6, limit=12, hp=140, fout=0.12,
    note='three metal-box lid interactions: a tin opening before its lid falls, a sliding tin lid, and the opening portion of a small money box; high-passed at 140 Hz to remove handling rumble')
sfx('box_close', [C('11551', 0.03, 0.25)], [11551], st=-21, peak=-6, limit=12, hp=80, fout=0.03,
    note='a small metal hand-cream tin snapped shut; separated from box_open so closing scenes never play a lid-opening slide')
sfx('truck_pass_quiet', [C('207118', 0.5, 4.1), C('532071', 11.2, 15.2)], [207118, 532071], st=-25, hp=150, fin=0.6, fout=0.9, move=(-60, 60, 1.4),
    note='a vehicle rolling past close on a quiet lane, almost all tyre noise; and a real electric mail van creeping past, a pebble ticking in its tyre')
sfx('tape_hiss', [C('150005', 2.0, 8.0), C('150005', 9.0, 15.0)], [150005], st=-28, hp=500, fin=0.3, fout=0.3,
    note='6 s of hiss from a blank cassette playing on a tape deck, high-passed at 500 Hz to drop deck rumble')
sfx('memory_keep', [C('691805', 0.0, 1.40), C('536550', 0.0, 1.60), C('209581', 0.08, 1.20)], [691805, 536550, 209581], st=-23, hp=300, fout=0.4,
    note='a softly plucked kalimba note (G4) and a middle-C kalimba note; a finger-plucked wine-glass rim')
sfx('focus_shift', [C('495390', 1.38, 2.10), C('495390', 2.76, 3.42), C('495390', 5.04, 5.66)], [495390], st=-24, hp=200, fin=0.01, fout=0.15,
    note='light whooshes of a jacket moved close to the mic, high-passed at 200 Hz (three takes)')
sfx('choice_appear', [C('418396', 0.72, 1.16), C('810068', 0.22, 0.62), lambda: highpass(cut('489763', 0.215, 0.40), 300)], [418396, 810068, 489763], st=-26, hp=150, limit=14, fin=0.03, fout=0.1,
    note='a small in-breath through the mouth (woman); a soft mouth inhale; lips parting')
sfx('title_tone', [C('616335', 0.0, 8.0)], [616335], st=-20, fin=1.2, fout=3.0, rate=0.71, jitter=0,
    note='a large singing bowl struck with a soft stick, its hum faded in and left to decay; played at rate 0.71 (~110 Hz)')
sfx('laugh_soft', [C('72695', 98.82, 99.62), C('399931', 21.0, 22.0)], [72695, 399931], st=-22, hp=120, fin=0.005, fout=0.08,
    note="an adult woman's soft closed-mouth laugh through the nose (two takes)")
sfx('laugh_soft_m', [C('643665', 0.10, 1.15), C('643665', 4.30, 5.40)], [643665], st=-22, hp=70, fin=0.02, fout=0.1,
    note="a young man's quiet closed-mouth chuckle through the nose (two takes)")
sfx('sigh', [C('663651', 0.24, 1.98), C('501339', 2.08, 3.40)], [663651, 501339], st=-23, hp=150, fin=0.1, fout=0.3,
    note="a woman's quiet sigh: a quick breath in and a slow breath out; and an exhale-only sigh")
sfx('sigh_m', [C('449438', 3.40, 5.50), C('449438', 7.05, 8.85), C('449438', 10.45, 11.95)], [449438], st=-23, hp=80, fin=0.05, fout=0.3,
    note="a middle-aged man's quiet, tired exhale (three takes)")
sfx('breath', [C('627854', 0.45, 2.25), C('627854', 23.90, 26.45), C('627854', 21.80, 23.30)], [627854], st=-25, hp=100, fin=0.1, fout=0.25,
    note='one close, calm breath of a young woman (three takes from the calm start of the recording)')
sfx('breath_m', [C('512741', 0.15, 2.30), C('512741', 4.88, 6.85), C('512741', 7.17, 9.40)], [512741], st=-25, hp=100, fin=0.1, fout=0.25,
    note='one slow, close breath of a young man, in and out (three takes)')
sfx('huddle_rustle', [C('269760', 14.25, 17.25), C('435296', 48.25, 51.25), C('435296', 54.0, 57.0)], [269760, 435296], st=-26, hp=150, limit=12, fin=0.4, fout=0.6,
    note='people leaning in to talk, heard without their words: clothes rubbing and shifting (three passages)')
