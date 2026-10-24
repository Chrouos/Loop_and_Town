// Synthesis recipes for every SfxId (plus a few ambient-only event sounds used by ambience.ts).
// Each recipe schedules nodes into c.out (the dry input of its spatial chain) starting at c.t, and
// returns its duration. Recipes vary pitch, timing and level a little on every play.

import type { SfxId } from './catalog';
import {
  addHit,
  chance,
  crackleBuffer,
  driveCurve,
  mulberry32,
  normalizePeak,
  perc,
  rand,
  renderBuffer,
  shape,
  sweep,
  vary,
  type NoiseKind,
  type SfxCtx,
  type SfxRecipe,
} from './core';
import { glottalWave, murmurRig } from './voice';

type Pts = ReadonlyArray<readonly [number, number]>;
type Part = readonly [ratio: number, amp: number, t60: number];

// ================================================================ building blocks

function endOf(c: SfxCtx, ...ends: number[]): number {
  return Math.max(c.t + 0.05, ...ends) - c.t;
}

function envGain(c: SfxCtx, dest: AudioNode, t: number, peak: number, att: number, t60: number): GainNode {
  const g = c.g.gain(0);
  perc(g.gain, t, peak, att, t60);
  g.connect(dest);
  return g;
}

function shaped(c: SfxCtx, dest: AudioNode, t: number, pts: Pts): GainNode {
  const g = c.g.gain(0);
  shape(g.gain, t, pts);
  g.connect(dest);
  return g;
}

function last(pts: Pts): number {
  return pts.length ? pts[pts.length - 1]![0] : 0;
}

/** A bus that feeds the dry chain and (additionally) the reverb send. */
function wetDry(c: SfxCtx, wet: number, dest: AudioNode = c.out): GainNode {
  const n = c.g.gain(1);
  n.connect(dest);
  if (wet > 0) {
    const w = c.g.gain(wet);
    n.connect(w).connect(c.send);
  }
  return n;
}

/** Sweep a stereo pan (no-op on the PannerNode fallback). */
function panSweep(n: AudioNode & { pan?: AudioParam }, from: number, to: number, t0: number, t1: number): void {
  if (!n.pan) return;
  n.pan.setValueAtTime(from, t0);
  n.pan.linearRampToValueAtTime(to, t1);
}

/** Lowpass in front of a destination. */
function lp(c: SfxCtx, f: number, dest: AudioNode = c.out, q = 0.6): BiquadFilterNode {
  const n = c.g.filter('lowpass', f, q);
  n.connect(dest);
  return n;
}

interface NB {
  kind?: NoiseKind;
  type?: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  att?: number;
  t60: number;
  level: number;
  rate?: number;
}

/** Filtered noise with a percussive envelope. */
function nburst(c: SfxCtx, dest: AudioNode, t: number, o: NB): number {
  const att = o.att ?? 0.002;
  const end = t + att + o.t60 + 0.03;
  const src = c.g.noise(o.kind ?? 'white', t, end, o.rate ?? 1);
  const f = c.g.filter(o.type ?? 'bandpass', o.f, o.q ?? 1);
  if (o.f2 !== undefined) sweep(f.frequency, t, o.f, [[att + o.t60 * 0.7, o.f2]]);
  src.connect(f).connect(envGain(c, dest, t, o.level, att, o.t60));
  return end;
}

interface NS {
  kind?: NoiseKind;
  type?: BiquadFilterType;
  f: number;
  q?: number;
  fpts?: Pts;
  pts: Pts;
  rate?: number;
}

/** Filtered noise with an arbitrary gain shape (and optional filter sweep). */
function nshape(c: SfxCtx, dest: AudioNode, t: number, o: NS): number {
  const dur = last(o.pts);
  const end = t + dur + 0.02;
  const src = c.g.noise(o.kind ?? 'pink', t, end, o.rate ?? 1);
  const f = c.g.filter(o.type ?? 'bandpass', o.f, o.q ?? 0.8);
  if (o.fpts) sweep(f.frequency, t, o.f, o.fpts);
  src.connect(f).connect(shaped(c, dest, t, o.pts));
  return end;
}

/** Sine thump with a pitch drop (the "body" of impacts, steps, hearts). */
function thump(c: SfxCtx, dest: AudioNode, t: number, f0: number, f1: number, t60: number, level: number, att = 0.003): number {
  const end = t + att + t60 + 0.03;
  const o = c.g.osc('sine', f0, t, end);
  sweep(o.frequency, t, f0, [[Math.max(0.01, t60 * 0.6), f1]]);
  o.connect(envGain(c, dest, t, level, att, t60));
  return end;
}

/** Additive inharmonic partials with individual decays (bells, glass, porcelain, metal). */
function modal(
  c: SfxCtx,
  dest: AudioNode,
  t: number,
  f0: number,
  parts: readonly Part[],
  level: number,
  o: { att?: number; beat?: number } = {},
): number {
  let end = t;
  const nyq = c.g.ac.sampleRate * 0.45;
  for (const [ratio, amp, t60] of parts) {
    const f = f0 * ratio;
    if (f > nyq || f < 20) continue;
    const e = t + (o.att ?? 0.001) + t60 + 0.05;
    const g = envGain(c, dest, t, level * amp * (o.beat ? 0.6 : 1), o.att ?? 0.001, t60);
    c.g.osc('sine', f * vary(1, 0.002), t, e).connect(g);
    if (o.beat) c.g.osc('sine', f + rand(0.3, 1) * o.beat * (chance(0.5) ? 1 : -1), t, e).connect(g);
    end = Math.max(end, e);
  }
  return end;
}

/** A partial bank that keeps ringing and is re-excited at each strike (bike bells, rods, spoons). */
function struck(
  c: SfxCtx,
  dest: AudioNode,
  f0: number,
  parts: readonly Part[],
  strikes: ReadonlyArray<readonly [time: number, level: number]>,
): number {
  if (!strikes.length) return c.t;
  const first = strikes[0]![0];
  const lastStrike = strikes[strikes.length - 1]![0];
  let end = first;
  const nyq = c.g.ac.sampleRate * 0.45;
  for (const [ratio, amp, t60] of parts) {
    const f = f0 * ratio;
    if (f > nyq) continue;
    const e = lastStrike + t60 + 0.05;
    const g = c.g.gain(0);
    g.gain.setValueAtTime(0, first);
    for (const [s, lv] of strikes) {
      g.gain.setTargetAtTime(lv * amp, s, 0.0015);
      g.gain.setTargetAtTime(0, s + 0.005, t60 / 6.9);
    }
    c.g.osc('sine', f, first, e).connect(g).connect(dest);
    end = Math.max(end, e);
  }
  return end;
}

/** One noise source + filter, excited by a train of short hits (keys, ratchets, ticks, tiny rattles). */
function clickTrain(
  c: SfxCtx,
  dest: AudioNode,
  strikes: ReadonlyArray<readonly [time: number, level: number]>,
  o: { f: number; q?: number; t60: number; type?: BiquadFilterType; kind?: NoiseKind; att?: number },
): number {
  if (!strikes.length) return c.t;
  const first = strikes[0]![0];
  const end = strikes[strikes.length - 1]![0] + o.t60 + 0.05;
  const src = c.g.noise(o.kind ?? 'white', first, end);
  const f = c.g.filter(o.type ?? 'bandpass', o.f, o.q ?? 2);
  const g = c.g.gain(0);
  const att = o.att ?? 0.0015;
  g.gain.setValueAtTime(0, first);
  for (const [s, lv] of strikes) {
    g.gain.setTargetAtTime(lv, s, att / 3);
    g.gain.setTargetAtTime(0, s + att, o.t60 / 6.9);
  }
  src.connect(f).connect(g).connect(dest);
  return end;
}

/** A slice of the crackle buffer (grit, paper, sizzle, static, droplets). */
function crackle(
  c: SfxCtx,
  dest: AudioNode,
  t: number,
  o: { type?: BiquadFilterType; f: number; q?: number; pts: Pts; rate?: number },
): number {
  const buf = crackleBuffer(c.g.ac);
  const end = t + last(o.pts) + 0.02;
  const src = c.g.buffer(buf, t, { t1: end, loop: true, rate: o.rate ?? 1, offset: Math.random() * (buf.duration - 0.1) });
  const f = c.g.filter(o.type ?? 'highpass', o.f, o.q ?? 0.7);
  src.connect(f).connect(shaped(c, dest, t, o.pts));
  return end;
}

/** Short mid/high click (latches, switches, plastic). */
function click(c: SfxCtx, dest: AudioNode, t: number, f: number, level: number, q = 1.5, t60 = 0.008): number {
  return nburst(c, dest, t, { f, q, att: 0.0006, t60, level });
}

/** Water drop "plop": an upward-chirping bubble resonance. */
function droplet(c: SfxCtx, dest: AudioNode, t: number, f: number, level: number): number {
  const end = t + 0.08;
  const o = c.g.osc('sine', f, t, end);
  sweep(o.frequency, t, f, [[0.02, f * rand(1.4, 1.9)]]);
  o.connect(envGain(c, dest, t, level, 0.001, rand(0.025, 0.05)));
  return end;
}

/** Stick-slip friction (door hinges, chairs, floorboards): a jittery low pulse train through body resonances. */
function creak(
  c: SfxCtx,
  dest: AudioNode,
  t: number,
  dur: number,
  o: { f0: number; f1: number; level: number; bright: number; jitter?: number },
): number {
  const end = t + dur + 0.05;
  const src = c.g.osc('sawtooth', o.f0, t, end);
  src.frequency.setValueAtTime(o.f0, t);
  const steps = Math.max(3, Math.floor(dur / 0.06));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const target = (o.f0 + (o.f1 - o.f0) * k) * vary(1, o.jitter ?? 0.25);
    src.frequency.setTargetAtTime(Math.max(4, target), t + (dur * (i - 1)) / steps, (dur / steps) * 0.45);
  }
  const amp = c.g.gain(0);
  const pts: [number, number][] = [[0, 0]];
  const segs = Math.max(2, Math.floor(dur / 0.12));
  for (let i = 1; i < segs; i++) pts.push([(dur * i) / segs, o.level * rand(0.45, 1)]);
  pts.push([dur, 0]);
  shape(amp.gain, t, pts);
  amp.connect(dest);
  const bodies: Array<readonly [number, number, number]> = [
    [o.bright * 0.45, 6, 0.9],
    [o.bright, 9, 0.8],
    [o.bright * 1.85, 10, 0.45],
  ];
  for (const [f, q, a] of bodies) src.connect(c.g.filter('bandpass', f, q)).connect(c.g.gain(a)).connect(amp);
  return end;
}

function footstep(c: SfxCtx, dest: AudioNode, t: number, o: { weight?: number; bright?: number; level: number; toe?: boolean }): number {
  const p = c.p;
  const w = o.weight ?? 1;
  const b = o.bright ?? 1;
  const lv = o.level * rand(0.72, 1);
  const e1 = thump(c, dest, t, vary(92, 0.15) * w * p, 46 * w * p, vary(0.07, 0.2), 0.5 * lv);
  const e2 = nburst(c, dest, t, { kind: 'pink', type: 'lowpass', f: vary(900, 0.25) * b * p, q: 0.8, t60: vary(0.06, 0.25), level: 0.55 * lv });
  const e3 = nburst(c, dest, t + rand(0.008, 0.025), {
    type: 'bandpass',
    f: vary(2600, 0.3) * b * p,
    q: 1.1,
    att: 0.004,
    t60: vary(0.045, 0.3),
    level: rand(0.08, 0.18) * lv,
  });
  let e4 = t;
  if (o.toe !== false)
    e4 = nburst(c, dest, t + rand(0.05, 0.09), { kind: 'pink', type: 'bandpass', f: vary(1300, 0.2) * b * p, q: 0.9, t60: vary(0.04, 0.2), level: 0.22 * lv });
  return Math.max(e1, e2, e3, e4);
}

// --------------------------------------------------------------- pre-rendered buffers

function watchBuffer(ac: BaseAudioContext): AudioBuffer {
  return renderBuffer(ac, 'watch', 3.2, 1, ([d], sr) => {
    const rnd = mulberry32(17);
    for (let k = 0; k < 19; k++) {
      const at = 0.05 + k / 6 + (k % 2 ? 0.007 : 0);
      const a = k % 2 ? 0.8 : 1;
      addHit(d!, sr, at, [
        [5600, a, 0.006],
        [8300, 0.5 * a, 0.004],
        [3100, 0.35 * a, 0.009],
        [1500, 0.15 * a, 0.012],
      ], 0.35 * a, 0.0015, rnd);
    }
    normalizePeak(d!, 0.8);
  });
}

function phoneRingBuffer(ac: BaseAudioContext): AudioBuffer {
  return renderBuffer(ac, 'phone_ring', 1.85, 1, ([d], sr) => {
    const rnd = mulberry32(5);
    const a: [number, number, number][] = [[1040, 1, 0.38], [2390, 0.35, 0.2], [3850, 0.16, 0.11]];
    const b: [number, number, number][] = [[1270, 0.9, 0.38], [2910, 0.3, 0.18], [4620, 0.12, 0.1]];
    for (const [s0, s1] of [[0.02, 0.42], [0.62, 1.02]] as const) {
      for (let s = s0; s < s1; s += 1 / 22) {
        addHit(d!, sr, s, a.map(([f, amp, t60]) => [f, amp * (0.8 + rnd() * 0.2), t60] as const), 0.05, 0.002, rnd);
        addHit(d!, sr, s + 1 / 44, b.map(([f, amp, t60]) => [f, amp * (0.8 + rnd() * 0.2), t60] as const), 0.05, 0.002, rnd);
      }
    }
    normalizePeak(d!, 0.8);
  });
}

/**
 * One clock's tick-tock as a seamless loop (2 beats). Used by clock_shop and the police office.
 * `body` adds a low wooden case resonance (pendulum clocks).
 */
export function clockBuffer(ac: BaseAudioContext, key: string, bps: number, f: number, body: number, seed: number): AudioBuffer {
  const period = 1 / bps;
  return renderBuffer(ac, `clock:${key}`, period * 2, 1, ([d], sr) => {
    const rnd = mulberry32(seed);
    const err = (rnd() * 2 - 1) * 0.035;
    const hit = (at: number, ff: number, a: number): void =>
      addHit(d!, sr, at, [
        [ff, a, 0.01],
        [ff * 2.31, 0.45 * a, 0.006],
        [ff * 3.7, 0.2 * a, 0.004],
        [ff * 0.42, body * a, 0.035],
      ], 0.4 * a, 0.0012, rnd, true);
    hit(0.004, f, 1);
    hit(0.004 + period * (1 + err), f * (0.9 + rnd() * 0.06), 0.78 + rnd() * 0.15);
    normalizePeak(d!, 0.9);
  });
}

