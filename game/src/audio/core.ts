// Shared plumbing for the procedural audio engine: randomness, cached buffers (noise, impulse
// responses, pre-rendered textures), envelope helpers, a node-tracking Graph and the spatial chain.
// Nothing in here touches a real AudioContext until a caller hands one in.

import { DIRECTION_ANGLE, type Direction, type Distance, type SpatialPos } from './catalog';

export type NoiseKind = 'white' | 'pink' | 'brown';

// ---------------------------------------------------------------- randomness

export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** x scaled by a random factor in [1 - amount, 1 + amount]. */
export function vary(x: number, amount: number): number {
  return x * (1 + (Math.random() * 2 - 1) * amount);
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Small deterministic PRNG for pre-rendered buffers (so they are identical every session). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- caches & buffers

const caches = new WeakMap<BaseAudioContext, Map<string, unknown>>();

export function cached<T>(ac: BaseAudioContext, key: string, make: () => T): T {
  let m = caches.get(ac);
  if (!m) {
    m = new Map();
    caches.set(ac, m);
  }
  if (m.has(key)) return m.get(key) as T;
  const v = make();
  m.set(key, v);
  return v;
}

/** Render (once per context) a buffer by filling its channel data in JS. */
export function renderBuffer(
  ac: BaseAudioContext,
  key: string,
  seconds: number,
  channels: number,
  fill: (data: Float32Array[], sr: number) => void,
): AudioBuffer {
  return cached(ac, `buf:${key}`, () => {
    const sr = ac.sampleRate;
    const len = Math.max(1, Math.floor(seconds * sr));
    const buf = ac.createBuffer(channels, len, sr);
    const data: Float32Array[] = [];
    for (let c = 0; c < channels; c++) data.push(buf.getChannelData(c));
    fill(data, sr);
    return buf;
  });
}

function normalizeRms(d: Float32Array, target: number): void {
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d[i]! * d[i]!;
  const rms = Math.sqrt(sum / Math.max(1, d.length));
  if (rms <= 0) return;
  const k = target / rms;
  for (let i = 0; i < d.length; i++) d[i]! *= k;
}

export function normalizePeak(d: Float32Array, target: number): void {
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]!));
  if (peak <= 0) return;
  const k = target / peak;
  for (let i = 0; i < d.length; i++) d[i]! *= k;
}

const NOISE_SECONDS = 6;
const NOISE_RMS = 0.25;

/**
 * Looping noise buffers, generated once per context. The tail is cross-faded into samples that
 * "precede" the head so the loop seam is inaudible even for brown noise.
 */
export function noiseBuffer(ac: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  return renderBuffer(ac, `noise:${kind}`, NOISE_SECONDS, 1, ([d], sr) => {
    const out = d!;
    const fade = Math.floor(sr * 0.08);
    const total = out.length + fade;
    const rnd = mulberry32(kind === 'white' ? 11 : kind === 'pink' ? 23 : 37);
    const tmp = new Float32Array(total);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < total; i++) {
      const w = rnd() * 2 - 1;
      if (kind === 'white') tmp[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        tmp[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        tmp[i] = last;
      }
    }
    // tmp[0..fade) is the material that leads into out[0]; blend the tail of out into it.
    for (let i = 0; i < out.length; i++) out[i] = tmp[i + fade]!;
    for (let i = 0; i < fade; i++) {
      const x = i / fade;
      const idx = out.length - fade + i;
      out[idx] = out[idx]! * Math.sqrt(1 - x) + tmp[i]! * Math.sqrt(x);
    }
    if (kind === 'brown') {
      let mean = 0;
      for (let i = 0; i < out.length; i++) mean += out[i]!;
      mean /= out.length;
      for (let i = 0; i < out.length; i++) out[i]! -= mean;
    }
    normalizeRms(out, NOISE_RMS);
  });
}

