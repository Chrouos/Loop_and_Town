// The spatial audio engine. Sounds are recorded samples where samples.ts has one (fetched and
// decoded lazily) and synthesized otherwise (sounds.ts / ambience.ts / voice.ts); either way they
// are placed around a listener at the origin facing -z with HRTF panners. A sound whose sample is
// not decoded yet plays from its synthesis recipe, so nothing ever waits on the network.
//
//   ambience layers → ambIn(ambience volume) → ambTone(lowpass) → ambDuck ─┐
//   one-shots ─────────────────────────────── sfxBus(sfx volume) ──────────┤
//   voice presence ─────────────────────────── voiceBus ──┼→ world → attention(lowpass) → daze(lowpass·gain) ─┐
//   reverb sends (ambience/sfx sends scaled like their buses) → room convolvers A/B (crossfaded per place) → reverbOut ┘ │
//   interface sounds (memory_keep, focus_shift, …) ── uiBus ─────────────────────────────┤
//   her own body (heartbeat, tinnitus) ── bodyBus: stays clear when the world is dazed ──┼→ master
//   master(volume·enabled) → glue compressor → lift → limiter → makeup undo → soft clip → destination ←┘
//   (ambience also passes speechDuck, which dips it while her phone reads a line out)

import { AMBIENCE, DIRECTION_ANGLE, isSfx, type AmbienceAt, type AmbienceId, type AmbienceList, type SfxId, type SpatialPos, type Via, type VoiceId } from './catalog';
import { createScreenReader, readable, readerClipsFor, type ScreenReader } from './reader';
import { READER_LINES, READER_NUMBERS, READER_TEMPLATES } from './readerClips';
import { roomFor, ROOMS, type RoomId } from './rooms';
import { startAmbience, type AmbienceLayer, type SampleBed, type SoundResolver } from './ambience';
import { clamp, compressorMakeup, expRampTo, glide, hold, impulseResponse, placementOf, softClipCurve, spawnShot, type SfxRecipe, type Shot } from './core';
import { SampleBank, sampleRecipe, type SampleBankStats } from './samples';
import { SFX_RECIPES, UI_SFX } from './sounds';
import { phoneTick } from './voice';

/** `to`: the sound travels there from `pos` while it plays. `radius` overrides how far away `pos` is, for steps between near/mid/far. */
export type SfxOpts = { gain?: number; rate?: number; variant?: number; to?: SpatialPos; radius?: number };

export interface AudioEngine {
  /**
   * Call from inside a user gesture: everything iOS only allows in one (waking the context, a silent buffer, the
   * first speech) happens before this returns its promise. Later taps and keys re-wake a context that iOS
   * interrupted (a call, Siri, another app) on their own, so this is needed once.
   */
  unlock(): Promise<void>;
  readonly ready: boolean;
  /** The audio context's state ('running', 'suspended', Safari's 'interrupted', …), or 'none' before unlock. */
  readonly state?: string;
  setEnabled(on: boolean): void;
  setVolume(v: number): void;
  setVoiceVolume(v: number): void;
  /** Ambience beds only; 1 = their mixed level. */
  setAmbienceVolume(v: number): void;
  /** Sound effects and interface sounds. */
  setSfxVolume(v: number): void;
  /** The beds to play; `ids.landmarks` moves a place's fixed sources (the tower, the café counter) for this scene. */
  setAmbience(ids: AmbienceList, fadeMs?: number): void;
  play(id: SfxId, pos: SpatialPos, opts?: SfxOpts): void;
  /**
   * Load these recordings ahead of the rest: `now` (the scene about to play) first, then the sounds every scene
   * uses, then `soon` (its background life, the scenes after it). The scene's own beds (`ambNow`) are decoded
   * ahead when they fit the bed budget, so they can start as recordings; the other beds in `amb` are only fetched.
   */
  prefetch?(sounds: SceneSoundsAhead): void;
  /**
   * A line spoken by `speaker`. The cast make no vocal sound, only a small real one (the text is their voice).
   * 'life' = a stranger in the background: a recording of someone talking, too far or muffled to make out;
   * 'whisper' = the same stranger in a quiet place, whispering. `gain` scales it (panic, tension).
   */
  voice(speaker: VoiceId, pos: SpatialPos, durationMs: number, kind?: VoiceKind, gain?: number, via?: Via): void;
  setAttention(level: number): void;
  /** Pain or shock: 0 = clear, 1 = the world comes through as if under water. Her own body stays clear. */
  setDaze(level: number): void;
  /** Panic: 1 = the ambience as mixed, up to 3 = pressing in on her. */
  setNoise(loud: number): void;
  duck(amount: number, ms: number): void;
  silence(ms: number): void;
  suspend(): void;
  resume(): void;
  /** Her phone's screen reader says this out loud (a synthesized voice: the reader is one). `aloud`: a moment that
   *  matters (18:31, a death, 119) is read at full level; otherwise the phone stays in the room, quieter. */
  speak?(text: string, aloud?: boolean): void;
  /** The screen reader stops mid-word: a new line, a new scene. */
  hush?(): void;
}

export type SampleMode = 'auto' | 'synth';

export type SceneSoundsAhead = { now: readonly SfxId[]; soon: readonly SfxId[]; amb: readonly AmbienceId[]; ambNow?: readonly AmbienceId[]; phone?: readonly string[] };