// ================================================================ SFX

const metalSmall: Part[] = [[1, 1, 0.09], [2.42, 0.55, 0.06], [4.1, 0.3, 0.035]];

function stepRecipe(o: { weight?: number; bright?: number; level?: number; heels?: boolean }): SfxRecipe {
  return {
    play(c) {
      const t = c.t;
      if (o.heels) {
        const d = wetDry(c, 0.12);
        const lv = rand(0.75, 1);
        // A bright, short heel strike with just enough body to keep it grounded.
        const e1 = click(c, d, t, vary(3800, 0.12) * c.p, 0.62 * lv, 2.2, 0.018);
        const e2 = modal(c, d, t, vary(2350, 0.08) * c.p, [[1, 1, 0.03], [2.2, 0.4, 0.018]], 0.08 * lv);
        const e3 = thump(c, d, t, 210 * c.p, 125 * c.p, 0.028, 0.11 * lv);
        const e4 = click(c, d, t + rand(0.06, 0.09), vary(4400, 0.12) * c.p, 0.22 * lv, 1.5, 0.012);
        return endOf(c, e1, e2, e3, e4);
      }
      return endOf(c, footstep(c, c.out, t, { weight: o.weight, bright: o.bright, level: o.level ?? 1 }));
    },
  };
}

// Keep existing male timbres independent when refining the other vocal effects.
function maleSigh(c: SfxCtx): number {
  const t = c.t;
  const e1 = nshape(c, c.out, t, { kind: 'pink', type: 'bandpass', f: 1300, q: 1.1, fpts: [[1.5, 650]], pts: [[0, 0], [0.35, 0.22], [0.8, 0.15], [1.55, 0]] });
  const f0 = vary(150, 0.15) * c.p * 0.62;
  const v = c.g.osc(glottalWave(c.g.ac), f0, t + 0.2, t + 1.5);
  sweep(v.frequency, t + 0.2, f0, [[1.2, f0 * 0.75]]);
  v.connect(lp(c, 650, shaped(c, c.out, t + 0.2, [[0, 0], [0.3, 0.035], [1.2, 0]])));
  return endOf(c, e1, t + 1.6);
}

function maleChuckle(c: SfxCtx): number {
  const t = c.t;
  const n = 3 + Math.floor(Math.random() * 2);
  let e = t;
  let f0 = rand(190, 230) * c.p * 0.58;
  for (let i = 0; i < n; i++) {
    const s = t + i * vary(0.17, 0.1);
    const lv = 1 - i * 0.18;
    nburst(c, c.out, s, { kind: 'white', type: 'bandpass', f: 1400, q: 1, att: 0.01, t60: 0.1, level: 0.08 * lv });
    const v = c.g.osc(glottalWave(c.g.ac), f0, s + 0.01, s + 0.22);
    sweep(v.frequency, s + 0.01, f0, [[0.12, f0 * 0.9]]);
    const g = envGain(c, c.out, s + 0.01, 0.06 * lv, 0.02, 0.12);
    v.connect(c.g.filter('bandpass', 750, 4)).connect(g);
    v.connect(c.g.filter('bandpass', 1250, 5)).connect(g);
    f0 *= 0.95;
    e = s + 0.25;
  }
  return endOf(c, e);
}