export interface ImpulseOpts {
  seconds: number;
  preDelay?: number;
  /** One-pole lowpass coefficient at t=0 (at 48 kHz); higher = brighter. */
  brightness?: number;
  /** How fast the tail darkens (per second). */
  damping?: number;
  /** Number of discrete early reflections. */
  early?: number;
  earlySpread?: number;
  seed?: number;
}

/** Stereo, decorrelated, darkening noise-tail impulse response for ConvolverNode reverbs. */
export function impulseResponse(ac: BaseAudioContext, key: string, o: ImpulseOpts): AudioBuffer {
  return renderBuffer(ac, `ir:${key}`, o.seconds + (o.preDelay ?? 0.01), 2, (chs, sr) => {
    const pre = Math.floor((o.preDelay ?? 0.01) * sr);
    const scale = 48000 / sr;
    const a0 = Math.min(0.98, (o.brightness ?? 0.6) * scale);
    const damping = o.damping ?? 1.2;
    chs.forEach((d, ch) => {
      const rnd = mulberry32((o.seed ?? 7) * 31 + ch * 1013);
      let y = 0;
      for (let i = pre; i < d.length; i++) {
        const t = (i - pre) / sr;
        const env = Math.exp((-6.9 * t) / o.seconds);
        const a = Math.max(0.002, a0 * Math.exp(-damping * t));
        y += a * (rnd() * 2 - 1 - y);
        const fadeIn = Math.min(1, (i - pre) / (sr * 0.004));
        d[i] = y * env * fadeIn * (1 / Math.sqrt(a + 0.02));
      }
      const early = o.early ?? 6;
      const spread = o.earlySpread ?? 0.06;
      for (let k = 0; k < early; k++) {
        const at = pre + Math.floor((0.004 + rnd() * spread) * sr);
        if (at < d.length) d[at]! += (rnd() < 0.5 ? -1 : 1) * (0.4 + rnd() * 0.5) * (1 - k / (early + 1));
      }
    });
    for (const d of chs) normalizePeak(d, 0.9);
  });
}

/** Decaying-sine "hit" added into a buffer (used for pre-rendered ticks, drops, rings). */
export function addHit(
  d: Float32Array,
  sr: number,
  at: number,
  partials: ReadonlyArray<readonly [freq: number, amp: number, t60: number]>,
  noiseAmp = 0,
  noiseT60 = 0.002,
  rnd: () => number = Math.random,
  wrap = false,
): void {
  const start = Math.floor(at * sr);
  for (const [f, amp, t60] of partials) {
    if (f >= sr * 0.48) continue;
    const n = Math.ceil(t60 * sr);
    const k = (2 * Math.PI * f) / sr;
    const dec = Math.exp(-6.9 / Math.max(1, t60 * sr));
    let e = amp;
    for (let i = 0; i < n; i++) {
      let idx = start + i;
      if (idx >= d.length) {
        if (!wrap) break;
        idx %= d.length;
      }
      // tiny attack ramp so the onset is a soft "tk" rather than a DC click
      const att = i < 8 ? i / 8 : 1;
      d[idx]! += e * att * Math.sin(k * i);
      e *= dec;
    }
  }
  if (noiseAmp > 0) {
    const n = Math.ceil(noiseT60 * sr);
    const dec = Math.exp(-6.9 / Math.max(1, n));
    let e = noiseAmp;
    for (let i = 0; i < n; i++) {
      let idx = start + i;
      if (idx >= d.length) {
        if (!wrap) break;
        idx %= d.length;
      }
      d[idx]! += e * (rnd() * 2 - 1);
      e *= dec;
    }
  }
}

