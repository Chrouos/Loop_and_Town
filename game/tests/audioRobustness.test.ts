import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressorMakeup } from '../src/audio/core';
import { createAudioEngine, type AudioEngine, type AudioEngineDebug } from '../src/audio/engine';
import { AMBIENCE_SAMPLES, SFX_SAMPLES, SampleBank } from '../src/audio/samples';
import type { AmbienceId, AmbienceList, SfxId } from '../src/audio/catalog';

// ------------------------------------------------------------------ a small permissive fake Web Audio API
// (the strict one lives in audioEngine.test.ts; this one records where a param was last asked to go)

class P {
  target: number;
  constructor(public value = 0) {
    this.target = value;
  }
  setValueAtTime(v: number) { this.value = v; this.target = v; return this; }
  linearRampToValueAtTime(v: number) { this.target = v; return this; }
  exponentialRampToValueAtTime(v: number) { this.target = v; return this; }
  setTargetAtTime(v: number) { this.target = v; return this; }
  setValueCurveAtTime() { return this; }
  cancelScheduledValues() { return this; }
  cancelAndHoldAtTime() { return this; }
}

const node = (extra: Record<string, unknown> = {}) => ({
  connect<T>(dest: T): T { return dest; },
  disconnect() {},
  ...extra,
});

class Ctx {
  static live: Ctx[] = [];
  state = 'suspended';
  currentTime = 0;
  readonly sampleRate = 16000;
  resumes = 0;
  started = 0;
  /** Seconds of audio each decoded file holds. */
  bufferSeconds = 1;
  onstatechange: (() => void) | null = null;
  readonly destination = node();
  readonly listener = Object.fromEntries(['positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ'].map((k) => [k, new P()]));
  constructor() {
    Ctx.live.push(this);
  }
  resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { return node({ gain: new P(1) }); }
  createBiquadFilter() { return node({ type: 'lowpass', frequency: new P(350), Q: new P(1), gain: new P(0), detune: new P(0) }); }
  private source(extra: Record<string, unknown>) {
    const ctx = this;
    return node({ onended: null, start() { ctx.started++; }, stop() {}, ...extra });
  }
  createOscillator() { return this.source({ type: 'sine', frequency: new P(440), detune: new P(0), setPeriodicWave() {} }); }
  createBufferSource() { return this.source({ buffer: null, loop: false, loopStart: 0, loopEnd: 0, playbackRate: new P(1), detune: new P(0) }); }
  createBuffer(ch: number, len: number, sr: number) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: (c: number) => data[c]! };
  }
  createPeriodicWave() { return {}; }
  createConvolver() { return node({ buffer: null, normalize: true }); }
  createDynamicsCompressor() { return node({ threshold: new P(-24), knee: new P(30), ratio: new P(12), attack: new P(0.003), release: new P(0.25) }); }
  createWaveShaper() { return node({ curve: null, oversample: 'none' }); }
  createStereoPanner() { return node({ pan: new P(0) }); }
  createPanner() {
    return node({ panningModel: 'HRTF', distanceModel: 'inverse', positionX: new P(), positionY: new P(), positionZ: new P() });
  }
  createDelay() { return node({ delayTime: new P(0) }); }
  decodeAudioData(_data: ArrayBuffer, ok?: (b: unknown) => void) {
    const b = this.createBuffer(1, this.sampleRate * this.bufferSeconds, this.sampleRate);
    ok?.(b);
    return Promise.resolve(b);
  }
}

// ------------------------------------------------------------------ a fake device voice

type Utterance = { text: string; volume: number; onend: (() => void) | null; onerror: (() => void) | null };
let spoken: Utterance[] = [];
class FakeUtterance {
  volume = 1;
  voice: unknown = null;
  lang = '';
  rate = 1;
  pitch = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

let fetched: string[] = [];
const realFetch = globalThis.fetch;
const flush = async (n = 40): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

beforeEach(() => {
  Ctx.live = [];
  spoken = [];
  fetched = [];
  const w = window as unknown as Record<string, unknown>;
  w.AudioContext = Ctx;
  w.speechSynthesis = {
    speak: (u: Utterance) => { spoken.push(u); },
    cancel: () => undefined,
    getVoices: () => [{ lang: 'zh-TW', name: 'test' }],
    addEventListener: () => undefined,
  };
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance;
  globalThis.fetch = (async (url: string) => {
    fetched.push(String(url));
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(16) } as unknown as Response;
  }) as typeof fetch;
});

afterEach(() => {
  const w = window as unknown as Record<string, unknown>;
  delete w.AudioContext;
  delete w.speechSynthesis;
  delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
  globalThis.fetch = realFetch;
  vi.useRealTimers();
});