export const SFX_RECIPES: Record<SfxId, SfxRecipe> = {
  // ------------------------------------------------------------ people & movement
  step: stepRecipe({}),
  step_heels: stepRecipe({ heels: true }),
  step_run: {
    play(c) {
      let t = c.t;
      let e = t;
      const n = 4;
      for (let i = 0; i < n; i++) {
        e = Math.max(e, footstep(c, c.out, t, { weight: 1.1, bright: 1.2, level: 0.85 + 0.1 * Math.sin(i), toe: false }));
        // scuffy push-off
        e = Math.max(e, nburst(c, c.out, t + 0.04, { type: 'bandpass', f: vary(1800, 0.2), q: 0.8, t60: 0.08, level: 0.12 }));
        t += vary(0.27, 0.08);
      }
      return endOf(c, e);
    },
  },
  step_wet: {
    play(c) {
      const t = c.t;
      const e1 = footstep(c, c.out, t, { weight: 0.9, bright: 0.8, level: 0.7, toe: false });
      const e2 = nburst(c, c.out, t + 0.005, { type: 'highpass', f: vary(1800, 0.2), q: 0.7, att: 0.006, t60: vary(0.14, 0.2), level: 0.22 });
      const e3 = nburst(c, c.out, t + 0.01, { type: 'bandpass', f: 500, f2: 1500, q: 4, att: 0.01, t60: 0.08, level: 0.18 });
      let e4 = t;
      const n = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) e4 = Math.max(e4, droplet(c, c.out, t + rand(0.01, 0.17), rand(1100, 3000) * c.p, rand(0.02, 0.06)));
      return endOf(c, e1, e2, e3, e4);
    },
  },
  cane_tap: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.22); // the tap's echo off nearby walls is the point of it
      const e1 = click(c, d, t, vary(3600, 0.12) * c.p, 0.5, 1, 0.012);
      const e2 = modal(c, d, t, vary(1150, 0.05) * c.p, [[1, 0.5, 0.09], [2.76, 0.3, 0.06], [5.4, 0.15, 0.04]], 0.09);
      const e3 = thump(c, d, t, 320 * c.p, 210 * c.p, 0.02, 0.14);
      return endOf(c, e1, e2, e3);
    },
  },
  door_open: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.12);
      const e1 = click(c, d, t, vary(2200, 0.1), 0.28, 3, 0.012);
      const e2 = click(c, d, t + rand(0.04, 0.06), vary(1500, 0.1), 0.2, 2, 0.015);
      const e3 = modal(c, d, t, vary(1800, 0.06), [[1, 1, 0.05], [2.4, 0.5, 0.04]], 0.04);
      const e4 = nshape(c, d, t + 0.08, { kind: 'pink', type: 'lowpass', f: 450, pts: [[0, 0], [0.25, 0.11], [0.9, 0.05], [1.25, 0]] });
      let e5 = t;
      if (chance(0.35)) e5 = creak(c, d, t + 0.15, rand(0.4, 0.7), { f0: 35, f1: 60, level: 0.1, bright: 1500 });
      return endOf(c, e1, e2, e3, e4, e5);
    },
  },
  door_close: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.12);
      const hit = t + vary(0.95, 0.06);
      const e1 = nshape(c, d, t, { kind: 'pink', type: 'lowpass', f: 650, pts: [[0, 0], [0.2, 0.13], [hit - t - 0.04, 0.16], [hit - t, 0]] });
      const e2 = thump(c, d, hit, 90 * c.p, 55 * c.p, 0.3, 0.65);
      const e3 = nburst(c, d, hit, { kind: 'pink', type: 'bandpass', f: vary(300, 0.12), q: 0.9, t60: 0.2, level: 0.5 });
      const e4 = click(c, d, hit + 0.025, vary(1300, 0.1), 0.38, 1.1, 0.025);
      const e5 = modal(c, d, hit, vary(330, 0.08), [[1, 1, 0.28], [1.7, 0.45, 0.19], [2.9, 0.2, 0.1]], 0.08);
      const e6 = click(c, d, hit + 0.065, 950 * c.p, 0.12, 1, 0.018);
      const e7 = click(c, d, t + 0.02, 1700 * c.p, 0.2, 1.2, 0.018);
      const e8 = click(c, d, t + 0.09, 1100 * c.p, 0.14, 1, 0.022);
      return endOf(c, e1, e2, e3, e4, e5, e6, e7, e8);
    },
  },
  door_creak: {
    play(c) {
      const dur = rand(1.3, 2.0);
      return endOf(c, creak(c, wetDry(c, 0.15), c.t, dur, { f0: rand(16, 24) * c.p, f1: rand(45, 65) * c.p, level: 0.5, bright: vary(1100, 0.15), jitter: 0.3 }));
    },
  },
  door_slam: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.5);
      const hit = t + 0.12;
      const e0 = nshape(c, d, t, { kind: 'pink', type: 'lowpass', f: 700, pts: [[0, 0], [0.1, 0.16], [0.12, 0.05]] });
      const e1 = thump(c, d, hit, 62 * c.p, 34 * c.p, 0.35, 1.0);
      const e2 = nburst(c, d, hit, { kind: 'pink', type: 'lowpass', f: 1300, t60: 0.25, level: 0.85 });
      const e3 = nburst(c, d, hit, { type: 'bandpass', f: 420, q: 1, t60: 0.1, level: 0.55 });
      const e4 = modal(c, d, hit + 0.01, vary(310, 0.1), [[1, 1, 0.3], [1.7, 0.6, 0.25], [2.9, 0.4, 0.2]], 0.07, { beat: 1.5 });
      const e5 = clickTrain(c, d, [[hit + 0.04, 0.2], [hit + 0.09, 0.12], [hit + 0.13, 0.07]], { f: 2400, q: 3, t60: 0.02 });
      return endOf(c, e0, e1, e2, e3, e4, e5);
    },
  },
  shop_bell: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.25);
      const parts: Part[] = [[1, 1, 0.9], [2.02, 0.45, 0.6], [2.76, 0.32, 0.45], [4.1, 0.16, 0.3]];
      const bells = [1560, 1840, 2210].map((f) => f * vary(1, 0.01) * c.p);
      let e = t;
      // one bell carries the first, strongest strike; the rest rattle on their spring
      const strikesPer: Array<Array<readonly [number, number]>> = bells.map(() => []);
      strikesPer[0]!.push([t, 0.09]);
      let s = t + rand(0.05, 0.09);
      let lv = 0.07;
      for (let i = 0; i < 6; i++) {
        strikesPer[Math.floor(Math.random() * bells.length)]!.push([s, lv * rand(0.6, 1)]);
        s += rand(0.06, 0.15);
        lv *= 0.72;
      }
      bells.forEach((f, i) => {
        const strikes = strikesPer[i]!.sort((a, b) => a[0] - b[0]);
        if (strikes.length) e = Math.max(e, struck(c, d, f, parts, strikes));
      });
      return endOf(c, e);
    },
  },
  key_jingle: {
    play(c) {
      const t = c.t;
      const d = lp(c, 5200);
      let e = t;
      const n = 10 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) {
        const s = t + (i < n / 2 ? rand(0, 0.25) : rand(0.3, 0.65));
        e = Math.max(e, modal(c, d, s, rand(1100, 3400) * c.p, [[1, 1, rand(0.015, 0.035)], [1.57, 0.35, 0.018], [2.19, 0.2, 0.01]], rand(0.012, 0.025)));
        e = Math.max(e, click(c, d, s, rand(1400, 2800) * c.p, rand(0.08, 0.14), 0.7, rand(0.006, 0.012)));
      }
      e = Math.max(e, nshape(c, d, t, { kind: 'white', type: 'bandpass', f: 1800, q: 0.5, pts: [[0, 0], [0.05, 0.025], [0.25, 0.008], [0.32, 0.022], [0.7, 0]] }));
      return endOf(c, e);
    },
  },
  lock_turn: {
    play(c) {
      const t = c.t;
      const e1 = nburst(c, c.out, t, { kind: 'pink', type: 'bandpass', f: 1300, f2: 800, q: 0.8, att: 0.04, t60: 0.26, level: 0.14 });
      const s = t + vary(0.42, 0.08);
      const e2 = click(c, c.out, s, 1300 * c.p, 0.65, 0.8, 0.025);
      const e3 = modal(c, c.out, s, vary(850, 0.05) * c.p, [[1, 1, 0.055], [2.3, 0.3, 0.025]], 0.05);
      const e4 = thump(c, c.out, s + 0.002, 260 * c.p, 150 * c.p, 0.065, 0.32, 0.001);
      const e5 = nburst(c, c.out, s, { type: 'bandpass', f: 700, q: 0.8, t60: 0.035, level: 0.3 });
      const e6 = click(c, c.out, s + 0.045, 1800 * c.p, 0.2, 1, 0.012);
      return endOf(c, e1, e2, e3, e4, e5, e6);
    },
  },
  chair_scrape: {
    play(c) {
      const t = c.t;
      const dur = rand(0.45, 0.85);
      const d = wetDry(c, 0.12);
      const f0 = rand(90, 140) * c.p;
      const e1 = creak(c, d, t, dur, { f0, f1: f0 * rand(0.8, 1.3), level: 0.3, bright: vary(900, 0.2), jitter: 0.15 });
      const e2 = nshape(c, d, t, { kind: 'pink', type: 'bandpass', f: 700, q: 2.5, fpts: [[dur, rand(500, 1100)]], pts: [[0, 0], [0.04, 0.12], [dur * 0.7, 0.09], [dur, 0]] });
      const e3 = thump(c, d, t + dur + 0.02, 120, 80, 0.05, 0.18);
      return endOf(c, e1, e2, e3);
    },
  },
  drawer: {
    play(c) {
      const t = c.t;
      const dur = rand(0.38, 0.55);
      const pts: [number, number][] = [[0, 0]];
      for (let i = 1; i < 8; i++) pts.push([(dur * i) / 8, rand(0.08, 0.16)]);
      pts.push([dur, 0.02]);
      const e1 = nshape(c, c.out, t, { kind: 'brown', type: 'lowpass', f: 650, pts });
      const e2 = nshape(c, c.out, t, { kind: 'pink', type: 'bandpass', f: 1300, q: 2, pts: [[0, 0], [0.05, 0.03], [dur, 0.015], [dur + 0.02, 0]] });
      const e3 = thump(c, c.out, t + dur, 140 * c.p, 90 * c.p, 0.06, 0.25);
      const e4 = nburst(c, c.out, t + dur, { type: 'bandpass', f: 500, q: 1.4, t60: 0.05, level: 0.22 });
      let e5 = t;
      if (chance(0.6)) e5 = modal(c, c.out, t + dur + 0.02, rand(2500, 4500), metalSmall, 0.02);
      return endOf(c, e1, e2, e3, e4, e5);
    },
  },
  cloth_rustle: {
    play(c) {
      const t = c.t;
      let e = t;
      const n = 3 + Math.floor(Math.random() * 3);
      let s = t;
      for (let i = 0; i < n; i++) {
        const len = rand(0.08, 0.24);
        e = Math.max(e, nshape(c, c.out, s, { kind: 'white', type: 'bandpass', f: rand(1800, 4200), q: 0.7, pts: [[0, 0], [len * 0.25, rand(0.04, 0.08)], [len, 0]] }));
        s += len * rand(0.5, 0.9);
      }
      return endOf(c, e);
    },
  },
  // people leaning in to talk, heard without their words: cloth and small shifts of weight
  huddle_rustle: {
    play(c) {
      let e = c.t;
      for (let s = c.t; s < c.t + 2.4; s += rand(0.3, 0.7)) e = Math.max(e, s + SFX_RECIPES.cloth_rustle.play({ ...c, t: s }));
      return endOf(c, e);
    },
  },
  gasp_crowd: {
    play(c) {
      const t = c.t;
      const bus = wetDry(c, 0.35);
      let e = t;
      for (let i = 0; i < 7; i++) {
        const s = t + rand(0, 0.12);
        const pan = c.g.pan(rand(-0.9, 0.9));
        pan.connect(bus);
        e = Math.max(e, nshape(c, pan, s, { kind: 'white', type: 'bandpass', f: rand(1300, 2200), q: 1, pts: [[0, 0], [0.07, 0.07], [0.22, 0.04], [0.32, 0]] }));
        const f0 = rand(210, 380) * c.p;
        const v = c.g.osc(glottalWave(c.g.ac), f0, s + 0.08, s + 1.0);
        sweep(v.frequency, s + 0.08, f0, [[0.2, f0 * 1.18], [0.8, f0 * 0.85]]);
        const f1 = c.g.filter('bandpass', rand(500, 650), 4);
        const f2 = c.g.filter('bandpass', rand(850, 1050), 5);
        const g = shaped(c, pan, s + 0.08, [[0, 0], [0.1, rand(0.03, 0.05)], [0.45, 0.018], [0.9, 0]]);
        v.connect(f1).connect(g);
        v.connect(f2).connect(g);
        e = Math.max(e, s + 1.0);
      }
      for (let i = 0; i < 3; i++) {
        const pan = c.g.pan(rand(-0.8, 0.8));
        pan.connect(bus);
        const rig = murmurRig(c.g, pan, t + 0.6, t + 2.8, { pitch: rand(110, 230), breath: 0.4, level: 0.05, bright: 1200, rate: 4.5 });
        rig.speak(t + 0.8 + rand(0, 0.3), 1.6);
      }
      return endOf(c, e, t + 2.8);
    },
  },
  cough: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.055);
      // One glottal release: compressed air first, then an irregular voiced throat tail.
      const s = t + 0.055;
      const e0 = nshape(c, d, t, { kind: 'pink', type: 'bandpass', f: 1400, q: 0.8, pts: [[0, 0], [0.015, 0.04], [0.035, 0.02], [0.045, 0]] });
      const e1 = nshape(c, d, s, {
        kind: 'white', type: 'bandpass', f: 1800 * c.p, q: 0.65,
        fpts: [[0.045, 1200 * c.p], [0.14, 800 * c.p]],
        pts: [[0, 0], [0.002, 0.9], [0.018, 0.72], [0.05, 0.3], [0.105, 0.06], [0.16, 0]],
      });
      const e2 = nshape(c, d, s, { kind: 'pink', type: 'bandpass', f: 500 * c.p, q: 0.8, pts: [[0, 0], [0.004, 0.45], [0.022, 0.28], [0.065, 0.1], [0.115, 0]] });
      const throat = s + 0.045;
      const f0 = vary(145, 0.12) * c.p;
      const v = c.g.osc(glottalWave(c.g.ac), f0, throat, throat + 0.15);
      sweep(v.frequency, throat, f0, [[0.035, f0 * 0.83], [0.12, f0 * 0.65]]);
      c.g.lfo(v.frequency, 29, 9 * c.p, throat, throat + 0.15);
      const voice = shaped(c, d, throat, [[0, 0], [0.008, 0.12], [0.018, 0.025], [0.028, 0.1], [0.04, 0.02], [0.052, 0.06], [0.08, 0.018], [0.13, 0]]);
      v.connect(c.g.filter('bandpass', 550 * c.p, 1.1)).connect(voice);
      v.connect(c.g.filter('bandpass', 1450 * c.p, 1.5)).connect(c.g.gain(0.5)).connect(voice);
      v.connect(c.g.filter('bandpass', 2600 * c.p, 1.8)).connect(c.g.gain(0.2)).connect(voice);
      const e3 = nshape(c, d, s + 0.14, { kind: 'pink', type: 'bandpass', f: 1100 * c.p, q: 0.7, pts: [[0, 0], [0.02, 0.08], [0.07, 0.025], [0.14, 0]] });
      return endOf(c, e0, e1, e2, throat + 0.15, e3);
    },
  },
  sigh: {
    play(c) {
      const t = c.t;
      const e0 = nshape(c, c.out, t, { kind: 'white', type: 'bandpass', f: 1800 * c.p, q: 0.65, pts: [[0, 0], [0.07, 0.14], [0.15, 0.08], [0.21, 0]] });
      const s = t + 0.26;
      const e1 = nshape(c, c.out, s, { kind: 'pink', type: 'bandpass', f: 1000 * c.p, q: 0.65, fpts: [[0.6, 700 * c.p], [1.3, 450 * c.p]], pts: [[0, 0], [0.035, 0.38], [0.17, 0.28], [0.6, 0.16], [1.05, 0.045], [1.35, 0]] });
      const e2 = nshape(c, c.out, s, { kind: 'white', type: 'bandpass', f: 2200 * c.p, q: 0.65, pts: [[0, 0], [0.04, 0.18], [0.2, 0.14], [0.7, 0.06], [1.1, 0]] });
      const f0 = vary(210, 0.08) * c.p;
      const v = c.g.osc(glottalWave(c.g.ac), f0, s, s + 0.3);
      sweep(v.frequency, s, f0, [[0.1, f0 * 0.9], [0.28, f0 * 0.72]]);
      const g = shaped(c, c.out, s, [[0, 0], [0.025, 0.045], [0.08, 0.025], [0.16, 0.01], [0.28, 0]]);
      v.connect(c.g.filter('bandpass', 650 * c.p, 1)).connect(g);
      v.connect(c.g.filter('bandpass', 1300 * c.p, 1.3)).connect(c.g.gain(0.35)).connect(g);
      return endOf(c, e0, e1, e2, s + 0.3);
    },
  },
  sigh_m: { play: maleSigh },
  breath_m: { play: (c) => SFX_RECIPES.breath.play(c) }, // breath is unpitched noise; only a recording tells them apart
  breath: {
    play(c) {
      const t = c.t;
      const e1 = nshape(c, c.out, t, { kind: 'white', type: 'bandpass', f: 1700, q: 1.4, fpts: [[0.9, 2300]], pts: [[0, 0], [0.5, 0.1], [0.85, 0.08], [1.0, 0]] });
      const s = t + vary(1.15, 0.08);
      const e2 = nshape(c, c.out, s, { kind: 'pink', type: 'bandpass', f: 950, q: 1, fpts: [[1.2, 600]], pts: [[0, 0], [0.15, 0.16], [0.8, 0.07], [1.3, 0]] });
      return endOf(c, e1, e2);
    },
  },
  laugh_soft: {
    play(c) {
      const t = c.t;
      const n = chance(0.45) ? 3 : 2;
      let e = t;
      let s = t;
      const base = vary(225, 0.1) * c.p;
      for (let i = 0; i < n; i++) {
        const len = rand(0.13, 0.17);
        const lv = (1 - i * 0.22) * rand(0.85, 1);
        const f0 = base * rand(0.94, 1.06);
        const breath = nburst(c, c.out, s, { kind: 'pink', type: 'bandpass', f: 1800 * c.p, q: 0.65, att: 0.008, t60: 0.08, level: 0.13 * lv });
        const v = c.g.osc(glottalWave(c.g.ac), f0, s + 0.006, s + len);
        sweep(v.frequency, s + 0.006, f0, [[0.03, f0 * 1.05], [len - 0.02, f0 * 0.87]]);
        c.g.lfo(v.frequency, 19, 3 * c.p, s + 0.006, s + len);
        const g = shaped(c, c.out, s, [[0, 0], [0.012, 0.12 * lv], [0.036, 0.08 * lv], [0.08, 0.035 * lv], [len, 0]]);
        v.connect(c.g.filter('bandpass', 320 * c.p, 1.2)).connect(g);
        v.connect(c.g.filter('bandpass', 1500 * c.p, 1.7)).connect(c.g.gain(0.25)).connect(g);
        v.connect(c.g.filter('bandpass', 2400 * c.p, 1.8)).connect(c.g.gain(0.15)).connect(g);
        e = Math.max(e, breath, s + len + 0.03);
        s += len + rand(0.035, 0.075);
      }
      return endOf(c, e);
    },
  },
  laugh_soft_m: { play: maleChuckle },
  // until the recording is decoded: three small sharp clicks
  braille_stylus: {
    play(c) {
      let end = c.t;
      for (let i = 0; i < 3; i++) end = Math.max(end, c.t + i * 0.28 + SFX_RECIPES.relay_click.play({ ...c, t: c.t + i * 0.28, p: c.p * 1.4 }));
      return end - c.t;
    },
  },
  kid_laugh: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.25);
      const n = 5 + Math.floor(Math.random() * 3);
      let e = t;
      let f0 = rand(340, 400) * c.p;
      for (let i = 0; i < n; i++) {
        const s = t + i * vary(0.13, 0.12);
        const lv = i < 2 ? 0.8 + i * 0.2 : 1 - (i - 2) * 0.14;
        nburst(c, d, s, { kind: 'white', type: 'bandpass', f: 2200, q: 1, att: 0.008, t60: 0.07, level: 0.05 * lv });
        const v = c.g.osc(glottalWave(c.g.ac), f0, s + 0.01, s + 0.17);
        sweep(v.frequency, s + 0.01, f0 * 1.05, [[0.09, f0 * 0.92]]);
        const g = envGain(c, d, s + 0.01, 0.06 * lv, 0.015, 0.09);
        v.connect(c.g.filter('bandpass', 950, 4)).connect(g);
        v.connect(c.g.filter('bandpass', 1750, 5)).connect(g);
        f0 *= i < 2 ? 1.06 : 0.96;
        e = s + 0.2;
      }
      return endOf(c, e);
    },
  },

  // ------------------------------------------------------------ objects
  paper_rustle: {
    play(c) {
      const t = c.t;
      const dur = rand(0.45, 0.75);
      const pts: [number, number][] = [[0, 0]];
      for (let i = 1; i < 7; i++) pts.push([(dur * i) / 7, rand(0.06, 0.28)]);
      pts.push([dur, 0]);
      const e1 = nshape(c, c.out, t, { kind: 'white', type: 'bandpass', f: 2600, q: 0.6, pts });
      const e2 = crackle(c, c.out, t, { type: 'highpass', f: 2500, pts: [[0, 0], [0.03, 0.1], [dur * 0.6, 0.07], [dur, 0]] });
      return endOf(c, e1, e2);
    },
  },
  page_turn: {
    play(c) {
      const t = c.t;
      const e1 = nshape(c, c.out, t, { kind: 'white', type: 'bandpass', f: 2800, q: 0.8, fpts: [[0.25, 5000]], pts: [[0, 0], [0.08, 0.07], [0.22, 0.11], [0.32, 0]] });
      const e2 = crackle(c, c.out, t, { type: 'highpass', f: 3000, pts: [[0, 0], [0.05, 0.12], [0.25, 0]] });
      const s = t + vary(0.3, 0.08);
      const e3 = nburst(c, c.out, s, { kind: 'pink', type: 'lowpass', f: 750, t60: 0.05, level: 0.14 });
      const e4 = thump(c, c.out, s, 190, 120, 0.03, 0.08);
      return endOf(c, e1, e2, e3, e4);
    },
  },
  envelope: {
    play(c) {
      const t = c.t;
      const e1 = nshape(c, c.out, t, { kind: 'white', type: 'bandpass', f: 1900, q: 0.9, fpts: [[0.6, 2600]], pts: [[0, 0], [0.1, 0.1], [0.45, 0.16], [0.7, 0]] });
      const e2 = crackle(c, c.out, t, { type: 'highpass', f: 2200, pts: [[0, 0], [0.1, 0.05], [0.6, 0.03], [0.7, 0]] });
      const s = t + 0.8;
      const e3 = crackle(c, c.out, s, { type: 'bandpass', f: 2600, q: 0.8, rate: 0.7, pts: [[0, 0], [0.03, 0.18], [0.22, 0.12], [0.3, 0]] });
      const e4 = nburst(c, c.out, s + 0.3, { kind: 'pink', type: 'lowpass', f: 900, t60: 0.05, level: 0.1 });
      const e5 = nshape(c, c.out, s, { kind: 'white', type: 'bandpass', f: 2600, q: 0.8, pts: [[0, 0], [0.03, 0.11], [0.22, 0.08], [0.3, 0]] });
      return endOf(c, e1, e2, e3, e4, e5);
    },
  },
  pen_scratch: {
    play(c) {
      const t = c.t;
      const dur = rand(1.3, 1.8);
      const end = t + dur + 0.05;
      const src = c.g.noise('white', t, end);
      const f = c.g.filter('bandpass', 3800, 2.5);
      const g = c.g.gain(0);
      g.gain.setValueAtTime(0, t);
      let s = t;
      while (s < t + dur - 0.1) {
        const len = rand(0.05, 0.18);
        const lv = rand(0.05, 0.11);
        f.frequency.setTargetAtTime(rand(3000, 5200) * c.p, s, 0.01);
        g.gain.setTargetAtTime(lv, s, 0.005);
        g.gain.setTargetAtTime(lv * 0.5, s + len * 0.6, 0.01);
        g.gain.setTargetAtTime(0, s + len, 0.008);
        s += len + (chance(0.15) ? rand(0.12, 0.25) : rand(0.01, 0.05));
      }
      src.connect(f).connect(g).connect(c.out);
      return endOf(c, end);
    },
  },
  cup_set: {
    play(c) {
      const t = c.t;
      const f0 = vary(2100, 0.06) * c.p;
      const parts: Part[] = [[1, 1, 0.25], [1.58, 0.6, 0.18], [2.31, 0.45, 0.12], [3.1, 0.3, 0.08]];
      const e1 = modal(c, c.out, t, f0, parts, 0.08);
      const e2 = click(c, c.out, t, 4200, 0.3, 1, 0.006);
      const e3 = thump(c, c.out, t, 230, 160, 0.04, 0.18);
      const e4 = chance(0.6) ? modal(c, c.out, t + rand(0.025, 0.05), f0 * 1.01, parts, 0.025) : t;
      return endOf(c, e1, e2, e3, e4);
    },
  },
  spoon_stir: {
    play(c) {
      const t = c.t;
      const n = 5 + Math.floor(Math.random() * 3);
      const strikes: Array<readonly [number, number]> = [];
      let s = t;
      for (let i = 0; i < n; i++) {
        strikes.push([s, rand(0.03, 0.06)]);
        s += rand(0.2, 0.32);
      }
      const e1 = struck(c, c.out, vary(3200, 0.08) * c.p, [[1, 1, 0.12], [2.4, 0.5, 0.08], [3.9, 0.3, 0.05]], strikes);
      const e2 = clickTrain(c, c.out, strikes.map(([x, lv]) => [x, lv * 2] as const), { f: 5500, q: 1, t60: 0.006 });
      const e3 = nshape(c, c.out, t, { kind: 'pink', type: 'bandpass', f: 600, q: 2, pts: [[0, 0], [0.2, 0.025], [s - t, 0.02], [s - t + 0.2, 0]] });
      return endOf(c, e1, e2, e3);
    },
  },
  coffee_grind: {
    play(c) {
      const t = c.t;
      const dur = rand(2.6, 3.2);
      const end = t + dur + 0.4;
      const m = c.g.osc('sawtooth', 60, t, end);
      sweep(m.frequency, t, 60, [[0.25, 118 * c.p], [dur, 112 * c.p], [dur + 0.35, 50]]);
      const env: Pts = [[0, 0], [0.25, 1], [dur, 0.9], [dur + 0.35, 0]];
      m.connect(lp(c, 900, shaped(c, c.out, t, env.map(([a, b]) => [a, b * 0.06] as const))));
      const e2 = crackle(c, c.out, t, { type: 'bandpass', f: 2200, q: 0.7, rate: 1.6, pts: env.map(([a, b]) => [a, b * 0.35] as const) });
      const e3 = nshape(c, c.out, t, { kind: 'pink', type: 'bandpass', f: 1200, q: 0.5, pts: env.map(([a, b]) => [a, b * 0.05] as const) });
      return endOf(c, end, e2, e3);
    },
  },
  steam_hiss: {
    play(c) {
      const t = c.t;
      const dur = rand(2.0, 2.8);
      const env: Pts = [[0, 0], [0.15, 1], [dur * 0.5, 0.85], [dur - 0.3, 0.9], [dur, 0]];
      const e1 = nshape(c, c.out, t, { kind: 'white', type: 'highpass', f: 3000, q: 0.7, pts: env.map(([a, b]) => [a, b * 0.15] as const) });
      const e2 = nshape(c, c.out, t, { kind: 'white', type: 'bandpass', f: 6500, q: 1.5, pts: env.map(([a, b]) => [a, b * 0.05] as const) });
      const e3 = crackle(c, c.out, t, { type: 'lowpass', f: 900, pts: env.map(([a, b]) => [a, b * 0.25] as const) });
      return endOf(c, e1, e2, e3);
    },
  },
  kettle: {
    play(c) {
      const t = c.t;
      const dur = 4.5;
      const e1 = nshape(c, c.out, t, { kind: 'brown', type: 'lowpass', f: 400, pts: [[0, 0.05], [2, 0.15], [dur, 0.18], [dur + 0.3, 0]] });
      const e2 = crackle(c, c.out, t, { type: 'bandpass', f: 1200, q: 0.8, rate: 0.6, pts: [[0, 0.05], [2.5, 0.25], [dur, 0.3], [dur + 0.3, 0]] });
      const wf = vary(1950, 0.05) * c.p;
      const w = c.g.osc('sine', wf, t + 1.2, t + dur + 0.4);
      sweep(w.frequency, t + 1.2, wf, [[dur - 1.2, wf * 1.2]]);
      c.g.lfo(w.frequency, 5.5, 14, t + 1.2, t + dur + 0.4);
      w.connect(shaped(c, c.out, t + 1.2, [[0, 0], [1.5, 0.012], [dur - 1.2, 0.05], [dur - 0.9, 0]]));
      const e3 = nshape(c, c.out, t + 1.2, { kind: 'white', type: 'bandpass', f: wf * 1.1, q: 25, pts: [[0, 0], [1.5, 0.1], [dur - 1.2, 0.2], [dur - 0.9, 0]] });
      return endOf(c, e1, e2, e3, t + dur + 0.4);
    },
  },
  glass_clink: {
    play(c) {
      const t = c.t;
      const f0 = vary(2900, 0.05) * c.p;
      const parts: Part[] = [[1, 1, 0.6], [2.32, 0.5, 0.4], [4.25, 0.3, 0.25], [6.63, 0.15, 0.15]];
      const e1 = modal(c, c.out, t, f0, parts, 0.06, { beat: 2 });
      const e2 = modal(c, c.out, t + rand(0, 0.004), f0 * rand(1.05, 1.1), parts, 0.035);
      const e3 = click(c, c.out, t, 6500, 0.18, 1, 0.004);
      return endOf(c, e1, e2, e3);
    },
  },
  camera_shutter: {
    play(c) {
      const t = c.t;
      const one = (s: number, f: number, lv: number): number => {
        const e1 = nburst(c, c.out, s, { type: 'bandpass', f: f * c.p, q: 1.2, att: 0.001, t60: 0.035, level: 0.38 * lv });
        const e2 = nburst(c, c.out, s, { type: 'bandpass', f: 1200 * c.p, q: 2, att: 0.0008, t60: 0.05, level: 0.3 * lv });
        const e3 = thump(c, c.out, s, 140, 90, 0.06, 0.22 * lv, 0.002);
        const e4 = modal(c, c.out, s, 4300 * c.p, [[1, 1, 0.03], [2.1, 0.6, 0.025]], 0.035 * lv);
        return Math.max(e1, e2, e3, e4);
      };
      const e1 = one(t, 3200, 1);
      const e2 = one(t + rand(0.07, 0.1), 3900, 0.8);
      return endOf(c, e1, e2);
    },
  },
  strap_click: {
    play(c) {
      const t = c.t;
      const parts: Part[] = [[1, 1, 0.05], [1.7, 0.6, 0.04], [2.9, 0.4, 0.025]];
      const e1 = modal(c, c.out, t, vary(5200, 0.1) * c.p, parts, 0.06);
      const e2 = click(c, c.out, t, 7000, 0.12, 1, 0.004);
      const e3 = chance(0.4) ? modal(c, c.out, t + rand(0.03, 0.06), vary(4800, 0.1) * c.p, parts, 0.03) : t;
      return endOf(c, e1, e2, e3);
    },
  },
  watch_tick: {
    play(c) {
      const t = c.t;
      const buf = watchBuffer(c.g.ac);
      const dur = Math.min(buf.duration, 3.1);
      const src = c.g.buffer(buf, t, { t1: t + dur, rate: c.p });
      src.connect(shaped(c, c.out, t, [[0, 0], [0.4, 0.5], [dur - 0.6, 0.5], [dur, 0]]));
      return dur + 0.05;
    },
  },
  clock_chime: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.3);
      const f0 = vary(523, 0.02) * c.p;
      const parts: Part[] = [[1, 1, 2.6], [2.76, 0.45, 1.4], [5.4, 0.22, 0.8], [8.93, 0.08, 0.4]];
      const n = 3;
      const strikes: Array<readonly [number, number]> = [];
      for (let i = 0; i < n; i++) strikes.push([t + i * 1.5, 0.08]);
      const e1 = struck(c, d, f0, parts, strikes);
      const e2 = clickTrain(c, d, strikes.map(([s]) => [s, 0.12] as const), { f: 900, q: 1, t60: 0.02 });
      return endOf(c, e1, e2);
    },
  },
  clock_wind: {
    play(c) {
      const t = c.t;
      const strikes: Array<readonly [number, number]> = [];
      let s = t;
      for (let turn = 0; turn < 3; turn++) {
        const n = 5 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          strikes.push([s, rand(0.12, 0.2)]);
          s += rand(0.05, 0.075);
        }
        s += rand(0.18, 0.3);
      }
      const e1 = clickTrain(c, c.out, strikes, { f: 4500 * c.p, q: 5, t60: 0.01 });
      const e2 = clickTrain(c, c.out, strikes.map(([x, lv]) => [x, lv * 0.4] as const), { f: 9000, q: 1, type: 'highpass', t60: 0.003 });
      const e3 = nshape(c, c.out, t, { kind: 'white', type: 'highpass', f: 2500, pts: [[0, 0], [0.05, 0.01], [s - t, 0.01], [s - t + 0.05, 0]] });
      return endOf(c, e1, e2, e3);
    },
  },
  tools_clink: {
    play(c) {
      const t = c.t;
      let e = t;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const s = t + (i === 0 ? 0 : rand(0.05, 0.5));
        e = Math.max(e, modal(c, c.out, s, rand(1800, 5000) * c.p, [[1, 1, rand(0.12, 0.3)], [2.6, 0.5, 0.15], [4.2, 0.3, 0.08]], rand(0.03, 0.06)));
        e = Math.max(e, click(c, c.out, s, 5000, 0.08, 1, 0.004));
      }
      e = Math.max(e, thump(c, c.out, t, 260, 180, 0.03, 0.08));
      return endOf(c, e);
    },
  },
  box_open: {
    play(c) {
      const t = c.t;
      const e1 = thump(c, c.out, t, 120, 80, 0.05, 0.12);
      const e2 = nburst(c, c.out, t, { kind: 'pink', type: 'lowpass', f: 400, t60: 0.05, level: 0.1 });
      const e3 = creak(c, c.out, t + 0.05, rand(0.3, 0.45), { f0: 40 * c.p, f1: 75 * c.p, level: 0.14, bright: 1800 });
      const s = t + 0.55;
      const e4 = thump(c, c.out, s, 260, 180, 0.03, 0.14);
      const e5 = nburst(c, c.out, s, { type: 'bandpass', f: 900, q: 1.2, t60: 0.03, level: 0.14 });
      return endOf(c, e1, e2, e3, e4, e5);
    },
  },
  box_close: {
    play(c) {
      const t = c.t;
      const e1 = thump(c, c.out, t, 260 * c.p, 180 * c.p, 0.04, 0.22, 0.001);
      const e2 = click(c, c.out, t, 1800 * c.p, 0.3, 1.2, 0.014);
      const e3 = modal(c, c.out, t, 1200 * c.p, [[1, 1, 0.045], [2.3, 0.3, 0.025]], 0.06);
      return endOf(c, e1, e2, e3);
    },
  },
  umbrella: {
    play(c) {
      const t = c.t;
      const e1 = click(c, c.out, t, 3000, 0.22, 2, 0.01);
      const e2 = modal(c, c.out, t, 3800, [[1, 1, 0.05], [2.2, 0.5, 0.03]], 0.02);
      const e3 = nshape(c, c.out, t + 0.05, { kind: 'pink', type: 'bandpass', f: 900, q: 0.7, fpts: [[0.25, 2000]], pts: [[0, 0], [0.2, 0.22], [0.27, 0.1]] });
      const s = t + vary(0.3, 0.05);
      const e4 = nburst(c, c.out, s, { kind: 'pink', type: 'lowpass', f: 2500, t60: 0.05, level: 0.45 });
      const e5 = thump(c, c.out, s, 150, 90, 0.05, 0.28);
      const e6 = click(c, c.out, s + 0.005, 2500, 0.2, 2, 0.012);
      const e7 = nshape(c, c.out, s + 0.02, { kind: 'white', type: 'bandpass', f: 1500, q: 0.8, pts: [[0, 0.08], [0.15, 0]] });
      return endOf(c, e1, e2, e3, e4, e5, e6, e7);
    },
  },
  lighter: {
    play(c) {
      const t = c.t;
      const e1 = crackle(c, c.out, t, { type: 'bandpass', f: 4000, q: 0.9, rate: 1.4, pts: [[0, 0.6], [0.08, 0]] });
      const e2 = nburst(c, c.out, t, { type: 'highpass', f: 5000, t60: 0.04, level: 0.18 });
      const s = t + vary(0.07, 0.2);
      const e3 = nburst(c, c.out, s, { kind: 'pink', type: 'lowpass', f: 700, att: 0.01, t60: 0.12, level: 0.3 });
      const e4 = nshape(c, c.out, s, { kind: 'pink', type: 'bandpass', f: 900, q: 0.7, pts: [[0, 0], [0.1, 0.03], [0.8, 0.022], [1.0, 0]] });
      const e5 = crackle(c, c.out, s, { type: 'lowpass', f: 2000, pts: [[0, 0], [0.1, 0.06], [0.9, 0]] });
      return endOf(c, e1, e2, e3, e4, e5);
    },
  },
  typing: {
    play(c) {
      const t = c.t;
      const keys: Array<readonly [number, number]> = [];
      const spaces: Array<readonly [number, number]> = [];
      let s = t;
      const end = t + rand(2.2, 2.8);
      while (s < end) {
        const lv = rand(0.5, 1);
        if (chance(0.14)) spaces.push([s, lv]);
        else keys.push([s, lv]);
        s += chance(0.08) ? rand(0.3, 0.5) : rand(0.07, 0.19);
      }
      const e1 = clickTrain(c, c.out, keys.map(([x, l]) => [x, l * 0.35] as const), { f: 2700, q: 2, t60: 0.012 });
      const e2 = clickTrain(c, c.out, keys.map(([x, l]) => [x + 0.004, l * 0.3] as const), { f: 520, q: 1.5, t60: 0.025, kind: 'pink' });
      const e3 = clickTrain(c, c.out, spaces.map(([x, l]) => [x, l * 0.4] as const), { f: 320, q: 1.2, t60: 0.04, kind: 'pink' });
      const e4 = clickTrain(c, c.out, spaces.map(([x, l]) => [x, l * 0.2] as const), { f: 1900, q: 2, t60: 0.015 });
      return endOf(c, e1, e2, e3, e4);
    },
  },
  phone_buzz: {
    play(c) {
      const t = c.t;
      const end = t + 1.05;
      const f = 170 * c.p;
      const m = c.g.osc('sawtooth', f, t, end);
      const r = c.g.osc('square', f * 1.01, t, end);
      const env = c.g.gain(0);
      const rattle = c.g.gain(0);
      for (const [a, b] of [[0, 0.4], [0.58, 0.98]] as const) {
        m.frequency.setValueAtTime(f * 0.82, t + a);
        m.frequency.setTargetAtTime(f, t + a, 0.025);
        env.gain.setTargetAtTime(0.09, t + a, 0.01);
        env.gain.setTargetAtTime(0, t + b, 0.012);
        rattle.gain.setTargetAtTime(0.012, t + a, 0.01);
        rattle.gain.setTargetAtTime(0, t + b, 0.012);
      }
      m.connect(lp(c, 900, env));
      env.connect(c.out);
      r.connect(c.g.filter('bandpass', 2300, 2)).connect(rattle).connect(c.out);
      return endOf(c, end);
    },
  },
  phone_notify: {
    play(c) {
      const t = c.t;
      const hp = c.g.filter('highpass', 500, 0.7);
      hp.connect(c.out);
      const note = (s: number, f: number): number => {
        const e = s + 0.6;
        const g = envGain(c, hp, s, 0.09, 0.006, 0.5);
        c.g.osc('sine', f, s, e).connect(g);
        const g2 = envGain(c, hp, s, 0.018, 0.004, 0.25);
        c.g.osc('sine', f * 2, s, e).connect(g2);
        return e;
      };
      const e1 = note(t, 1318.5 * c.p);
      const e2 = note(t + 0.13, 1760 * c.p);
      return endOf(c, e1, e2);
    },
  },
  phone_ring: {
    jitter: 0.005,
    play(c) {
      const t = c.t;
      const buf = phoneRingBuffer(c.g.ac);
      const src = c.g.buffer(buf, t, { t1: t + buf.duration, rate: c.p });
      src.connect(c.g.gain(0.35)).connect(wetDry(c, 0.2));
      return buf.duration / c.p + 0.05;
    },
  },
  phone_hangup: {
    jitter: 0,
    play(c) {
      const t = c.t;
      const end = t + 0.1 + 4 * 0.7;
      const band = c.g.filter('lowpass', 3400, 0.7);
      const hp = c.g.filter('highpass', 300, 0.7);
      band.connect(hp).connect(c.out);
      const g = c.g.gain(0);
      g.connect(band);
      c.g.osc('sine', 480, t, end).connect(g);
      c.g.osc('sine', 620, t, end).connect(g);
      g.gain.setValueAtTime(0, t);
      for (let i = 0; i < 4; i++) {
        const s = t + 0.1 + i * 0.7;
        g.gain.setTargetAtTime(0.05, s, 0.003);
        g.gain.setTargetAtTime(0, s + 0.35, 0.003);
      }
      const e2 = click(c, c.out, t, 1200, 0.15, 1.5, 0.02);
      return endOf(c, end, e2);
    },
  },
  recorder_click: {
    play(c) {
      const t = c.t;
      const e1 = click(c, c.out, t, 1400 * c.p, 0.42, 1.5, 0.015);
      const e2 = thump(c, c.out, t, 240, 150, 0.04, 0.28);
      const e3 = nburst(c, c.out, t, { kind: 'pink', type: 'bandpass', f: 600, q: 1.2, t60: 0.05, level: 0.22 });
      const e4 = modal(c, c.out, t, 2700, [[1, 1, 0.06], [2.2, 0.5, 0.04]], 0.025);
      const e5 = click(c, c.out, t + rand(0.025, 0.04), 1900, 0.18, 2, 0.01);
      const m = c.g.osc('sawtooth', 80, t + 0.05, t + 0.6);
      sweep(m.frequency, t + 0.05, 80, [[0.3, 110]]);
      m.connect(lp(c, 400, shaped(c, c.out, t + 0.05, [[0, 0], [0.1, 0.012], [0.5, 0]])));
      return endOf(c, e1, e2, e3, e4, e5, t + 0.6);
    },
  },
  tape_hiss: {
    play(c) {
      const t = c.t;
      const dur = 3;
      const src = c.g.noise('pink', t, t + dur + 0.05);
      const hp = c.g.filter('highpass', 1500, 0.6);
      const pk = c.g.filter('peaking', 5000, 0.8, 4);
      const g = shaped(c, c.out, t, [[0, 0], [0.3, 0.09], [dur - 0.3, 0.09], [dur, 0]]);
      const flutter = c.g.gain(1);
      c.g.lfo(flutter.gain, 6.3, 0.08, t, t + dur);
      src.connect(hp).connect(pk).connect(flutter).connect(g);
      const hum = c.g.osc('sine', 60, t, t + dur);
      hum.connect(shaped(c, c.out, t, [[0, 0], [0.3, 0.006], [dur - 0.3, 0.006], [dur, 0]]));
      return dur + 0.05;
    },
  },
  tape_rewind: {
    play(c) {
      const t = c.t;
      const dur = rand(1.8, 2.3);
      const m = c.g.osc('sawtooth', 220 * c.p, t, t + dur);
      sweep(m.frequency, t, 220 * c.p, [[dur, 520 * c.p]]);
      m.connect(lp(c, 1200, shaped(c, c.out, t, [[0, 0], [0.15, 0.03], [dur - 0.05, 0.035], [dur, 0]])));
      const src = c.g.noise('white', t, t + dur);
      const bp = c.g.filter('bandpass', 2500, 6);
      bp.frequency.setValueAtTime(2000, t);
      for (let s = t; s < t + dur; s += 0.035) bp.frequency.setTargetAtTime(rand(1500, 4200) * c.p, s, 0.01);
      src.connect(bp).connect(shaped(c, c.out, t, [[0, 0], [0.15, 0.25], [dur - 0.05, 0.3], [dur, 0]]));
      const s = t + dur;
      const e1 = click(c, c.out, s, 1300, 0.35, 1.5, 0.02);
      const e2 = thump(c, c.out, s, 200, 130, 0.05, 0.25);
      return endOf(c, e1, e2);
    },
  },
  radio_noise: {
    play(c) {
      const t = c.t;
      const dur = rand(3.5, 4.5);
      const src = c.g.noise('pink', t, t + dur + 0.1);
      src.connect(c.g.filter('bandpass', 1100, 0.6)).connect(shaped(c, c.out, t, [[0, 0], [0.4, 0.06], [dur - 0.6, 0.05], [dur, 0]]));
      return dur + 0.1;
    },
  },
  static_burst: {
    play(c) {
      const t = c.t;
      const dur = rand(0.55, 0.9);
      const src = c.g.noise('white', t, t + dur + 0.05);
      const bp = c.g.filter('bandpass', 2500, 0.5);
      const g = c.g.gain(0);
      g.gain.setValueAtTime(0, t);
      for (let s = t + 0.005; s < t + dur; s += rand(0.01, 0.03)) g.gain.linearRampToValueAtTime(rand(0.04, 0.32), s);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      src.connect(bp).connect(g).connect(c.out);
      const e2 = crackle(c, c.out, t, { type: 'highpass', f: 1500, rate: 1.3, pts: [[0, 0], [0.005, 0.15], [dur * 0.8, 0.11], [dur, 0]] });
      return endOf(c, t + dur + 0.05, e2);
    },
  },

  // ------------------------------------------------------------ town
  train_brake: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.35);
      const dur = rand(4.5, 5.5);
      const fs = [2300, 3150, 4400].map((f) => vary(f, 0.05) * c.p);
      fs.forEach((f, i) => {
        const o = c.g.osc('sine', f, t, t + dur);
        sweep(o.frequency, t, f, [[dur, f * 0.92]]);
        c.g.lfo(o.frequency, rand(3.5, 6.5), f * rand(0.006, 0.015), t, t + dur);
        const lv = [0.05, 0.035, 0.02][i]!;
        o.connect(shaped(c, d, t, [[0, 0], [rand(0.4, 0.8), lv * 0.5], [rand(1.3, 1.7), lv], [dur * 0.65, lv * rand(0.6, 0.9)], [dur * 0.85, lv * 0.3], [dur, 0]]));
      });
      const e1 = nshape(c, d, t, { kind: 'brown', type: 'lowpass', f: 160, pts: [[0, 0], [0.2, 0.55], [dur * 0.7, 0.32], [dur + 1, 0]] });
      const e2 = nshape(c, d, t, { kind: 'pink', type: 'bandpass', f: 1100, q: 2, pts: [[0, 0], [0.4, 0.1], [dur * 0.8, 0.06], [dur, 0]] });
      const e3 = nshape(c, d, t + dur - 0.3, { kind: 'white', type: 'highpass', f: 2500, pts: [[0, 0], [0.05, 0.18], [1.1, 0]] });
      return endOf(c, e1, e2, e3);
    },
  },
  train_horn: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.5);
      const dur = rand(1.4, 1.9);
      const bus = shaped(c, lp(c, 1800, d), t, [[0, 0], [0.12, 1], [dur, 0.9], [dur + 0.45, 0]]);
      for (const f of [311, 370, 415]) {
        for (const det of [1, 1.0025]) {
          const o = c.g.osc('sawtooth', f * c.p * det * 0.97, t, t + dur + 0.5);
          o.frequency.setTargetAtTime(f * c.p * det, t, 0.04);
          o.connect(c.g.gain(0.025)).connect(bus);
        }
      }
      return dur + 0.55;
    },
  },
  train_door: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.2);
      const e1 = nburst(c, d, t, { type: 'highpass', f: 2500, att: 0.01, t60: 0.4, level: 0.22 });
      const e2 = nshape(c, d, t + 0.1, { kind: 'pink', type: 'bandpass', f: 500, q: 0.8, pts: [[0, 0], [0.15, 0.18], [0.8, 0.14], [0.95, 0]] });
      const e3 = crackle(c, d, t + 0.1, { type: 'lowpass', f: 800, pts: [[0, 0], [0.15, 0.12], [0.85, 0]] });
      const s = t + 1.05;
      const e4 = thump(c, d, s, 90, 55, 0.15, 0.5);
      const e5 = nburst(c, d, s, { kind: 'pink', type: 'lowpass', f: 900, t60: 0.12, level: 0.3 });
      return endOf(c, e1, e2, e3, e4, e5);
    },
  },
  station_chime: {
    jitter: 0,
    play(c) {
      const t = c.t;
      const pa = c.g.filter('highpass', 350, 0.7);
      const pl = c.g.filter('lowpass', 4500, 0.7);
      pa.connect(pl).connect(wetDry(c, 0.6));
      const notes = [440, 554.37, 659.25, 880];
      let e = t;
      notes.forEach((f, i) => {
        e = Math.max(e, modal(c, pa, t + i * 0.42, f * c.p, [[1, 1, 1.4], [2, 0.25, 0.8], [3, 0.08, 0.5], [4, 0.05, 0.3]], 0.07, { att: 0.004 }));
      });
      return endOf(c, e);
    },
  },
  car_pass: {
    play(c) {
      const t = c.t;
      const dur = rand(3.8, 4.8);
      const mid = t + dur * 0.5;
      const dirSign = chance(0.5) ? 1 : -1;
      c.move(-75 * dirSign, 75 * dirSign, t, t + dur, 2.2);
      const env: Pts = [[0, 0], [dur * 0.4, 0.6], [dur * 0.5, 1], [dur * 0.62, 0.6], [dur, 0]];
      const e1 = nshape(c, c.out, t, {
        kind: 'pink',
        type: 'bandpass',
        f: 450,
        q: 0.6,
        fpts: [[dur * 0.5, 1400], [dur, 550]],
        pts: env.map(([a, b]) => [a, b * 0.3] as const),
      });
      const e2 = nshape(c, c.out, t, { kind: 'brown', type: 'lowpass', f: 220, pts: env.map(([a, b]) => [a, b * 0.35] as const) });
      const eng = c.g.osc('sawtooth', 76 * c.p, t, t + dur);
      eng.frequency.setValueAtTime(76 * c.p, mid - 0.3);
      eng.frequency.linearRampToValueAtTime(63 * c.p, mid + 0.3);
      eng.connect(lp(c, 380, shaped(c, c.out, t, env.map(([a, b]) => [a, b * 0.035] as const))));
      const e3 = nshape(c, c.out, t, { kind: 'white', type: 'highpass', f: 3500, pts: [[0, 0], [dur * 0.45, 0], [dur * 0.5, 0.03], [dur * 0.58, 0]] });
      return endOf(c, e1, e2, e3);
    },
  },
  truck_pass_quiet: {
    play(c) {
      const t = c.t;
      const dur = rand(5, 6);
      const sgn = chance(0.5) ? 1 : -1;
      c.move(-60 * sgn, 60 * sgn, t, t + dur, 1.4);
      const env: Pts = [[0, 0], [dur * 0.35, 0.5], [dur * 0.5, 1], [dur * 0.65, 0.5], [dur, 0]];
      const e1 = nshape(c, c.out, t, { kind: 'pink', type: 'bandpass', f: 700, q: 0.7, fpts: [[dur * 0.5, 1200], [dur, 600]], pts: env.map(([a, b]) => [a, b * 0.14] as const) });
      const e2 = nshape(c, c.out, t, { kind: 'brown', type: 'lowpass', f: 120, pts: env.map(([a, b]) => [a, b * 0.3] as const) });
      const w = c.g.osc('sine', 1260 * c.p, t, t + dur);
      w.frequency.setValueAtTime(1260 * c.p, t + dur * 0.4);
      w.frequency.linearRampToValueAtTime(1150 * c.p, t + dur * 0.6);
      w.connect(shaped(c, c.out, t, env.map(([a, b]) => [a, b * 0.008] as const)));
      const e3 = crackle(c, c.out, t, { type: 'lowpass', f: 1800, pts: env.map(([a, b]) => [a, b * 0.06] as const) });
      return endOf(c, e1, e2, e3);
    },
  },
  truck_reverse: {
    jitter: 0.01,
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.4);
      const end = t + 4 * 0.95;
      const o = c.g.osc('square', 1050 * c.p, t, end);
      const g = c.g.gain(0);
      g.gain.setValueAtTime(0, t);
      for (let i = 0; i < 4; i++) {
        const s = t + i * 0.95;
        g.gain.setTargetAtTime(0.05, s, 0.003);
        g.gain.setTargetAtTime(0, s + 0.45, 0.004);
      }
      o.connect(c.g.filter('bandpass', 1050 * c.p, 3)).connect(g).connect(d);
      const idle = c.g.osc('sawtooth', 42, t, end + 0.3);
      idle.connect(lp(c, 200, shaped(c, d, t, [[0, 0], [0.3, 0.03], [end - t, 0.03], [end - t + 0.3, 0]])));
      return endOf(c, end + 0.3);
    },
  },
  bicycle_bell: {
    play(c) {
      const t = c.t;
      const strikes: Array<readonly [number, number]> = [];
      for (const g0 of [0, 0.42]) for (let i = 0; i < 6; i++) strikes.push([t + g0 + i * 0.032, 0.05 * (1 - i * 0.08)]);
      const e = struck(c, wetDry(c, 0.2), vary(2650, 0.02) * c.p, [[1, 1, 0.55], [1.48, 0.5, 0.35], [2.1, 0.35, 0.25]], strikes);
      return endOf(c, e);
    },
  },
  ball_bounce: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.2);
      let s = t;
      let gap = vary(0.45, 0.1);
      let a = 1;
      let e = t;
      for (let i = 0; i < 6; i++) {
        e = Math.max(e, thump(c, d, s, 175 * c.p, 120 * c.p, 0.05, 0.4 * a));
        e = Math.max(e, modal(c, d, s, 480 * c.p, [[1, 1, 0.06], [2.1, 0.3, 0.04]], 0.07 * a));
        e = Math.max(e, nburst(c, d, s, { type: 'bandpass', f: 900, q: 1, t60: 0.02, level: 0.2 * a }));
        s += gap;
        gap *= 0.72;
        a *= 0.7;
      }
      return endOf(c, e);
    },
  },
  construction_drill: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.4);
      const bursts: Array<readonly [number, number]> = [];
      let s = t;
      for (let i = 0; i < 2; i++) {
        const len = rand(1.2, 2.0);
        bursts.push([s, len]);
        s += len + rand(0.5, 0.9);
      }
      const end = s;
      const rate = rand(21, 26) * c.p;
      const src = c.g.noise('white', t, end);
      const bp = c.g.filter('bandpass', 950, 1);
      const ring = c.g.filter('bandpass', 2200, 4);
      const am = c.g.gain(0.5);
      const saw = c.g.osc('sawtooth', rate, t, end);
      saw.connect(c.g.gain(-0.5)).connect(am.gain);
      const env = c.g.gain(0);
      env.gain.setValueAtTime(0, t);
      for (const [b, len] of bursts) {
        env.gain.setTargetAtTime(0.35, b, 0.03);
        env.gain.setTargetAtTime(0, b + len, 0.05);
      }
      src.connect(bp).connect(am);
      src.connect(ring).connect(am);
      am.connect(env).connect(lp(c, 2600, d));
      const motor = c.g.osc('sawtooth', 48, t, end);
      motor.connect(lp(c, 300, env));
      return endOf(c, end + 0.3);
    },
  },
  hammer: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.35);
      let e = t;
      let s = t;
      let nail = vary(2300, 0.1) * c.p;
      for (let i = 0; i < 3; i++) {
        e = Math.max(e, thump(c, d, s, 110, 70, 0.12, 0.45));
        e = Math.max(e, nburst(c, d, s, { type: 'bandpass', f: 1600, q: 1, att: 0.0008, t60: 0.03, level: 0.45 }));
        e = Math.max(e, modal(c, d, s, nail, [[1, 1, 0.15], [2.7, 0.4, 0.1]], 0.035));
        e = Math.max(e, nburst(c, d, s, { kind: 'pink', type: 'bandpass', f: 300, q: 2, t60: 0.08, level: 0.28 }));
        nail *= 1.05;
        s += rand(0.55, 0.72);
      }
      return endOf(c, e);
    },
  },
  dog_bark: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.35);
      const n = chance(0.3) ? 3 : 2;
      let e = t;
      for (let i = 0; i < n; i++) {
        const s = t + i * vary(0.3, 0.15);
        const f0 = vary(420, 0.1) * c.p;
        const end = s + 0.25;
        const v = c.g.osc(glottalWave(c.g.ac), f0, s, end);
        sweep(v.frequency, s, f0, [[0.03, f0 * 1.08], [0.15, f0 * 0.62]]);
        const sub = c.g.osc('sawtooth', f0 * 0.5, s, end);
        sweep(sub.frequency, s, f0 * 0.5, [[0.15, f0 * 0.31]]);
        const g = envGain(c, d, s, 0.4, 0.012, 0.16);
        const mix = c.g.gain(1);
        v.connect(mix);
        sub.connect(c.g.gain(0.35)).connect(mix);
        for (const [f, q, a] of [[550, 3, 1], [1150, 4, 0.7], [2400, 5, 0.3]] as const) mix.connect(c.g.filter('bandpass', f, q)).connect(c.g.gain(a)).connect(g);
        nburst(c, d, s, { kind: 'pink', type: 'bandpass', f: 1300, q: 1, att: 0.01, t60: 0.12, level: 0.12 });
        e = end;
      }
      return endOf(c, e);
    },
  },
  seagull: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.35);
      const n = 2 + Math.floor(Math.random() * 3);
      let s = t;
      let scale = 1;
      let e = t;
      const out = lp(c, 5000, d);
      for (let i = 0; i < n; i++) {
        const dur = rand(0.32, 0.5);
        const f = 1150 * c.p * scale;
        const o = c.g.osc('sawtooth', f, s, s + dur + 0.02);
        sweep(o.frequency, s, f, [[0.06, f * 1.7], [dur * 0.55, f * 1.6], [dur, f * 1.05]]);
        c.g.lfo(o.frequency, rand(8, 11), 55 * scale, s, s + dur);
        const g = shaped(c, out, s, [[0, 0], [0.04, 0.06], [dur * 0.6, 0.045], [dur, 0]]);
        o.connect(c.g.filter('highpass', 900, 0.7)).connect(c.g.filter('bandpass', 2200, 1.4)).connect(g);
        e = s + dur + 0.02;
        s += dur + rand(0.08, 0.2);
        scale *= rand(0.9, 0.97);
      }
      return endOf(c, e);
    },
  },
  crow: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.3);
      const n = 2 + Math.floor(Math.random() * 2);
      let e = t;
      for (let i = 0; i < n; i++) {
        const s = t + i * vary(0.5, 0.1);
        const dur = rand(0.3, 0.4);
        const f = vary(560, 0.06) * c.p;
        const o = c.g.osc('sawtooth', f, s, s + dur + 0.02);
        sweep(o.frequency, s, f, [[dur, f * 0.86]]);
        const rough = c.g.gain(0.7);
        c.g.lfo(rough.gain, rand(38, 50), 0.3, s, s + dur);
        const g = shaped(c, d, s, [[0, 0], [0.03, 0.12], [dur * 0.6, 0.1], [dur, 0]]);
        rough.connect(g);
        for (const [ff, q, a] of [[1300, 3, 1], [2100, 4, 0.6], [650, 2, 0.4]] as const) o.connect(c.g.filter('bandpass', ff, q)).connect(c.g.gain(a)).connect(rough);
        nshape(c, rough, s, { kind: 'pink', type: 'bandpass', f: 1800, q: 1, pts: [[0, 0], [0.03, 0.12], [dur, 0]] });
        e = s + dur + 0.05;
      }
      return endOf(c, e);
    },
  },
  siren_far: {
    play(c) {
      const t = c.t;
      const dur = 7;
      const d = wetDry(c, 0.6);
      const o = c.g.osc('triangle', 650 * c.p, t, t + dur);
      o.frequency.setValueAtTime(650 * c.p, t);
      let s = t;
      while (s < t + dur) {
        o.frequency.exponentialRampToValueAtTime(1300 * c.p, Math.min(t + dur, s + 1.3));
        o.frequency.exponentialRampToValueAtTime(650 * c.p, Math.min(t + dur, s + 2.8));
        s += 2.8;
      }
      o.connect(lp(c, 1800, shaped(c, d, t, [[0, 0], [1.5, 0.05], [5.5, 0.05], [dur, 0]])));
      return dur + 0.05;
    },
  },
  bus_hiss: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.25);
      const e1 = click(c, d, t, 900, 0.28, 1.2, 0.03);
      const e2 = thump(c, d, t, 100, 70, 0.25, 0.3);
      const s = t + 0.08;
      const e3 = nburst(c, d, s, { type: 'bandpass', f: 3500, q: 0.6, att: 0.01, t60: 1.4, level: 0.32 });
      const e4 = nburst(c, d, s, { type: 'highpass', f: 5000, att: 0.01, t60: 1.0, level: 0.12 });
      const e5 = nshape(c, d, t, { kind: 'brown', type: 'lowpass', f: 120, pts: [[0, 0], [0.2, 0.25], [1.5, 0.2], [1.9, 0]] });
      return endOf(c, e1, e2, e3, e4, e5);
    },
  },

  // ------------------------------------------------------------ weather
  rain_burst: {
    play(c) {
      const t = c.t;
      const dur = rand(5.5, 6.5);
      const env: Pts = [[0, 0], [1.0, 0.6], [2.0, 1], [4.0, 0.8], [dur, 0]];
      let e = t;
      for (const pan of [-0.6, 0.6]) {
        const p = c.g.pan(pan);
        p.connect(c.out);
        e = Math.max(e, nshape(c, p, t, { kind: 'pink', type: 'lowpass', f: 1200, pts: env.map(([a, b]) => [a, b * 0.2] as const) }));
        e = Math.max(e, nshape(c, p, t, { kind: 'white', type: 'bandpass', f: 4000, q: 0.5, pts: env.map(([a, b]) => [a, b * 0.06] as const) }));
        e = Math.max(e, crackle(c, p, t, { type: 'bandpass', f: 3500, q: 0.8, pts: env.map(([a, b]) => [a, b * 0.35] as const) }));
      }
      return endOf(c, e);
    },
  },
  thunder_far: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.5);
      const e1 = nburst(c, d, t, { kind: 'pink', type: 'lowpass', f: 1500, att: 0.02, t60: 0.4, level: 0.2 });
      const pts: [number, number][] = [[0, 0], [0.15, 0.6]];
      let s = 0.15;
      while (s < 5.5) {
        s += rand(0.35, 0.9);
        pts.push([s, rand(0.2, 0.7) * (1 - s / 8)]);
      }
      pts.push([s + 1.5, 0]);
      const e2 = nshape(c, d, t, { kind: 'brown', type: 'lowpass', f: 180, pts });
      const e3 = nshape(c, d, t, { kind: 'brown', type: 'lowpass', f: 70, pts: pts.map(([a, b]) => [a, b * 0.8] as const) });
      return endOf(c, e1, e2, e3);
    },
  },
  wind_gust: {
    play(c) {
      const t = c.t;
      const dur = rand(3, 4);
      const p = c.g.pan(-0.5);
      panSweep(p, -0.5, 0.5, t, t + dur);
      p.connect(c.out);
      const e1 = nshape(c, p, t, { kind: 'pink', type: 'bandpass', f: 400, q: 1.2, fpts: [[dur * 0.35, 1100], [dur, 500]], pts: [[0, 0], [dur * 0.35, 0.3], [dur * 0.6, 0.2], [dur, 0]] });
      const e2 = nshape(c, p, t, { kind: 'white', type: 'bandpass', f: 900, q: 18, fpts: [[dur * 0.35, 1400], [dur, 800]], pts: [[0, 0], [dur * 0.35, 0.18], [dur, 0]] });
      return endOf(c, e1, e2);
    },
  },
  wave: {
    play(c) {
      const t = c.t;
      let e = t;
      for (const pan of [-0.4, 0.4]) {
        const p = c.g.pan(pan);
        p.connect(c.out);
        e = Math.max(e, nshape(c, p, t, {
          kind: 'pink',
          type: 'lowpass',
          f: 250,
          fpts: [[1.8, 1800], [2.2, 3000], [5, 900], [6, 400]],
          pts: [[0, 0], [1.6, 0.18], [2.2, 0.4], [2.8, 0.3], [4.5, 0.12], [6, 0]],
        }));
      }
      const e2 = nshape(c, c.out, t, { kind: 'white', type: 'bandpass', f: 2500, q: 0.5, pts: [[0, 0], [2.0, 0], [2.3, 0.18], [3.0, 0.08], [4, 0]] });
      const e3 = crackle(c, c.out, t, { type: 'highpass', f: 3000, pts: [[0, 0], [2.6, 0], [3.2, 0.12], [5.5, 0]] });
      const e4 = nshape(c, c.out, t, { kind: 'brown', type: 'lowpass', f: 120, pts: [[0, 0], [1.9, 0], [2.25, 0.35], [3.2, 0]] });
      return endOf(c, e, e2, e3, e4);
    },
  },

  // ------------------------------------------------------------ anomaly
  hum_rise: {
    play(c) {
      const t = c.t;
      const dur = 4.2;
      const end = t + dur + 0.35;
      const f0 = 52 * c.p;
      const f1 = 66 * c.p;
      const saw = c.g.osc('sawtooth', f0, t, end);
      sweep(saw.frequency, t, f0, [[dur, f1]]);
      const filt = c.g.filter('lowpass', 280, 1.2);
      sweep(filt.frequency, t, 280, [[dur, 1600]]);
      const drive = c.g.shaper(driveCurve(2.5));
      const sub = c.g.osc('sine', f0, t, end);
      sweep(sub.frequency, t, f0, [[dur, f1]]);
      const grit = c.g.osc('square', f0 * 2, t, end);
      sweep(grit.frequency, t, f0 * 2, [[dur, f1 * 2]]);
      const env: Pts = [[0, 0], [0.6, 0.12], [3.0, 0.6], [dur, 1], [dur + 0.3, 0]];
      const out = shaped(c, c.out, t, env.map(([a, b]) => [a, b * 0.14] as const));
      saw.connect(filt).connect(drive).connect(out);
      sub.connect(c.g.gain(0.6)).connect(out);
      grit.connect(c.g.filter('highpass', 1500, 0.7)).connect(c.g.gain(0.05)).connect(out);
      return endOf(c, end);
    },
  },
  hum_fall: {
    play(c) {
      const t = c.t;
      const dur = 3.5;
      const end = t + dur + 0.1;
      const f0 = 66 * c.p;
      const saw = c.g.osc('sawtooth', f0, t, end);
      sweep(saw.frequency, t, f0, [[dur, 36]]);
      const filt = c.g.filter('lowpass', 1500, 1.2);
      sweep(filt.frequency, t, 1500, [[dur, 140]]);
      const drive = c.g.shaper(driveCurve(2.5));
      const sub = c.g.osc('sine', f0, t, end);
      sweep(sub.frequency, t, f0, [[dur, 36]]);
      const out = c.g.gain(0);
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(0.14, t + 0.05);
      out.gain.setTargetAtTime(0, t + 0.05, dur / 4);
      out.connect(c.out);
      saw.connect(filt).connect(drive).connect(out);
      sub.connect(c.g.gain(0.6)).connect(out);
      // The lowpass keeps a short release after the oscillators stop.
      return endOf(c, end + 0.08);
    },
  },
  light_buzz: {
    play(c) {
      const t = c.t;
      const dur = rand(2.2, 2.8);
      const end = t + dur + 0.05;
      const sq = c.g.osc('square', 120 * c.p, t, end);
      const saw = c.g.osc('sawtooth', 120 * c.p, t, end);
      const flick = c.g.gain(0);
      flick.gain.setValueAtTime(0, t);
      let s = t;
      while (s < t + dur - 0.1) {
        flick.gain.setTargetAtTime(chance(0.15) ? rand(0, 0.2) : rand(0.6, 1), s, 0.01);
        s += rand(0.05, 0.22);
      }
      flick.gain.setTargetAtTime(0, t + dur - 0.08, 0.02);
      flick.connect(c.out);
      sq.connect(c.g.filter('bandpass', 2400, 0.9)).connect(c.g.gain(0.03)).connect(flick);
      saw.connect(c.g.filter('lowpass', 600, 0.7)).connect(c.g.gain(0.035)).connect(flick);
      const e2 = crackle(c, c.out, t, { type: 'highpass', f: 2000, rate: 0.5, pts: [[0, 0], [0.1, 0.12], [dur - 0.1, 0.1], [dur, 0]] });
      return endOf(c, end, e2);
    },
  },
  blackout: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.3);
      const e1 = thump(c, d, t, 48, 28, 0.9, 0.9, 0.004);
      const e2 = nburst(c, d, t, { kind: 'brown', type: 'lowpass', f: 250, att: 0.004, t60: 0.7, level: 0.7 });
      const e3 = click(c, d, t, 1100, 0.32, 2, 0.02);
      const e4 = thump(c, d, t, 160, 100, 0.05, 0.25);
      // the room's hum dying with it
      const hum = c.g.osc('sawtooth', 60, t, t + 0.5);
      sweep(hum.frequency, t, 60, [[0.4, 32]]);
      hum.connect(lp(c, 400, shaped(c, d, t, [[0, 0.05], [0.4, 0]])));
      return endOf(c, e1, e2, e3, e4);
    },
  },
  power_up: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.25);
      const w = c.g.osc('sine', 180 * c.p, t, t + 2.6);
      sweep(w.frequency, t, 180 * c.p, [[2.2, 3800 * c.p]]);
      w.connect(shaped(c, d, t, [[0, 0], [0.3, 0.02], [2.0, 0.03], [2.5, 0]]));
      const w2 = c.g.osc('triangle', 90 * c.p, t, t + 2.6);
      sweep(w2.frequency, t, 90 * c.p, [[2.2, 1900 * c.p]]);
      w2.connect(shaped(c, d, t, [[0, 0], [0.3, 0.015], [2.0, 0.02], [2.5, 0]]));
      const hum = c.g.osc('sawtooth', 60, t + 0.5, t + 3.7);
      hum.connect(lp(c, 500, shaped(c, d, t + 0.5, [[0, 0], [2.0, 0.05], [3.0, 0.035], [3.2, 0]])));
      let e = t + 3.7;
      for (const s of [0.3, 1.1, 1.7]) {
        e = Math.max(e, click(c, d, t + s, vary(1300, 0.15), 0.3, 2, 0.015));
        e = Math.max(e, thump(c, d, t + s, 170, 110, 0.05, 0.22));
      }
      e = Math.max(e, modal(c, d, t + 2.3, 3200, [[1, 1, 0.3], [2.3, 0.4, 0.15]], 0.02));
      e = Math.max(e, crackle(c, d, t + 2.3, { type: 'highpass', f: 2500, pts: [[0, 0.15], [0.25, 0]] }));
      return endOf(c, e);
    },
  },
  spark: {
    play(c) {
      const t = c.t;
      const e1 = nburst(c, c.out, t, { type: 'highpass', f: 1500, att: 0.0005, t60: 0.015, level: 0.8 });
      const e2 = nburst(c, c.out, t + rand(0.03, 0.06), { type: 'highpass', f: 1800, att: 0.0005, t60: 0.012, level: 0.45 });
      const e3 = crackle(c, c.out, t, { type: 'highpass', f: 3000, rate: 2, pts: [[0, 0], [0.01, 0.45], [0.3, 0]] });
      const z = c.g.osc('sawtooth', 120, t, t + 0.12);
      z.connect(c.g.filter('bandpass', 3000, 1)).connect(envGain(c, c.out, t, 0.06, 0.002, 0.1));
      return endOf(c, e1, e2, e3, t + 0.12);
    },
  },
  metal_crash: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.5);
      let e = t;
      const hits: Array<readonly [number, number]> = [[0, 1], [rand(0.14, 0.22), 0.65], [rand(0.4, 0.5), 0.4]];
      for (const [dt, a] of hits) {
        const s = t + dt;
        e = Math.max(e, thump(c, d, s, 82, 45, 0.5, 0.8 * a));
        e = Math.max(e, nburst(c, d, s, { kind: 'pink', type: 'lowpass', f: 3000, att: 0.001, t60: 0.35, level: 0.6 * a }));
        e = Math.max(e, modal(c, d, s, rand(180, 320) * c.p, [[1, 1, 1.6], [1.53, 0.7, 1.3], [2.37, 0.6, 1.0], [3.11, 0.4, 0.8], [4.6, 0.3, 0.5], [6.2, 0.2, 0.35]], 0.05 * a, { beat: 1.2 }));
      }
      const n = 8 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const s = t + 0.5 + Math.pow(Math.random(), 1.6) * 1.6;
        e = Math.max(e, modal(c, d, s, rand(1500, 5000), [[1, 1, rand(0.08, 0.25)], [2.4, 0.4, 0.1]], rand(0.01, 0.03)));
      }
      e = Math.max(e, crackle(c, d, t + 0.4, { type: 'bandpass', f: 2500, q: 0.7, pts: [[0, 0.25], [1.6, 0]] }));
      return endOf(c, e);
    },
  },
  thud: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.25);
      const e1 = thump(c, d, t, 65 * c.p, 38 * c.p, 0.3, 0.9);
      const e2 = nburst(c, d, t, { kind: 'brown', type: 'lowpass', f: 400, att: 0.002, t60: 0.25, level: 0.6 });
      const e3 = nburst(c, d, t, { kind: 'pink', type: 'bandpass', f: 250, q: 1, t60: 0.12, level: 0.4 });
      const e4 = crackle(c, d, t + 0.02, { type: 'lowpass', f: 2000, pts: [[0, 0.1], [0.3, 0]] });
      return endOf(c, e1, e2, e3, e4);
    },
  },
  glass_break: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.3);
      const e1 = nburst(c, d, t, { type: 'highpass', f: 2000, att: 0.0005, t60: 0.08, level: 0.7 });
      const e2 = thump(c, d, t, 200, 140, 0.05, 0.25);
      let e = t;
      const n = 14 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) {
        const s = t + Math.pow(Math.random(), 2) * 0.7;
        e = Math.max(e, modal(c, d, s, rand(2500, 9000), [[1, 1, rand(0.08, 0.4)], [2.3, 0.5, 0.1]], rand(0.01, 0.035)));
      }
      const e3 = crackle(c, d, t, { type: 'highpass', f: 4000, pts: [[0, 0.5], [0.6, 0]] });
      return endOf(c, e1, e2, e, e3);
    },
  },
  relay_click: {
    play(c) {
      const t = c.t;
      const e1 = click(c, c.out, t, 2500 * c.p, 0.45, 2, 0.006);
      const e2 = thump(c, c.out, t, 380, 250, 0.015, 0.22, 0.001);
      const e3 = click(c, c.out, t + rand(0.012, 0.02), 2900 * c.p, 0.28, 2, 0.005);
      const e4 = modal(c, c.out, t, 3800, [[1, 1, 0.03]], 0.02);
      return endOf(c, e1, e2, e3, e4);
    },
  },
  bell_toll: {
    jitter: 0.004,
    play(c) {
      return bell(c, { prime: 118, level: 0.16, cutoff: 3200, wet: 0.45, att: 0.002, maxRatio: 8 });
    },
  },
  bell_toll_far: {
    jitter: 0.004,
    play(c) {
      return bell(c, { prime: 118, level: 0.07, cutoff: 1300, wet: 0.9, att: 0.025, maxRatio: 4.5 });
    },
  },
  heartbeat: {
    jitter: 0.02,
    play(c) {
      const t = c.t;
      const d = lp(c, 260);
      const e1 = thump(c, d, t, 58 * c.p, 38 * c.p, 0.16, 0.7, 0.012);
      const e2 = nburst(c, d, t, { kind: 'brown', type: 'lowpass', f: 120, att: 0.01, t60: 0.12, level: 0.3 });
      const s = t + vary(0.3, 0.05);
      const e3 = thump(c, d, s, 70 * c.p, 45 * c.p, 0.12, 0.5, 0.01);
      const e4 = nburst(c, d, s, { kind: 'brown', type: 'lowpass', f: 140, att: 0.008, t60: 0.09, level: 0.2 });
      return endOf(c, e1, e2, e3, e4);
    },
  },
  tinnitus: {
    jitter: 0.01,
    play(c) {
      const t = c.t;
      const dur = 6;
      const f = 5200 * c.p;
      const env: Pts = [[0, 0], [0.8, 0.028], [3.5, 0.022], [dur, 0]];
      c.g.osc('sine', f, t, t + dur).connect(shaped(c, c.out, t, env));
      c.g.osc('sine', f + 7, t, t + dur).connect(shaped(c, c.out, t, env.map(([a, b]) => [a, b * 0.4] as const)));
      return dur + 0.05;
    },
  },
  silence_drop: {
    jitter: 0,
    play(c) {
      const t = c.t;
      // a short inward "suck" that cuts dead — the engine pulls the ambience away at the cut
      const e1 = nshape(c, c.out, t, { kind: 'white', type: 'bandpass', f: 1500, q: 0.6, fpts: [[0.3, 4000]], pts: [[0, 0], [0.26, 0.1], [0.3, 0]] });
      const e2 = nshape(c, c.out, t, { kind: 'pink', type: 'lowpass', f: 300, fpts: [[0.3, 900]], pts: [[0, 0], [0.26, 0.15], [0.3, 0]] });
      const o = c.g.osc('sine', 70, t + 0.28, t + 1.6);
      sweep(o.frequency, t + 0.28, 70, [[1.2, 38]]);
      o.connect(shaped(c, c.out, t + 0.28, [[0, 0], [0.04, 0.12], [1.3, 0]]));
      return endOf(c, e1, e2, t + 1.6);
    },
  },

  // ------------------------------------------------------------ diegetic interface
  memory_keep: {
    jitter: 0.004,
    play(c) {
      const t = c.t;
      const d = lp(c, 3500, wetDry(c, 0.3));
      const e1 = nshape(c, d, t, { kind: 'pink', type: 'bandpass', f: 1500, q: 0.9, pts: [[0, 0], [0.12, 0.025], [0.3, 0]] });
      const s = t + 0.08;
      const f = 880 * c.p;
      const e2 = modal(c, d, s, f, [[1, 1, 1.1], [2.0, 0.12, 0.6], [3.0, 0.04, 0.4], [4.2, 0.02, 0.25], [0.5, 0.35, 0.9]], 0.05, { att: 0.012 });
      return endOf(c, e1, e2);
    },
  },
  focus_shift: {
    play(c) {
      const t = c.t;
      const from = chance(0.5) ? -0.25 : 0.25;
      const p = c.g.pan(from);
      panSweep(p, from, -from, t, t + 0.6);
      p.connect(c.out);
      return endOf(c, nshape(c, p, t, { kind: 'pink', type: 'bandpass', f: 500, q: 0.8, fpts: [[0.25, 1400], [0.6, 600]], pts: [[0, 0], [0.22, 0.08], [0.6, 0]] }));
    },
  },
  choice_appear: {
    play(c) {
      const t = c.t;
      const e1 = nburst(c, c.out, t, { type: 'bandpass', f: 1800, q: 3, att: 0.0008, t60: 0.004, level: 0.015 });
      const e2 = nshape(c, c.out, t + 0.02, { kind: 'white', type: 'bandpass', f: 1700, q: 1.2, fpts: [[0.4, 2300]], pts: [[0, 0], [0.25, 0.03], [0.38, 0.018], [0.45, 0]] });
      return endOf(c, e1, e2);
    },
  },
  title_tone: {
    jitter: 0.003,
    play(c) {
      const t = c.t;
      const dur = 10;
      const env: Pts = [[0, 0], [3, 1], [5, 0.8], [dur, 0]];
      const filt = c.g.filter('lowpass', 600, 0.7);
      c.g.lfo(filt.frequency, 0.15, 120, t, t + dur);
      const out = shaped(c, wetDry(c, 0.5), t, env.map(([a, b]) => [a, b * 0.12] as const));
      filt.connect(out);
      const tones: Array<readonly [OscillatorType, number, number]> = [
        ['sine', 55, 1],
        ['sine', 55.15, 0.6],
        ['sine', 82.4, 0.5],
        ['sine', 110, 0.35],
        ['triangle', 110.4, 0.15],
      ];
      for (const [type, f, a] of tones) c.g.osc(type, f * c.p, t, t + dur).connect(c.g.gain(a)).connect(filt);
      nshape(c, out, t, { kind: 'pink', type: 'lowpass', f: 400, pts: [[0, 0.25], [dur, 0.25]] });
      return dur + 0.05;
    },
  },
};

