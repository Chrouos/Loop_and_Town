// Ambience layers: long-running beds (looped noise, slow modulation), fixed point sources placed
// around the listener, and sparse randomized events (one-shots) scheduled ahead on the audio clock.
// Every node, timer and event of a layer is owned by it and released when the layer is disposed.

import type { AmbienceId, SfxId } from './catalog';
import {
  clamp,
  crackleBuffer,
  Graph,
  impulseResponse,
  mulberry32,
  normalizePeak,
  pick,
  rand,
  rampTo,
  renderBuffer,
  spatialize,
  spawnShot,
  vary,
  type NoiseKind,
  type SfxRecipe,
  type Shot,
} from './core';
import { AMBIENT_EVENTS, SFX_RECIPES, clockBuffer, type AmbientEventId } from './sounds';
import { murmurRig, type MurmurOpts, type MurmurRig } from './voice';

type FilterSpec = readonly [BiquadFilterType, number, number?];

export interface BedOpts {
  kind: NoiseKind;
  filters: readonly FilterSpec[];
  gain: number;
  pan?: number;
  rate?: number;
  /** Reverb send amount. */
  send?: number;
}

export interface Bed {
  gain: GainNode;
  filters: BiquadFilterNode[];
  pan: (AudioNode & { pan?: AudioParam }) | null;
}

type Sound = SfxId | AmbientEventId | SfxRecipe;

export interface AmbienceEnv {
  readonly ac: BaseAudioContext;
  readonly g: Graph;
  /** Layer input (stereo, non-spatial). */
  readonly out: AudioNode;
  readonly t0: number;
  /** Current reverb send target (shared room by default; a layer may install its own space). */
  reverb: AudioNode | null;
  bed(o: BedOpts): Bed;
  /** Two decorrelated copies of a bed panned ±spread (each at gain/√2). */
  wide(o: BedOpts, spread?: number): Bed[];
  /** Static HRTF point source in the layer; connect a sound to the returned node. */
  point(angle: number, r: number, sendScale?: number): AudioNode;
  pan(p: number): AudioNode;
  lfo(param: AudioParam, hz: number, depth: number): void;
  /** Random walk: glide the param to a new random value every minS..maxS seconds. */
  drift(param: AudioParam, lo: number, hi: number, minS: number, maxS: number): void;
  /** Call fn(t, dt) at random intervals; t is the audio time to schedule at (slightly ahead). */
  every(minS: number, maxS: number, fn: (t: number, dt: number) => void, first?: number): void;
  shot(sound: Sound, angle: number | null, r: number, o?: { t?: number; gain?: number; rate?: number }): void;
  /** A private convolution space for this layer (returns its send input; sets env.reverb). */
  space(key: string, seconds: number, opts?: { brightness?: number; damping?: number; early?: number; earlySpread?: number; level?: number }): AudioNode;
  murmur(angle: number, r: number, o: MurmurOpts): MurmurRig;
}

export interface AmbienceRecipe {
  /** Layer level at full fade-in. */
  level: number;
  build(env: AmbienceEnv): void;
}

const MAX_LAYER_SHOTS = 14;
const LOOKAHEAD = 0.3;

function resolve(sound: Sound): SfxRecipe | undefined {
  if (typeof sound !== 'string') return sound;
  return (SFX_RECIPES as Record<string, SfxRecipe>)[sound] ?? (AMBIENT_EVENTS as Record<string, SfxRecipe>)[sound];
}

class Env implements AmbienceEnv {
  readonly g: Graph;
  readonly t0: number;
  reverb: AudioNode | null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private shots = new Set<Shot>();
  disposed = false;

  constructor(
    readonly ac: BaseAudioContext,
    readonly out: GainNode,
    reverb: AudioNode | null,
  ) {
    this.g = new Graph(ac);
    this.t0 = ac.currentTime + 0.02;
    this.reverb = reverb;
  }

  bed(o: BedOpts): Bed {
    const src = this.g.noise(o.kind, this.t0, undefined, o.rate ?? vary(1, 0.02));
    let node: AudioNode = src;
    const filters: BiquadFilterNode[] = [];
    for (const [type, f, q] of o.filters) {
      const n = this.g.filter(type, f, q ?? 0.707);
      node.connect(n);
      node = n;
      filters.push(n);
    }
    const gain = this.g.gain(o.gain);
    node.connect(gain);
    let pan: Bed['pan'] = null;
    if (o.pan !== undefined && o.pan !== 0) {
      pan = this.g.pan(o.pan);
      gain.connect(pan).connect(this.out);
    } else gain.connect(this.out);
    if (o.send && this.reverb) gain.connect(this.g.gain(o.send)).connect(this.reverb);
    return { gain, filters, pan };
  }

  wide(o: BedOpts, spread = 0.7): Bed[] {
    return [-spread, spread].map((p) => this.bed({ ...o, gain: o.gain * Math.SQRT1_2, pan: p, rate: vary(1, 0.03) }));
  }

  point(angle: number, r: number, sendScale = 1): AudioNode {
    return spatialize(this.g, { angle, r }, this.out, this.reverb, { sendScale }).input;
  }

  pan(p: number): AudioNode {
    const n = this.g.pan(p);
    n.connect(this.out);
    return n;
  }

  lfo(param: AudioParam, hz: number, depth: number): void {
    this.g.lfo(param, hz, depth, this.t0);
  }

  drift(param: AudioParam, lo: number, hi: number, minS: number, maxS: number): void {
    param.value = rand(lo, hi);
    this.every(minS, maxS, (t, dt) => param.setTargetAtTime(rand(lo, hi), t, Math.max(0.05, dt / 3)), rand(0, minS));
  }

  every(minS: number, maxS: number, fn: (t: number, dt: number) => void, first?: number): void {
    let next = this.ac.currentTime + (first ?? rand(minS * 0.3, maxS));
    let dt = rand(minS, maxS);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = (): void => {
      if (timer !== null) this.timers.delete(timer);
      if (this.disposed) return;
      const now = this.ac.currentTime;
      // long throttling (background tab) — skip ahead instead of firing a burst
      if (next < now - 1) next = now + rand(0, minS);
      let guard = 0;
      while (next < now + LOOKAHEAD && guard++ < 32) {
        if (next >= now - 0.05) {
          try {
            fn(Math.max(next, now + 0.01), dt);
          } catch {
            // an event failing must never take the layer down
          }
        }
        next += dt;
        dt = rand(minS, maxS);
      }
      const wait = clamp((next - now - LOOKAHEAD * 0.6) * 1000, 40, 1000);
      timer = setTimeout(tick, wait);
      this.timers.add(timer);
    };
    timer = setTimeout(tick, 0);
    this.timers.add(timer);
  }