type Inside = { bus: { speechDuck: { gain: P }; ambLoud: { gain: P } } };

describe('iOS: waking the audio, and keeping it awake', () => {
  it('does everything a gesture allows before unlock() first awaits (resume, a silent buffer, the first speech)', async () => {
    const engine = createAudioEngine();
    const pending = engine.unlock();
    const ac = Ctx.live[0]!;
    expect(ac.resumes).toBe(1);
    expect(ac.started).toBe(1);
    expect(spoken).toHaveLength(1);
    expect(spoken[0]!.volume).toBe(0);
    await pending;
    expect(engine.ready).toBe(true);
    expect(engine.state).toBe('running');
  });

  it('a context Safari interrupts is asked to run again, and any tap wakes one that stayed stopped', async () => {
    const engine = createAudioEngine();
    await engine.unlock();
    const ac = Ctx.live[0]!;
    // a phone call: Safari moves the context to 'interrupted'
    ac.state = 'interrupted';
    ac.onstatechange?.();
    expect(ac.resumes).toBe(2);
    expect(engine.ready).toBe(true);
    // stopped without a statechange we could act on: the next tap anywhere starts it again, with a silent buffer
    ac.state = 'suspended';
    const started = ac.started;
    document.dispatchEvent(new Event('pointerdown'));
    expect(ac.state).toBe('running');
    expect(ac.started).toBe(started + 1);
  });

  it('does not wake a context suspended on purpose (page hidden) until resume()', async () => {
    const engine = createAudioEngine();
    await engine.unlock();
    const ac = Ctx.live[0]!;
    engine.suspend();
    await flush();
    const resumes = ac.resumes;
    document.dispatchEvent(new Event('keydown'));
    ac.onstatechange?.();
    expect(ac.resumes).toBe(resumes);
    expect(ac.state).toBe('suspended');
    engine.resume();
    expect(ac.state).toBe('running');
  });
});

describe('her phone reading out loud', () => {
  const setup = async (): Promise<{ engine: AudioEngine; inside: Inside }> => {
    const engine = createAudioEngine();
    await engine.unlock();
    spoken = [];
    return { engine, inside: engine as unknown as Inside };
  };

  it('ducks the beds under the device voice and lets go when it ends', async () => {
    const { engine, inside } = await setup();
    engine.speak!('撥號中。');
    expect(spoken).toHaveLength(1);
    expect(inside.bus.speechDuck.gain.target).toBeCloseTo(0.42);
    spoken[0]!.onend!();
    expect(inside.bus.speechDuck.gain.target).toBe(1);
  });

  it('panic cannot push the beds over the voice', async () => {
    const { engine, inside } = await setup();
    engine.setNoise(3);
    engine.speak!('撥號中。');
    const under = inside.bus.ambLoud.gain.target * inside.bus.speechDuck.gain.target;
    expect(under).toBeCloseTo(0.42);
    engine.setNoise(2);
    expect(inside.bus.ambLoud.gain.target * inside.bus.speechDuck.gain.target).toBeCloseTo(0.42);
  });

  it('lets go of the duck even if the device never says it finished', async () => {
    vi.useFakeTimers();
    const { engine, inside } = await setup();
    engine.speak!('撥號中。');
    expect(inside.bus.speechDuck.gain.target).toBeLessThan(1);
    vi.advanceTimersByTime(2100);
    expect(inside.bus.speechDuck.gain.target).toBe(1);
  });

  it('keeps its usual loudness at the default master, follows the master on the mix curve, and the voice level at 0 is silent', async () => {
    const { engine } = await setup();
    engine.setVolume(0.8);
    engine.setVoiceVolume(0.45);
    engine.speak!('撥號中。');
    expect(spoken.at(-1)!.volume).toBeCloseTo(0.8 * (0.4 + 0.45));
    engine.setVolume(0.4);
    engine.speak!('撥號中。');
    expect(spoken.at(-1)!.volume).toBeCloseTo(0.8 * (0.4 + 0.45) / 4);
    engine.setVolume(1);
    engine.setVoiceVolume(1);
    engine.speak!('撥號中。');
    expect(spoken.at(-1)!.volume).toBeCloseTo(1);
    const before = spoken.length;
    engine.setVoiceVolume(0);
    engine.speak!('撥號中。');
    expect(spoken).toHaveLength(before);
  });
});