function bell(c: SfxCtx, o: { prime: number; level: number; cutoff: number; wet: number; att: number; maxRatio: number }): number {
  const t = c.t;
  const out = lp(c, o.cutoff, wetDry(c, o.wet), 0.5);
  const f0 = o.prime * c.p;
  // Tower-bell partials relative to the prime: hum, prime, minor-third tierce, quint, nominal, ...
  const parts: Part[] = [
    [0.5, 0.45, 9],
    [1.0, 0.6, 6.5],
    [1.183, 0.5, 5],
    [1.5, 0.25, 3.5],
    [2.0, 0.55, 4],
    [2.51, 0.2, 2.5],
    [2.66, 0.15, 2],
    [3.01, 0.15, 1.6],
    [4.0, 0.1, 1.2],
    [5.33, 0.06, 0.8],
    [6.8, 0.04, 0.6],
  ];
  const e1 = modal(c, out, t, f0, parts.filter(([r]) => r <= o.maxRatio), o.level, { beat: 0.9, att: o.att });
  // the clapper's clang
  const e2 = nburst(c, out, t, { kind: 'pink', type: 'bandpass', f: 1500, q: 0.8, att: o.att, t60: 0.12, level: o.level * 1.5 });
  const e3 = thump(c, out, t, 120, 80, 0.1, o.level, o.att);
  return endOf(c, e1, e2, e3);
}

