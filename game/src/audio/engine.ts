// The spatial audio engine. Sounds are recorded samples where samples.ts has one (fetched and
// decoded lazily) and synthesized otherwise (sounds.ts / ambience.ts / voice.ts); either way they
// are placed around a listener at the origin facing -z with HRTF panners. A sound whose sample is
// not decoded yet plays from its synthesis recipe, so nothing ever waits on the network.
//
//   ambience layers → ambIn(ambience volume) → ambTone(lowpass) → ambDuck ─┐
//   one-shots ─────────────────────────────── sfxBus(sfx volume) ──────────┤
//   voice presence ─────────────────────────── voiceBus ──┼→ world → attention(lowpass) → daze(lowpass·gain) ─┐
//   reverb sends (ambience/sfx sends scaled like their buses) → room convolver → reverbOut ┘ │
//   interface sounds (memory_keep, focus_shift, …) ── uiBus ─────────────────────────────┤
//   her own body (heartbeat, tinnitus) ── bodyBus: stays clear when the world is dazed ──┼→ master
//   master(volume·enabled) → glue compressor → limiter → soft clip → destination ←───────┘

import { AMBIENCE, isSfx, type AmbienceId, type SfxId, type SpatialPos, type VoiceId } from './catalog';
import { startAmbience, type AmbienceLayer, type SampleBed, type SoundResolver } from './ambience';
import { clamp, expRampTo, glide, hold, impulseResponse, placementOf, softClipCurve, spawnShot, type SfxRecipe, type Shot } from './core';
import { SampleBank, sampleRecipe, type SampleBankStats } from './samples';
import { SFX_RECIPES, UI_SFX } from './sounds';
import { phoneTick } from './voice';

/** `to`: the sound travels there from `pos` while it plays. */
export type SfxOpts = { gain?: number; rate?: number; variant?: number; to?: SpatialPos };

export interface AudioEngine {
  unlock(): Promise<void>;
  readonly ready: boolean;
  setEnabled(on: boolean): void;
  setVolume(v: number): void;
  setVoiceVolume(v: number): void;
  /** Ambience beds only; 1 = their mixed level. */
  setAmbienceVolume(v: number): void;
  /** Sound effects and interface sounds. */
  setSfxVolume(v: number): void;
  setAmbience(ids: AmbienceId[], fadeMs?: number): void;
  play(id: SfxId, pos: SpatialPos, opts?: SfxOpts): void;
  /** A line spoken by `speaker` ('life' = a passer-by in the background). People make no vocal sound, only a small real one. */
  voice(speaker: VoiceId, pos: SpatialPos, durationMs: number, kind?: 'line' | 'life'): void;
  setAttention(level: number): void;
  /** Pain or shock: 0 = clear, 1 = the world comes through as if under water. Her own body stays clear. */
  setDaze(level: number): void;
  duck(amount: number, ms: number): void;
  silence(ms: number): void;
  suspend(): void;
  resume(): void;
}

export type SampleMode = 'auto' | 'synth';

/** Optional diagnostics, implemented by the Web Audio engine (used by the lab page and tests). */
export interface AudioEngineDebug {
  stats(): {
    state: string;
    layers: string[];
    sampledLayers: string[];
    shots: number;
    voices: number;
    layerTimers: number;
    layerShots: number;
    samples: SampleBankStats | null;
  };
  /** 'auto' = recordings when decoded, synthesis otherwise; 'synth' = synthesis only. */
  setSampleMode(mode: SampleMode): void;
  /** Play one sound from a chosen source; a sample that is not loaded yet is loaded first. */
  playSource(id: SfxId, pos: SpatialPos, source: 'sample' | 'synth', opts?: SfxOpts): Promise<boolean>;
  hasSample(id: SfxId | AmbienceId): boolean;
}

