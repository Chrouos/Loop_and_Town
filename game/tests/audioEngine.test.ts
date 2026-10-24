import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMBIENCE, DIRECTIONS, DISTANCES, SFX, VOICES, type AmbienceId, type SfxId, type SpatialPos, type VoiceId } from '../src/audio/catalog';
import { AMBIENCE_RECIPES, startAmbience } from '../src/audio/ambience';
import { Graph, type SfxCtx } from '../src/audio/core';
import { createAudioEngine, createSilentEngine, type AudioEngine, type AudioEngineDebug } from '../src/audio/engine';
import { AMBIENT_EVENTS, SFX_RECIPES } from '../src/audio/sounds';

// ------------------------------------------------------------------ a strict fake Web Audio API
// It throws (and records) wherever a real browser would throw, so recipe bugs surface here even
// though the engine itself swallows errors at runtime.

const errors: string[] = [];
function fail(msg: string): never {
  errors.push(msg);
  throw new RangeError(msg);
}
function checkValue(v: number, where: string): void {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`non-finite value ${v} in ${where}`);
}
function checkTime(t: number, where: string): void {
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) fail(`bad time ${t} in ${where}`);
}

class FakeParam {
  private v: number;
  constructor(v = 0, private readonly name = 'param') {
    this.v = v;
  }
  get value(): number {
    return this.v;
  }
  set value(x: number) {
    checkValue(x, `${this.name}.value`);
    this.v = x;
  }
  setValueAtTime(v: number, t: number): this {
    checkValue(v, `${this.name}.setValueAtTime`);
    checkTime(t, `${this.name}.setValueAtTime`);
    this.v = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    checkValue(v, `${this.name}.linearRamp`);
    checkTime(t, `${this.name}.linearRamp`);
    this.v = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    checkValue(v, `${this.name}.expRamp`);
    checkTime(t, `${this.name}.expRamp`);
    if (v === 0) fail(`${this.name}.expRamp to 0`);
    this.v = v;
    return this;
  }
  setTargetAtTime(v: number, t: number, tc: number): this {
    checkValue(v, `${this.name}.setTarget`);
    checkTime(t, `${this.name}.setTarget`);
    checkValue(tc, `${this.name}.setTarget tc`);
    if (tc < 0) fail(`${this.name}.setTarget negative tc`);
    return this;
  }
  setValueCurveAtTime(values: Float32Array | number[], t: number, d: number): this {
    checkTime(t, `${this.name}.setValueCurve`);
    if (!(d > 0)) fail('curve duration');
    for (const x of values) checkValue(x, `${this.name}.setValueCurve`);
    return this;
  }
  cancelScheduledValues(t: number): this {
    checkTime(t, `${this.name}.cancel`);
    return this;
  }
  cancelAndHoldAtTime(t: number): this {
    checkTime(t, `${this.name}.cancelAndHold`);
    return this;
  }
}

class FakeNode {
  readonly outputs = new Set<unknown>();
  constructor(readonly context: FakeContext) {
    context.nodes.push(this);
  }
  connect<T>(dest: T): T {
    if (!dest) fail('connect to nothing');
    this.outputs.add(dest);
    return dest;
  }
  disconnect(): void {
    this.outputs.clear();
  }
}

class FakeSource extends FakeNode {
  started: number | null = null;
  stopAt: number | null = null;
  onended: (() => void) | null = null;
  constructor(ctx: FakeContext) {
    super(ctx);
    ctx.sources.push(this);
  }
  start(when = 0, offset = 0): void {
    if (this.started !== null) fail('start twice');
    checkTime(when, 'start');
    checkTime(offset, 'start offset');
    this.started = when;
  }
  stop(when = 0): void {
    if (this.started === null) fail('stop before start');
    checkTime(when, 'stop');
    this.stopAt = when;
  }
}

