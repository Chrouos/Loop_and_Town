import type { Pos } from '../src/script/types';
import { DECOY_SAME_MAX, Director, HOLD_PER_BAND, decoyGain } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

const chapter = (beats: string, sceneExtra = '') => `
chapter: 1
title: 測試
start: s1
advance:
  - if: "true"
    to: 1
scenes:
  - id: s1
${sceneExtra}    beats:
${beats.trim().split('\n').map((line) => `      ${line}`).join('\n')}
      - pause: 30
      - end: reset
`;

type Played = { id: string; gain?: number; pos?: Pos; t: number };

function rig(source: string, options: { taught?: string[]; tension?: number } = {}) {
  const { script, errors } = buildScript([{ name: 'a.yaml', source }]);
  expect(errors).toEqual([]);
  const played: Played[] = [];
  const vib: string[] = [];
  let save: GameSave = { ...freshSave(), started: true, scene: 's1', taught: options.taught ?? ['locate', 'approach', 'hold'], tension: options.tension ?? 0 };
  let director!: Director;
  const audio = { ...silentAudio(), play: (id: string, pos?: Pos, o?: { gain?: number }) => { played.push({ id, gain: o?.gain, pos, t: director.view.t }); } };
  director = new Director(script, save, { audio: audio as never, vibrate: (id) => { vib.push(id); }, persist: (next) => { save = next; }, wallNow: () => 0 });
  director.start();
  const run = (ms: number) => { for (let t = 0; t < ms; t += 50) director.tick(50); };
  const until = (type: string) => { for (let i = 0; i < 600 && director.view.interact?.type !== type; i++) run(50); };
  return { director, played, vib, run, until, save: () => save };
}

const flags = (director: Director, names: string[]) => [...director.loopFlags].filter((name) => names.includes(name));

// ───────────────────────── decoys ─────────────────────────

describe('locate decoys', () => {
  const locate = (decoys: string, extra = '') => chapter(`
- locate:
    sfx: hum_rise
    at: right
    decoys: ${decoys}
    tries: 2${extra}
    success:
      - set: found
    fail:
      - set: lost`);

  it('a decoy takes its own gain, scaled by what her tension does to the others', () => {
    const { director, played, run, until } = rig(locate('[{ sfx: light_buzz, at: left, gain: 0.5 }]'));
    until('locate');
    run(3000);
    const decoy = played.find((entry) => entry.id === 'light_buzz')!;
    expect(decoy.gain).toBeCloseTo(0.5 * 0.8);
    expect(director.view.interact?.type).toBe('locate');
  });

  it('the same sound as the target never comes louder than 0.7 of it, even in a panic', () => {
    for (const tension of [0, 40, 60, 90]) {
      const { played, run, until } = rig(locate('[{ sfx: hum_rise, at: left, gain: 1.5 }]'), { tension });
      until('locate');
      run(6000);
      const target = played.filter((entry) => entry.id === 'hum_rise' && entry.pos?.dir === 'right');
      const decoys = played.filter((entry) => entry.id === 'hum_rise' && entry.pos?.dir === 'left');
      expect(target.length).toBeGreaterThan(0);
      expect(decoys.length).toBeGreaterThan(0);
      for (const decoy of decoys) expect(decoy.gain!).toBeLessThanOrEqual(DECOY_SAME_MAX * target[0].gain! + 1e-9);
    }
  });

  it('with lag, the same-sound cap is measured against the target as it is played there', () => {
    const { played, run, until } = rig(locate('[{ sfx: hum_rise, at: left }]', '\n    lag: 0.25'), { tension: 90 });
    until('locate');
    run(2500);
    const target = played.find((entry) => entry.id === 'hum_rise' && entry.pos?.dir === 'right')!;
    const decoy = played.find((entry) => entry.id === 'hum_rise' && entry.pos?.dir === 'left')!;
    expect(decoy.gain!).toBeLessThanOrEqual(DECOY_SAME_MAX * target.gain! + 1e-9);
  });

  it('a different sound is not capped', () => {
    expect(decoyGain({ sfx: 'a' }, { sfx: 'b', gain: 1.5 }, 1.15, 0.5)).toBeCloseTo(1.725);
    expect(decoyGain({ sfx: 'a' }, { sfx: 'a', gain: 1.5 }, 1.15, 0.5)).toBeCloseTo(0.35);
  });

  it('the validator keeps a locate gain, and each decoy gain, in range', () => {
    const errors = (source: string) => buildScript([{ name: 'a.yaml', source }]).errors.join('\n');
    expect(errors(locate('[{ sfx: light_buzz, at: left, gain: 2 }]'))).toMatch(/decoys\[0\]\.gain/);
    expect(errors(locate('[{ sfx: light_buzz, at: left, gain: 0 }]'))).toMatch(/decoys\[0\]\.gain/);
    expect(errors(locate('[{ sfx: light_buzz, at: left }]', '\n    gain: 0.01'))).toMatch(/locate 的 gain/);
    expect(errors(locate('[{ sfx: light_buzz, at: left, gain: 1.2 }]', '\n    gain: 0.55'))).toBe('');
  });
});