/** Sparse random impulses — the raw material for crackle, grit, sizzle, paper and static. */
export function crackleBuffer(ac: BaseAudioContext): AudioBuffer {
  return renderBuffer(ac, 'crackle', 4, 1, ([d], sr) => {
    const out = d!;
    const rnd = mulberry32(99);
    const count = Math.floor(4 * 420);
    for (let k = 0; k < count; k++) {
      const start = Math.floor(rnd() * out.length);
      const amp = Math.pow(rnd(), 3) * (rnd() < 0.5 ? -1 : 1);
      const len = 2 + Math.floor(rnd() * Math.max(2, sr / 4000));
      for (let i = 0; i < len; i++) {
        const idx = (start + i) % out.length;
        out[idx]! += amp * Math.exp(-i / (len * 0.35)) * (i % 2 === 0 ? 1 : -0.6);
      }
    }
    normalizePeak(out, 0.95);
  });
}

// ---------------------------------------------------------------- param helpers

const MIN_TC = 0.0008;

/** Freeze a param at its current (automated) value from time t onward. */
export function hold(p: AudioParam, t: number): void {
  const anyParam = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
  if (typeof anyParam.cancelAndHoldAtTime === 'function') {
    try {
      anyParam.cancelAndHoldAtTime(t);
      return;
    } catch {
      // fall through
    }
  }
  const v = p.value;
  p.cancelScheduledValues(t);
  p.setValueAtTime(v, t);
}

/** Smoothly glide a param to v starting now (exponential approach, click-free). */
export function glide(p: AudioParam, v: number, t: number, timeConstant: number): void {
  hold(p, t);
  p.setTargetAtTime(v, t, Math.max(MIN_TC, timeConstant));
}

/** Exponential ramp (for frequencies) from the current value to v over `dur` seconds. */
export function expRampTo(p: AudioParam, v: number, t: number, dur: number): void {
  hold(p, t);
  p.exponentialRampToValueAtTime(Math.max(1e-4, v), t + Math.max(0.005, dur));
}

/** Linear ramp from the current value to v over `dur` seconds. */
export function rampTo(p: AudioParam, v: number, t: number, dur: number): void {
  hold(p, t);
  p.linearRampToValueAtTime(v, t + Math.max(0.005, dur));
}

/** Percussive envelope: linear attack to peak, exponential decay with the given T60. */
export function perc(p: AudioParam, t: number, peak: number, att: number, t60: number): void {
  const a = Math.max(0.0005, att);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(0, t + a, Math.max(MIN_TC, t60 / 6.9));
}

/** Piecewise-linear shape; points are [offsetSeconds, value], offsets increasing. */
export function shape(p: AudioParam, t: number, pts: ReadonlyArray<readonly [number, number]>): void {
  if (pts.length === 0) return;
  const [d0, v0] = pts[0]!;
  p.setValueAtTime(v0, t + d0);
  for (let i = 1; i < pts.length; i++) {
    const [dt, v] = pts[i]!;
    p.linearRampToValueAtTime(v, t + dt);
  }
}

/** Exponential glide through frequency points [offset, hz]. */
export function sweep(p: AudioParam, t: number, from: number, pts: ReadonlyArray<readonly [number, number]>): void {
  p.setValueAtTime(Math.max(1, from), t);
  for (const [dt, v] of pts) p.exponentialRampToValueAtTime(Math.max(1, v), t + dt);
}

// ---------------------------------------------------------------- graph

/**
 * Creates nodes and remembers them, so a whole one-shot or ambience layer can be stopped and
 * disconnected in one call (no leaks over hours of play).
 */
export class Graph {
  readonly sources: AudioScheduledSourceNode[] = [];
  readonly nodes: AudioNode[] = [];
  disposed = false;

  constructor(readonly ac: BaseAudioContext) {}

  private keep<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  private src<T extends AudioScheduledSourceNode>(n: T): T {
    this.sources.push(n);
    this.nodes.push(n);
    return n;
  }

  get nyquist(): number {
    return this.ac.sampleRate / 2;
  }

  gain(v = 1): GainNode {
    const n = this.ac.createGain();
    n.gain.value = v;
    return this.keep(n);
  }

