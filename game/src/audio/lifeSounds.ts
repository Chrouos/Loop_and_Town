// Everyday foley, animal calls and machines. All sources belong to the shot's Graph,
// have finite stop times, and taper to silence before the shot is released.
import {
  crackleBuffer, rand, shape, sweep,
  type NoiseKind, type SfxCtx, type SfxRecipe,
} from './core';

function envelope(c: SfxCtx, at: number, dur: number, level: number, attack = 0.015): GainNode {
  const g = c.g.gain(0);
  shape(g.gain, c.t + at, [[0, 0], [Math.min(attack, dur * 0.2), level],
    [dur * 0.65, level * 0.7], [dur, 0]]);
  g.connect(c.out);
  return g;
}

function tone(
  c: SfxCtx, at: number, dur: number, hz: number, to: number, level: number,
  type: OscillatorType = 'sine', cutoff?: number,
): OscillatorNode {
  const t = c.t + at;
  const osc = c.g.osc(type, hz * c.p, t, t + dur);
  sweep(osc.frequency, t, hz * c.p, [[dur * 0.35, hz * c.p], [dur * 0.9, to * c.p]]);
  const env = envelope(c, at, dur, level);
  if (cutoff) osc.connect(c.g.filter('lowpass', cutoff * c.p, 0.65)).connect(env);
  else osc.connect(env);
  return osc;
}

function noise(
  c: SfxCtx, at: number, dur: number, hz: number, level: number,
  type: BiquadFilterType = 'bandpass', kind: NoiseKind = 'white', q = 0.7,
): BiquadFilterNode {
  const f = c.g.filter(type, hz * c.p, q);
  c.g.noise(kind, c.t + at, c.t + at + dur).connect(f)
    .connect(envelope(c, at, dur, level, Math.min(0.12, dur * 0.15)));
  return f;
}

function grit(c: SfxCtx, at: number, dur: number, hz: number, level: number): void {
  const f = c.g.filter('highpass', hz * c.p, 0.65);
  c.g.buffer(crackleBuffer(c.g.ac), c.t + at, {
    t1: c.t + at + dur, loop: true, rate: c.p, offset: rand(0, 1),
  }).connect(f).connect(envelope(c, at, dur, level, 0.025));
}

function hit(c: SfxCtx, at: number, hz: number, level: number, dur = 0.18): void {
  tone(c, at, dur, hz, hz * 0.65, level);
  noise(c, at, Math.min(dur, 0.09), hz * 7, level * 0.5);
}

function bell(c: SfxCtx, at: number, hz: number, dur = 1): void {
  tone(c, at, dur, hz, hz, 0.105);
  tone(c, at, dur * 0.7, hz * 2.76, hz * 2.76, 0.035);
  tone(c, at, dur * 0.45, hz * 5.4, hz * 5.4, 0.012);
}

function horn(c: SfxCtx, at: number, dur: number, hz: number): void {
  tone(c, at, dur, hz, hz * 0.98, 0.10, 'sawtooth', 1800);
  tone(c, at, dur, hz * 1.26, hz * 1.24, 0.07, 'sawtooth', 1800);
  tone(c, at, dur, hz * 2, hz * 1.96, 0.025);
}

function motor(c: SfxCtx, at: number, dur: number, hz: number, speed: number, level: number): void {
  const t = c.t + at;
  const pulse = c.g.gain(0.65);
  c.g.lfo(pulse.gain, speed * c.p, 0.3, t, t + dur);
  const f = c.g.filter('lowpass', Math.max(250, hz * 9 * c.p), 0.7);
  const osc = c.g.osc('sawtooth', hz * c.p, t, t + dur);
  sweep(osc.frequency, t, hz * c.p, [[dur * 0.35, hz * 1.12 * c.p], [dur * 0.9, hz * 0.9 * c.p]]);
  osc.connect(f).connect(pulse).connect(envelope(c, at, dur, level, 0.12));
}

