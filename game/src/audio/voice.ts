// Speech-shaped noise for the few crowd sounds that still synthesize as a fallback (an unvoiced murmur rig,
// never a pitched voice), and the phone screen reader's tick.

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
  // Unvoiced only: a pitched glottal oscillator through formants read as an uncanny robot voice, so the
  // murmur is breath noise shaped by the moving formants (indistinct people, never a synthesized voice).
  const air = g.noise('pink', t0, t1);
  const airHp = g.filter('highpass', 500, 0.7);
  const airG = g.gain(0.6 + breath * 1.8);
  const pre = g.gain(1);
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
      for (const y of syl) {
        const [v1, v2] = pick(VOWELS);
        f1.frequency.setTargetAtTime(v1 * shift, y.s, 0.03);
        f2.frequency.setTargetAtTime(v2 * shift, y.s, 0.035);
      }
      return t + dur + 0.25;
    },
  };
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