const OSC_TYPES = new Set(['sine', 'square', 'sawtooth', 'triangle']);
class FakeOsc extends FakeSource {
  frequency = new FakeParam(440, 'osc.frequency');
  detune = new FakeParam(0, 'osc.detune');
  private t = 'sine';
  get type(): string {
    return this.t;
  }
  set type(v: string) {
    if (!OSC_TYPES.has(v)) fail(`bad oscillator type ${v}`);
    this.t = v;
  }
  setPeriodicWave(): void {
    this.t = 'custom';
  }
}

class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
  loop = false;
  playbackRate = new FakeParam(1, 'playbackRate');
  detune = new FakeParam(0, 'detune');
}

class FakeBuffer {
  readonly duration: number;
  private readonly data: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    if (length <= 0) fail('empty buffer');
    this.duration = length / sampleRate;
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(c: number): Float32Array {
    const d = this.data[c];
    if (!d) fail('bad channel');
    return d;
  }
}

const FILTER_TYPES = new Set(['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass']);

class FakeContext {
  readonly nodes: FakeNode[] = [];
  readonly sources: FakeSource[] = [];
  currentTime = 0;
  readonly sampleRate = 16000;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  readonly destination: FakeNode;
  readonly listener = {
    positionX: new FakeParam(0),
    positionY: new FakeParam(0),
    positionZ: new FakeParam(0),
    forwardX: new FakeParam(0),
    forwardY: new FakeParam(0),
    forwardZ: new FakeParam(-1),
    upX: new FakeParam(0),
    upY: new FakeParam(1),
    upZ: new FakeParam(0),
  };
  constructor() {
    this.destination = new FakeNode(this);
    FakeContext.instances.push(this);
  }
  static instances: FakeContext[] = [];
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
  createGain() {
    return Object.assign(new FakeNode(this), { gain: new FakeParam(1, 'gain') });
  }
  createBiquadFilter() {
    const n = Object.assign(new FakeNode(this), {
      frequency: new FakeParam(350, 'biquad.frequency'),
      Q: new FakeParam(1, 'biquad.Q'),
      gain: new FakeParam(0, 'biquad.gain'),
      detune: new FakeParam(0, 'biquad.detune'),
      _type: 'lowpass',
    });
    Object.defineProperty(n, 'type', {
      get: () => n._type,
      set: (v: string) => {
        if (!FILTER_TYPES.has(v)) fail(`bad filter type ${v}`);
        n._type = v;
      },
    });
    return n;
  }
  createOscillator() {
    return new FakeOsc(this);
  }
  createBufferSource() {
    return new FakeBufferSource(this);
  }
  createBuffer(ch: number, len: number, sr: number) {
    return new FakeBuffer(ch, len, sr);
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array) {
    if (real.length !== imag.length || real.length < 2) fail('bad periodic wave');
    return {};
  }
  createConvolver() {
    return Object.assign(new FakeNode(this), { buffer: null as FakeBuffer | null, normalize: true });
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(this), {
      threshold: new FakeParam(-24),
      knee: new FakeParam(30),
      ratio: new FakeParam(12),
      attack: new FakeParam(0.003),
      release: new FakeParam(0.25),
    });
  }
  createWaveShaper() {
    return Object.assign(new FakeNode(this), { curve: null as Float32Array | null, oversample: 'none' });
  }
  createStereoPanner() {
    return Object.assign(new FakeNode(this), { pan: new FakeParam(0, 'pan') });
  }
  createPanner() {
    return Object.assign(new FakeNode(this), {
      panningModel: 'equalpower',
      distanceModel: 'inverse',
      refDistance: 1,
      maxDistance: 10000,
      rolloffFactor: 1,
      coneInnerAngle: 360,
      coneOuterAngle: 360,
      coneOuterGain: 0,
      positionX: new FakeParam(0, 'panner.x'),
      positionY: new FakeParam(0, 'panner.y'),
      positionZ: new FakeParam(0, 'panner.z'),
    });
  }
  createDelay() {
    return Object.assign(new FakeNode(this), { delayTime: new FakeParam(0) });
  }
}