  filter(type: BiquadFilterType, freq: number, q = 0.707, gainDb = 0): BiquadFilterNode {
    const n = this.ac.createBiquadFilter();
    n.type = type;
    n.frequency.value = clamp(freq, 10, this.nyquist * 0.98);
    n.Q.value = q;
    n.gain.value = gainDb;
    return this.keep(n);
  }

  osc(type: OscillatorType | PeriodicWave, freq: number, t0: number, t1?: number): OscillatorNode {
    const n = this.ac.createOscillator();
    if (typeof type === 'string') n.type = type as OscillatorType;
    else n.setPeriodicWave(type);
    n.frequency.value = clamp(freq, 0.01, this.nyquist * 0.98);
    n.start(Math.max(0, t0));
    if (t1 !== undefined) n.stop(Math.max(t0 + 0.01, t1));
    return this.src(n);
  }

  noise(kind: NoiseKind, t0: number, t1?: number, rate = 1): AudioBufferSourceNode {
    const buf = noiseBuffer(this.ac, kind);
    return this.buffer(buf, t0, { t1, rate, loop: true, offset: Math.random() * (buf.duration - 0.2) });
  }

  buffer(
    buf: AudioBuffer,
    t0: number,
    o: { t1?: number; rate?: number; loop?: boolean; offset?: number } = {},
  ): AudioBufferSourceNode {
    const n = this.ac.createBufferSource();
    n.buffer = buf;
    n.loop = o.loop ?? false;
    n.playbackRate.value = o.rate ?? 1;
    n.start(Math.max(0, t0), clamp(o.offset ?? 0, 0, Math.max(0, buf.duration - 0.01)));
    if (o.t1 !== undefined) n.stop(Math.max(t0 + 0.01, o.t1));
    return this.src(n);
  }

  shaper(curve: Float32Array<ArrayBuffer>): WaveShaperNode {
    const n = this.ac.createWaveShaper();
    n.curve = curve;
    n.oversample = 'none';
    return this.keep(n);
  }

  /** Stereo pan, with an equal-power PannerNode fallback for browsers without StereoPannerNode. */
  pan(p: number): AudioNode & { pan?: AudioParam } {
    const ac = this.ac as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode };
    if (typeof ac.createStereoPanner === 'function') {
      const n = ac.createStereoPanner();
      n.pan.value = clamp(p, -1, 1);
      return this.keep(n);
    }
    const n = this.ac.createPanner();
    n.panningModel = 'equalpower';
    setPannerPosition(n, Math.sin((clamp(p, -1, 1) * Math.PI) / 2), 0, -Math.cos((clamp(p, -1, 1) * Math.PI) / 2));
    return this.keep(n);
  }

  delay(seconds: number): DelayNode {
    const n = this.ac.createDelay(Math.max(0.05, seconds + 0.05));
    n.delayTime.value = seconds;
    return this.keep(n);
  }

  convolver(buf: AudioBuffer): ConvolverNode {
    const n = this.ac.createConvolver();
    n.normalize = true;
    n.buffer = buf;
    return this.keep(n);
  }

  panner(): PannerNode {
    return this.keep(this.ac.createPanner());
  }

  /** Low-frequency modulation: adds depth·sin(2πf t) to the param. */
  lfo(param: AudioParam, hz: number, depth: number, t0: number, t1?: number, type: OscillatorType = 'sine'): OscillatorNode {
    const o = this.osc(type, hz, t0, t1);
    const g = this.gain(depth);
    o.connect(g).connect(param);
    return o;
  }

  /** Stop everything (with a tiny safety margin) and disconnect. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // already stopped or never started
      }
    }
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        // not connected
      }
    }
    this.sources.length = 0;
    this.nodes.length = 0;
  }
}

/** Soft-clip curve: transparent to ~-3 dBFS then a smooth knee to 1.0. */
export function softClipCurve(): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(n);
  const knee = 0.7;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
    c[i] = Math.sign(x) * y;
  }
  return c;
}

/** Gentle saturation for "gritty" electrical sounds. */
export function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const c = new Float32Array(n);
  const k = Math.max(0.01, amount);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
}