  shot(sound: Sound, angle: number | null, r: number, o: { t?: number; gain?: number; rate?: number } = {}): void {
    if (this.disposed || this.shots.size >= MAX_LAYER_SHOTS) return;
    const recipe = resolve(sound);
    if (!recipe) return;
    const s = spawnShot(this.ac, recipe, {
      dest: this.out,
      reverb: this.reverb,
      place: { angle, r },
      t: Math.max(this.ac.currentTime + 0.01, o.t ?? this.ac.currentTime + 0.02),
      gain: o.gain,
      rate: o.rate,
      onDone: (shot) => this.shots.delete(shot),
    });
    if (s) this.shots.add(s);
  }

  space(
    key: string,
    seconds: number,
    o: { brightness?: number; damping?: number; early?: number; earlySpread?: number; level?: number } = {},
  ): AudioNode {
    const ir = impulseResponse(this.ac, key, { seconds, brightness: o.brightness, damping: o.damping, early: o.early, earlySpread: o.earlySpread, preDelay: 0.015 });
    const input = this.g.gain(1);
    const conv = this.g.convolver(ir);
    input.connect(conv).connect(this.g.gain(o.level ?? 0.6)).connect(this.out);
    this.reverb = input;
    return input;
  }

  murmur(angle: number, r: number, o: MurmurOpts): MurmurRig {
    return murmurRig(this.g, this.point(angle, r), this.t0, undefined, o);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    for (const s of [...this.shots]) s.dispose();
    this.shots.clear();
    this.g.dispose();
    try {
      this.out.disconnect();
    } catch {
      // ignore
    }
  }

  get activeTimers(): number {
    return this.timers.size;
  }

  get activeShots(): number {
    return this.shots.size;
  }
}

// ================================================================ pre-rendered textures

function cricketBuffer(ac: BaseAudioContext, seed: number, f: number, pulses: number): AudioBuffer {
  return renderBuffer(ac, `cricket:${seed}:${f}:${pulses}`, 6, 1, ([d], sr) => {
    const rnd = mulberry32(seed);
    const out = d!;
    const period = 0.45 + rnd() * 0.4;
    for (let t = rnd() * period; t < 6 - 0.2; t += period * (0.9 + rnd() * 0.2)) {
      if (rnd() < 0.12) continue; // occasional pause
      for (let p = 0; p < pulses; p++) {
        const start = Math.floor((t + p * 0.022) * sr);
        const len = Math.floor(0.014 * sr);
        const ff = f * (1 + (rnd() - 0.5) * 0.01);
        for (let i = 0; i < len; i++) {
          const w = Math.sin((Math.PI * i) / len);
          const idx = (start + i) % out.length;
          out[idx]! += w * w * Math.sin((2 * Math.PI * ff * i) / sr) * (0.8 + 0.2 * Math.sin(i * 0.02));
        }
      }
    }
    normalizePeak(out, 0.5);
  });
}

interface RainTexture {
  /** Drops per second. */
  density: number;
  /** Quietest drop relative to the loudest, and the skew between them (kept narrow so no drop marks the loop). */
  ampLo: number;
  ampCurve: number;
  /** Impact brightness range (one-pole lowpass cutoff, Hz) and length range (s). */
  fLo: number;
  fHi: number;
  tickLo: number;
  tickHi: number;
  /** Share of drops that trap a bubble, its start pitch range and level relative to the impact. */
  bubble: number;
  bLo: number;
  bHi: number;
  bubbleAmp: number;
  /** Level of a tiny bright ring after each impact (glass); 0 for none. */
  ring: number;
  /** Loudness the texture is normalized to (RMS), with a peak ceiling. */
  rms: number;
}

const RAIN_OUTDOOR: RainTexture = {
  density: 900, ampLo: 0.25, ampCurve: 1.6, fLo: 2500, fHi: 9000, tickLo: 0.0004, tickHi: 0.0016,
  bubble: 0.22, bLo: 900, bHi: 3200, bubbleAmp: 0.35, ring: 0, rms: 0.037,
};
const RAIN_GLASS: RainTexture = {
  density: 55, ampLo: 0.2, ampCurve: 1.8, fLo: 4000, fHi: 9000, tickLo: 0.0003, tickHi: 0.0009,
  bubble: 0.04, bLo: 1500, bHi: 3500, bubbleAmp: 0.2, ring: 0.18, rms: 0.026,
};

/**
 * Rain as many small impacts rather than tones: each drop is a short filtered noise tick, some trap
 * a bubble whose pitch rises as it closes, and on glass a tiny bright ring. Amplitudes stay in a
 * narrow band and loops are long (and different per copy), so the ear finds no repeating drop.
 */