// ───────────────────────── tension makes it harder ─────────────────────────

describe('tension and the hands-and-ears moments', () => {
  const HOLD = chapter(`
- hold:
    seconds: 4
    timeout: 5
    sfx: hum_rise
    at: right
    success:
      - set: held
    fail:
      - set: slipped`);

  it('a hold asks 0.75 s more per band, and its window grows by as much', () => {
    for (const [tension, band] of [[0, 0], [40, 1], [60, 2], [90, 3]] as const) {
      const { director } = rig(HOLD, { tension });
      for (let i = 0; i < 600 && director.view.interact?.type !== 'hold'; i++) director.tick(50);
      const view = director.view.interact;
      expect(view?.type === 'hold' && view.seconds).toBeCloseTo(4 + HOLD_PER_BAND * band);
    }
  });

  it('in a panic, 4.5 s of breath is not enough, 6.3 s is, and a 5 s window still leaves room for it', () => {
    const short = rig(HOLD, { tension: 90 });
    short.until('hold');
    short.director.holdStart();
    short.run(4500);
    expect(short.director.view.interact?.type).toBe('hold');
    short.director.holdEnd();

    const long = rig(HOLD, { tension: 90 });
    long.until('hold');
    long.run(700);
    long.director.holdStart();
    long.run(6400);
    expect(flags(long.director, ['held', 'slipped'])).toEqual(['held']);
  });

  it('a panicked hold she never manages still ends (failure never stalls the day)', () => {
    const { director, run, until } = rig(HOLD, { tension: 95 });
    until('hold');
    run(9000);
    expect(director.view.interact).toBeNull();
    expect(flags(director, ['held', 'slipped'])).toEqual(['slipped']);
  });

  const APPROACH = chapter(`
- approach:
    sfx: step
    at: front
    steps: 6
    interval: 0.8
    hit:
      - set: hit
    early:
      - set: early
    late:
      - set: late`);

  it('approach: calm, the last two steps count; panicked, only the very last one does', () => {
    // Steps land at 0.7 s + i × 0.8 s: the fifth (i = 4) at 3.9 s, the sixth at 4.7 s.
    for (const [tension, waitMs, flag] of [[0, 4000, 'hit'], [90, 4000, 'early'], [90, 4800, 'hit'], [90, 6600, 'late']] as const) {
      const { director, run, until } = rig(APPROACH, { tension });
      until('approach');
      run(waitMs);
      director.approachCall();
      run(100);
      expect(flags(director, ['hit', 'early', 'late'])).toEqual([flag]);
    }
  });

  it('approach: the hand feels only the steps that count', () => {
    for (const [tension, taps] of [[0, 2], [90, 1]] as const) {
      const { vib, run, until } = rig(APPROACH, { tension });
      until('approach');
      run(9000);
      expect(vib.filter((id) => id === 'tap').length).toBe(taps);
    }
  });
});

// ───────────────────────── first-time lessons ─────────────────────────

describe('teaching locate, approach and hold once', () => {
  const TWO_LOCATES = chapter(`
- locate:
    sfx: hum_rise
    at: right
    tries: 2
    success:
      - set: one
    fail:
      - set: one
- locate:
    sfx: hum_rise
    at: left
    tries: 2
    success:
      - set: two
    fail:
      - set: two`);

  it('the first locate ever says how it works and is remembered at once; the next one does not', () => {
    const { director, run, until, save } = rig(TWO_LOCATES, { taught: [] });
    until('locate');
    const first = director.view.interact;
    expect(first?.type === 'locate' && first.lesson).toBe(true);
    expect(save().taught).toContain('locate');
    director.locatePick('right');
    run(200);
    until('locate');
    const second = director.view.interact;
    expect(second?.type === 'locate' && second.key).not.toBe(first?.key);
    expect(second?.type === 'locate' && second.lesson).toBeUndefined();
  });

  it('an approach being taught waits for the lesson to be read before the steps start', () => {
    const APPROACH = chapter(`
- approach:
    sfx: step
    at: front
    steps: 6
    interval: 0.8
    hit:
      - set: hit
    early:
      - set: early
    late:
      - set: late`);
    for (const [waitMs, flag] of [[4000, 'early'], [7100, 'hit']] as const) {
      const { director, run, until, save } = rig(APPROACH, { taught: [] });
      until('approach');
      expect(director.view.interact?.type === 'approach' && director.view.interact.lesson).toBe(true);
      expect(save().taught).toContain('approach');
      run(waitMs);
      director.approachCall();
      run(100);
      expect(flags(director, ['hit', 'early', 'late'])).toEqual([flag]);
    }
  });

  it('a hold being taught gets the same reading time on its window', () => {
    const HOLD = chapter(`
- hold:
    seconds: 2
    timeout: 3
    success:
      - set: held
    fail:
      - set: slipped`);
    const { director, run, until } = rig(HOLD, { taught: [] });
    until('hold');
    expect(director.view.interact?.type === 'hold' && director.view.interact.lesson).toBe(true);
    run(3500);
    expect(director.view.interact?.type).toBe('hold');
    director.holdStart();
    run(2100);
    expect(flags(director, ['held', 'slipped'])).toEqual(['held']);
  });

  it('a line written `teach: approach` says it first, waits for a tap, and the walk itself does not say it again', () => {
    const source = chapter(`
- { narr: 有人從前面走過來。, teach: approach }
- approach:
    sfx: step
    at: front
    steps: 6
    interval: 0.8
    hit:
      - set: hit
    early:
      - set: early
    late:
      - set: late`);
    const { director, run, until, save } = rig(source, { taught: [] });
    for (let i = 0; i < 400 && director.view.teach !== 'approach'; i++) run(50);
    expect(director.view.teach).toBe('approach');
    expect(save().taught).toContain('approach');
    run(10000);
    // Held, like the other lessons, until the player goes on.
    expect(director.view.interact).toBeNull();
    expect(director.view.teach).toBe('approach');
    director.hurry();
    until('approach');
    expect(director.view.teach).toBeNull();
    expect(director.view.interact?.type === 'approach' && director.view.interact.lesson).toBeUndefined();
  });

  it('a lesson line nobody taps goes on by itself', () => {
    const source = chapter(`
- { narr: 聽。, teach: locate }
- set: past`);
    const { director, run } = rig(source, { taught: [] });
    run(30000);
    expect(director.loopFlags.has('past')).toBe(true);
  });

  it('only the moments that exist can be taught', () => {
    const errors = buildScript([{ name: 'a.yaml', source: chapter('- { narr: 打。, teach: punch }') }]).errors.join('\n');
    expect(errors).toMatch(/teach 只能是/);
  });
});