// ---------------------------------------------------------------- spatial

export const DIST_RADIUS: Record<Distance, number> = { near: 1, mid: 2.5, far: 6 };

export interface Placement {
  /** Degrees clockwise from front; null = at the listener (no panner). */
  angle: number | null;
  r: number;
}

/** Tolerant of malformed positions (unknown direction → centre, unknown distance → mid). */
export function placementOf(pos: SpatialPos | null | undefined): Placement {
  const a = pos && pos.dir !== 'center' ? (DIRECTION_ANGLE as Record<string, number | undefined>)[pos.dir as Direction] : undefined;
  const r = pos ? (DIST_RADIUS as Record<string, number | undefined>)[pos.dist] : undefined;
  return { angle: typeof a === 'number' ? a : null, r: typeof r === 'number' ? r : DIST_RADIUS.mid };
}

export function toXZ(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r];
}

export function setPannerPosition(p: PannerNode, x: number, y: number, z: number): void {
  if (p.positionX) {
    p.positionX.value = x;
    p.positionY.value = y;
    p.positionZ.value = z;
  } else {
    (p as PannerNode & { setPosition?: (x: number, y: number, z: number) => void }).setPosition?.(x, y, z);
  }
}

/**
 * Lowpass cutoff used to shade a source: back-ish directions are dulled (~3.2–4.2 kHz) to help
 * front/back disambiguation, and far sources lose some air.
 */
export function shadingCutoff(angle: number | null, r: number): number {
  let f = 20000;
  if (angle !== null) {
    const back = -Math.cos((angle * Math.PI) / 180);
    if (back > 0.6) f = 4200 - (1000 * clamp(back - 0.7, 0, 0.3)) / 0.3;
  }
  if (r >= 5) f = Math.min(f * 0.8, 6000);
  else if (r >= 2) f = Math.min(f, 12000);
  return f;
}

/** Reverb send scaled by distance: far things are mostly room. */
export function distanceSend(r: number): number {
  return clamp(0.035 + 0.045 * (r - 1), 0.02, 0.32);
}

export interface Spatial {
  /** Connect the dry sound here. */
  input: GainNode;
  /** Wet send gain (also scaled by the input gain). */
  send: GainNode | null;
  panner: PannerNode | null;
  move(fromDeg: number, toDeg: number, t0: number, t1: number, radiusScale?: number): void;
}

/**
 * input → [shading lowpass] → HRTF panner → dest, plus a distance-scaled send into `reverb`.
 * Centre placements bypass the panner entirely ("inside the head", like one's own voice).
 */
export function spatialize(
  g: Graph,
  place: Placement,
  dest: AudioNode,
  reverb: AudioNode | null,
  o: { hrtf?: boolean; sendScale?: number } = {},
): Spatial {
  const input = g.gain(1);
  const r = Math.max(0.3, place.r);
  let tap: AudioNode = input;
  const cutoff = shadingCutoff(place.angle, r);
  if (cutoff < 19000) {
    const lp = g.filter('lowpass', cutoff, 0.6);
    input.connect(lp);
    tap = lp;
  }
  let send: GainNode | null = null;
  if (reverb) {
    send = g.gain(distanceSend(place.angle === null ? 0.6 : r) * (o.sendScale ?? 1));
    tap.connect(send).connect(reverb);
  }
  if (place.angle === null) {
    tap.connect(dest);
    return { input, send, panner: null, move: () => undefined };
  }
  const p = g.panner();
  p.panningModel = o.hrtf === false ? 'equalpower' : 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = 1;
  p.maxDistance = 1000;
  p.rolloffFactor = 1;
  p.coneInnerAngle = 360;
  p.coneOuterAngle = 360;
  p.coneOuterGain = 1;
  const base = place.angle;
  const [x, z] = toXZ(base, r);
  setPannerPosition(p, x, 0, z);
  tap.connect(p).connect(dest);
  const move = (fromDeg: number, toDeg: number, t0: number, t1: number, radiusScale = 1): void => {
    if (!p.positionX) return;
    const rr = r * radiusScale;
    const [x0, z0] = toXZ(base + fromDeg, rr);
    const [x1, z1] = toXZ(base + toDeg, rr);
    p.positionX.setValueAtTime(x0, t0);
    p.positionZ.setValueAtTime(z0, t0);
    p.positionX.linearRampToValueAtTime(x1, t1);
    p.positionZ.linearRampToValueAtTime(z1, t1);
  };
  return { input, send, panner: p, move };
}

