import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMBIENCE, DIRECTIONS, DISTANCES, SFX, VOICES, type AmbienceId, type SfxId, type SpatialPos, type VoiceId } from '../src/audio/catalog';
import { AMBIENCE_RECIPES, startAmbience } from '../src/audio/ambience';
import { Graph, type SfxCtx } from '../src/audio/core';
import { createAudioEngine, createSilentEngine, type AudioEngine, type AudioEngineDebug } from '../src/audio/engine';
import { AMBIENT_EVENTS, HUMAN_SFX, SFX_RECIPES } from '../src/audio/sounds';
import { AMBIENCE_SAMPLES, SFX_SAMPLES, SampleBank, sampleRecipe, sampleUrl } from '../src/audio/samples';
import credits from '../public/audio/CREDITS.md?raw';
import { ATTRIBUTION_CREDITS } from '../src/audio/credits';
import { parseSoundSources } from '../src/audio/sourceList';

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
        e.setAmbienceVolume(0.3);
        e.setSfxVolume(1);
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

  it('places a speaker with one rustle per turn, never a voice', async () => {
    const engine = createAudioEngine();
    await engine.unlock();
    const dbg = engine as unknown as AudioEngineDebug;
    const at = { dir: 'right', dist: 'near' } as const;
    engine.voice('yuan', at, 1500); // a new speaker: one rustle
    engine.voice('me', at, 1500); // the protagonist makes no sound and does not end his turn
    engine.voice('yuan', at, 1500); // the same conversation: nothing
    expect(dbg.stats().shots).toBe(1);
    engine.voice('ruoqing', at, 1500); // someone else starts talking
    expect(dbg.stats().shots).toBe(2);
    engine.voice('woman', at, 1500, 'life'); // a passer-by: clothes and shifting weight
    expect(dbg.stats().shots).toBe(3);
    expect(dbg.stats().voices).toBe(0);
  });

  it('plays every human sound from synthesis when no recording can be decoded', async () => {
    const engine = createAudioEngine();
    await engine.unlock();
    const dbg = engine as unknown as AudioEngineDebug;
    for (const id of HUMAN_SFX) {
      const before = dbg.stats().shots;
      engine.play(id, { dir: 'front', dist: 'near' });
      expect(dbg.stats().shots, id).toBe(before + 1);
    }
    expect(errors).toEqual([]);
  });

  it('allows synthesized human events in ambience when their recording is unavailable', () => {
    const ac = fake();
    const build = vi.spyOn(AMBIENCE_RECIPES.hospital, 'build').mockImplementation((env) => env.shot('cough', 0, 2));
    try {
      const layer = startAmbience(ac, 'hospital', ac.destination, null, undefined, { resolve: () => undefined });
      expect(layer?.stats.shots).toBe(1);
      layer?.dispose();
    } finally {
      build.mockRestore();
    }
  });

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
    // people's lines are silent (no synthesized voices); only the phone's screen reader ticks
    expect(dbg.stats().voices).toBe(1);

    // malformed input never throws
    engine.play('nope' as SfxId, { dir: 'up' as never, dist: 'very' as never });
    engine.voice('ghost' as VoiceId, { dir: 'left', dist: 'near' }, Number.NaN);
    engine.setVolume(Number.NaN);
    engine.setAmbienceVolume(Number.NaN);
    engine.setSfxVolume(Number.POSITIVE_INFINITY);
    engine.setAmbienceVolume(0.4);
    engine.setSfxVolume(0.9);
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

// ------------------------------------------------------------------ recorded samples

// every audio file that exists under public/audio/ (keys like '../public/audio/sfx/step_1.m4a')
const ON_DISK = new Set(Object.keys(import.meta.glob('../public/audio/**/*.m4a', { query: '?url', import: 'default' })).map((k) => k.replace('../public/audio/', '')));