/** A recording still loading may hold its sound back this long; later than that it would land out of place. */
const LATE_SAMPLE_MS = 2500;
/** Gestures that may wake a context iOS suspended or interrupted. Listened to once, on the whole document. */
const WAKE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;
/** A context that stopped on its own is asked to run again at most this often outside a gesture. */
const NUDGE_MS = 1000;

export type VoiceKind = 'line' | 'life' | 'whisper';

/** What each device sounds like under the words: a loudspeaker or a call crackles, a radio or TV hisses, a tape runs. */
const VIA_SOUND: Record<Via, { id: SfxId; gain: number; rate?: number }> = {
  speaker: { id: 'static_burst', gain: 0.16, rate: 0.85 },
  radio: { id: 'radio_noise', gain: 0.22 },
  tv: { id: 'radio_noise', gain: 0.15, rate: 1.15 },
  tape: { id: 'tape_hiss', gain: 0.24 },
  phone: { id: 'static_burst', gain: 0.07, rate: 1.4 },
};

/** Strangers: whose recorded murmur stands in for their voice (rate < 1 = an older, lower voice). */
const LIFE_MURMUR: Partial<Record<VoiceId, { id: SfxId; rate?: number }>> = {
  man: { id: 'murmur_m' },
  woman: { id: 'murmur_w' },
  old_man: { id: 'murmur_old', rate: 0.94 },
  old_woman: { id: 'murmur_old', rate: 1.08 },
  child: { id: 'murmur_child' },
};
/**
 * Background voices sit under the text but stay audible far off: the panner already drops ~16 dB at 'far'.
 * Measured in the speech band, a far murmur lands a few dB over the busier beds (street, restaurant) and
 * about 5 dB over a far footstep or cough, so it reads as a person and not as the room.
 */
/** Distance is already lifted for every sound (distanceLift), so strangers sit at one level wherever they stand. */
/** Nearly every scene uses these (people talking, devices, her heart, a question): always fetched first. */
const EVERYWHERE_SFX: readonly SfxId[] = [...new Set<SfxId>([
  'cloth_rustle', 'whisper', 'huddle_rustle', 'heartbeat', 'choice_appear', 'memory_keep', 'focus_shift',
  ...Object.values(LIFE_MURMUR).map((m) => m.id),
  ...Object.values(VIA_SOUND).map((v) => v.id),
])];

const LIFE_VOICE_GAIN: Record<SpatialPos['dist'], number> = { near: 0.15, mid: 0.145, far: 0.143 };

/**
 * The panner's inverse rolloff takes a far sound (r = 6) down 16 dB, which buried distant life and story sounds.
 * Lift each shot so far still sounds far but always comes through: overall it falls as r^-0.55 (mid about -4 dB,
 * far about -9 dB) instead of r^-1.
 */
export function distanceLift(r: number): number {
  return r > 1 ? Math.pow(r, 0.45) : 1;
}
/** Whispers are baked about 9 dB under talking (RMS), so a quiet room keeps them just above its hum. */
const WHISPER_GAIN = 1;

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
    /** Sounds that never played because their recording arrived too late (id → times). */
    dropped: Record<string, number>;
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
/**
 * A place whose recording is still being decoded waits this long for it, in silence, rather than starting
 * synthesized and crossfading 2.5 s later (two beds over each other as the scene opens). Later than this, the
 * synthesis starts after all and the recording takes over when it comes.
 */
const BED_WAIT_MS = 800;
/**
 * The same long sound again while earlier ones still ring (the midnight bell, twelve strikes): at most this many
 * tails at once, the oldest fading out, and each older tail steps down a little so the sum stays off the limiter.
 */
const SAME_TAILS = 3;
const SAME_TAIL_STEP = 0.63; // -4 dB per newer strike
const SAME_TAIL_FADE = 0.25;
/** A copy with more than this left to play counts as a ringing tail. */
const TAIL_S = 1.5;
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
  prefetch(): void {}
  voice(): void {}
  setAttention(): void {}
  setDaze(): void {}
  setNoise(): void {}
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
  ambLoud: GainNode;
  /** Dips the ambience (and its reverb send) while the reader talks; separate so it never fights duck() or a slider. */
  speechDuck: GainNode;
  speechDuckVerb: GainNode;
  ambVerb: GainNode;
  sfx: GainNode;
  sfxVerb: GainNode;
  voice: GainNode;
  /** Her phone's reader clips: the same level the device's voice gets (readerBusGain), not the voice-presence curve. */
  reader: GainNode;
  ui: GainNode;
  reverbIn: GainNode;
  rooms: [{ conv: ConvolverNode; wet: GainNode }, { conv: ConvolverNode; wet: GainNode }];
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Beds stay 6 dB behind their original mix so story cues have room to stand out. */
const ambienceGain = (v: number): number => perceptual(v) * 0.5;
const sfxGain = (v: number): number => perceptual(v) * 2;
/** Interface sounds sit a little under the effects (0.9 at the default effects volume). */
const UI_TRIM = 0.62;
/** Her phone: in her right pocket or her right hand, close. The reader's clips play from there. */
const PHONE_POS: SpatialPos = { dir: 'right', dist: 'near' };
/** The clips are rendered quiet (about -34 dB mean, peaks near -19 dB): +12 dB brings them level with a cough or a step. */
const READER_GAIN = 4;
/** Before the master: the reader's level as the device voice has it (readerVolume) without the master's own curve. */
const readerBusGain = (voice: number): number => (voice > 0 ? (0.4 + voice) / 0.8 : 0);
/** A reader clip that takes longer than this to load is read by the device's voice instead (it would land late). */
const READER_LATE_MS = 700;
const READER_MANIFEST = { lines: READER_LINES, templates: READER_TEMPLATES, numbers: READER_NUMBERS };

