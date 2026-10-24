// The spatial audio engine. All sound is synthesized (sounds.ts / ambience.ts / voice.ts) and placed
// around a listener at the origin facing -z with HRTF panners.
//
//   ambience layers → ambIn → ambTone(lowpass) → ambDuck ─┐
//   one-shots ─────────────────────────────── sfxBus ─────┤
//   voice presence ─────────────────────────── voiceBus ──┼→ world → attention(lowpass) ─┐
//   reverb sends → room convolver → reverbOut ────────────┘                              │
//   interface sounds (memory_keep, focus_shift, …) ── uiBus ─────────────────────────────┼→ master
//   master(volume·enabled) → glue compressor → limiter → soft clip → destination ←───────┘

import { AMBIENCE, VOICES, type AmbienceId, type SfxId, type SpatialPos, type VoiceId } from './catalog';
import { startAmbience, type AmbienceLayer } from './ambience';
import { clamp, expRampTo, glide, hold, impulseResponse, placementOf, softClipCurve, spawnShot, type SfxRecipe, type Shot } from './core';
import { SFX_RECIPES, UI_SFX } from './sounds';
import { phoneTick, voicePresence } from './voice';

export interface AudioEngine {
  unlock(): Promise<void>;
  readonly ready: boolean;
  setEnabled(on: boolean): void;
  setVolume(v: number): void;
  setVoiceVolume(v: number): void;
  setAmbience(ids: AmbienceId[], fadeMs?: number): void;
  play(id: SfxId, pos: SpatialPos, opts?: { gain?: number; rate?: number }): void;
  voice(speaker: VoiceId, pos: SpatialPos, durationMs: number): void;
  setAttention(level: number): void;
  duck(amount: number, ms: number): void;
  silence(ms: number): void;
  suspend(): void;
  resume(): void;
}

/** Optional diagnostics, implemented by the Web Audio engine (used by the lab page and tests). */
export interface AudioEngineDebug {
  stats(): { state: string; layers: string[]; shots: number; voices: number; layerTimers: number; layerShots: number };
}

const MAX_SFX = 24;
const MAX_VOICES = 6;
const DEFAULT_FADE_MS = 2500;
const OPEN = 20000;
const MUFFLED = 900;
/** How long the head turn muffles everything before hearing opens up again. */
const TURN_MS = 700;

class SilentEngine implements AudioEngine {
  readonly ready = false;
  async unlock(): Promise<void> {}
  setEnabled(): void {}
  setVolume(): void {}
  setVoiceVolume(): void {}
  setAmbience(): void {}
  play(): void {}
  voice(): void {}
  setAttention(): void {}
  duck(): void {}
  silence(): void {}
  suspend(): void {}
  resume(): void {}
}

export function createSilentEngine(): AudioEngine {
  return new SilentEngine();
}

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function createAudioEngine(): AudioEngine {
  const Ctor = audioContextCtor();
  if (!Ctor) return createSilentEngine();
  return new WebAudioEngine(Ctor);
}

interface Buses {
  master: GainNode;
  world: GainNode;
  attention: BiquadFilterNode;
  ambIn: GainNode;
  ambTone: BiquadFilterNode;
  ambDuck: GainNode;
  sfx: GainNode;
  voice: GainNode;
  ui: GainNode;
  reverbIn: GainNode;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const perceptual = (v: number): number => {
  const x = clamp(Number.isFinite(v) ? v : 0, 0, 1);
  return x * x;
};

class WebAudioEngine implements AudioEngine, AudioEngineDebug {
  private ac: AudioContext | null = null;
  private bus: Buses | null = null;
  private failed = false;
  private primed = false;
  private enabled = true;
  private volume = 0.8;
  private voiceVolume = 0.8;
  private wanted: AmbienceId[] = [];
  private layers = new Map<AmbienceId, AmbienceLayer>();
  private shots: Shot[] = [];
  private voices: Shot[] = [];
  private attentionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly Ctor: AudioContextCtor) {}

  get ready(): boolean {
    return !!this.ac && this.ac.state === 'running';
  }

  async unlock(): Promise<void> {
    if (this.failed) return;
    try {
      if (!this.ac) this.build();
      const ac = this.ac;
      if (!ac) return;
      if (ac.state !== 'running') await Promise.race([ac.resume(), sleep(1200)]);
      if (!this.primed) {
        // iOS: a (silent) buffer started inside the gesture fully unlocks output
        this.primed = true;
        const b = ac.createBuffer(1, 1, ac.sampleRate);
        const s = ac.createBufferSource();
        s.buffer = b;
        s.connect(ac.destination);
        s.start();
        s.onended = () => s.disconnect();
      }
    } catch {
      // never throw from unlock
    }
  }