function bubbles(c: SfxCtx, count: number, span: number, start = 0): void {
  for (let i = 0; i < count; i++) {
    const hz = rand(450, 1500);
    tone(c, start + (i / count) * span, rand(0.06, 0.15), hz, hz * 0.45, 0.035);
  }
}

export const LIFE_SFX_RECIPES = {
  plastic_crinkle: { play(c) {
    for (let i = 0; i < 5; i++) {
      const at = i * 0.16;
      grit(c, at, 0.2, 1500, rand(0.12, 0.23));
      noise(c, at, 0.18, 3700, 0.12, 'highpass');
    }
    return 0.9;
  } },
  broom_sweep: { play(c) {
    for (let i = 0; i < 3; i++) {
      const f = noise(c, i * 0.55, 0.43, 1800, 0.28, 'highpass', 'pink');
      sweep(f.frequency, c.t + i * 0.55, 2300 * c.p, [[0.4, 700 * c.p]]);
      grit(c, i * 0.55 + 0.04, 0.35, 900, 0.07);
    }
    return 1.6;
  } },
  water_splash: { play(c) {
    noise(c, 0, 0.8, 1700, 0.4, 'lowpass');
    noise(c, 0.04, 0.5, 3300, 0.18, 'highpass');
    bubbles(c, 8, 0.7, 0.1);
    return 1;
  } },
  chop_thud: { play(c) {
    hit(c, 0, 180, 0.22, 0.17);
    tone(c, 0.004, 0.09, 760, 470, 0.07, 'triangle');
    return 0.24;
  } },
  car_horn: { play(c) { horn(c, 0, 0.55, 350); horn(c, 0.72, 0.3, 350); return 1.1; } },
  fry_sizzle: { play(c) {
    noise(c, 0, 2.3, 4000, 0.23, 'highpass');
    grit(c, 0, 2.3, 1700, 0.2);
    for (let i = 0; i < 12; i++) noise(c, i * 0.17 + 0.08, 0.04, rand(1800, 6500), 0.22);
    return 2.4;
  } },
  garbage_melody: { jitter: 0.005, play(c) {
    // The familiar opening of Für Elise, heard from Taiwanese collection trucks.
    const notes = [659.25, 622.25, 659.25, 622.25, 659.25, 493.88, 587.33, 523.25, 440, 261.63, 329.63, 440];
    notes.forEach((hz, i) => bell(c, i * 0.37, hz, 0.55));
    motor(c, 0, 4.7, 58, 14, 0.035);
    return 4.8;
  } },
  fan_hum: { play(c) {
    motor(c, 0, 2.8, 95, 22, 0.09);
    noise(c, 0, 2.8, 950, 0.12, 'lowpass', 'pink');
    return 2.9;
  } },
  flush_water: { play(c) {
    const f = noise(c, 0, 3.3, 650, 0.42, 'lowpass', 'pink', 1.1);
    sweep(f.frequency, c.t, 650 * c.p, [[0.65, 2400 * c.p], [2.7, 400 * c.p]]);
    bubbles(c, 16, 2.5, 0.5);
    return 3.4;
  } },
  cat_meow: { play(c) {
    const osc = tone(c, 0, 0.95, 580, 260, 0.17, 'sawtooth', 2100);
    osc.frequency.cancelScheduledValues(c.t);
    shape(osc.frequency, c.t, [[0, 420 * c.p], [0.14, 730 * c.p], [0.4, 610 * c.p], [0.72, 390 * c.p], [0.95, 240 * c.p]]);
    c.g.lfo(osc.frequency, 17, 9 * c.p, c.t, c.t + 0.95);
    tone(c, 0.1, 0.7, 1180, 700, 0.025);
    return 1.05;
  } },
  cricket_chirp: { play(c) {
    for (let group = 0; group < 3; group++) {
      for (let n = 0; n < 4; n++) tone(c, group * 0.55 + n * 0.075, 0.048, 4600, 4900, 0.065);
    }
    return 1.5;
  } },
  gecko_click: { play(c) {
    for (let i = 0; i < 4; i++) {
      tone(c, i * 0.22, 0.075, 2300, 1200, 0.105, 'triangle');
      noise(c, i * 0.22, 0.03, 3500, 0.1, 'bandpass', 'white', 2);
    }
    return 0.85;
  } },
  mosquito_buzz: { play(c) {
    const osc = tone(c, 0, 1.7, 620, 760, 0.055, 'sawtooth', 4200);
    c.g.lfo(osc.frequency, 7, 28 * c.p, c.t, c.t + 1.7);
    c.move(-25, 35, c.t, c.t + 1.7, 0.6);
    return 1.8;
  } },
  frog_croak: { play(c) {
    for (let i = 0; i < 2; i++) {
      motor(c, i * 0.7, 0.48, 125, 31, 0.19);
      tone(c, i * 0.7, 0.46, 370, 240, 0.055, 'triangle');
    }
    return 1.3;
  } },
  owl_hoot: { play(c) {
    tone(c, 0, 0.25, 390, 340, 0.13);
    tone(c, 0.4, 0.8, 420, 290, 0.16);
    tone(c, 0.43, 0.72, 840, 580, 0.018);
    return 1.3;
  } },
  scanner_beep: { jitter: 0.005, play(c) { tone(c, 0, 0.13, 2300, 2300, 0.13); return 0.2; } },
  call_chime: { jitter: 0.005, play(c) { bell(c, 0, 830.61, 0.8); bell(c, 0.3, 1108.73, 0.9); return 1.3; } },
  elevator_ding: { play(c) { bell(c, 0, 1318.51, 1.4); tone(c, 0, 1.1, 659.25, 659.25, 0.035); return 1.5; } },
  photocopier: { play(c) {
    motor(c, 0, 1.9, 140, 9, 0.12);
    for (let i = 0; i < 2; i++) {
      noise(c, i * 0.8 + 0.2, 0.55, 1900, 0.23, 'bandpass', 'pink');
      tone(c, i * 0.8 + 0.15, 0.55, 620, 970, 0.045, 'triangle');
      hit(c, i * 0.8 + 0.7, 230, 0.1, 0.13);
    }
    return 2;
  } },
  icecream_horn: { play(c) {
    for (let i = 0; i < 3; i++) {
      tone(c, i * 0.36, 0.25, [523.25, 659.25, 783.99][i]!, [523.25, 659.25, 783.99][i]!, 0.12, 'square', 2400);
    }
    return 1.1;
  } },
  can_rattle: { play(c) {
    for (let i = 0; i < 6; i++) {
      const at = i * 0.105;
      tone(c, at, 0.17, 1120, 1090, 0.06);
      tone(c, at, 0.13, 2430, 2410, 0.045);
      noise(c, at, 0.05, 3200, 0.16, 'highpass');
    }
    return 0.8;
  } },
  skate_roll: { play(c) {
    motor(c, 0, 1.7, 85, 25, 0.07);
    noise(c, 0, 1.7, 1400, 0.2, 'bandpass', 'pink');
    for (let i = 0; i < 5; i++) { hit(c, i * 0.3 + 0.12, 170, 0.09, 0.09); hit(c, i * 0.3 + 0.17, 210, 0.07, 0.07); }
    c.move(-35, 35, c.t, c.t + 1.7);
    return 1.8;
  } },
  branch_snap: { play(c) {
    noise(c, 0, 0.1, 2300, 0.35, 'highpass');
    hit(c, 0, 300, 0.16, 0.14);
    grit(c, 0.025, 0.26, 900, 0.23);
    return 0.35;
  } },
  boat_engine: { play(c) {
    motor(c, 0, 2.8, 65, 12, 0.2);
    noise(c, 0, 2.8, 650, 0.16, 'lowpass', 'brown');
    bubbles(c, 10, 2.5, 0.15);
    return 3;
  } },
  ship_horn: { play(c) {
    horn(c, 0, 2.6, 110);
    tone(c, 0, 2.6, 55, 54, 0.07);
    noise(c, 0, 2.6, 550, 0.1, 'lowpass', 'pink');
    return 2.8;
  } },
  mouse_squeak: { play(c) {
    tone(c, 0, 0.15, 2600, 4200, 0.07);
    tone(c, 0.22, 0.12, 3900, 2200, 0.065);
    return 0.45;
  } },
  air_flow: { play(c) {
    const f = noise(c, 0, 2.2, 1200, 0.23, 'bandpass', 'pink', 0.5);
    sweep(f.frequency, c.t, 800 * c.p, [[0.9, 1800 * c.p], [2.2, 700 * c.p]]);
    return 2.3;
  } },
  power_saw: { play(c) {
    motor(c, 0, 2.1, 150, 82, 0.18);
    tone(c, 0, 2.1, 1950, 1500, 0.045, 'sawtooth', 4200);
    noise(c, 0.25, 1.5, 2900, 0.22, 'bandpass');
    grit(c, 0.3, 1.4, 2300, 0.09);
    return 2.3;
  } },
  excavator: { play(c) {
    motor(c, 0, 3, 48, 9, 0.2);
    noise(c, 0.5, 1.6, 1800, 0.18, 'bandpass', 'pink');
    tone(c, 0.5, 1.6, 540, 320, 0.04, 'triangle');
    hit(c, 2.1, 95, 0.2, 0.35);
    for (let i = 0; i < 5; i++) hit(c, 2.15 + i * 0.11, 480, 0.06, 0.12);
    return 3.2;
  } },
  water_rush: { play(c) {
    noise(c, 0, 2.8, 1800, 0.35, 'lowpass', 'pink');
    noise(c, 0.1, 2.6, 4500, 0.16, 'highpass');
    bubbles(c, 20, 2.5, 0.12);
    return 3;
  } },
  leaf_rustle: { play(c) {
    for (let i = 0; i < 4; i++) {
      noise(c, i * 0.33, 0.48, 2800, 0.18, 'highpass', 'pink');
      grit(c, i * 0.33 + 0.06, 0.32, 1900, 0.12);
    }
    return 1.6;
  } },
  fabric_flap: { play(c) {
    for (let i = 0; i < 4; i++) {
      const at = i * 0.37;
      // A broad cloth billow ends in a dull, tight flap.
      noise(c, at, 0.3, 650, 0.24, 'lowpass', 'pink');
      noise(c, at + 0.2, 0.1, 1200, 0.22, 'lowpass');
      tone(c, at + 0.2, 0.09, 105, 65, 0.065);
    }
    return 1.5;
  } },
  wire_whistle: { play(c) {
    const osc = tone(c, 0, 2.4, 1350, 1730, 0.075);
    c.g.lfo(osc.frequency, 3.7, 22 * c.p, c.t, c.t + 2.4);
    tone(c, 0.25, 1.9, 2710, 3370, 0.018);
    noise(c, 0, 2.4, 2100, 0.1, 'bandpass', 'pink', 2);
    return 2.5;
  } },
  pebble_roll: { play(c) {
    noise(c, 0, 1.8, 1100, 0.14, 'lowpass', 'pink');
    for (let i = 0; i < 19; i++) {
      const at = i * 0.075 + rand(0, 0.025);
      const hz = rand(280, 680);
      hit(c, at, hz, rand(0.035, 0.09), rand(0.045, 0.09));
    }
    return 1.9;
  } },
  metal_rattle: { play(c) {
    for (let i = 0; i < 5; i++) {
      const at = i * 0.19;
      const hz = i % 2 ? 390 : 330;
      tone(c, at, 0.34, hz, hz, 0.07);
      tone(c, at, 0.26, hz * 2.73, hz * 2.73, 0.045);
      tone(c, at, 0.18, hz * 5.18, hz * 5.18, 0.018);
      noise(c, at, 0.055, 2200, 0.12, 'highpass');
    }
    return 1.2;
  } },
} satisfies Record<string, SfxRecipe>;