/**
 * The master chain, made explicit. A DynamicsCompressorNode adds makeup gain of its own (see compressorMakeup):
 * the glue added +4.99 dB and the old limiter (-4 dB, ratio 20) +2.28 dB to every sound, and an output trim of
 * 0.85 (-1.41 dB) took a little back: +5.86 dB in all, the level the mix was tuned at by ear. Now each makeup is
 * undone right after its compressor and that +5.86 dB is one named gain before the limiter, so quiet sounds
 * come out exactly as loud as before, and changing a compressor setting no longer moves the whole mix.
 * The limiter catches at -3.2 dBFS (the old one, after its makeup and the trim, sat at about -3.1), just under
 * the soft clip's knee (0.7 = -3.1 dBFS); the soft clip stays as the last safety for what slips past it.
 */
const GLUE = { threshold: -20, knee: 12, ratio: 2.5, attack: 0.012, release: 0.3 } as const;
const LIMITER = { threshold: -3.2, knee: 0, ratio: 20, attack: 0.001, release: 0.12 } as const;
const MIX_LIFT_DB = 5.86;
/** While her phone reads a line that matters, the beds step back by about 7.5 dB (and never sit higher than that, panic or not). */
const SPEECH_DUCK = 0.42;
/** An everyday line (a message, the time) is a sound in the room: the phone about 6 dB down, the beds back only 3 dB. */
const READER_QUIET = 0.5;
const SPEECH_DUCK_QUIET = 0.71;
const SPEECH_ATTACK_TC = 0.025;
const SPEECH_RELEASE_TC = 0.16;
/** A device voice that never reports its end releases the duck after this long per character (and at least 2 s). */
const TTS_MS_PER_CHAR = 330;
/**
 * Sounds whose level must stay the same every time: a person's own sound (she knows them by it), voices, her body,
 * the interface. Everything else gets a small random level change (±1.5 dB) along with its small pitch change.
 */
