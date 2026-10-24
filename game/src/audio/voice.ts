// Speech-like textures without words: syllable planning, whispered noise speech and a muffled
// "voiced murmur" rig (used for voice presence, crowds, café chatter, TVs and station PA).

import { cached, clamp, Graph, pick, rand, vary, type SfxCtx } from './core';

export interface Syllable {
  s: number;
  len: number;
  /** 0..1 position within its phrase (for declination). */
  pos: number;
  /** True for the last syllable of a phrase. */
  last: boolean;
}

export interface SyllablePlan {
  rate: number;
  phraseMin: number;
  phraseMax: number;
  gapMin: number;
  gapMax: number;
}

/** Plan syllables grouped into breath phrases, filling [t, t + dur). */
export function planSyllables(t: number, dur: number, o: SyllablePlan): Syllable[] {
  const out: Syllable[] = [];
  const end = t + dur;
  let cursor = t;
  while (cursor < end - 0.12) {
    const phraseEnd = Math.min(end, cursor + rand(o.phraseMin, o.phraseMax));
    const phraseStart = cursor;
    const span = Math.max(0.05, phraseEnd - phraseStart);
    while (cursor < phraseEnd - 0.06) {
      const len = Math.min(phraseEnd - cursor, vary(1 / o.rate, 0.35));
      out.push({ s: cursor, len, pos: (cursor - phraseStart) / span, last: false });
      cursor += len;
    }
    if (out.length) out[out.length - 1]!.last = true;
    cursor = phraseEnd + rand(o.gapMin, o.gapMax);
  }
  return out;
}

/** Apply a syllabic amplitude envelope (soft swells with dips between, silence between phrases). */
function applySyllables(p: AudioParam, t: number, syl: Syllable[], level: number, dip = 0.22): void {
  // glide (not jump) to silence, in case a previous stretch on the same rig is still decaying
  p.setTargetAtTime(0, t, 0.01);
  for (const y of syl) {
    const peak = level * rand(0.5, 1) * (1 - 0.35 * y.pos);
    p.setTargetAtTime(peak, y.s, Math.max(0.008, y.len * 0.14));
    if (y.last) p.setTargetAtTime(0, y.s + y.len * 0.55, Math.max(0.01, y.len * 0.18));
    else p.setTargetAtTime(peak * dip, y.s + y.len * 0.6, Math.max(0.008, y.len * 0.14));
  }
}

// rough vowel formants (F1, F2)
const VOWELS: ReadonlyArray<readonly [number, number]> = [
  [730, 1090],
  [300, 2200],
  [530, 1840],
  [570, 840],
  [320, 900],
  [660, 1700],
  [490, 1350],
  [440, 1020],
];

/** A soft glottal-ish wave: sawtooth-like spectrum with a steeper roll-off. */
export function glottalWave(ac: BaseAudioContext): PeriodicWave {
  return cached(ac, 'wave:glottal', () => {
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = Math.pow(k, -1.35) * (k % 2 === 0 ? 0.85 : 1);
    return ac.createPeriodicWave(real, imag, { disableNormalization: false });
  });
}

export interface WhisperOpts {
  level: number;
  rate?: number;
  /** Formant scale (≥1 = smaller vocal tract). */
  shift?: number;
}

/** Hushed, unintelligible speech: noise through moving formants, with syllabic rhythm and sibilants. */
export function whisper(g: Graph, dest: AudioNode, t: number, dur: number, o: WhisperOpts): number {
  const end = t + dur + 0.3;
  const shift = o.shift ?? 1;
  const src = g.noise('white', t, end);
  const amp = g.gain(0);
  const tone = g.filter('highpass', 350, 0.7);
  const f1 = g.filter('bandpass', 800 * shift, 4);
  const f2 = g.filter('bandpass', 1800 * shift, 6);
  const f3 = g.filter('bandpass', 2900 * shift, 7);
  const m1 = g.gain(0.7);
  const m2 = g.gain(1.0);
  const m3 = g.gain(0.55);
  src.connect(tone);
  tone.connect(f1).connect(m1).connect(amp);
  tone.connect(f2).connect(m2).connect(amp);
  tone.connect(f3).connect(m3).connect(amp);
  amp.connect(dest);

  const sib = g.noise('white', t, end);
  const sibF = g.filter('highpass', 4800, 0.8);
  const sibG = g.gain(0);
  sib.connect(sibF).connect(sibG).connect(dest);

  const syl = planSyllables(t, dur, { rate: o.rate ?? 4.4, phraseMin: 0.6, phraseMax: 1.5, gapMin: 0.12, gapMax: 0.38 });
  applySyllables(amp.gain, t, syl, o.level * 2.2, 0.3);
  sibG.gain.setValueAtTime(0, t);
  for (const y of syl) {
    const [v1, v2] = pick(VOWELS);
    // whispered formants sit a little higher than voiced ones
    f1.frequency.setTargetAtTime(v1 * 1.15 * shift, y.s, 0.025);
    f2.frequency.setTargetAtTime(v2 * 1.08 * shift, y.s, 0.03);
    if (Math.random() < 0.28) {
      sibG.gain.setTargetAtTime(o.level * rand(0.25, 0.5), y.s, 0.01);
      sibG.gain.setTargetAtTime(0, y.s + Math.min(0.09, y.len * 0.5), 0.02);
    }
  }
  return end;
}