const fake = (): BaseAudioContext => new FakeContext() as unknown as BaseAudioContext;

function ctxFor(ac: BaseAudioContext, p = 1): SfxCtx {
  return { g: new Graph(ac), out: ac.createGain(), send: ac.createGain(), t: 0.05, p, move: () => undefined };
}

const POSITIONS: SpatialPos[] = [
  { dir: 'center', dist: 'near' },
  ...DIRECTIONS.flatMap((dir) => DISTANCES.map((dist) => ({ dir, dist }))),
];

// ------------------------------------------------------------------ tests

describe('audio catalog coverage', () => {
  it('has a synthesis recipe for every SfxId and nothing else', () => {
    expect(Object.keys(SFX_RECIPES).sort()).toEqual(Object.keys(SFX).sort());
  });

  it('has an ambience recipe for every AmbienceId and nothing else', () => {
    expect(Object.keys(AMBIENCE_RECIPES).sort()).toEqual(Object.keys(AMBIENCE).sort());
  });
});

describe('engine without Web Audio (jsdom)', () => {
  it('createAudioEngine() falls back to a silent engine whose methods never throw', async () => {
    expect((window as unknown as { AudioContext?: unknown }).AudioContext).toBeUndefined();
    const engines: AudioEngine[] = [createAudioEngine(), createSilentEngine()];
    for (const e of engines) {
      await expect(e.unlock()).resolves.toBeUndefined();
      expect(e.ready).toBe(false);
      expect(() => {
        e.setEnabled(false);
        e.setEnabled(true);
        e.setVolume(0.5);
        e.setVoiceVolume(0.5);
        e.setAmbience(['rain', 'cafe']);
        e.setAmbience([], 100);
        e.play('step', { dir: 'left', dist: 'near' });
        e.play('bell_toll', { dir: 'center', dist: 'far' }, { gain: 0.5, rate: 1.2 });
        e.voice('yuan', { dir: 'front', dist: 'mid' }, 1200);
        e.voice('phone', { dir: 'center', dist: 'near' }, 500);
        e.setAttention(1);
        e.setAttention(0);
        e.duck(0.5, 1000);
        e.silence(500);
        e.suspend();
        e.resume();
      }).not.toThrow();
    }
  });
});