  private build(): void {
    let ac: AudioContext;
    try {
      ac = new this.Ctor({ latencyHint: 'interactive' });
    } catch {
      try {
        ac = new this.Ctor();
      } catch {
        this.failed = true;
        return;
      }
    }
    try {
      // let audio play with the iOS ring/silent switch off — this game is unplayable without sound
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      // ignore
    }

    const gain = (v: number): GainNode => {
      const g = ac.createGain();
      g.gain.value = v;
      return g;
    };
    const master = gain(this.enabled ? perceptual(this.volume) : 0);
    const glue = ac.createDynamicsCompressor();
    glue.threshold.value = -20;
    glue.knee.value = 12;
    glue.ratio.value = 2.5;
    glue.attack.value = 0.012;
    glue.release.value = 0.3;
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    const trim = gain(0.85);
    const clip = ac.createWaveShaper();
    clip.curve = softClipCurve();
    master.connect(glue).connect(limiter).connect(trim).connect(clip).connect(ac.destination);

    const attention = ac.createBiquadFilter();
    attention.type = 'lowpass';
    attention.frequency.value = OPEN;
    attention.Q.value = 0.5;
    const world = gain(1);
    world.connect(attention).connect(master);

    const ambIn = gain(1);
    const ambTone = ac.createBiquadFilter();
    ambTone.type = 'lowpass';
    ambTone.frequency.value = OPEN;
    ambTone.Q.value = 0.5;
    const ambDuck = gain(1);
    ambIn.connect(ambTone).connect(ambDuck).connect(world);

    const sfx = gain(1);
    sfx.connect(world);
    const voice = gain(perceptual(this.voiceVolume) * 1.2);
    voice.connect(world);
    const ui = gain(0.9);
    ui.connect(master);

    const reverbIn = gain(1);
    const conv = ac.createConvolver();
    conv.normalize = true;
    conv.buffer = impulseResponse(ac, 'room', { seconds: 2.4, brightness: 0.5, damping: 1.3, early: 8, preDelay: 0.018 });
    const reverbOut = gain(0.55);
    reverbIn.connect(conv).connect(reverbOut).connect(world);

    const L = ac.listener;
    try {
      if (L.forwardX) {
        L.positionX.value = 0;
        L.positionY.value = 0;
        L.positionZ.value = 0;
        L.forwardX.value = 0;
        L.forwardY.value = 0;
        L.forwardZ.value = -1;
        L.upX.value = 0;
        L.upY.value = 1;
        L.upZ.value = 0;
      } else {
        L.setOrientation?.(0, 0, -1, 0, 1, 0);
        L.setPosition?.(0, 0, 0);
      }
    } catch {
      // defaults are already correct
    }

    this.ac = ac;
    this.bus = { master, world, attention, ambIn, ambTone, ambDuck, sfx, voice, ui, reverbIn };
    if (this.wanted.length) this.reconcile(1500);
  }

  setEnabled(on: boolean): void {
    this.enabled = !!on;
    this.applyMaster(0.06);
  }

  setVolume(v: number): void {
    this.volume = clamp(Number.isFinite(v) ? v : 0, 0, 1);
    this.applyMaster(0.05);
  }

  setVoiceVolume(v: number): void {
    this.voiceVolume = clamp(Number.isFinite(v) ? v : 0, 0, 1);
    if (!this.ac || !this.bus) return;
    glide(this.bus.voice.gain, perceptual(this.voiceVolume) * 1.2, this.ac.currentTime, 0.05);
  }

  private applyMaster(tc: number): void {
    if (!this.ac || !this.bus) return;
    glide(this.bus.master.gain, this.enabled ? perceptual(this.volume) : 0, this.ac.currentTime, tc);
  }

  setAmbience(ids: AmbienceId[], fadeMs: number = DEFAULT_FADE_MS): void {
    const valid = Array.isArray(ids) ? ids.filter((id) => Object.prototype.hasOwnProperty.call(AMBIENCE, id)) : [];
    this.wanted = [...new Set(valid)];
    this.reconcile(fadeMs);
  }