export interface MurmurOpts {
  pitch: number;
  /** 0..1 — how much of the sound is breath vs voiced tone. */
  breath: number;
  level: number;
  /** Final lowpass (muffling); lower = less intelligible. */
  bright?: number;
  rate?: number;
  /** Formant scale; default derived from pitch. */
  shift?: number;
}

export interface MurmurRig {
  /** Schedule one stretch of talking; returns its end time. */
  speak(t: number, dur: number, gain?: number): number;
}

/**
 * Long-running voiced murmur: a glottal oscillator + breath noise through two moving formants and
 * a muffling lowpass. Sources run from t0 to t1 (or until the owning Graph is disposed).
 */
export function murmurRig(g: Graph, dest: AudioNode, t0: number, t1: number | undefined, o: MurmurOpts): MurmurRig {
  const shift = o.shift ?? clamp(Math.pow(o.pitch / 120, 0.25), 0.9, 1.35);
  const breath = clamp(o.breath, 0, 1);
  const vox = g.osc(glottalWave(g.ac), o.pitch, t0, t1);
  const voxG = g.gain(1 - breath * 0.75);
  const air = g.noise('pink', t0, t1);
  const airHp = g.filter('highpass', 500, 0.7);
  const airG = g.gain(breath * 2.4);
  const pre = g.gain(1);
  vox.connect(voxG).connect(pre);
  air.connect(airHp).connect(airG).connect(pre);
  const f1 = g.filter('bandpass', 550 * shift, 3.5);
  const f2 = g.filter('bandpass', 1500 * shift, 5);
  // narrow formant bands pass little energy; this is make-up gain so `level` reads naturally
  const m1 = g.gain(4);
  const m2 = g.gain(2.6);
  const lp = g.filter('lowpass', o.bright ?? 1600, 0.6);
  const amp = g.gain(0);
  pre.connect(f1).connect(m1).connect(lp);
  pre.connect(f2).connect(m2).connect(lp);
  lp.connect(amp).connect(dest);
  amp.gain.value = 0;
  return {
    speak(t: number, dur: number, gain = 1): number {
      const syl = planSyllables(t, dur, { rate: o.rate ?? 3.6, phraseMin: 0.9, phraseMax: 2.4, gapMin: 0.18, gapMax: 0.5 });
      applySyllables(amp.gain, t, syl, o.level * gain);
      let phraseBase = o.pitch * rand(0.96, 1.06);
      for (const y of syl) {
        const [v1, v2] = pick(VOWELS);
        f1.frequency.setTargetAtTime(v1 * shift, y.s, 0.03);
        f2.frequency.setTargetAtTime(v2 * shift, y.s, 0.035);
        // intonation: phrase declination plus a little per-syllable movement
        const pitch = phraseBase * (1.07 - 0.15 * y.pos) * vary(1, 0.045);
        vox.frequency.setTargetAtTime(pitch, y.s, 0.045);
        if (y.last) phraseBase = o.pitch * rand(0.96, 1.08);
      }
      return t + dur + 0.25;
    },
  };
}

/** The faint "someone is talking there" presence for one phrase. */
export function voicePresence(c: SfxCtx, pitch: number, breath: number, dur: number): number {
  const t = c.t + 0.02;
  const end = t + dur + 0.5;
  const rig = murmurRig(c.g, c.out, t, end, {
    pitch: pitch * c.p,
    breath,
    level: 0.12,
    bright: pitch > 170 ? 1500 : 1250,
    rate: 3.2,
  });
  rig.speak(t, Math.max(0.3, dur));
  return end - c.t;
}

/** The phone's "voice": one tiny soft digital tick. */
export function phoneTick(c: SfxCtx): number {
  const t = c.t;
  const o = c.g.osc('sine', 2400, t, t + 0.05);
  const o2 = c.g.osc('sine', 4800, t, t + 0.05);
  const g = c.g.gain(0);
  const g2 = c.g.gain(0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.0015);
  g.gain.setTargetAtTime(0, t + 0.0015, 0.004);
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(0.015, t + 0.001);
  g2.gain.setTargetAtTime(0, t + 0.001, 0.002);
  o.connect(g).connect(c.out);
  o2.connect(g2).connect(c.out);
  return 0.1;
}