function rainBuffer(ac: BaseAudioContext, seed: number, seconds: number, o: RainTexture): AudioBuffer {
  return renderBuffer(ac, `rain:${seed}:${seconds}:${o.density}:${o.fHi}:${o.ring}`, seconds, 1, ([d], sr) => {
    const rnd = mulberry32(seed);
    const out = d!;
    const len = out.length;
    const n = Math.floor(o.density * seconds);
    for (let k = 0; k < n; k++) {
      const start = Math.floor(rnd() * len);
      const amp = o.ampLo + (1 - o.ampLo) * Math.pow(rnd(), o.ampCurve);
      // impact: decaying noise through a one-pole lowpass, then a one-zero highpass (no thump, no DC)
      const fc = o.fLo + rnd() * (o.fHi - o.fLo);
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
      const ilen = Math.max(4, Math.floor((o.tickLo + rnd() * (o.tickHi - o.tickLo)) * sr));
      const idec = Math.exp(-6.9 / ilen);
      let lp = 0;
      let prev = 0;
      let e = amp;
      for (let i = 0; i < ilen * 1.5; i++) {
        lp += a * ((rnd() * 2 - 1) * e - lp);
        out[(start + i) % len]! += lp - 0.9 * prev;
        prev = lp;
        e *= idec;
      }
      if (rnd() < o.bubble) {
        // Minnaert bubble: the resonance glides upward as the bubble shrinks
        const f0 = o.bLo + rnd() * (o.bHi - o.bLo);
        const rise = 1.3 + rnd() * 0.6;
        const blen = Math.floor((0.008 + rnd() * 0.025) * sr);
        const bdec = Math.exp(-6.9 / blen);
        let ph = 0;
        let be = amp * o.bubbleAmp;
        for (let i = 0; i < blen; i++) {
          ph += (2 * Math.PI * f0 * (1 + (rise - 1) * (i / blen))) / sr;
          out[(start + 6 + i) % len]! += be * (i < 12 ? i / 12 : 1) * Math.sin(ph);
          be *= bdec;
        }
      }
      if (o.ring > 0) {
        const f = 2800 + rnd() * 3500;
        const rlen = Math.floor((0.002 + rnd() * 0.004) * sr);
        const rdec = Math.exp(-6.9 / rlen);
        let re = amp * o.ring;
        for (let i = 0; i < rlen; i++) {
          out[(start + i) % len]! += re * Math.sin((2 * Math.PI * f * i) / sr);
          re *= rdec;
        }
      }
    }
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < len; i++) {
      sum += out[i]! * out[i]!;
      peak = Math.max(peak, Math.abs(out[i]!));
    }
    const rms = Math.sqrt(sum / len);
    if (rms <= 0) return;
    const k = Math.min(o.rms / rms, 0.9 / peak);
    for (let i = 0; i < len; i++) out[i]! *= k;
  });
}

// ================================================================ helpers

function anyAngle(): number {
  return rand(0, 360);
}

/** A few footsteps walking past at a distance. */
function walk(e: AmbienceEnv, t: number, o: { r?: number; n?: number; id?: Sound; gain?: number } = {}): void {
  const n = o.n ?? 3 + Math.floor(Math.random() * 4);
  let a = anyAngle();
  const da = rand(-12, 12);
  const step = rand(0.5, 0.62);
  for (let i = 0; i < n; i++) {
    e.shot(o.id ?? 'step', a, o.r ?? rand(4, 6), { t: t + i * vary(step, 0.05), gain: (o.gain ?? 0.6) * rand(0.8, 1) });
    a += da;
  }
}

/** A looped, pre-rendered texture into a node. */
function loopInto(e: AmbienceEnv, buf: AudioBuffer, dest: AudioNode, gain: number, rate = 1, t = e.t0): AudioBufferSourceNode {
  const src = e.g.buffer(buf, t, { loop: true, rate, offset: Math.random() * buf.duration });
  src.connect(e.g.gain(gain)).connect(dest);
  return src;
}

function talkLoop(e: AmbienceEnv, rig: MurmurRig, minS: number, maxS: number, gain = 1): void {
  e.every(minS, maxS, (t, dt) => {
    if (Math.random() < 0.15) return; // a pause in the conversation
    rig.speak(t, dt * rand(0.5, 0.85), gain);
  }, rand(0.2, minS));
}

function crickets(e: AmbienceEnv, specs: ReadonlyArray<readonly [angle: number, r: number, f: number, gain: number]>, lowpass?: number): void {
  specs.forEach(([angle, r, f, gain], i) => {
    let dest = e.point(angle, r);
    if (lowpass) {
      const lp = e.g.filter('lowpass', lowpass, 0.6);
      lp.connect(dest);
      dest = lp;
    }
    loopInto(e, cricketBuffer(e.ac, 300 + i * 17, f, 3 + (i % 2)), dest, gain, vary(1, 0.01));
  });
}

function stationPa(e: AmbienceEnv, t: number, angle: number): void {
  e.shot('station_chime', angle, 6, { t, gain: 0.7 });
  e.shot('pa_voice', angle, 6, { t: t + 2.2, gain: 0.8 });
}

// ================================================================ recipes