// ---------------------------------------------------------------- one-shots

export interface SfxCtx {
  g: Graph;
  /** Dry input of the spatial chain. */
  out: AudioNode;
  /** Extra reverb send (for sounds that should bloom in the room regardless of distance). */
  send: AudioNode;
  /** Start time (AudioContext time). */
  t: number;
  /** Pitch factor: caller's rate × a small per-play random variation. */
  p: number;
  /** Move the source along a straight line relative to its base direction (no-op at centre). */
  move(fromDeg: number, toDeg: number, t0: number, t1: number, radiusScale?: number): void;
}

export interface SfxRecipe {
  /** Schedule the sound; returns its duration in seconds (from c.t). */
  play(c: SfxCtx): number;
  /** Static level trim for the recipe. */
  level?: number;
  /** Per-play random pitch variation (fraction). Default 0.03. */
  jitter?: number;
}

export interface Shot {
  readonly end: number;
  readonly startedAt: number;
  readonly disposed: boolean;
  /** Fade out quickly and free (voice stealing / layer teardown). */
  kill(): void;
  dispose(): void;
}

export interface ShotOpts {
  dest: AudioNode;
  reverb: AudioNode | null;
  place: Placement;
  t: number;
  gain?: number;
  rate?: number;
  hrtf?: boolean;
  onDone?: (s: Shot) => void;
}

export function spawnShot(ac: BaseAudioContext, recipe: SfxRecipe, o: ShotOpts): Shot | null {
  const g = new Graph(ac);
  const level = (o.gain ?? 1) * (recipe.level ?? 1);
  const sp = spatialize(g, o.place, o.dest, o.reverb, { hrtf: o.hrtf });
  sp.input.gain.value = level;
  const wet = g.gain(level);
  if (o.reverb) wet.connect(o.reverb);
  const ctx: SfxCtx = {
    g,
    out: sp.input,
    send: wet,
    t: o.t,
    p: Math.max(0.05, (o.rate ?? 1) * vary(1, recipe.jitter ?? 0.03)),
    move: sp.move,
  };
  let dur: number;
  try {
    dur = recipe.play(ctx);
  } catch {
    g.dispose();
    return null;
  }
  if (!Number.isFinite(dur) || dur <= 0) dur = 1;
  const end = o.t + dur;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let done = false;
  const shot: Shot = {
    end,
    startedAt: o.t,
    get disposed() {
      return done;
    },
    dispose() {
      if (done) return;
      done = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      g.dispose();
      o.onDone?.(shot);
    },
    kill() {
      if (done) return;
      const now = ac.currentTime;
      try {
        glide(sp.input.gain, 0, now, 0.012);
        glide(wet.gain, 0, now, 0.012);
        for (const s of g.sources) s.stop(now + 0.08);
      } catch {
        // ignore
      }
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => shot.dispose(), 160);
    },
  };
  // Free the nodes once the sound (and a little reverb tail) is over. If the context was suspended
  // in the meantime, its clock froze, so re-check instead of cutting the sound short.
  const check = (): void => {
    if (done) return;
    const remain = end - ac.currentTime;
    if (remain > 0.05) timer = setTimeout(check, remain * 1000 + 250);
    else shot.dispose();
  };
  timer = setTimeout(check, Math.max(0, end - ac.currentTime) * 1000 + 300);
  return shot;
}