// ================================================================ ambient-only event sounds

export const AMBIENT_EVENTS = {
  rail_clack: {
    play(c) {
      const t = c.t;
      const e1 = thump(c, c.out, t, vary(75, 0.1), 50, 0.07, 0.5);
      const e2 = nburst(c, c.out, t, { type: 'bandpass', f: vary(1300, 0.1), q: 2.5, att: 0.0008, t60: 0.03, level: 0.32 });
      const e3 = nburst(c, c.out, t, { kind: 'pink', type: 'lowpass', f: 500, t60: 0.06, level: 0.3 });
      return endOf(c, e1, e2, e3);
    },
  },
  cabin_rattle: {
    play(c) {
      const t = c.t;
      const strikes: Array<readonly [number, number]> = [];
      let s = t;
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        strikes.push([s, rand(0.05, 0.12)]);
        s += rand(0.03, 0.09);
      }
      return endOf(c, clickTrain(c, c.out, strikes, { f: rand(1800, 2800), q: 3, t60: 0.02 }));
    },
  },
  wood_creak: {
    play(c) {
      return endOf(c, creak(c, c.out, c.t, rand(0.3, 0.8), { f0: rand(14, 28), f1: rand(30, 70), level: 0.22, bright: rand(500, 1100), jitter: 0.3 }));
    },
  },
  house_tick: {
    play(c) {
      const t = c.t;
      const e1 = nburst(c, c.out, t, { type: 'bandpass', f: rand(1500, 3000), q: 4, att: 0.0008, t60: 0.012, level: 0.25 });
      const e2 = thump(c, c.out, t, 220, 160, 0.02, 0.06);
      return endOf(c, e1, e2);
    },
  },
  bird_chirp: {
    jitter: 0.08,
    play(c) {
      const t = c.t;
      const kind = Math.floor(Math.random() * 3);
      const n = 2 + Math.floor(Math.random() * 5);
      const end = t + n * 0.2 + 0.3;
      const o = c.g.osc('sine', 3000, t, end);
      const g = c.g.gain(0);
      g.gain.setValueAtTime(0, t);
      let s = t;
      const base = rand(2800, 4800) * c.p;
      for (let i = 0; i < n; i++) {
        const len = kind === 1 ? rand(0.025, 0.04) : rand(0.04, 0.08);
        const f0 = kind === 0 ? base * 1.35 : kind === 1 ? base : base * (i % 2 ? 0.8 : 1.05);
        const f1 = kind === 0 ? base * 0.8 : kind === 1 ? base * 1.2 : f0 * 1.02;
        o.frequency.setValueAtTime(f0, s);
        o.frequency.linearRampToValueAtTime(f1, s + len);
        const lv = rand(0.025, 0.05);
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(lv, s + len * 0.25);
        g.gain.linearRampToValueAtTime(0, s + len);
        s += len + (kind === 1 ? rand(0.02, 0.04) : rand(0.06, 0.18));
      }
      o.connect(g).connect(c.out);
      const h = c.g.gain(0.15);
      g.connect(c.g.filter('highpass', 6000)).connect(h).connect(c.out);
      return endOf(c, end);
    },
  },
  pigeon_coo: {
    jitter: 0.06,
    play(c) {
      const t = c.t;
      const f = rand(300, 360) * c.p;
      const end = t + 1.4;
      const o = c.g.osc('sine', f, t, end);
      sweep(o.frequency, t, f, [[0.15, f * 1.05], [0.35, f * 1.25], [0.75, f * 1.1], [1.2, f * 0.9]]);
      const am = c.g.gain(0.7);
      c.g.lfo(am.gain, rand(22, 28), 0.3, t, end);
      const env = shaped(c, lp(c, 900), t, [[0, 0], [0.08, 0.05], [0.2, 0.02], [0.35, 0.07], [0.75, 0.05], [0.9, 0.02], [1.0, 0.04], [1.3, 0]]);
      o.connect(am).connect(env);
      return endOf(c, end);
    },
  },
  wing_flutter: {
    play(c) {
      const t = c.t;
      const src = c.g.noise('pink', t, t + 1);
      const am = c.g.gain(0.5);
      const l = c.g.lfo(am.gain, 14, 0.5, t, t + 1, 'triangle');
      sweep(l.frequency, t, 14, [[0.9, 8]]);
      src.connect(c.g.filter('bandpass', 1200, 0.8)).connect(am).connect(shaped(c, c.out, t, [[0, 0], [0.05, 0.25], [0.6, 0.15], [0.9, 0]]));
      return 1.05;
    },
  },
  drip: {
    jitter: 0.1,
    play(c) {
      const t = c.t;
      const e1 = droplet(c, wetDry(c, 0.7), t, rand(600, 1400) * c.p, rand(0.08, 0.16));
      const e2 = click(c, c.out, t, 3000, 0.03, 1, 0.003);
      return endOf(c, e1, e2, t + 1.5);
    },
  },
  /** One raindrop landing close by (ground, leaf, umbrella edge): a soft broadband tick, sometimes a bubble. */
  rain_drop_near: {
    jitter: 0.15,
    play(c) {
      const t = c.t;
      const e1 = nburst(c, c.out, t, { type: 'bandpass', f: rand(2200, 6000), q: rand(0.6, 1.2), att: 0.0004, t60: rand(0.006, 0.02), level: rand(0.12, 0.25) });
      const e2 = Math.random() < 0.3 ? droplet(c, c.out, t + 0.002, rand(900, 2200) * c.p, rand(0.03, 0.06)) : t;
      return endOf(c, e1, e2);
    },
  },
  /** A heavier drop striking a window pane: a hard little tick with a short glassy ring. */
  rain_tap_glass: {
    jitter: 0.1,
    play(c) {
      const t = c.t;
      const e1 = nburst(c, c.out, t, { type: 'highpass', f: rand(3000, 4500), att: 0.0003, t60: rand(0.003, 0.008), level: rand(0.15, 0.28) });
      const e2 = click(c, c.out, t, rand(3800, 6500) * c.p, rand(0.03, 0.07), 6, rand(0.006, 0.012));
      return endOf(c, e1, e2);
    },
  },
  drip_metal: {
    jitter: 0.1,
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.6);
      const e1 = droplet(c, d, t, rand(800, 1500) * c.p, 0.08);
      const e2 = modal(c, d, t, rand(1800, 3500) * c.p, [[1, 1, 0.3], [2.3, 0.3, 0.15]], 0.025);
      return endOf(c, e1, e2, t + 1.2);
    },
  },
  cart_roll: {
    play(c) {
      const t = c.t;
      const dur = rand(3, 4);
      c.move(-40, 40, t, t + dur, 1);
      const env: Pts = [[0, 0], [0.5, 1], [dur - 0.5, 1], [dur, 0]];
      const src = c.g.noise('pink', t, t + dur + 0.05);
      const am = c.g.gain(0.6);
      c.g.lfo(am.gain, rand(9, 13), 0.35, t, t + dur);
      src.connect(c.g.filter('bandpass', 600, 1.2)).connect(am).connect(shaped(c, c.out, t, env.map(([a, b]) => [a, b * 0.1] as const)));
      const strikes: Array<readonly [number, number]> = [];
      for (let s = t + 0.2; s < t + dur - 0.2; s += rand(0.15, 0.45)) strikes.push([s, rand(0.03, 0.08)]);
      const e1 = clickTrain(c, c.out, strikes, { f: 2600, q: 8, t60: 0.06 });
      return endOf(c, e1, t + dur + 0.05);
    },
  },
  monitor_beep: {
    jitter: 0,
    play(c) {
      const t = c.t;
      let e = t;
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.9;
        const g = c.g.gain(0);
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.04, s + 0.005);
        g.gain.setValueAtTime(0.04, s + 0.11);
        g.gain.linearRampToValueAtTime(0, s + 0.12);
        c.g.osc('sine', 960, s, s + 0.13).connect(g).connect(c.out);
        e = s + 0.13;
      }
      return endOf(c, e);
    },
  },
  shutter_roll: {
    play(c) {
      const t = c.t;
      const dur = rand(2, 2.6);
      const env: Pts = [[0, 0], [0.2, 1], [dur - 0.2, 0.9], [dur, 0]];
      const src = c.g.noise('white', t, t + dur + 0.05);
      const am = c.g.gain(0.5);
      const saw = c.g.osc('sawtooth', rand(18, 24), t, t + dur);
      saw.connect(c.g.gain(-0.5)).connect(am.gain);
      const bus = shaped(c, wetDry(c, 0.3), t, env.map(([a, b]) => [a, b * 0.2] as const));
      src.connect(c.g.filter('bandpass', 900, 1.2)).connect(am);
      src.connect(c.g.filter('bandpass', 2400, 6)).connect(am);
      am.connect(bus);
      const e1 = thump(c, c.out, t + dur, 110, 70, 0.15, 0.3);
      const e2 = click(c, c.out, t + dur, 1500, 0.2, 1.5, 0.03);
      return endOf(c, e1, e2);
    },
  },
  chopsticks: {
    play(c) {
      const t = c.t;
      const f = rand(2500, 3500);
      const e = clickTrain(c, c.out, [[t, 0.2], [t + rand(0.03, 0.06), 0.14]], { f, q: 5, t60: 0.012 });
      return endOf(c, e);
    },
  },
  wok: {
    play(c) {
      const t = c.t;
      const e1 = nshape(c, c.out, t, { kind: 'white', type: 'bandpass', f: 2500, q: 2, fpts: [[0.5, 1600]], pts: [[0, 0], [0.05, 0.12], [0.5, 0]] });
      const e2 = modal(c, c.out, t, rand(550, 650), [[1, 1, 0.5], [1.8, 0.5, 0.3], [2.9, 0.3, 0.2]], 0.04);
      const e3 = crackle(c, c.out, t, { type: 'highpass', f: 2000, pts: [[0, 0], [0.1, 0.35], [1.5, 0]] });
      return endOf(c, e1, e2, e3);
    },
  },
  hdd_seek: {
    play(c) {
      const t = c.t;
      const strikes: Array<readonly [number, number]> = [];
      let s = t;
      const n = 4 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) {
        strikes.push([s, rand(0.06, 0.14)]);
        s += rand(0.02, 0.12);
      }
      return endOf(c, clickTrain(c, c.out, strikes, { f: 3500, q: 3, t60: 0.005 }));
    },
  },
  pipe_knock: {
    play(c) {
      const t = c.t;
      const d = wetDry(c, 0.5);
      let e = t;
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const s = t + i * rand(0.25, 0.4);
        e = Math.max(e, thump(c, d, s, 140, 90, 0.08, 0.3));
        e = Math.max(e, modal(c, d, s, vary(320, 0.1), [[1, 1, 0.6], [2.6, 0.4, 0.3]], 0.05));
      }
      return endOf(c, e);
    },
  },
  tower_groan: {
    play(c) {
      const t = c.t;
      const dur = rand(2.5, 3.5);
      const o = c.g.osc('sawtooth', 55, t, t + dur);
      sweep(o.frequency, t, 55, [[dur, 47]]);
      o.connect(c.g.filter('bandpass', 300, 6)).connect(shaped(c, wetDry(c, 0.6), t, [[0, 0], [dur * 0.4, 0.05], [dur, 0]]));
      const e = creak(c, c.out, t + 0.2, dur * 0.6, { f0: 10, f1: 18, level: 0.06, bright: 600, jitter: 0.4 });
      return endOf(c, e, t + dur);
    },
  },
  metal_groan: {
    play(c) {
      const t = c.t;
      const dur = rand(1.5, 2.5);
      const e = creak(c, wetDry(c, 0.7), t, dur, { f0: rand(18, 30), f1: rand(25, 45), level: 0.12, bright: rand(700, 1300), jitter: 0.35 });
      return endOf(c, e);
    },
  },
  fridge_click: {
    play(c) {
      const t = c.t;
      const e1 = click(c, c.out, t, 1200, 0.15, 1.5, 0.02);
      const e2 = thump(c, c.out, t, 120, 80, 0.06, 0.15);
      return endOf(c, e1, e2);
    },
  },
} satisfies Record<string, SfxRecipe>;