describe('sample manifest', () => {
  it('only uses catalog ids', () => {
    for (const id of Object.keys(SFX_SAMPLES)) expect(Object.prototype.hasOwnProperty.call(SFX, id), `sfx ${id}`).toBe(true);
    for (const id of Object.keys(AMBIENCE_SAMPLES)) expect(Object.prototype.hasOwnProperty.call(AMBIENCE, id), `ambience ${id}`).toBe(true);
  });

  it('points at files that exist on disk', () => {
    const entries = [...Object.values(SFX_SAMPLES), ...Object.values(AMBIENCE_SAMPLES)];
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e!.files.length).toBeGreaterThan(0);
      for (const f of e!.files) {
        expect(ON_DISK.has(f), f).toBe(true);
        expect(f, f).toMatch(/^(sfx|amb)\/[a-z0-9_]+\.m4a$/);
      }
    }
  });

  it('has sane levels and loop points', () => {
    for (const [id, e] of Object.entries(SFX_SAMPLES)) {
      expect(e!.gain > 0 && e!.gain <= 4, id).toBe(true);
      if (e!.rate !== undefined) expect(e!.rate > 0.25 && e!.rate < 4, id).toBe(true);
    }
    for (const [id, e] of Object.entries(AMBIENCE_SAMPLES)) {
      expect(e!.loop, id).toBe(true);
      expect(e!.gain > 0 && e!.gain <= 4, id).toBe(true);
      expect(e!.loopStart >= 0 && e!.loopEnd - e!.loopStart > 10, id).toBe(true);
      expect(e!.files.length, id).toBe(1);
    }
  });

  it('shows every CC BY recording in the game, not only in CREDITS.md', () => {
    const attributed = credits.split('\n').filter((line) => / — CC BY /.test(line));
    expect(attributed.length).toBeGreaterThan(0);
    for (const line of attributed) {
      const url = line.match(/https:\/\/freesound\.org\/people\/[^ ]+\/sounds\/\d+\//)?.[0];
      expect(ATTRIBUTION_CREDITS.some((credit) => credit.url === url), line.slice(0, 80)).toBe(true);
    }
  });

  it('lists every credited recording in the 參考資料 tab', () => {
    const sources = parseSoundSources(credits);
    const urls = new Set(credits.match(/https:\/\/freesound\.org\/people\/[^ ;]+\/sounds\/\d+\//g));
    expect(sources.map((source) => source.url).sort()).toEqual([...urls].sort());
    for (const source of sources) {
      expect(source.license, source.url).toMatch(/^(CC0|CC BY [\d.]+)$/);
      expect(source.title && source.author, source.url).toBeTruthy();
      for (const use of source.uses) expect(use, source.url).not.toMatch(/^[a-z0-9_]+$/);
    }
  });

  it('credits every file', () => {
    for (const e of [...Object.values(SFX_SAMPLES), ...Object.values(AMBIENCE_SAMPLES)]) {
      for (const f of e!.files) expect(credits.includes('`' + f + '`'), f).toBe(true);
    }
  });

  it('resolves urls under the Vite base', () => {
    expect(sampleUrl('sfx/step_1.m4a')).toMatch(/\/audio\/sfx\/step_1\.m4a$/);
  });
});

/** A fake context that can "decode": every file becomes a 2 s buffer. */
class DecodingContext extends FakeContext {
  decodeAudioData(_data: ArrayBuffer, ok?: (b: FakeBuffer) => void): Promise<FakeBuffer> {
    const b = new FakeBuffer(1, this.sampleRate * 2, this.sampleRate);
    ok?.(b);
    return Promise.resolve(b);
  }
}

describe('Web Audio engine with recorded samples (fake decoder)', () => {
  const realFetch = globalThis.fetch;
  let fetched: string[] = [];
  beforeEach(() => {
    errors.length = 0;
    FakeContext.instances.length = 0;
    fetched = [];
    vi.useFakeTimers();
    (window as unknown as { AudioContext?: unknown }).AudioContext = DecodingContext;
    globalThis.fetch = (async (url: string) => {
      fetched.push(String(url));
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Response;
    }) as typeof fetch;
  });
  afterEach(() => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    globalThis.fetch = realFetch;
    vi.useRealTimers();
  });

  const flush = async (): Promise<void> => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  const tick = (seconds: number): void => {
    const fc = FakeContext.instances[0]!;
    for (let i = 0; i < seconds * 10; i++) {
      fc.currentTime += 0.1;
      vi.advanceTimersByTime(100);
    }
  };

  it('auditions an exact recording variant and rejects invalid version indices', async () => {
    const engine = createAudioEngine();
    const dbg = engine as unknown as AudioEngineDebug;
    await engine.unlock();
    const pos: SpatialPos = { dir: 'center', dist: 'near' };
    const buffers: Array<FakeBuffer | null> = [];
    for (const variant of [0, 1, 0]) {
      expect(await dbg.playSource('step', pos, 'sample', { variant })).toBe(true);
      const source = FakeContext.instances[0]!.sources.at(-1) as FakeBufferSource;
      buffers.push(source.buffer);
    }
    expect(buffers[0]).not.toBeNull();
    expect(buffers[0]).not.toBe(buffers[1]);
    expect(buffers[0]).toBe(buffers[2]);
    for (const variant of [-1, 0.5, 99, NaN]) {
      expect(await dbg.playSource('step', pos, 'sample', { variant })).toBe(false);
    }
  });

  it('plays synthesis until a sample is decoded, then the sample; beds crossfade from synth to recording', async () => {
    const engine = createAudioEngine();
    const dbg = engine as unknown as AudioEngineDebug;
    const sampledAmb = Object.keys(AMBIENCE_SAMPLES)[0] as AmbienceId;
    engine.setAmbience([sampledAmb]);
    await engine.unlock();
    // the bed starts synthesized and its recording is requested
    expect(dbg.stats().layers).toEqual([sampledAmb]);
    expect(dbg.stats().sampledLayers).toEqual([]);
    await flush();
    tick(0.2);
    await flush();
    expect(fetched.some((u) => u.endsWith(AMBIENCE_SAMPLES[sampledAmb]!.files[0]!))).toBe(true);
    expect(dbg.stats().sampledLayers).toEqual([sampledAmb]);
    // all one-shots were preloaded after unlock
    for (let i = 0; i < 40; i++) await flush();
    const s = dbg.stats().samples!;
    expect(s.sfxReady).toBe(s.sfxTotal);
    expect(s.failed).toBe(0);

    let i = 0;
    for (const id of Object.keys(SFX) as SfxId[]) {
      engine.play(id, POSITIONS[i++ % POSITIONS.length]!, { gain: 0.8 });
      tick(0.1);
    }
    expect(dbg.stats().shots).toBeGreaterThan(0);
    expect(await dbg.playSource('step', { dir: 'left', dist: 'near' }, 'sample')).toBe(true);
    expect(await dbg.playSource('step', { dir: 'left', dist: 'near' }, 'synth')).toBe(true);
    expect(dbg.hasSample('step')).toBe(!!SFX_SAMPLES.step);

    // A/B: synth only, then back to recordings
    dbg.setSampleMode('synth');
    tick(4);
    expect(dbg.stats().sampledLayers).toEqual([]);
    dbg.setSampleMode('auto');
    tick(4);
    expect(dbg.stats().sampledLayers).toEqual([sampledAmb]);

    const others = (Object.keys(AMBIENCE_SAMPLES) as AmbienceId[]).slice(1, 4);
    engine.setAmbience(others, 500);
    for (let k = 0; k < 10; k++) await flush();
    tick(6);
    expect(dbg.stats().layers.sort()).toEqual([...others].sort());

    engine.silence(500);
    tick(20);
    const end = dbg.stats();
    expect(end.layers).toEqual([]);
    expect(end.layerTimers).toBe(0);
    expect(end.shots).toBe(0);
    expect(errors).toEqual([]);
    const fc = FakeContext.instances[0]!;
    const unstopped = fc.sources.filter((src) => src.started !== null && src.stopAt === null);
    expect(unstopped.length).toBeLessThanOrEqual(1);
  });

  it('retries a recording whose load failed once, after a short wait', async () => {
    let fail = true;
    globalThis.fetch = (async () =>
      (fail ? { ok: false, status: 503 } : { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }) as unknown as Response) as typeof fetch;
    const bank = new SampleBank(new DecodingContext() as unknown as BaseAudioContext);
    const file = SFX_SAMPLES.step!.files[2]!;
    expect(await bank.load(file)).toBeNull();
    fail = false;
    expect(await bank.load(file)).toBeNull(); // still waiting before a retry
    vi.advanceTimersByTime(3100);
    expect(await bank.load(file)).not.toBeNull();
    expect(bank.stats().failed).toBe(0);
  });

  it('falls back to synthesis forever when loading fails', async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 404 }) as unknown as Response) as typeof fetch;
    const engine = createAudioEngine();
    const dbg = engine as unknown as AudioEngineDebug;
    await engine.unlock();
    for (let k = 0; k < 40; k++) await flush();
    expect(dbg.stats().samples!.sfxReady).toBe(0);
    engine.play('step', { dir: 'front', dist: 'near' });
    engine.setAmbience(['rain']);
    for (let k = 0; k < 10; k++) await flush();
    tick(3);
    expect(dbg.stats().layers).toEqual(['rain']);
    expect(dbg.stats().sampledLayers).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('prefers loaded human recordings and still allows explicit or forced synthesis', async () => {
    const engine = createAudioEngine();
    const dbg = engine as unknown as AudioEngineDebug;
    await engine.unlock();
    for (let k = 0; k < 40; k++) await flush();
    expect(dbg.stats().samples!.sfxReady).toBe(dbg.stats().samples!.sfxTotal);
    const fc = FakeContext.instances[0]!;
    const pos: SpatialPos = { dir: 'front', dist: 'near' };
    const before = fc.sources.length;
    engine.play('sigh_m', pos);
    const automatic = fc.sources.slice(before).filter((source): source is FakeBufferSource => source instanceof FakeBufferSource);
    expect(automatic).toHaveLength(1);
    expect(automatic[0]!.buffer!.duration).toBe(2);

    const recordingStart = fc.sources.length;
    expect(await dbg.playSource('sigh_m', pos, 'sample', { variant: 0 })).toBe(true);
    const sources = fc.sources.slice(recordingStart).filter((source): source is FakeBufferSource => source instanceof FakeBufferSource);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.buffer!.duration).toBe(2); // the decoder fixture's recorded clip

    const synthStart = fc.sources.length;
    expect(await dbg.playSource('sigh_m', pos, 'synth')).toBe(true);
    expect(fc.sources.slice(synthStart).some((source) => source instanceof FakeOsc)).toBe(true);
    dbg.setSampleMode('synth');
    const forcedStart = fc.sources.length;
    engine.play('sigh_m', pos);
    expect(fc.sources.slice(forcedStart).some((source) => source instanceof FakeOsc)).toBe(true);
  });

  it('sample recipes schedule valid automation', () => {
    const ac = new DecodingContext() as unknown as BaseAudioContext;
    const buf = ac.createBuffer(1, 16000, 16000);
    for (const [id, e] of Object.entries(SFX_SAMPLES)) {
      const c = ctxFor(ac, 1);
      const dur = sampleRecipe(buf, e!).play(c);
      expect(Number.isFinite(dur) && dur > 0, id).toBe(true);
      c.g.dispose();
    }
    const bank = new SampleBank(ac);
    expect(bank.supported).toBe(true);
    expect(errors).toEqual([]);
  });
});