// ───────────────────────── the slate ─────────────────────────

describe('a wrong dot on the slate', () => {
  const PUNCH = chapter(`
- punch:
    cells: [[1, 4, 5]]`);

  it('slips with a rustle and a short buzz, and punches nothing', () => {
    const { director, played, vib, until } = rig(PUNCH);
    until('punch');
    played.length = 0;
    director.punchMiss();
    expect(played.map((entry) => entry.id)).toEqual(['cloth_rustle']);
    expect(vib).toEqual(['buzz']);
    expect(director.view.interact?.type).toBe('punch');
  });

  it('keeps the hand still when vibration is off', () => {
    const { director, vib, until } = rig(PUNCH);
    until('punch');
    director.updateSettings({ vibration: false });
    director.punchMiss();
    expect(vib).toEqual([]);
  });
});

// ───────────────────────── the room keeps out of the way (H-03) ─────────────────────────

describe('background life during a hands-and-ears moment', () => {
  const LIFE = `    life:
      - { text: 嗡, sfx: hum_rise, at: [back] }
      - { text: 咳, sfx: cough, at: [front] }
      - { text: 叮, sfx: light_buzz, at: [back] }
`;
  const LOCATE = (before = '') => chapter(`
- pause: 8${before}
- locate:
    sfx: hum_rise
    at: right
    decoys: [{ sfx: light_buzz, at: left }]
    tries: 2
    timeout: 30
    success:
      - set: found
    fail:
      - set: lost`, LIFE);

  it('no stranger starts up, labelled or not, while she points; the room comes back after', () => {
    const { director, played, run, until } = rig(LOCATE());
    until('locate');
    const from = director.view.t;
    const labels = new Set(director.view.periph.map((item) => item.key));
    for (let i = 0; i < 400; i++) {
      run(50);
      expect(director.view.periph.filter((item) => (item.kind === 'life' || item.kind === 'sfx') && !labels.has(item.key))).toEqual([]);
    }
    const during = played.filter((entry) => entry.t >= from);
    expect(during.filter((entry) => entry.id === 'cough')).toEqual([]);
    expect(during.filter((entry) => entry.id === 'hum_rise' && entry.pos?.dir !== 'right')).toEqual([]);
    expect(during.filter((entry) => entry.id === 'light_buzz' && entry.pos?.dir !== 'left')).toEqual([]);
    director.locatePick('right');
    const after = played.length;
    run(20000);
    expect(played.slice(after).some((entry) => entry.id === 'cough' || (entry.id === 'hum_rise' && entry.pos?.dir === 'back'))).toBe(true);
  });

  it('a scripted panic keeps sounding, but without labels and never with the sounds she is sorting out', () => {
    const { director, played, run, until } = rig(LOCATE('\n- noise: heavy'));
    until('locate');
    const from = director.view.t;
    const labels = new Set(director.view.periph.map((item) => item.key));
    for (let i = 0; i < 400; i++) {
      run(50);
      expect(director.view.periph.filter((item) => (item.kind === 'life' || item.kind === 'sfx') && !labels.has(item.key))).toEqual([]);
    }
    const during = played.filter((entry) => entry.t >= from);
    expect(during.some((entry) => entry.id === 'cough')).toBe(true);
    expect(during.filter((entry) => entry.id === 'hum_rise' && entry.pos?.dir !== 'right')).toEqual([]);
    expect(during.filter((entry) => entry.id === 'light_buzz' && entry.pos?.dir !== 'left')).toEqual([]);
  });
});