const MAX_SFX = 24;
const MAX_VOICES = 6;
const DEFAULT_FADE_MS = 2500;
/** A speaker who talks again after this long a silence gets their turn-taking rustle again. */
const TURN_GAP_S = 8;
/** Crossfade from a synthesized bed to its recording once that has been decoded. */
const SWAP_S = 2.5;
const OPEN = 20000;
const MUFFLED = 900;
/** Fully dazed: the world through a wall. */
const DAZED = 520;
/** Sounds of her own body, which pain does not muffle. */
const BODY_SFX: ReadonlySet<SfxId> = new Set<SfxId>(['heartbeat', 'tinnitus']);
/** How long the head turn muffles everything before hearing opens up again. */
const TURN_MS = 700;

class SilentEngine implements AudioEngine {
  readonly ready = false;
  async unlock(): Promise<void> {}
  setEnabled(): void {}
  setVolume(): void {}
  setVoiceVolume(): void {}
  setAmbienceVolume(): void {}
  setSfxVolume(): void {}
  setAmbience(): void {}
  play(): void {}
  voice(): void {}
  setAttention(): void {}
  setDaze(): void {}
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
  daze: BiquadFilterNode;
  dazeGain: GainNode;
  body: GainNode;
  ambIn: GainNode;
  ambTone: BiquadFilterNode;
  ambDuck: GainNode;
  ambVerb: GainNode;
  sfx: GainNode;
  sfxVerb: GainNode;
  voice: GainNode;
  ui: GainNode;
  reverbIn: GainNode;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Beds stay 6 dB behind their original mix so story cues have room to stand out. */
const ambienceGain = (v: number): number => perceptual(v) * 0.5;
const sfxGain = (v: number): number => perceptual(v) * 2;
/** Interface sounds sit a little under the effects (0.9 at the default effects volume). */
const UI_TRIM = 0.62;

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
  private ambienceVolume = 0.7;
  private lastSpeaker: VoiceId | null = null;
  private lastSpokeAt = -Infinity;
  private sfxVolume = 0.85;
  private wanted: AmbienceId[] = [];
  private layers = new Map<AmbienceId, AmbienceLayer>();
  private shots: Shot[] = [];
  private voices: Shot[] = [];
  private attentionTimer: ReturnType<typeof setTimeout> | null = null;
  private bank: SampleBank | null = null;
  private sampleMode: SampleMode = 'auto';
  private preloading = false;
  private readonly resolver: SoundResolver = (id) => (isSfx(id) ? this.sampleFor(id) : undefined);

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
      if (!this.preloading && this.bank && ac.state === 'running') {
        // fetch the one-shots in the background; until each arrives its recipe plays instead
        this.preloading = true;
        void this.bank.preloadSfx().catch(() => undefined);
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
    const daze = ac.createBiquadFilter();
    daze.type = 'lowpass';
    daze.frequency.value = OPEN;
    daze.Q.value = 0.7;
    const dazeGain = gain(1);
    world.connect(attention).connect(daze).connect(dazeGain).connect(master);

    const ambIn = gain(ambienceGain(this.ambienceVolume));
    const ambTone = ac.createBiquadFilter();
    ambTone.type = 'lowpass';
    ambTone.frequency.value = OPEN;
    ambTone.Q.value = 0.5;
    const ambDuck = gain(1);
    ambIn.connect(ambTone).connect(ambDuck).connect(world);

    const sfx = gain(sfxGain(this.sfxVolume));
    sfx.connect(world);
    const voice = gain(perceptual(this.voiceVolume) * 1.2);
    voice.connect(world);
    const ui = gain(sfxGain(this.sfxVolume) * UI_TRIM);
    ui.connect(master);
    const body = gain(sfxGain(this.sfxVolume));
    body.connect(master);

    const reverbIn = gain(1);
    const ambVerb = gain(ambienceGain(this.ambienceVolume));
    ambVerb.connect(reverbIn);
    const sfxVerb = gain(sfxGain(this.sfxVolume));
    sfxVerb.connect(reverbIn);
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
    this.bus = { master, world, attention, daze, dazeGain, body, ambIn, ambTone, ambDuck, ambVerb, sfx, sfxVerb, voice, ui, reverbIn };
    try {
      this.bank = new SampleBank(ac);
    } catch {
      this.bank = null;
    }
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

  setAmbienceVolume(v: number): void {
    this.ambienceVolume = clamp(Number.isFinite(v) ? v : 0, 0, 1);
    if (!this.ac || !this.bus) return;
    const g = ambienceGain(this.ambienceVolume);
    glide(this.bus.ambIn.gain, g, this.ac.currentTime, 0.05);
    glide(this.bus.ambVerb.gain, g, this.ac.currentTime, 0.05);
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = clamp(Number.isFinite(v) ? v : 0, 0, 1);
    if (!this.ac || !this.bus) return;
    const g = sfxGain(this.sfxVolume);
    glide(this.bus.sfx.gain, g, this.ac.currentTime, 0.05);
    glide(this.bus.sfxVerb.gain, g, this.ac.currentTime, 0.05);
    glide(this.bus.ui.gain, g * UI_TRIM, this.ac.currentTime, 0.05);
    glide(this.bus.body.gain, g, this.ac.currentTime, 0.05);
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
    for (const id of this.wanted) this.ensureLayer(id, sec);
    this.bank?.trimBeds(this.wanted);
  }

  /** The decoded recording for a bed, or null (not in the manifest, not loaded yet, or A/B synth). */
  private bedFor(id: AmbienceId): SampleBed | null {
    if (!this.bank || this.sampleMode === 'synth') return null;
    const entry = this.bank.ambEntry(id);
    const buffer = entry ? this.bank.amb(id) : null;
    if (!entry || !buffer) return null;
    return { buffer, gain: entry.gain, loopStart: entry.loopStart, loopEnd: entry.loopEnd, extras: !!entry.extras };
  }

  /**
   * Make sure the wanted layer `id` is running from the best available source. A synthesized
   * layer whose recording becomes available is crossfaded into the recording.
   */
  private ensureLayer(id: AmbienceId, sec: number): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus) return;
    const bed = this.bedFor(id);
    const existing = this.layers.get(id);
    if (existing && !existing.disposed) {
      if (existing.stopping) existing.revive(sec);
      if (existing.sampled === !!bed) return;
      existing.stop(Math.max(sec, SWAP_S));
    }
    const layer = startAmbience(
      ac,
      id,
      bus.ambIn,
      bus.ambVerb,
      (l) => {
        if (this.layers.get(l.id) === l) this.layers.delete(l.id);
      },
      { bed, resolve: this.resolver },
    );
    if (layer) {
      this.layers.set(id, layer);
      layer.fadeIn(existing ? Math.max(sec, SWAP_S) : sec);
    }
    if (!bed && this.bank && this.sampleMode !== 'synth' && this.bank.ambEntry(id)) {
      void this.bank.loadAmb(id).then((buf) => {
        if (buf && this.wanted.includes(id)) this.ensureLayer(id, SWAP_S);
      });
    }
  }

  /** A recorded variant of `id` ready to play, or undefined (and its loading is kicked off). */
  private sampleFor(id: SfxId, force = false): SfxRecipe | undefined {
    const bank = this.bank;
    if (!bank || (this.sampleMode === 'synth' && !force)) return undefined;
    const entry = bank.sfxEntry(id);
    if (!entry) return undefined;
    const buf = bank.pickSfx(id);
    if (!buf) {
      void bank.loadSfx(id);
      return undefined;
    }
    return sampleRecipe(buf, entry);
  }

  play(id: SfxId, pos: SpatialPos, opts?: SfxOpts): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus || ac.state !== 'running') return;
    if (!isSfx(id)) return;
    // Script numbers are converted to zero-based indices by the director.
    // Await the exact recording rather than substituting another loaded variant.
    if (opts?.variant !== undefined && this.sampleMode !== 'synth') {
      void this.playSource(id, pos, 'sample', opts).then((played) => {
        if (!played) this.shoot(id, pos, opts, SFX_RECIPES[id]);
      });
      return;
    }
    const sampled = this.sampleFor(id);
    if (sampled) this.shoot(id, pos, opts, sampled);
    else this.shoot(id, pos, opts, SFX_RECIPES[id]);
  }

  private shoot(id: SfxId, pos: SpatialPos, opts: SfxOpts | undefined, recipe: SfxRecipe | undefined): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus || !recipe) return;
    try {
      this.shots = this.shots.filter((s) => !s.disposed);
      while (this.shots.length >= MAX_SFX) this.shots.shift()?.kill();
      const shot = spawnShot(ac, recipe, {
        dest: UI_SFX.has(id) ? bus.ui : BODY_SFX.has(id) ? bus.body : bus.sfx,
        reverb: BODY_SFX.has(id) ? null : bus.sfxVerb,
        place: placementOf(pos),
        glide: opts?.to ? placementOf(opts.to) : undefined,
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

  voice(speaker: VoiceId, pos: SpatialPos, _durationMs?: number, kind: 'line' | 'life' = 'line'): void {
    // No voice is ever simulated (a synthesized voice under the text read as uncanny; the text is the voice).
    // Instead someone who starts talking is placed by a small real sound: a passer-by's clothes and shifting
    // weight, or the rustle of a speaker turning to talk (a new speaker, or the same one after a silence).
    if (speaker !== 'phone') {
      if (kind === 'life') {
        this.play('huddle_rustle', pos, { gain: 0.12 });
        return;
      }
      if (speaker === 'me') return;
      const now = this.ac?.currentTime ?? 0;
      if (speaker !== this.lastSpeaker || now - this.lastSpokeAt > TURN_GAP_S) this.play('cloth_rustle', pos, { gain: 0.2 });
      this.lastSpeaker = speaker;
      this.lastSpokeAt = now;
      return;
    }
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus || ac.state !== 'running') return;
    try {
      const recipe: SfxRecipe = { play: (c) => phoneTick(c), jitter: 0 };
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

  setDaze(level: number): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus) return;
    const l = clamp(Number.isFinite(level) ? level : 0, 0, 1);
    const now = ac.currentTime;
    // sinking in is quick, coming back takes a while
    expRampTo(bus.daze.frequency, OPEN * Math.pow(DAZED / OPEN, l), now, l > 0 ? 0.5 : 1.6);
    glide(bus.dazeGain.gain, 1 - 0.5 * l, now, l > 0 ? 0.4 : 1.2);
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
      sampledLayers: [...this.layers.values()].filter((l) => l.sampled && !l.stopping).map((l) => l.id),
      shots: this.shots.filter((s) => !s.disposed).length,
      voices: this.voices.filter((s) => !s.disposed).length,
      layerTimers,
      layerShots,
      samples: this.bank?.stats() ?? null,
    };
  }

  setSampleMode(mode: SampleMode): void {
    const next: SampleMode = mode === 'synth' ? 'synth' : 'auto';
    if (next === this.sampleMode) return;
    this.sampleMode = next;
    for (const id of this.wanted) this.ensureLayer(id, SWAP_S);
  }

  async playSource(id: SfxId, pos: SpatialPos, source: 'sample' | 'synth', opts?: SfxOpts): Promise<boolean> {
    if (!isSfx(id)) return false;
    if (source === 'synth') {
      this.shoot(id, pos, opts, SFX_RECIPES[id]);
      return true;
    }
    const entry = this.bank?.sfxEntry(id);
    if (!entry || !this.bank) return false;
    let recipe: SfxRecipe | undefined;
    if (opts?.variant !== undefined) {
      if (!Number.isInteger(opts.variant) || opts.variant < 0 || opts.variant >= entry.files.length) return false;
      const buffer = await this.bank.load(entry.files[opts.variant]!);
      if (buffer) recipe = sampleRecipe(buffer, entry);
    } else {
      await this.bank.loadSfx(id);
      recipe = this.sampleFor(id, true);
    }
    // A suspended context (tab switch, OS audio change) is not a broken file: wake it before giving up.
    if (this.ac && this.ac.state !== 'running') await this.ac.resume().catch(() => undefined);
    if (!recipe || !this.ac || this.ac.state !== 'running') return false;
    this.shoot(id, pos, opts, recipe);
    return true;
  }

  hasSample(id: SfxId | AmbienceId): boolean {
    if (!this.bank) return false;
    return isSfx(id) ? !!this.bank.sfxEntry(id) : !!this.bank.ambEntry(id as AmbienceId);
  }
}