const STEADY_LEVEL: ReadonlySet<SfxId> = new Set<SfxId>([
  'step_uneven', 'strap_click', 'hand_rub', 'raincoat_rustle', 'lighter_lid',
  'whisper', 'murmur_m', 'murmur_w', 'murmur_old', 'murmur_child',
  'heartbeat', 'tinnitus',
]);
const LEVEL_WOBBLE_DB = 1.5;

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
  /** Where the scene put each place's landmarks (degrees by name), and which placement each running layer was built with. */
  private landmarks: AmbienceAt = {};
  private readonly layerAt = new WeakMap<AmbienceLayer, string>();
  /** Beds waiting a moment for their recording before they start (see BED_WAIT_MS). */
  private readonly bedWaits = new Map<AmbienceId, object>();
  private layers = new Map<AmbienceId, AmbienceLayer>();
  private shots: Shot[] = [];
  private readonly shotIds = new WeakMap<Shot, SfxId>();
  private voices: Shot[] = [];
  private attentionTimer: ReturnType<typeof setTimeout> | null = null;
  private bank: SampleBank | null = null;
  private sampleMode: SampleMode = 'auto';
  private preloading = false;
  private readonly dropped = new Map<SfxId, number>();
  /** The place her ears are in, and which of the two convolvers holds it. */
  private room: RoomId = 'home';
  private roomSlot = 0;
  private roomShown: RoomId | null = null;
  private readonly reader: ScreenReader = createScreenReader();
  /** The pre-rendered reader clip playing now, and a count that drops a clip still loading when the next line comes. */
  private readerShot: Shot | null = null;
  private readerGen = 0;
  private readerNumbersWarm = false;
  /** Her phone is reading a line now (a clip or the device's voice): the beds stay ducked under it. */
  private speaking = false;
  /** How this line is read: its level against the reader's, and how far the beds step back under it. */
  private readerLevel = 1;
  private speechDuckTo = SPEECH_DUCK;
  private speechTimer: ReturnType<typeof setTimeout> | null = null;
  /** The panic level setNoise last asked for (1 = as mixed). */
  private noise = 1;
  /** Suspended on purpose (the page is hidden): a tap must not wake it, resume() will. */
  private held = false;
  private listening = false;
  private lastNudge = -Infinity;
  private readonly resolver: SoundResolver = (id) => (isSfx(id) ? this.sampleFor(id) : undefined);

  constructor(private readonly Ctor: AudioContextCtor) {}

  get ready(): boolean {
    return !!this.ac && this.ac.state === 'running';
  }

  get state(): string {
    return this.ac?.state ?? 'none';
  }

  async unlock(): Promise<void> {
    if (this.failed) return;
    let resumed: Promise<void> = Promise.resolve();
    try {
      if (!this.ac) this.build();
      const ac = this.ac;
      if (!ac) return;
      this.held = false;
      // Everything iOS allows only inside the gesture happens here, before the first await: after it, the
      // gesture is over and Safari would refuse the first speech (and may refuse the resume).
      resumed = this.wake(ac, !this.primed);
      this.primed = true;
      this.reader.prime();
    } catch {
      return; // never throw from unlock
    }
    try {
      await Promise.race([resumed, sleep(1200)]);
      this.startPreload();
    } catch {
      // never throw from unlock
    }
  }

  /** Once the context runs: fetch the one-shots in the background; until each arrives its recipe plays instead. */
  private startPreload(): void {
    if (this.preloading || !this.bank || this.ac?.state !== 'running') return;
    this.preloading = true;
    void this.bank.preloadSfx().catch(() => undefined);
  }

  /**
   * Ask the context to run, synchronously (call it inside a gesture). With `kick`, also start a one-sample silent
   * buffer: on iOS that is what really opens the output after an unlock or an interruption.
   */
  private wake(ac: AudioContext, kick: boolean): Promise<void> {
    let resumed: Promise<void> = Promise.resolve();
    if (ac.state !== 'running' && ac.state !== 'closed') {
      try {
        resumed = ac.resume().catch(() => undefined);
      } catch {
        // an old engine without a promise
      }
    }
    if (kick) {
      try {
        const s = ac.createBufferSource();
        s.buffer = ac.createBuffer(1, 1, ac.sampleRate);
        s.connect(ac.destination);
        s.onended = () => s.disconnect();
        s.start();
        s.stop(ac.currentTime + 0.05);
      } catch {
        // ignore
      }
    }
    return resumed;
  }

  /**
   * iOS stops the context on its own (a call, Siri, an alarm, another app taking the audio session, the screen
   * locking) and only a gesture may start it again; play() does nothing until it runs. So every tap and key
   * anywhere on the page wakes a stopped context, and a context that stops by itself is asked to run again
   * (Safari's 'interrupted' resolves that request once the interruption ends).
   */
  private listen(ac: AudioContext): void {
    if (this.listening) return;
    this.listening = true;
    const onGesture = (): void => {
      if (this.ac !== ac || ac.state === 'closed') return;
      this.reader.prime();
      if (ac.state !== 'running' && !this.held) this.wake(ac, true);
    };
    try {
      if (typeof document !== 'undefined') {
        for (const type of WAKE_EVENTS) document.addEventListener(type, onGesture, { capture: true, passive: true });
      }
    } catch {
      // no document: nothing to listen to
    }
    const onState = (): void => {
      const state = ac.state as string;
      if (state === 'running') this.startPreload();
      if (state === 'running' || state === 'closed' || this.held) return;
      // 'suspended' or 'interrupted' without being asked: speech that was going is gone with it.
      this.stopReader();
      this.nudge(true);
    };
    try {
      if (typeof ac.addEventListener === 'function') ac.addEventListener('statechange', onState);
      else (ac as { onstatechange: unknown }).onstatechange = onState;
    } catch {
      // ignore
    }
  }

  /** Outside a gesture: ask a context that stopped on its own to run again (harmless when the browser says no). */
  private nudge(now = false): void {
    const ac = this.ac;
    if (!ac || this.held || ac.state === 'running' || ac.state === 'closed') return;
    const t = Date.now();
    if (!now && t - this.lastNudge < NUDGE_MS) return;
    this.lastNudge = t;
    this.wake(ac, false);
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
    const compressor = (o: typeof GLUE | typeof LIMITER): DynamicsCompressorNode => {
      const c = ac.createDynamicsCompressor();
      c.threshold.value = o.threshold;
      c.knee.value = o.knee;
      c.ratio.value = o.ratio;
      c.attack.value = o.attack;
      c.release.value = o.release;
      return c;
    };
    const glue = compressor(GLUE);
    // undo the glue's own makeup, then the mix's one deliberate lift (see MIX_LIFT_DB)
    const lift = gain(Math.pow(10, MIX_LIFT_DB / 20) / compressorMakeup(GLUE.threshold, GLUE.knee, GLUE.ratio));
    const limiter = compressor(LIMITER);
    const unmake = gain(1 / compressorMakeup(LIMITER.threshold, LIMITER.knee, LIMITER.ratio));
    const clip = ac.createWaveShaper();
    clip.curve = softClipCurve();
    master.connect(glue).connect(lift).connect(limiter).connect(unmake).connect(clip).connect(ac.destination);

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
    const ambLoud = gain(1);
    const speechDuck = gain(1);
    ambIn.connect(ambTone).connect(ambDuck).connect(ambLoud).connect(speechDuck).connect(world);

    const sfx = gain(sfxGain(this.sfxVolume));
    sfx.connect(world);
    const voice = gain(perceptual(this.voiceVolume) * 1.2);
    voice.connect(world);
    const reader = gain(readerBusGain(this.voiceVolume));
    reader.connect(world);
    const ui = gain(sfxGain(this.sfxVolume) * UI_TRIM);
    ui.connect(master);
    const body = gain(sfxGain(this.sfxVolume));
    body.connect(master);

    const reverbIn = gain(1);
    const ambVerb = gain(ambienceGain(this.ambienceVolume));
    const speechDuckVerb = gain(1);
    ambVerb.connect(speechDuckVerb).connect(reverbIn);
    const sfxVerb = gain(sfxGain(this.sfxVolume));
    sfxVerb.connect(reverbIn);
    const reverbOut = gain(1);
    reverbOut.connect(world);
    const slot = () => {
      const conv = ac.createConvolver();
      conv.normalize = true;
      const wet = gain(0);
      reverbIn.connect(conv).connect(wet).connect(reverbOut);
      return { conv, wet };
    };
    const rooms: Buses['rooms'] = [slot(), slot()];

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
    this.bus = { master, world, attention, daze, dazeGain, body, ambIn, ambTone, ambDuck, ambLoud, speechDuck, speechDuckVerb, ambVerb, sfx, sfxVerb, voice, reader, ui, reverbIn, rooms };
    this.listen(ac);
    this.applyRoom(0);
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
    if (!this.enabled) this.stopReader();
  }

  setVolume(v: number): void {
    this.volume = clamp(Number.isFinite(v) ? v : 0, 0, 1);
    this.applyMaster(0.05);
    this.reader.setVolume(this.readerVolume());
  }

  setVoiceVolume(v: number): void {
    this.voiceVolume = clamp(Number.isFinite(v) ? v : 0, 0, 1);
    this.reader.setVolume(this.readerVolume());
    if (!this.ac || !this.bus) return;
    glide(this.bus.voice.gain, perceptual(this.voiceVolume) * 1.2, this.ac.currentTime, 0.05);
    glide(this.bus.reader.gain, readerBusGain(this.voiceVolume), this.ac.currentTime, 0.05);
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

  setAmbience(ids: AmbienceList, fadeMs: number = DEFAULT_FADE_MS): void {
    const valid = Array.isArray(ids) ? ids.filter((id) => Object.prototype.hasOwnProperty.call(AMBIENCE, id)) : [];
    this.wanted = [...new Set(valid)];
    this.landmarks = (Array.isArray(ids) && ids.landmarks) || {};
    // The beds name the place; a bed that is only weather (night insects) leaves her in the room she was in.
    const room = roomFor(this.wanted);
    if (room && room !== this.room) {
      this.room = room;
      this.applyRoom(Math.min(2.4, Math.max(0.3, (Number.isFinite(fadeMs) ? fadeMs : DEFAULT_FADE_MS) / 1000)));
    }
    this.reconcile(fadeMs);
  }

  /** Load the room's echo into the idle convolver and crossfade to it, so the tail of the last place dies out. */
  private applyRoom(sec: number): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus || this.roomShown === this.room) return;
    const spec = ROOMS[this.room];
    const now = ac.currentTime;
    const first = this.roomShown === null;
    const next = first ? 0 : 1 - this.roomSlot;
    const into = bus.rooms[next];
    const out = bus.rooms[1 - next];
    try {
      into.conv.buffer = impulseResponse(ac, `room:${this.room}`, spec);
    } catch {
      return;
    }
    glide(into.wet.gain, spec.wet, now, first ? 0.01 : sec / 3);
    if (!first) glide(out.wet.gain, 0, now, sec / 3);
    this.roomSlot = next;
    this.roomShown = this.room;
  }

  /**
   * The device's voice bypasses Web Audio, so the master slider gets the same squared (perceptual) curve as the mix,
   * scaled so the default master (0.8) reads as loud as it always has (0.8 × (0.4 + voice)); the voice level at 0 is silent.
   * (iOS Safari ignores an utterance's volume: there the device voice follows only the phone's own volume.)
   */
  private readerVolume(): number {
    if (!this.enabled || this.voiceVolume <= 0) return 0;
    return clamp((perceptual(this.volume) / 0.8) * (0.4 + this.voiceVolume), 0, 1);
  }

  /**
   * Her phone reads the line: the pre-rendered clip when there is one (a flat voice through a small speaker, the
   * same on every device), placed where her phone is; otherwise the device's own voice. A clip that cannot be
   * loaded in time is read by the device's voice instead, so the line is never silent.
   */
  speak(text: string, aloud = false): void {
    this.stopReader();
    this.readerLevel = aloud ? 1 : READER_QUIET;
    this.speechDuckTo = aloud ? SPEECH_DUCK : SPEECH_DUCK_QUIET;
    if (this.readerVolume() <= 0) return;
    const clips = this.sampleMode === 'synth' ? null : readerClipsFor(text, READER_MANIFEST);
    const bank = this.bank;
    if (!clips || !bank || !this.ac || this.ac.state !== 'running') { this.speakDevice(text, this.readerGen); return; }
    const gen = ++this.readerGen;
    const asked = performance.now();
    void Promise.all(clips.map((clip) => bank.load(clip))).then((buffers) => {
      if (gen !== this.readerGen) return;
      const ready = buffers.every((buffer): buffer is AudioBuffer => buffer !== null);
      if (!ready || performance.now() - asked > READER_LATE_MS) { this.speakDevice(text, gen); return; }
      this.playReader(buffers);
    });
  }

  /** The device's own voice reads it; the beds step back until it is done (or would have been). */
  private speakDevice(text: string, gen: number): void {
    const started = this.reader.speak(text, this.readerVolume() * this.readerLevel, () => {
      if (gen === this.readerGen) this.setSpeaking(false);
    });
    if (started) this.setSpeaking(true, Math.max(2000, readable(text).length * TTS_MS_PER_CHAR));
  }

  /** Duck the beds under the reader. `forMs`: let go by then even if no end is ever reported. */
  private setSpeaking(on: boolean, forMs = 0): void {
    if (this.speechTimer !== null) clearTimeout(this.speechTimer);
    this.speechTimer = null;
    this.speaking = on;
    if (on && forMs > 0) {
      this.speechTimer = setTimeout(() => {
        this.speechTimer = null;
        this.setSpeaking(false);
      }, forMs);
    }
    this.applySpeechDuck();
  }

  /** Under the reader the beds sit at this line's duck (SPEECH_DUCK or SPEECH_DUCK_QUIET), however loud panic (setNoise) made them. */
  private applySpeechDuck(): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus) return;
    const now = ac.currentTime;
    const dry = this.speaking ? this.speechDuckTo / this.noise : 1;
    const wet = this.speaking ? this.speechDuckTo : 1;
    const tc = this.speaking ? SPEECH_ATTACK_TC : SPEECH_RELEASE_TC;
    glide(bus.speechDuck.gain, dry, now, tc);
    glide(bus.speechDuckVerb.gain, wet, now, tc);
  }

  private playReader(buffers: AudioBuffer[]): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus || ac.state !== 'running') return;
    const seconds = buffers.reduce((sum, b) => sum + b.duration, 0);
    this.setSpeaking(true, seconds * 1000 + 60);
    try {
      const recipe: SfxRecipe = {
        jitter: 0,
        play(c) {
          let t = c.t;
          for (const buffer of buffers) {
            c.g.buffer(buffer, t).connect(c.out);
            t += buffer.duration;
          }
          return t - c.t + 0.05;
        },
      };
      this.readerShot = spawnShot(ac, recipe, { dest: bus.reader, reverb: null, place: placementOf(PHONE_POS), t: ac.currentTime + 0.01, gain: READER_GAIN * this.readerLevel });
    } catch {
      // a broken clip must never break the game
    }
  }

  private stopReader(): void {
    this.readerGen += 1;
    this.readerShot?.kill();
    this.readerShot = null;
    this.reader.stop();
    if (this.speaking || this.speechTimer !== null) this.setSpeaking(false);
  }

  hush(): void {
    this.stopReader();
  }

  private reconcile(fadeMs: number): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus) return;
    const sec = Math.max(0.05, (Number.isFinite(fadeMs) ? fadeMs : DEFAULT_FADE_MS) / 1000);
    for (const [id, layer] of this.layers) {
      if (!this.wanted.includes(id) && !layer.stopping) layer.stop(sec);
    }
    for (const id of [...this.bedWaits.keys()]) if (!this.wanted.includes(id)) this.bedWaits.delete(id);
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

  /** The scene's placement of `id`'s landmarks in degrees, or undefined (the place as it always sounds). */
  private landmarkAt(id: AmbienceId): Record<string, number> | undefined {
    const at = this.landmarks[id];
    if (!at) return undefined;
    const out: Record<string, number> = {};
    for (const [name, dir] of Object.entries(at)) if (dir in DIRECTION_ANGLE) out[name] = DIRECTION_ANGLE[dir];
    return Object.keys(out).length ? out : undefined;
  }

  /**
   * Make sure the wanted layer `id` is running from the best available source. A place starting from silence
   * waits up to BED_WAIT_MS for its recording; a synthesized layer whose recording arrives later is crossfaded
   * into it, and so is a layer whose landmarks this scene puts somewhere else.
   */
  private ensureLayer(id: AmbienceId, sec: number, mayWait = true): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus) return;
    const bed = this.bedFor(id);
    const at = this.landmarkAt(id);
    const placed = at ? JSON.stringify(at) : '';
    const existing = this.layers.get(id);
    const live = existing && !existing.disposed ? existing : undefined;
    if (live) {
      if (live.stopping) live.revive(sec);
      if (live.sampled === !!bed && (this.layerAt.get(live) ?? '') === placed) return;
    } else if (!bed && this.recordingComing(id)) {
      if (mayWait) this.awaitBed(id, sec);
      if (mayWait || this.bedWaits.has(id)) return;
    }
    live?.stop(Math.max(sec, SWAP_S));
    const layer = startAmbience(
      ac,
      id,
      bus.ambIn,
      bus.ambVerb,
      (l) => {
        if (this.layers.get(l.id) === l) this.layers.delete(l.id);
      },
      { bed, resolve: this.resolver, at },
    );
    if (layer) {
      this.layers.set(id, layer);
      this.layerAt.set(layer, placed);
      layer.fadeIn(live ? Math.max(sec, SWAP_S) : sec);
    }
    if (!bed && this.recordingComing(id)) {
      void this.bank!.loadAmb(id).then((buf) => {
        if (buf && this.wanted.includes(id)) this.ensureLayer(id, SWAP_S);
      });
    }
  }

  /** `id` has a recording that may still arrive (not synth-only, not just failed). */
  private recordingComing(id: AmbienceId): boolean {
    return !!this.bank && this.sampleMode !== 'synth' && !!this.bank.ambEntry(id) && this.bank.bedLoadable(id);
  }

  /** Hold a starting place back until its recording is decoded, or BED_WAIT_MS at most; then start it either way. */
  private awaitBed(id: AmbienceId, sec: number): void {
    const bank = this.bank;
    if (!bank || this.bedWaits.has(id)) return;
    const token = {};
    this.bedWaits.set(id, token);
    const asked = performance.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const go = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (this.bedWaits.get(id) !== token) return;
      this.bedWaits.delete(id);
      if (!this.wanted.includes(id)) return;
      const waited = (performance.now() - asked) / 1000;
      this.ensureLayer(id, Math.max(0.6, sec - waited), false);
    };
    timer = setTimeout(go, BED_WAIT_MS);
    void bank.loadAmb(id).then(go, go);
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

  /** A recipe from buffers a load just handed back (the cache may already have let them go). */
  private loadedRecipe(id: SfxId, loaded: readonly AudioBuffer[]): SfxRecipe | undefined {
    const entry = this.bank?.sfxEntry(id);
    const buf = loaded[Math.floor(Math.random() * loaded.length)];
    return entry && buf ? sampleRecipe(buf, entry) : undefined;
  }

  prefetch(sounds: SceneSoundsAhead): void {
    if (this.sampleMode === 'synth') return;
    // This scene's sounds (and the ones every scene uses) are decoded now and kept; the scenes after it are only
    // fetched, and decoded when they begin (or when first played), so decoded memory stays within its budget.
    const ambNow = sounds.ambNow ?? [];
    this.bank?.prefetch([...new Set([...sounds.now, ...EVERYWHERE_SFX])], sounds.amb.filter((id) => !ambNow.includes(id)), sounds.soon);
    // Its beds are decoded while the last place fades out (and its card shows), next to the beds still playing.
    this.bank?.prepareBeds(ambNow, this.wanted);
    this.prefetchReader(sounds.phone ?? []);
  }

  /**
   * The reader clips for the phone lines ahead, through the bank's queue (decoded clips count against its budget).
   * A line with a number to fill in fetches every number once, compressed (decoded when read); a fetch that fails
   * is tried again with the next scene.
   */
  private prefetchReader(lines: readonly string[]): void {
    const bank = this.bank;
    if (!bank || !lines.length) return;
    const clips = new Set<string>();
    let numbers = false;
    for (const line of lines) {
      if (line.includes('<')) {
        for (const t of READER_TEMPLATES) for (const clip of t.clips) if (clip) clips.add(clip);
        numbers = true;
        continue;
      }
      for (const clip of readerClipsFor(line, READER_MANIFEST) ?? []) clips.add(clip);
    }
    if (clips.size) void bank.prefetchFiles([...clips]);
    if (numbers && !this.readerNumbersWarm) {
      const all = Object.values(READER_NUMBERS);
      if (!all.length) return;
      this.readerNumbersWarm = true;
      void bank.prefetchFiles(all, 'raw').then((ok) => {
        if (!ok) this.readerNumbersWarm = false;
      });
    }
  }

  play(id: SfxId, pos: SpatialPos, opts?: SfxOpts): void {
    const ac = this.ac;
    const bus = this.bus;
    if (ac && ac.state !== 'running') this.nudge();
    if (!ac || !bus || ac.state !== 'running') return;
    if (!isSfx(id)) return;
    // Script numbers are converted to zero-based indices by the director.
    // Await the exact recording rather than substituting another loaded variant; like any recording, one that
    // arrives too late is dropped (it would land out of place), and one that cannot be had plays its recipe.
    if (opts?.variant !== undefined && this.sampleMode !== 'synth') {
      const asked = performance.now();
      void this.variantRecipe(id, opts.variant).then((recipe) => {
        if (recipe === null) { this.shoot(id, pos, opts, SFX_RECIPES[id]); return; }
        if (performance.now() - asked > LATE_SAMPLE_MS) { this.dropped.set(id, (this.dropped.get(id) ?? 0) + 1); return; }
        if (this.ac?.state === 'running') this.shoot(id, pos, opts, recipe);
      });
      return;
    }
    const sampled = this.sampleFor(id);
    if (sampled) { this.shoot(id, pos, opts, sampled); return; }
    // A sound with a recording waits for it (the synthesized stand-in reads as fake: a cough, a voice). Only a
    // recording that cannot be decoded at all falls back to synthesis; one that arrives too late is dropped.
    const bank = this.bank;
    if (bank && this.sampleMode !== 'synth' && bank.sfxEntry(id)) {
      const asked = performance.now();
      void bank.loadSfx(id).then((loaded) => {
        const late = performance.now() - asked > LATE_SAMPLE_MS;
        if (late) { this.dropped.set(id, (this.dropped.get(id) ?? 0) + 1); return; }
        this.shoot(id, pos, opts, this.sampleFor(id) ?? this.loadedRecipe(id, loaded) ?? SFX_RECIPES[id]);
      });
      return;
    }
    this.shoot(id, pos, opts, SFX_RECIPES[id]);
  }

  private shoot(id: SfxId, pos: SpatialPos, opts: SfxOpts | undefined, recipe: SfxRecipe | undefined): void {
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus || !recipe) return;
    try {
      this.shots = this.shots.filter((s) => !s.disposed);
      while (this.shots.length >= MAX_SFX) this.shots.shift()?.kill();
      this.yieldTails(id, ac.currentTime);
      const shot = spawnShot(ac, recipe, {
        dest: UI_SFX.has(id) ? bus.ui : BODY_SFX.has(id) ? bus.body : bus.sfx,
        reverb: BODY_SFX.has(id) ? null : bus.sfxVerb,
        place: opts?.radius !== undefined ? { ...placementOf(pos), r: opts.radius } : placementOf(pos),
        glide: opts?.to ? placementOf(opts.to) : undefined,
        t: ac.currentTime + 0.01,
        gain: clamp((opts?.gain ?? 1) * distanceLift(opts?.radius ?? placementOf(pos).r) * this.levelWobble(id, recipe), 0, 6),
        rate: clamp(opts?.rate ?? 1, 0.25, 4),
      });
      if (shot) {
        this.shots.push(shot);
        this.shotIds.set(shot, id);
      }
      this.sideEffects(id);
    } catch {
      // a broken recipe must never break the game
    }
  }

  /**
   * Earlier copies of `id` still ringing make room for a new one: past SAME_TAILS the oldest fades out, and the rest
   * step down, so twelve bell strikes ring like a bell and not like twelve bells stacked on the limiter.
   */
  private yieldTails(id: SfxId, now: number): void {
    const ringing = this.shots.filter((s) => !s.disposed && this.shotIds.get(s) === id && s.end - now > TAIL_S);
    while (ringing.length >= SAME_TAILS) {
      const oldest = ringing.shift()!;
      oldest.kill(SAME_TAIL_FADE);
      this.shotIds.delete(oldest); // fading out: no longer one of the tails
    }
    for (const s of ringing) s.scale(SAME_TAIL_STEP, 0.3);
  }

  /** A small random level change (±1.5 dB) so a repeated sound is never the same twice; none where it must be. */
  private levelWobble(id: SfxId, recipe: SfxRecipe): number {
    if (STEADY_LEVEL.has(id) || UI_SFX.has(id) || recipe.jitter === 0) return 1;
    return Math.pow(10, ((Math.random() * 2 - 1) * LEVEL_WOBBLE_DB) / 20);
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

  voice(speaker: VoiceId, pos: SpatialPos, _durationMs?: number, kind: VoiceKind = 'line', gain = 1, via?: Via): void {
    // No voice is ever simulated (a synthesized voice under the text read as uncanny; the text is the voice).
    // A voice through a device is placed by the device's own sound: the loudspeaker keying in, the radio's hiss.
    const device = via ?? (speaker === 'announcer' ? 'speaker' : undefined);
    if (device) {
      const texture = VIA_SOUND[device];
      this.play(texture.id, pos, { gain: texture.gain * (kind === 'line' ? 1 : 0.6), rate: texture.rate });
      return;
    }
    // The cast are placed by a small real sound: the rustle of a speaker turning to talk (a new speaker, or
    // the same one after a silence). Strangers in the background are real recordings of people talking,
    // muffled and far enough that no word comes through; in a quiet place, of people whispering.
    if (speaker !== 'phone') {
      if (kind !== 'line') {
        const level = clamp(Number.isFinite(gain) ? gain : 1, 0, 3) * (LIFE_VOICE_GAIN[pos.dist] ?? LIFE_VOICE_GAIN.mid);
        const murmur = LIFE_MURMUR[speaker];
        if (kind === 'whisper' && speaker !== 'announcer') this.play('whisper', pos, { gain: level * WHISPER_GAIN, rate: murmur?.rate });
        else if (murmur) this.play(murmur.id, pos, { gain: level, rate: murmur.rate });
        // A loudspeaker or a TV: keep it to the small real sound it always had.
        else this.play('huddle_rustle', pos, { gain: 0.12 });
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
    // sinking in takes a breath or two, coming back takes a while (the screen clears on the same clock)
    expRampTo(bus.daze.frequency, OPEN * Math.pow(DAZED / OPEN, l), now, l > 0 ? 1.4 : 4);
    glide(bus.dazeGain.gain, 1 - 0.5 * l, now, l > 0 ? 0.5 : 1.3);
  }

  setNoise(loud: number): void {
    const l = clamp(Number.isFinite(loud) ? loud : 1, 1, 3);
    this.noise = l;
    const ac = this.ac;
    const bus = this.bus;
    if (!ac || !bus) return;
    // It swells in over a couple of breaths, and drains away more slowly. Under the reader the swell is held
    // back (applySpeechDuck divides it out): panic presses in on her, it never drowns what her phone says.
    glide(bus.ambLoud.gain, l, ac.currentTime, l > 1 ? 0.5 : 1.2);
    if (this.speaking) this.applySpeechDuck();
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
    this.held = true;
    this.stopReader();
    this.ac?.suspend().catch(() => undefined);
  }

  resume(): void {
    this.held = false;
    if (!this.ac || this.ac.state === 'closed') return;
    // Not a gesture on iOS (visibilitychange): this may be refused; the next tap wakes it (see listen()).
    this.wake(this.ac, false);
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
      dropped: Object.fromEntries(this.dropped),
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
      recipe = (await this.variantRecipe(id, opts.variant)) ?? undefined;
    } else {
      const loaded = await this.bank.loadSfx(id);
      recipe = this.sampleFor(id, true) ?? this.loadedRecipe(id, loaded);
    }
    // A suspended context (tab switch, OS audio change) is not a broken file: wake it before giving up.
    if (this.ac && this.ac.state !== 'running') await this.ac.resume().catch(() => undefined);
    if (!recipe || !this.ac || this.ac.state !== 'running') return false;
    this.shoot(id, pos, opts, recipe);
    return true;
  }

  /** The exact recorded variant `variant` of `id`, loaded; null when there is no such recording or it cannot load. */
  private async variantRecipe(id: SfxId, variant: number): Promise<SfxRecipe | null> {
    const entry = this.bank?.sfxEntry(id);
    if (!entry || !this.bank) return null;
    if (!Number.isInteger(variant) || variant < 0 || variant >= entry.files.length) return null;
    const buffer = await this.bank.load(entry.files[variant]!);
    return buffer ? sampleRecipe(buffer, entry) : null;
  }

  hasSample(id: SfxId | AmbienceId): boolean {
    if (!this.bank) return false;
    return isSfx(id) ? !!this.bank.sfxEntry(id) : !!this.bank.ambEntry(id as AmbienceId);
  }
}