  private reconcile(fadeMs: number): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus) return;
    const sec = Math.max(0.05, (Number.isFinite(fadeMs) ? fadeMs : DEFAULT_FADE_MS) / 1000);
    for (const [id, layer] of this.layers) {
      if (!this.wanted.includes(id) && !layer.stopping) layer.stop(sec);
    }
    for (const id of this.wanted) {
      const existing = this.layers.get(id);
      if (existing && !existing.disposed) {
        if (existing.stopping) existing.revive(sec);
        continue;
      }
      const layer = startAmbience(ac, id, bus.ambIn, bus.reverbIn, (l) => {
        if (this.layers.get(l.id) === l) this.layers.delete(l.id);
      });
      if (layer) {
        this.layers.set(id, layer);
        layer.fadeIn(sec);
      }
    }
  }

  play(id: SfxId, pos: SpatialPos, opts?: { gain?: number; rate?: number }): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus || ac.state !== 'running') return;
    const recipe = (SFX_RECIPES as Record<string, SfxRecipe | undefined>)[id];
    if (!recipe) return;
    try {
      this.shots = this.shots.filter((s) => !s.disposed);
      while (this.shots.length >= MAX_SFX) this.shots.shift()?.kill();
      const shot = spawnShot(ac, recipe, {
        dest: UI_SFX.has(id) ? bus.ui : bus.sfx,
        reverb: bus.reverbIn,
        place: placementOf(pos),
        t: ac.currentTime + 0.01,
        gain: clamp(opts?.gain ?? 1, 0, 4),
        rate: clamp(opts?.rate ?? 1, 0.25, 4),
      });
      if (shot) this.shots.push(shot);
      this.sideEffects(id);
    } catch {
      // a broken recipe must never break the game
    }
  }

  /** Some sounds also change the world: power cuts darken the room, silence_drop pulls everything away. */
  private sideEffects(id: SfxId): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus) return;
    const now = ac.currentTime;
    if (id === 'blackout') {
      const f = bus.ambTone.frequency;
      expRampTo(f, 320, now, 0.08);
      f.setValueAtTime(320, now + 1.6);
      f.exponentialRampToValueAtTime(OPEN, now + 5);
      this.duck(0.55, 1200);
    } else if (id === 'silence_drop') {
      const g = bus.ambDuck.gain;
      hold(g, now);
      g.setTargetAtTime(0, now + 0.28, 0.015);
      g.setTargetAtTime(1, now + 2.6, 0.7);
    } else if (id === 'tinnitus') {
      this.duck(0.5, 3500);
    }
  }

  voice(speaker: VoiceId, pos: SpatialPos, durationMs: number): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus || ac.state !== 'running') return;
    const v = (VOICES as Record<string, { pitch: number; breath: number } | undefined>)[speaker];
    if (!v) return;
    try {
      const dur = clamp((Number.isFinite(durationMs) ? durationMs : 1000) / 1000, 0.2, 30);
      const recipe: SfxRecipe =
        v.pitch <= 0 ? { play: (c) => phoneTick(c), jitter: 0 } : { play: (c) => voicePresence(c, v.pitch, v.breath, dur), jitter: 0.02 };
      this.voices = this.voices.filter((s) => !s.disposed);
      while (this.voices.length >= MAX_VOICES) this.voices.shift()?.kill();
      const shot = spawnShot(ac, recipe, {
        dest: bus.voice,
        reverb: bus.reverbIn,
        place: placementOf(pos),
        t: ac.currentTime + 0.01,
      });
      if (shot) this.voices.push(shot);
    } catch {
      // ignore
    }
  }

  setAttention(level: number): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus) return;
    const l = clamp(Number.isFinite(level) ? level : 0, 0, 1);
    const now = ac.currentTime;
    if (this.attentionTimer !== null) clearTimeout(this.attentionTimer);
    this.attentionTimer = null;
    if (l <= 0) {
      expRampTo(bus.attention.frequency, OPEN, now, 0.45);
      glide(bus.world.gain, 1, now, 0.12);
      return;
    }
    // turn of the head: hearing smears, then opens up on the new direction
    expRampTo(bus.attention.frequency, OPEN * Math.pow(MUFFLED / OPEN, l), now, 0.12);
    glide(bus.world.gain, 1 - 0.3 * l, now, 0.05);
    this.attentionTimer = setTimeout(() => {
      this.attentionTimer = null;
      this.setAttention(0);
    }, TURN_MS);
  }

  duck(amount: number, ms: number): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus) return;
    const a = clamp(Number.isFinite(amount) ? amount : 0, 0, 1);
    const holdS = Math.max(0, (Number.isFinite(ms) ? ms : 0) / 1000);
    const now = ac.currentTime;
    const g = bus.ambDuck.gain;
    glide(g, 1 - a, now, 0.12);
    g.setTargetAtTime(1, now + 0.35 + holdS, 0.5);
  }

  silence(ms: number): void {
    this.setAmbience([], ms);
  }

  suspend(): void {
    this.ac?.suspend().catch(() => undefined);
  }

  resume(): void {
    if (!this.ac || this.ac.state === 'closed') return;
    this.ac.resume().catch(() => undefined);
  }

  stats(): ReturnType<AudioEngineDebug['stats']> {
    let layerTimers = 0;
    let layerShots = 0;
    for (const l of this.layers.values()) {
      layerTimers += l.stats.timers;
      layerShots += l.stats.shots;
    }
    return {
      state: this.ac?.state ?? 'none',
      layers: [...this.layers.keys()],
      shots: this.shots.filter((s) => !s.disposed).length,
      voices: this.voices.filter((s) => !s.disposed).length,
      layerTimers,
      layerShots,
    };
  }
}