describe('decoded memory stays bounded', () => {
  const PER_FILE = 16000 * 4; // one second of mono float32 at the fake 16 kHz

  it('keeps decoded one-shots under budget, the current scene last to go, and decodes again without the network', async () => {
    const ac = new Ctx();
    ac.state = 'running';
    const budget = PER_FILE * 10;
    const bank = new SampleBank(ac as unknown as BaseAudioContext, SFX_SAMPLES, AMBIENCE_SAMPLES, budget);
    bank.prefetch(['step']);
    await bank.loadSfx('step');
    await bank.preloadSfx();
    const all = Object.values(SFX_SAMPLES).flatMap((e) => [...e!.files]);
    expect(bank.stats().sfxFetched).toBe(bank.stats().sfxTotal);
    for (const file of all) {
      expect(await bank.load(file)).not.toBeNull();
      expect(bank.stats().decodedBytes).toBeLessThanOrEqual(budget);
    }
    for (const file of SFX_SAMPLES.step!.files) expect(bank.has(file)).toBe(true);
    const evicted = all.find((file) => !bank.has(file))!;
    const requests = fetched.length;
    expect(await bank.load(evicted)).not.toBeNull();
    expect(fetched.length).toBe(requests);
  });

  it('with the default budget, playing every sound in the game holds at most 40 MB of decoded one-shots', async () => {
    const ac = new Ctx();
    ac.bufferSeconds = 6; // longer than almost every real one-shot
    const bank = new SampleBank(ac as unknown as BaseAudioContext);
    for (const id of Object.keys(SFX_SAMPLES) as SfxId[]) await bank.loadSfx(id);
    expect(bank.stats().decodedBytes).toBeLessThanOrEqual(40 * 1024 * 1024);
    expect(bank.stats().decodedBytes).toBeGreaterThan(30 * 1024 * 1024);
  });

  it('keeps the beds that play, then the most recent ones, within the bed budget; reading stats changes nothing', async () => {
    const ac = new Ctx();
    // fake beds decode to one second of mono: room for two besides the ones playing
    const bank = new SampleBank(ac as unknown as BaseAudioContext, SFX_SAMPLES, AMBIENCE_SAMPLES, undefined, PER_FILE * 2);
    await bank.loadAmb('rain');
    await bank.loadAmb('cafe');
    await bank.loadAmb('library');
    bank.stats(); // used to mark every decoded bed as just used, in manifest order
    bank.trimBeds(['library']);
    const has = (id: 'rain' | 'cafe' | 'library') => bank.has(AMBIENCE_SAMPLES[id]!.files[0]!);
    expect(has('library')).toBe(true);
    expect(has('cafe')).toBe(true);
    expect(has('rain')).toBe(false);
    // the next place has two beds: both stay, the last place goes
    await bank.loadAmb('rain');
    bank.trimBeds(['library', 'rain']);
    expect(has('cafe')).toBe(false);
    expect(has('rain') && has('library')).toBe(true);
  });

  it("decodes the next place's beds ahead next to the ones playing, only as far as the budget allows", async () => {
    const ac = new Ctx();
    ac.state = 'running';
    // estimates come from the loop length: rain is 60.5 s at 16 kHz, stereo unless marked mono
    const rainBytes = Math.ceil((AMBIENCE_SAMPLES.rain!.loopEnd + AMBIENCE_SAMPLES.rain!.loopStart) * ac.sampleRate) * (AMBIENCE_SAMPLES.rain!.mono ? 1 : 2) * 4;
    const bank = new SampleBank(ac as unknown as BaseAudioContext, SFX_SAMPLES, AMBIENCE_SAMPLES, undefined, rainBytes + PER_FILE);
    await bank.loadAmb('library');
    bank.prepareBeds(['rain', 'cafe'], ['library']);
    await flush(80);
    const has = (id: 'rain' | 'cafe' | 'library') => bank.has(AMBIENCE_SAMPLES[id]!.files[0]!);
    expect(has('library')).toBe(true);
    expect(has('rain')).toBe(true); // fits next to the one playing
    expect(has('cafe')).toBe(false); // would not: loaded when its scene starts
    // the scene starts: what played before is kept only while it fits
    bank.trimBeds(['rain']);
    expect(has('rain') && has('library')).toBe(true);
  });
});