describe('recipes against a strict fake AudioContext', () => {
  beforeEach(() => {
    errors.length = 0;
  });

  it('every SFX recipe schedules valid automation and returns a finite duration', () => {
    const ac = fake();
    for (const [id, recipe] of Object.entries(SFX_RECIPES)) {
      for (const p of [0.5, 1, 2]) {
        const c = ctxFor(ac, p);
        let dur = 0;
        expect(() => {
          dur = recipe.play(c);
        }, `${id} @ rate ${p}`).not.toThrow();
        expect(Number.isFinite(dur) && dur > 0, `${id} duration ${dur}`).toBe(true);
        expect(dur, `${id} is too long`).toBeLessThan(15);
        c.g.dispose();
      }
    }
    expect(errors).toEqual([]);
  });

  it('every ambient event recipe works', () => {
    const ac = fake();
    for (const [id, recipe] of Object.entries(AMBIENT_EVENTS)) {
      const c = ctxFor(ac);
      expect(() => recipe.play(c), id).not.toThrow();
      c.g.dispose();
    }
    expect(errors).toEqual([]);
  });

  it('every ambience layer builds, runs its events and frees everything when disposed', () => {
    vi.useFakeTimers();
    try {
      const fc = new FakeContext();
      fc.state = 'running';
      const ac = fc as unknown as BaseAudioContext;
      const dest = ac.createGain();
      const reverb = ac.createGain();
      for (const id of Object.keys(AMBIENCE) as AmbienceId[]) {
        const layer = startAmbience(ac, id, dest, reverb);
        expect(layer, id).not.toBeNull();
        layer!.fadeIn(0.5);
        for (let i = 0; i < 400; i++) {
          fc.currentTime += 0.1;
          vi.advanceTimersByTime(100);
        }
        layer!.stop(0.5);
        for (let i = 0; i < 20; i++) {
          fc.currentTime += 0.1;
          vi.advanceTimersByTime(100);
        }
        expect(layer!.disposed, id).toBe(true);
        expect(layer!.stats, id).toEqual({ timers: 0, shots: 0, nodes: 0 });
      }
      expect(errors).toEqual([]);
      const unstopped = fc.sources.filter((s) => s.started !== null && s.stopAt === null);
      expect(unstopped.length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Web Audio engine (fake context)', () => {
  beforeEach(() => {
    errors.length = 0;
    FakeContext.instances.length = 0;
    vi.useFakeTimers();
    (window as unknown as { AudioContext?: unknown }).AudioContext = FakeContext;
  });
  afterEach(() => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    vi.useRealTimers();
  });

  const tick = (seconds: number): void => {
    const fc = FakeContext.instances[0]!;
    for (let i = 0; i < seconds * 10; i++) {
      fc.currentTime += 0.1;
      vi.advanceTimersByTime(100);
    }
  };

  it('unlocks, plays every sound everywhere, crossfades ambience and cleans up', async () => {
    const engine = createAudioEngine();
    engine.setAmbience(['rain']); // before unlock: remembered
    expect(engine.ready).toBe(false);
    await engine.unlock();
    await engine.unlock(); // idempotent
    expect(engine.ready).toBe(true);
    expect(FakeContext.instances.length).toBe(1);
    const dbg = engine as unknown as AudioEngineDebug;
    expect(dbg.stats().layers).toEqual(['rain']);

    let i = 0;
    for (const id of Object.keys(SFX) as SfxId[]) {
      engine.play(id, POSITIONS[i++ % POSITIONS.length]!, { gain: 0.8, rate: 1 });
      tick(0.1);
    }
    expect(dbg.stats().shots).toBeGreaterThan(0);
    expect(dbg.stats().shots).toBeLessThanOrEqual(24);
    for (const v of Object.keys(VOICES) as VoiceId[]) engine.voice(v, POSITIONS[i++ % POSITIONS.length]!, 1500);
    expect(dbg.stats().voices).toBeLessThanOrEqual(6);

    // malformed input never throws
    engine.play('nope' as SfxId, { dir: 'up' as never, dist: 'very' as never });
    engine.voice('ghost' as VoiceId, { dir: 'left', dist: 'near' }, Number.NaN);
    engine.setVolume(Number.NaN);
    engine.setAmbience(['not_a_layer' as AmbienceId, 'cafe', 'cafe']);

    engine.setAttention(1);
    engine.duck(0.6, 800);
    tick(1);
    engine.setAmbience(['clock_shop', 'cafe'], 1000);
    tick(2.5); // rain (default 2.5 s fade-out from the previous call) is gone by now
    expect(dbg.stats().layers.sort()).toEqual(['cafe', 'clock_shop']);
    engine.setAmbience(['train_interior']);
    engine.setAmbience(['train_interior', 'clock_shop']); // revive a fading layer
    tick(5);
    expect(dbg.stats().layers.sort()).toEqual(['clock_shop', 'train_interior']);

    engine.suspend();
    engine.resume();
    engine.silence(500);
    tick(15);
    const s = dbg.stats();
    expect(s.layers).toEqual([]);
    expect(s.layerTimers).toBe(0);
    expect(s.shots).toBe(0);
    expect(s.voices).toBe(0);
    expect(errors).toEqual([]);

    const fc = FakeContext.instances[0]!;
    const unstopped = fc.sources.filter((src) => src.started !== null && src.stopAt === null);
    // only the one-sample iOS unlock buffer may be left without an explicit stop
    expect(unstopped.length).toBeLessThanOrEqual(1);
  });
});