export type AmbientEventId = keyof typeof AMBIENT_EVENTS;

/**
 * Level trims: physical fallbacks are matched to their recordings using the loudest 50 ms
 * windows from three offline renders (2026-10-24). Boosts retain 6 dB of sampled peak
 * headroom. Human and UI recipes are tuned separately.
 * This is an energy calibration; timbre and perceived loudness still need listening.
 */
const TRIM: Partial<Record<SfxId, number>> = {
  // big impacts: keep headroom for the limiter
  heartbeat: 0.366,
  thud: 0.274,
  door_slam: 0.285,
  metal_crash: 0.324,
  blackout: 0.234,
  hum_rise: 0.8,
  hum_fall: 0.8,
  train_door: 0.7,
  construction_drill: 0.42,
  hammer: 0.8,
  dog_bark: 0.8,
  wave: 0.9,
  // small, detailed sounds that came out too faint
  choice_appear: 7,
  focus_shift: 4.8,
  cloth_rustle: 9.487,
  laugh_soft: 1.6,
  laugh_soft_m: 3,
  kid_laugh: 2.5,
  pen_scratch: 9.396,
  typing: 7.046,
  clock_wind: 4.5,
  key_jingle: 8.75,
  door_open: 2,
  huddle_rustle: 6.125,
  breath: 1.6,
  breath_m: 1.6,
  page_turn: 4.832,
  envelope: 4.582,
  strap_click: 3.547,
  seagull: 3.476,
  siren_far: 1.5,
  tinnitus: 1.3,
  wind_gust: 4.083,
  light_buzz: 5.298,
  memory_keep: 1.3,
  camera_shutter: 1.4,
  relay_click: 2.35,
  static_burst: 2,
  paper_rustle: 2.449,
  cane_tap: 2.394,
  step_heels: 3.281,
  train_horn: 2.5,
  bicycle_bell: 2.625,
  crow: 3.718,
  door_creak: 3.063,
  chair_scrape: 2.259,
  tools_clink: 2.944,
  box_open: 2.929,
  box_close: 1.6,
  lighter: 2.877,
  tape_hiss: 1.3,
  spoon_stir: 3.793,
  braille_stylus: 2.065,
  coffee_grind: 2.851,
  door_close: 0.367,
  glass_clink: 1.905,
  phone_buzz: 1.95,
  power_up: 1.622,
  radio_noise: 7.079,
  spark: 1.429,
  station_chime: 1.622,
  steam_hiss: 2.065,
  thunder_far: 0.417,
  train_brake: 0.61,
  truck_reverse: 2.163,
};
for (const [id, v] of Object.entries(TRIM) as Array<[SfxId, number]>) SFX_RECIPES[id].level = (SFX_RECIPES[id].level ?? 1) * v;

/** Human effects allow both recordings and synthesis, including immediate synthesis while recordings load. */
export const HUMAN_SFX: ReadonlySet<SfxId> = new Set<SfxId>([
  'gasp_crowd', 'cough', 'sigh', 'sigh_m', 'breath', 'breath_m', 'laugh_soft', 'laugh_soft_m', 'kid_laugh', 'choice_appear',
]);

/** Sounds that belong to the "interface" (they bypass the attention muffle). */
export const UI_SFX: ReadonlySet<SfxId> = new Set<SfxId>(['memory_keep', 'focus_shift', 'choice_appear', 'title_tone']);