describe('a place starting', () => {
  const sampled = 'rain' as const;
  it('waits briefly for its recording, then starts synthesized if it is late, and takes the recording over when it comes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
    let release: () => void = () => undefined;
    globalThis.fetch = ((url: string) => {
      fetched.push(String(url));
      return new Promise((resolve) => {
        const answer = () => resolve({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(16) } as unknown as Response);
        if (String(url).includes('amb/rain')) release = answer;
        else answer();
      });
    }) as typeof fetch;
    const engine = createAudioEngine();
    const dbg = engine as unknown as AudioEngineDebug;
    await engine.unlock();
    engine.setAmbience([sampled], 1000);
    await flush();
    expect(dbg.stats().layers).toEqual([]); // silence while the recording may still come
    vi.advanceTimersByTime(900);
    await flush();
    expect(dbg.stats().layers).toEqual([sampled]); // late: synthesis after all
    expect(dbg.stats().sampledLayers).toEqual([]);
    release();
    await flush(80);
    expect(dbg.stats().sampledLayers).toEqual([sampled]);
  });

  it('starts from its recording at once when it was decoded ahead', async () => {
    const engine = createAudioEngine();
    const dbg = engine as unknown as AudioEngineDebug;
    await engine.unlock();
    engine.prefetch!({ now: [], soon: [], amb: [sampled], ambNow: [sampled] });
    await flush(80);
    engine.setAmbience([sampled], 1000);
    expect(dbg.stats().sampledLayers).toEqual([sampled]);
  });

  it('puts a landmark where the scene says, and rebuilds a running place whose landmarks move', async () => {
    const engine = createAudioEngine();
    const dbg = engine as unknown as AudioEngineDebug;
    await engine.unlock();
    const front = Object.assign(['tower_square_night'] as AmbienceList, {});
    engine.setAmbience(front, 500);
    await flush(80);
    const first = dbg.stats().layers.length;
    expect(first).toBe(1);
    const moved: AmbienceList = Object.assign(['tower_square_night'] as AmbienceId[], { landmarks: { tower_square_night: { tower: 'back-right' as const } } });
    engine.setAmbience(moved, 500);
    // the old placement fades out under the new one
    expect((engine as unknown as { layers: Map<string, unknown> }).layers.size).toBe(1);
    const inner = engine as unknown as { layerAt: WeakMap<object, string>; layers: Map<string, object> };
    expect(inner.layerAt.get(inner.layers.get('tower_square_night')!)).toBe(JSON.stringify({ tower: 135 }));
    engine.setAmbience(moved, 500);
    expect(inner.layerAt.get(inner.layers.get('tower_square_night')!)).toBe(JSON.stringify({ tower: 135 }));
  });
});

describe('the same long sound again and again (the midnight bell)', () => {
  it('rings at most three tails at once and steps the older ones down', async () => {
    const engine = createAudioEngine();
    const dbg = engine as unknown as AudioEngineDebug;
    await engine.unlock();
    const ac = Ctx.live[0]!;
    ac.bufferSeconds = 15;
    await dbg.playSource('bell_toll', { dir: 'front', dist: 'far' }, 'sample');
    for (let i = 1; i < 12; i++) {
      ac.currentTime += 1.4;
      engine.play('bell_toll', { dir: 'front', dist: 'far' });
    }
    await flush();
    const inner = engine as unknown as { shots: { disposed: boolean; end: number }[]; shotIds: WeakMap<object, string> };
    const ringing = inner.shots.filter((s) => inner.shotIds.get(s) === 'bell_toll' && s.end - ac.currentTime > 1.5 && !s.disposed);
    expect(ringing.length).toBe(3);
  });
});

describe('a recording variant that arrives too late', () => {
  it('is dropped, like any other recording, instead of landing out of place', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
    let release: () => void = () => undefined;
    globalThis.fetch = ((url: string) => {
      fetched.push(String(url));
      return new Promise((resolve) => {
        const answer = () => resolve({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(16) } as unknown as Response);
        if (String(url).includes('chair_creak_2')) release = answer;
        else answer();
      });
    }) as typeof fetch;
    const engine = createAudioEngine();
    await engine.unlock();
    const ac = Ctx.live[0]!;
    const started = ac.started;
    engine.play('chair_creak', { dir: 'left', dist: 'near' }, { variant: 1 });
    vi.advanceTimersByTime(3000);
    release();
    await flush(80);
    expect((engine as unknown as AudioEngineDebug).stats().dropped.chair_creak).toBe(1);
    expect(ac.started).toBe(started);
  });
});

describe('master chain', () => {
  it('knows how much a compressor lifts everything on its own (Web Audio makeup gain)', () => {
    const db = (g: number) => 20 * Math.log10(g);
    // knee 0: the curve at full scale is T·(1 − 1/ratio) dB, and makeup is −0.6 of that
    for (const [t, r] of [[-4, 20], [-3.2, 20], [-12, 4]] as const) expect(db(compressorMakeup(t, 0, r))).toBeCloseTo(-0.6 * t * (1 - 1 / r), 2);
    // the glue (soft knee) is the one that was adding about +5 dB to every quiet sound
    expect(db(compressorMakeup(-20, 12, 2.5))).toBeGreaterThan(4.5);
    expect(db(compressorMakeup(-20, 12, 2.5))).toBeLessThan(5.5);
  });
});