export const AMBIENCE_RECIPES: Record<AmbienceId, AmbienceRecipe> = {
  train_interior: {
    level: 0.8,
    build(e) {
      for (const b of e.wide({ kind: 'brown', filters: [['lowpass', 140, 0.8]], gain: 0.3 }, 0.45)) {
        e.lfo(b.gain.gain, rand(0.11, 0.17), 0.1);
        e.drift(b.filters[0]!.frequency, 110, 190, 2, 5);
        if (b.pan?.pan) e.lfo(b.pan.pan, rand(0.08, 0.12), 0.12); // the car's sway
      }
      for (const b of e.wide({ kind: 'pink', filters: [['bandpass', 380, 0.7], ['lowpass', 1400]], gain: 0.08 }, 0.75)) e.drift(b.gain.gain, 0.04, 0.07, 1.5, 4);
      e.bed({ kind: 'white', filters: [['highpass', 4000], ['lowpass', 9000]], gain: 0.006, pan: 0.6 });
      const whine = e.g.osc('sine', 330, e.t0);
      whine.connect(e.g.gain(0.004)).connect(e.pan(-0.2));
      e.drift(whine.frequency, 318, 345, 3, 8);
      // clack-clack pairs, alternating front and rear bogies under the floor
      let front = true;
      e.every(1.1, 1.6, (t) => {
        const a = (front ? 0 : 180) + rand(-25, 25);
        front = !front;
        e.shot('rail_clack', a, 2.2, { t, gain: rand(0.7, 1) });
        e.shot('rail_clack', a + rand(-8, 8), 2.2, { t: t + rand(0.1, 0.15), gain: rand(0.55, 0.85) });
      }, 0.4);
      e.every(4, 10, (t) => e.shot(pick<Sound>(['cabin_rattle', 'wood_creak']), anyAngle(), 1.5, { t, gain: 0.45 }));
    },
  },
  platform: {
    level: 1.2,
    build(e) {
      for (const b of e.wide({ kind: 'pink', filters: [['bandpass', 500, 0.6]], gain: 0.07 }, 0.8)) {
        e.drift(b.filters[0]!.frequency, 300, 850, 2, 6);
        e.drift(b.gain.gain, 0.025, 0.07, 2, 5);
      }
      e.bed({ kind: 'brown', filters: [['lowpass', 250]], gain: 0.08 });
      e.bed({ kind: 'white', filters: [['highpass', 5000]], gain: 0.004, pan: -0.4 });
      e.every(7, 16, (t) => walk(e, t));
      e.every(45, 100, (t) => stationPa(e, t, rand(-60, 60)), rand(8, 25));
      e.every(90, 180, (t) => e.shot('train_horn', rand(40, 140), 6, { t, gain: 0.45 }), rand(30, 90));
      e.every(12, 30, (t) => e.shot('bird_chirp', anyAngle(), 6, { t, gain: 0.7 }));
      e.every(12, 25, (t) => e.shot('wind_gust', anyAngle(), 6, { t, gain: 0.4 }));
      e.every(30, 60, (t) => e.shot('crow', anyAngle(), 6, { t, gain: 0.5 }), rand(10, 40));
    },
  },
  street_morning: {
    level: 1.35,
    build(e) {
      e.wide({ kind: 'pink', filters: [['lowpass', 600]], gain: 0.045 }, 0.8);
      const far = e.bed({ kind: 'brown', filters: [['lowpass', 220]], gain: 0.07 });
      e.drift(far.gain.gain, 0.04, 0.09, 3, 8);
      e.every(1.2, 4, (t) => e.shot('bird_chirp', anyAngle(), pick([2.5, 4, 6]), { t, gain: rand(0.5, 1) }));
      e.every(9, 22, (t) => e.shot('car_pass', pick([90, 270]) + rand(-20, 20), 6, { t, gain: 0.7 }));
      e.every(30, 70, (t) => e.shot('shutter_roll', anyAngle(), 6, { t, gain: 0.6 }), rand(5, 30));
      e.every(40, 90, (t) => e.shot('bicycle_bell', anyAngle(), 6, { t, gain: 0.45 }), rand(15, 50));
      e.every(8, 15, (t) => walk(e, t, { r: rand(3, 6) }));
      e.every(60, 120, (t) => e.shot('kid_laugh', anyAngle(), 6, { t, gain: 0.5 }), rand(20, 60));
    },
  },
  street_evening: {
    level: 1.4,
    build(e) {
      e.wide({ kind: 'brown', filters: [['lowpass', 160]], gain: 0.09 }, 0.6);
      e.wide({ kind: 'pink', filters: [['lowpass', 450]], gain: 0.03 }, 0.8);
      e.every(6, 14, (t) => e.shot('car_pass', pick([90, 270]) + rand(-25, 25), pick([2.5, 6]), { t, gain: 0.6 }));
      // a television through somebody's window
      const tvAngle = pick([110, 250]);
      const tvLp = e.g.filter('lowpass', 900, 0.6);
      tvLp.connect(e.point(tvAngle, 6));
      const tv = murmurRig(e.g, tvLp, e.t0, undefined, { pitch: 150, breath: 0.25, level: 0.06, bright: 2200, rate: 4 });
      talkLoop(e, tv, 2.5, 5);
      e.every(25, 60, (t) => e.shot('dog_bark', anyAngle(), 6, { t, gain: 0.45 }), rand(10, 30));
      e.every(40, 90, (t) => e.shot('kid_laugh', anyAngle(), 6, { t, gain: 0.4 }), rand(20, 50));
      e.every(30, 60, (t) => e.shot('door_close', anyAngle(), 6, { t, gain: 0.5 }));
      e.every(10, 20, (t) => walk(e, t, { r: rand(3, 6) }));
      crickets(e, [[200, 6, 4400, 0.03]]);
    },
  },
  town_square: {
    level: 1.7,
    build(e) {
      for (const b of e.wide({ kind: 'pink', filters: [['bandpass', 600, 0.6]], gain: 0.05 }, 0.85)) e.drift(b.gain.gain, 0.02, 0.06, 2, 6);
      e.bed({ kind: 'brown', filters: [['lowpass', 180]], gain: 0.05 });
      e.every(3, 8, (t) => e.shot('pigeon_coo', anyAngle(), pick([1.6, 2.5, 4]), { t, gain: rand(0.6, 1) }));
      e.every(10, 25, (t) => e.shot('wing_flutter', anyAngle(), 2.5, { t, gain: 0.6 }));
      e.every(5, 12, (t) => walk(e, t, { r: rand(2.5, 6) }));
      e.every(10, 20, (t) => e.shot('distant_chatter', anyAngle(), 6, { t, gain: 0.7 }));
      e.every(15, 30, (t) => e.shot('car_pass', anyAngle(), 6, { t, gain: 0.4 }));
    },
  },
  construction_far: {
    level: 1.0,
    build(e) {
      e.bed({ kind: 'brown', filters: [['lowpass', 120]], gain: 0.1 });
      const site = rand(0, 360);
      const engine = e.g.osc('sawtooth', 45, e.t0);
      const lp = e.g.filter('lowpass', 180, 0.7);
      engine.connect(lp).connect(e.g.gain(0.02)).connect(e.point(site, 6));
      e.drift(engine.frequency, 42, 50, 2, 6);
      e.every(6, 14, (t) => e.shot('construction_drill', site + rand(-20, 20), 6, { t, gain: 0.8 }));
      e.every(7, 16, (t) => e.shot('hammer', site + rand(-30, 30), 6, { t, gain: 0.6 }));
      e.every(10, 25, (t) => e.shot('tools_clink', site + rand(-30, 30), 6, { t, gain: 0.5, rate: 0.6 }));
      e.every(40, 90, (t) => e.shot('truck_reverse', site + rand(-30, 30), 6, { t, gain: 0.5 }), rand(10, 40));
    },
  },
  old_house: {
    level: 1.1,
    build(e) {
      e.wide({ kind: 'pink', filters: [['lowpass', 220]], gain: 0.05 }, 0.6);
      e.bed({ kind: 'white', filters: [['highpass', 6000]], gain: 0.002 });
      e.bed({ kind: 'brown', filters: [['lowpass', 80]], gain: 0.04 });
      const win = e.bed({ kind: 'pink', filters: [['bandpass', 900, 3]], gain: 0.008, pan: 0.7 });
      e.drift(win.gain.gain, 0.002, 0.012, 2, 6);
      e.drift(win.filters[0]!.frequency, 650, 1200, 3, 8);
      e.every(6, 18, (t) => e.shot('wood_creak', anyAngle(), pick([1.6, 2.5, 4]), { t, gain: rand(0.5, 0.9) }));
      e.every(4, 12, (t) => e.shot('house_tick', anyAngle(), pick([1.6, 2.5, 4]), { t, gain: rand(0.4, 0.8) }));
    },
  },
  house_night: {
    level: 1.4,
    build(e) {
      e.wide({ kind: 'pink', filters: [['lowpass', 200]], gain: 0.04 }, 0.6);
      // the fridge in the next room
      const fridge = e.point(250, 2.5);
      const hum = e.g.osc('sawtooth', 59.8, e.t0);
      const fg = e.g.gain(0.03);
      hum.connect(e.g.filter('lowpass', 220, 0.7)).connect(fg).connect(fridge);
      e.g.osc('sine', 119.6, e.t0).connect(e.g.gain(0.008)).connect(fridge);
      e.drift(fg.gain, 0.018, 0.034, 8, 20);
      const comp = e.g.noise('pink', e.t0);
      comp.connect(e.g.filter('bandpass', 300, 4)).connect(e.g.gain(0.006)).connect(fridge);
      e.every(60, 140, (t) => e.shot('fridge_click', 250, 2.5, { t, gain: 0.5 }), rand(20, 60));
      crickets(e, [[60, 6, 4300, 0.07], [95, 6, 4700, 0.06], [125, 6, 4500, 0.06]], 3000);
      e.every(6, 15, (t) => e.shot('house_tick', anyAngle(), pick([1.6, 2.5, 4]), { t, gain: 0.5 }));
      e.every(15, 35, (t) => e.shot('wood_creak', anyAngle(), 2.5, { t, gain: 0.5 }));
      e.every(40, 80, (t) => e.shot('car_pass', pick([60, 120]), 6, { t, gain: 0.25, rate: 0.9 }));
    },
  },
  clock_shop: {
    level: 1.3,
    build(e) {
      e.wide({ kind: 'pink', filters: [['lowpass', 250]], gain: 0.03 }, 0.6);
      // [beats/sec, tick pitch, level, angle, distance, case body]
      const clocks: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
        [1.0, 900, 0.8, 300, 2.5, 0.7], // tall pendulum clock
        [2.0, 2600, 0.4, 40, 1.6, 0.2],
        [2.5, 3400, 0.3, 100, 2.2, 0.15],
        [3.0, 4200, 0.22, 160, 1.4, 0.1],
        [1.5, 1800, 0.5, 210, 2.8, 0.4],
        [4.0, 5200, 0.17, 250, 1.2, 0.05],
        [2.0, 3000, 0.3, 20, 3.0, 0.2],
        [1.33, 1500, 0.5, 130, 3.2, 0.5],
        [5.0, 6000, 0.12, 340, 1.1, 0.05],
      ];
      clocks.forEach(([bps, f, lv, angle, r, body], i) => {
        const buf = clockBuffer(e.ac, `shop${i}`, bps, f, body, 101 + i * 7);
        loopInto(e, buf, e.point(angle, r), lv, vary(1, 0.004), e.t0 + rand(0, 1));
      });
      e.every(50, 110, (t) => e.shot('clock_chime', anyAngle(), 3, { t, gain: 0.45 }), rand(15, 50));
      e.every(25, 60, (t) => e.shot('tools_clink', pick([0, 330, 30]), 1.4, { t, gain: 0.25 }));
    },
  },
  cafe: {
    level: 2.2,
    build(e) {
      e.space('cafe', 1.1, { brightness: 0.45, damping: 2, level: 0.45 });
      e.wide({ kind: 'pink', filters: [['lowpass', 500]], gain: 0.025, send: 0.3 }, 0.8);
      const voices: ReadonlyArray<readonly [number, number, number]> = [
        [40, 3.5, 115],
        [110, 5, 195],
        [200, 6, 130],
        [255, 3, 215],
        [320, 6, 165],
      ];
      for (const [a, r, pitch] of voices) talkLoop(e, e.murmur(a, r, { pitch: pitch * vary(1, 0.05), breath: 0.35, level: 0.09, bright: 1600 }), 2, 5);
      const counter = 150;
      e.every(3, 9, (t) => e.shot('cup_set', anyAngle(), pick([2.5, 4, 6]), { t, gain: rand(0.4, 0.7) }));
      e.every(12, 30, (t) => e.shot('spoon_stir', anyAngle(), pick([2.5, 4]), { t, gain: 0.45 }));
      e.every(20, 40, (t) => e.shot('glass_clink', anyAngle(), 4, { t, gain: 0.35 }));
      e.every(30, 60, (t) => e.shot('steam_hiss', counter, 3, { t, gain: 0.55 }), rand(5, 25));
      e.every(40, 80, (t) => {
        e.shot('coffee_grind', counter + rand(-10, 10), 3, { t, gain: 0.5 });
        e.shot('thud', counter, 3, { t: t + 4, gain: 0.15, rate: 1.6 });
      }, rand(10, 40));
      e.every(25, 50, (t) => e.shot('chair_scrape', anyAngle(), 4, { t, gain: 0.35 }));
    },
  },
  hospital: {
    level: 1.3,
    build(e) {
      e.space('corridor', 1.6, { brightness: 0.55, damping: 1.4, early: 8, earlySpread: 0.03, level: 0.5 });
      e.wide({ kind: 'pink', filters: [['lowpass', 500]], gain: 0.05 }, 0.7);
      e.bed({ kind: 'brown', filters: [['lowpass', 120]], gain: 0.04 });
      const buzz = e.g.osc('sawtooth', 120, e.t0);
      buzz.connect(e.g.filter('bandpass', 240, 3)).connect(e.g.gain(0.002)).connect(e.point(0, 1.6));
      e.every(50, 110, (t) => stationPa(e, t, anyAngle()), rand(10, 40));
      e.every(8, 18, (t) => walk(e, t, { r: rand(2.5, 6), gain: 0.4 }));
      e.every(25, 50, (t) => e.shot('cart_roll', anyAngle(), 4, { t, gain: 0.6 }));
      e.every(20, 40, (t) => e.shot('monitor_beep', pick([70, 290]), 6, { t, gain: 0.4 }));
      e.every(30, 70, (t) => e.shot('cough', anyAngle(), 6, { t, gain: 0.4 }));
      e.every(30, 60, (t) => e.shot('door_close', anyAngle(), 6, { t, gain: 0.4 }));
    },
  },
  police_office: {
    level: 2.1,
    build(e) {
      e.space('office', 0.9, { brightness: 0.5, damping: 2, level: 0.4 });
      e.wide({ kind: 'pink', filters: [['lowpass', 400]], gain: 0.03 }, 0.7);
      // desk fan, front-right
      const fan = e.point(45, 1.6);
      const air = e.g.noise('pink', e.t0);
      const am = e.g.gain(0.08);
      air.connect(e.g.filter('bandpass', 700, 0.8)).connect(am).connect(fan);
      e.g.lfo(am.gain, 6.5, 0.025, e.t0);
      e.g.osc('sawtooth', 100, e.t0).connect(e.g.filter('lowpass', 200, 0.7)).connect(e.g.gain(0.006)).connect(fan);
      loopInto(e, clockBuffer(e.ac, 'office', 1, 1300, 0.3, 77), e.point(330, 3), 0.12);
      e.every(8, 20, (t) => e.shot('typing', pick([60, 120, 300]), pick([2.5, 6]), { t, gain: 0.5 }));
      e.every(40, 90, (t) => e.shot('phone_ring', anyAngle(), 6, { t, gain: 0.45 }), rand(15, 50));
      e.every(10, 25, (t) => e.shot('paper_rustle', anyAngle(), 2.5, { t, gain: 0.4 }));
      e.every(30, 60, (t) => e.shot('chair_scrape', anyAngle(), 4, { t, gain: 0.35 }));
      talkLoop(e, e.murmur(200, 6, { pitch: 118, breath: 0.3, level: 0.07, bright: 1300 }), 3, 7);
      e.every(30, 70, (t) => e.shot('door_close', anyAngle(), 6, { t, gain: 0.4 }));
    },
  },
  library: {
    level: 1.25,
    build(e) {
      e.space('library', 1.8, { brightness: 0.4, damping: 1.8, level: 0.4 });
      e.wide({ kind: 'pink', filters: [['lowpass', 350]], gain: 0.03 }, 0.7);
      e.bed({ kind: 'brown', filters: [['lowpass', 90]], gain: 0.03 });
      e.every(4, 12, (t) => e.shot('page_turn', anyAngle(), pick([2.5, 4, 6]), { t, gain: rand(0.4, 0.7) }));
      e.every(20, 40, (t) => e.shot('pen_scratch', anyAngle(), 4, { t, gain: 0.4 }));
      e.every(40, 90, (t) => e.shot('cough', anyAngle(), 6, { t, gain: 0.35 }));
      e.every(15, 30, (t) => walk(e, t, { r: 6, gain: 0.35 }));
      e.every(40, 80, (t) => e.shot('chair_scrape', anyAngle(), 6, { t, gain: 0.3 }));
      e.every(30, 60, (t) => e.shot('whisper', anyAngle(), 6, { t, gain: 0.4 }));
    },
  },
  old_station_hall: {
    level: 1.4,
    build(e) {
      e.space('hall', 4.5, { brightness: 0.5, damping: 0.9, early: 10, earlySpread: 0.12, level: 0.75 });
      for (const b of e.wide({ kind: 'pink', filters: [['bandpass', 450, 0.7]], gain: 0.05, send: 0.5 }, 0.85)) {
        e.drift(b.filters[0]!.frequency, 300, 700, 2, 6);
        e.drift(b.gain.gain, 0.02, 0.06, 2, 6);
      }
      const whistle = e.bed({ kind: 'white', filters: [['bandpass', 900, 20]], gain: 0.008, pan: -0.5, send: 0.8 });
      e.drift(whistle.filters[0]!.frequency, 700, 1250, 3, 8);
      e.drift(whistle.gain.gain, 0, 0.012, 3, 7);
      e.bed({ kind: 'brown', filters: [['lowpass', 80]], gain: 0.06 });
      e.every(2, 6, (t) => e.shot('drip', anyAngle(), pick([2.5, 4, 6]), { t, gain: rand(0.5, 0.9) }));
      e.every(20, 40, (t) => e.shot('wing_flutter', anyAngle(), 6, { t, gain: 0.5 }));
      e.every(30, 60, (t) => e.shot('metal_groan', anyAngle(), 6, { t, gain: 0.5 }), rand(10, 30));
      e.every(15, 30, (t) => e.shot('wind_gust', anyAngle(), 6, { t, gain: 0.45 }));
    },
  },
  maintenance_tunnel: {
    level: 1.6,
    build(e) {
      e.space('tunnel', 1.6, { brightness: 0.6, damping: 1.6, early: 14, earlySpread: 0.025, level: 0.6 });
      // transformer hum on both walls, very slightly detuned so it beats slowly
      for (const [angle, f] of [[270, 50], [90, 50.3]] as const) {
        const dest = e.point(angle, 1.2, 0.5);
        e.g.osc('sawtooth', f, e.t0).connect(e.g.filter('lowpass', 300, 0.8)).connect(e.g.gain(0.04)).connect(dest);
        e.g.osc('sine', f * 2, e.t0).connect(e.g.gain(0.01)).connect(dest);
      }
      e.wide({ kind: 'pink', filters: [['bandpass', 260, 1.5]], gain: 0.08, send: 0.3 }, 0.6);
      e.bed({ kind: 'white', filters: [['highpass', 3000]], gain: 0.003 });
      const tube = e.g.osc('square', 120, e.t0);
      tube.connect(e.g.filter('bandpass', 2400, 0.9)).connect(e.g.gain(0.0015)).connect(e.point(0, 2));
      e.every(1.5, 4, (t) => e.shot(pick<Sound>(['drip', 'drip_metal']), pick([10, 170, 190, 350]) + rand(-15, 15), pick([1.6, 2.5, 4]), { t, gain: rand(0.5, 0.9) }));
      e.every(15, 35, (t) => e.shot('pipe_knock', pick([0, 180]) + rand(-20, 20), 6, { t, gain: 0.5 }));
      e.every(30, 70, (t) => e.shot('relay_click', anyAngle(), 4, { t, gain: 0.3 }));
    },
  },
  research_facility: {
    level: 1.4,
    build(e) {
      e.space('lab', 1.2, { brightness: 0.5, damping: 1.8, level: 0.4 });
      e.bed({ kind: 'brown', filters: [['lowpass', 120]], gain: 0.05 });
      for (const [angle, r, tone] of [[60, 2.5, 230], [140, 4, 310], [300, 3, 415]] as const) {
        const dest = e.point(angle, r);
        const fan = e.g.noise('pink', e.t0);
        fan.connect(e.g.filter('bandpass', 1800, 0.6)).connect(e.g.gain(0.025)).connect(dest);
        const o = e.g.osc('sine', tone, e.t0);
        o.connect(e.g.gain(0.0025)).connect(dest);
        e.drift(o.frequency, tone - 2, tone + 2, 4, 10);
      }
      e.every(4, 12, (t) => e.shot('hdd_seek', anyAngle(), 2.5, { t, gain: 0.5 }));
      e.every(30, 60, (t) => e.shot('relay_click', anyAngle(), 4, { t, gain: 0.25 }));
      e.every(25, 50, (t) => e.shot('monitor_beep', anyAngle(), 6, { t, gain: 0.25 }));
    },
  },
  rain: {
    level: 1.4,
    build(e) {
      // distant roar and a little air; the body of the rain comes from the drop textures below
      const beds = [
        ...e.wide({ kind: 'pink', filters: [['lowpass', 700]], gain: 0.08 }, 0.7),
        ...e.wide({ kind: 'pink', filters: [['bandpass', 1800, 0.5]], gain: 0.025 }, 0.85),
        ...e.wide({ kind: 'white', filters: [['highpass', 5500]], gain: 0.007 }, 0.9),
      ];
      for (const b of beds) e.drift(b.gain.gain, b.gain.gain.value * 0.7, b.gain.gain.value * 1.15, 3, 9);
      ([[-0.65, 11.3], [0.65, 12.7]] as const).forEach(([p, seconds], i) => {
        const hp = e.g.filter('highpass', 900, 0.7);
        const swell = e.g.gain(1);
        hp.connect(swell).connect(e.pan(p));
        e.drift(swell.gain, 0.75, 1.15, 2, 7);
        loopInto(e, rainBuffer(e.ac, 21 + i, seconds, RAIN_OUTDOOR), hp, 0.3, vary(1, 0.02));
      });
      // drops landing close by, never in the same place twice
      e.every(0.12, 0.55, (t) => e.shot('rain_drop_near', anyAngle(), rand(1.2, 3), { t, gain: rand(0.25, 0.6) }));
      const eave = rand(270, 340);
      e.every(1.8, 4.5, (t) => {
        if (Math.random() < 0.25) return;
        e.shot('drip', eave + rand(-10, 10), 1.8, { t, gain: rand(0.12, 0.28) });
      });
      e.every(60, 150, (t) => e.shot('thunder_far', anyAngle(), 6, { t, gain: 0.6 }), rand(20, 80));
    },
  },
  rain_on_window: {
    level: 1.4,
    build(e) {
      e.wide({ kind: 'pink', filters: [['lowpass', 500]], gain: 0.06 }, 0.7);
      e.bed({ kind: 'brown', filters: [['lowpass', 100]], gain: 0.03 });
      ([[330, 9.1], [30, 10.9]] as const).forEach(([a, seconds], i) => {
        const hp = e.g.filter('highpass', 1500, 0.7);
        const swell = e.g.gain(1);
        hp.connect(swell).connect(e.point(a, 1.5));
        e.drift(swell.gain, 0.7, 1.2, 2, 8);
        loopInto(e, rainBuffer(e.ac, 41 + i, seconds, RAIN_GLASS), hp, 0.4, vary(1, 0.02));
      });
      // the odd heavier drop striking the pane, somewhere across the window
      e.every(0.4, 1.6, (t) => e.shot('rain_tap_glass', rand(-45, 45), 1.4, { t, gain: rand(0.2, 0.5) }));
      const trickle = e.point(350, 1.5);
      const cr = e.g.buffer(crackleBuffer(e.ac), e.t0, { loop: true, rate: 0.4 });
      cr.connect(e.g.filter('lowpass', 1500, 0.7)).connect(e.g.gain(0.02)).connect(trickle);
      e.every(90, 200, (t) => e.shot('thunder_far', anyAngle(), 6, { t, gain: 0.4, rate: 0.9 }), rand(30, 90));
    },
  },
  sea_far: {
    level: 1.6,
    build(e) {
      for (const b of e.wide({ kind: 'pink', filters: [['lowpass', 350]], gain: 0.06 }, 0.8)) e.lfo(b.gain.gain, rand(0.06, 0.1), 0.02);
      e.every(5, 10, (t) => e.shot('wave', rand(-60, 60), 6, { t, gain: rand(0.6, 0.9) }), 0.5);
      e.every(12, 35, (t) => e.shot('seagull', anyAngle(), 6, { t, gain: 0.6 }));
      const w = e.bed({ kind: 'pink', filters: [['bandpass', 600, 0.7]], gain: 0.02, pan: 0.3 });
      e.drift(w.gain.gain, 0.008, 0.03, 3, 8);
    },
  },
  night_insects: {
    level: 2.6,
    build(e) {
      e.wide({ kind: 'pink', filters: [['lowpass', 250]], gain: 0.025 }, 0.7);
      crickets(e, [
        [30, 4, 4300, 0.15],
        [100, 6, 4900, 0.12],
        [170, 2.5, 4600, 0.1],
        [240, 6, 5200, 0.1],
        [300, 4, 4100, 0.13],
      ]);
      const trill = e.point(200, 6);
      const tg = e.g.gain(0.015);
      e.g.noise('white', e.t0).connect(e.g.filter('bandpass', 6500, 8)).connect(tg).connect(trill);
      e.g.lfo(tg.gain, 38, 0.015, e.t0);
      e.every(60, 120, (t) => e.shot('dog_bark', anyAngle(), 6, { t, gain: 0.35 }), rand(20, 60));
    },
  },
  wind_open: {
    level: 1.6,
    build(e) {
      for (const b of e.wide({ kind: 'pink', filters: [['bandpass', 500, 0.5]], gain: 0.08 }, 0.85)) {
        e.drift(b.filters[0]!.frequency, 250, 900, 2, 5);
        e.drift(b.gain.gain, 0.025, 0.08, 1.5, 4);
      }
      const low = e.bed({ kind: 'brown', filters: [['lowpass', 150]], gain: 0.06 });
      e.drift(low.gain.gain, 0.03, 0.08, 2, 6);
      const whistle = e.bed({ kind: 'white', filters: [['bandpass', 1200, 14]], gain: 0.004, pan: 0.4 });
      e.drift(whistle.filters[0]!.frequency, 800, 1800, 2, 6);
      e.drift(whistle.gain.gain, 0, 0.008, 2, 5);
      e.every(8, 18, (t) => e.shot('wind_gust', anyAngle(), 2.5, { t, gain: 0.6 }));
    },
  },
  restaurant: {
    level: 2.8,
    build(e) {
      e.space('restaurant', 0.9, { brightness: 0.5, damping: 2, level: 0.4 });
      const kitchen = e.point(210, 2.5);
      const sizzle = e.g.buffer(crackleBuffer(e.ac), e.t0, { loop: true, rate: 1 });
      const sg = e.g.gain(0.3);
      sizzle.connect(e.g.filter('highpass', 2500, 0.7)).connect(sg).connect(kitchen);
      e.drift(sg.gain, 0.15, 0.4, 2, 6);
      e.g.noise('white', e.t0).connect(e.g.filter('highpass', 4000, 0.7)).connect(e.g.gain(0.015)).connect(kitchen);
      e.every(10, 25, (t) => e.shot('wok', 210 + rand(-10, 10), 2.5, { t, gain: 0.6 }));
      const fan = e.point(180, 3);
      e.g.noise('brown', e.t0).connect(e.g.filter('lowpass', 200, 0.7)).connect(e.g.gain(0.1)).connect(fan);
      e.g.noise('pink', e.t0).connect(e.g.filter('bandpass', 400, 1)).connect(e.g.gain(0.05)).connect(fan);
      // TV up in the corner
      const tvBand = e.g.filter('highpass', 400, 0.7);
      tvBand.connect(e.point(40, 3));
      talkLoop(e, murmurRig(e.g, tvBand, e.t0, undefined, { pitch: 150, breath: 0.2, level: 0.06, bright: 2600, rate: 4.2 }), 2.5, 5);
      talkLoop(e, e.murmur(100, 2.5, { pitch: 120, breath: 0.3, level: 0.08, bright: 1500 }), 2, 5);
      talkLoop(e, e.murmur(290, 4, { pitch: 200, breath: 0.35, level: 0.08, bright: 1600 }), 2, 5);
      e.every(3, 8, (t) => e.shot('cup_set', anyAngle(), pick([2.5, 4]), { t, gain: 0.45, rate: 0.8 }));
      e.every(15, 30, (t) => e.shot('glass_clink', anyAngle(), 4, { t, gain: 0.3 }));
      e.every(4, 9, (t) => e.shot('chopsticks', anyAngle(), pick([1.6, 2.5]), { t, gain: 0.5 }));
      e.every(30, 60, (t) => e.shot('chair_scrape', anyAngle(), 4, { t, gain: 0.35 }));
    },
  },
  room_tone: {
    level: 1.0,
    build(e) {
      for (const b of e.wide({ kind: 'pink', filters: [['lowpass', 180]], gain: 0.025 }, 0.6)) e.lfo(b.gain.gain, rand(0.03, 0.06), 0.006);
      e.wide({ kind: 'white', filters: [['highpass', 7000]], gain: 0.0015 }, 0.8);
    },
  },
  tower_square_night: {
    level: 1.2,
    build(e) {
      for (const b of e.wide({ kind: 'pink', filters: [['bandpass', 450, 0.6]], gain: 0.035 }, 0.85)) e.drift(b.gain.gain, 0.012, 0.04, 2, 6);
      e.bed({ kind: 'brown', filters: [['lowpass', 140]], gain: 0.05 });
      e.every(15, 40, (t) => e.shot('car_pass', anyAngle(), 6, { t, gain: 0.4 }));
      crickets(e, [[250, 6, 4500, 0.03], [290, 6, 4800, 0.025]]);
      e.every(60, 140, (t) => e.shot('dog_bark', anyAngle(), 6, { t, gain: 0.25 }), rand(20, 60));
      e.every(30, 70, (t) => e.shot('tower_groan', 0, 6, { t, gain: 0.5 }), rand(10, 30));
      e.every(25, 60, (t) => walk(e, t, { r: 6, gain: 0.4 }));
    },
  },
};

// ================================================================ layer lifecycle

export interface AmbienceLayer {
  readonly id: AmbienceId;
  readonly stopping: boolean;
  readonly disposed: boolean;
  fadeIn(seconds: number): void;
  /** Fade to silence, then free everything. */
  stop(seconds: number): void;
  /** Cancel a pending stop and fade back in. */
  revive(seconds: number): void;
  dispose(): void;
  /** Diagnostics (tests / lab). */
  readonly stats: { timers: number; shots: number; nodes: number };
}

export function startAmbience(
  ac: BaseAudioContext,
  id: AmbienceId,
  dest: AudioNode,
  reverb: AudioNode | null,
  onDisposed?: (layer: AmbienceLayer) => void,
): AmbienceLayer | null {
  const recipe = AMBIENCE_RECIPES[id];
  if (!recipe) return null;
  const out = ac.createGain();
  out.gain.value = 0;
  out.connect(dest);
  const env = new Env(ac, out, reverb);
  try {
    recipe.build(env);
  } catch {
    env.dispose();
    return null;
  }
  let stopping = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const layer: AmbienceLayer = {
    id,
    get stopping() {
      return stopping;
    },
    get disposed() {
      return env.disposed;
    },
    get stats() {
      return { timers: env.activeTimers, shots: env.activeShots, nodes: env.g.nodes.length };
    },
    fadeIn(seconds) {
      rampTo(out.gain, recipe.level, ac.currentTime, seconds);
    },
    stop(seconds) {
      if (env.disposed) return;
      stopping = true;
      rampTo(out.gain, 0, ac.currentTime, seconds);
      if (timer !== null) clearTimeout(timer);
      // The layer keeps scheduling events while fading out; they fade with it.
      const end = ac.currentTime + seconds;
      const check = (): void => {
        const remain = end - ac.currentTime;
        if (remain > 0.02) timer = setTimeout(check, remain * 1000 + 100);
        else layer.dispose();
      };
      timer = setTimeout(check, seconds * 1000 + 100);
    },
    revive(seconds) {
      if (env.disposed) return;
      stopping = false;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      rampTo(out.gain, recipe.level, ac.currentTime, seconds);
    },
    dispose() {
      if (env.disposed) return;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      env.dispose();
      onDisposed?.(layer);
    },
  };
  return layer;
}
