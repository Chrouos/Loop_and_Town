import { useEffect, useRef } from 'react';
import type { RainKind } from '../engine/director';

// Rain she hears, drawn as rings spreading on water. When the rain first comes in it falls over the whole screen;
// once the line she hears it on has gone, it thins out and lands somewhere, a few drops around one spot, then
// somewhere else, for as long as the rain is heard. It comes and goes in gusts, thick and then thin.

/** How long the rain stays over the whole screen at least, even if the first line goes sooner. */
const WIDE_MIN_MS = 5000;
/** How long it takes to thin out from the whole screen (or fill it again). */
const SETTLE_MS = 2600;
/** Drops a second at a full gust: over the whole screen, and once it has settled. */
const RATE_WIDE = 16;
const RATE_SETTLED = 5;
const KIND_RATE: Record<RainKind, number> = { out: 1.25, window: 0.85, car: 1.1 };
/** How far around the spot the drops land, and how long before the rain moves on to somewhere else. */
const SPOT_RADIUS = 110;
const SPOT_MS: [number, number] = [2200, 5200];
const INK = '236, 230, 218';

type Drop = { x: number; y: number; r: number; born: number; life: number; alpha: number; second: boolean };
type Streak = { x: number; y: number; len: number; born: number; life: number; fall: number; alpha: number };

const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
const lerp = (a: number, b: number, m: number): number => a + (b - a) * m;
/** Most near the middle, fewer further out: a spot with no hard edge. */
const soft = (): number => (Math.random() + Math.random() + Math.random()) / 3 - 0.5;

/** Anywhere on screen but on the line she is reading. */
function pickSpot(width: number, height: number): { x: number; y: number } {
  for (let i = 0; i < 8; i += 1) {
    const x = rand(0.06, 0.94) * width;
    const y = rand(0.08, 0.92) * height;
    if (!(x > width * 0.22 && x < width * 0.78 && y > height * 0.38 && y < height * 0.62)) return { x, y };
  }
  return { x: width * 0.85, y: height * 0.2 };
}

export function Rain({ kind, centerKey, still }: { kind: RainKind | null; centerKey: number | undefined; still: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wake = useRef<(() => void) | null>(null);
  // Read by the drawing loop without restarting it.
  const live = useRef({ kind, centerKey, wide: false, since: 0, firstLine: undefined as number | undefined, lineGone: false });
  const state = live.current;
  if (kind && !state.kind) Object.assign(state, { wide: true, since: performance.now(), firstLine: undefined, lineGone: false });
  if (state.wide && centerKey !== undefined) {
    if (state.firstLine === undefined) state.firstLine = centerKey;
    else if (centerKey !== state.firstLine) state.lineGone = true;
  }
  state.kind = kind;
  state.centerKey = centerKey;

  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const off = still || Boolean(reduced);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || off) return undefined;
    const stage = el.parentElement!;
    const drops: Drop[] = [];
    const streaks: Streak[] = [];
    let width = 0;
    let height = 0;
    const fit = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = stage.clientWidth;
      height = stage.clientHeight;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);

    // m: 0 = the whole screen, 1 = settled, landing around one spot at a time.
    let m = state.wide ? 0 : 1;
    let spot = pickSpot(stage.clientWidth, stage.clientHeight);
    let spotNext = 0;
    let gust = 0.7;
    let gustTo = 1;
    let gustNext = 0;
    let owed = 0;
    let last = performance.now();
    let frame = 0;
    let running = false;

    const tick = (now: number): void => {
      const dt = Math.min(now - last, 100);
      last = now;
      const raining = state.kind !== null;
      if (state.wide && state.lineGone && now - state.since > WIDE_MIN_MS) state.wide = false;
      m = Math.max(0, Math.min(1, m + (state.wide ? -dt : dt) / SETTLE_MS));
      const e = m * m * (3 - 2 * m);

      // 一陣密，一陣疏: the rain swells and thins on its own, every couple of seconds.
      if (now > gustNext) {
        gustTo = Math.random() < 0.5 ? rand(0.75, 1) : rand(0.12, 0.4);
        gustNext = now + rand(1600, 4200);
      }
      gust += (gustTo - gust) * Math.min(1, dt / 900);

      if (now > spotNext) {
        spot = pickSpot(width, height);
        spotNext = now + rand(...SPOT_MS);
      }
      const scale = lerp(1, 0.7, e);

      if (raining && state.kind) {
        owed += (dt / 1000) * lerp(RATE_WIDE, RATE_SETTLED, e) * KIND_RATE[state.kind] * gust;
        while (owed >= 1) {
          owed -= 1;
          // Settling, more and more of the drops land around the spot; now and then one still falls on its own.
          const around = Math.random() < e * 0.85;
          const x = around ? spot.x + soft() * SPOT_RADIUS * 2 : Math.random() * width;
          const y = around ? spot.y + soft() * SPOT_RADIUS * 1.2 : Math.random() * height;
          drops.push({
            x, y, r: rand(18, 46) * scale, born: now, life: rand(1300, 2100),
            alpha: lerp(0.15, 0.24, e) * rand(0.6, 1), second: Math.random() < 0.4,
          });
          if (Math.random() < 0.8) {
            streaks.push({
              x: x + rand(-30, 30) * scale, y: y - rand(40, 90) * scale, len: rand(12, 26) * scale,
              born: now, life: rand(260, 420), fall: rand(30, 60) * scale, alpha: lerp(0.08, 0.1, e),
            });
          }
        }
      }

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      for (let i = drops.length - 1; i >= 0; i -= 1) {
        const d = drops[i];
        const age = (now - d.born) / d.life;
        if (age >= 1) { drops.splice(i, 1); continue; }
        const grow = 1 - (1 - age) ** 3;
        const fade = (1 - age) ** 1.5;
        ctx.strokeStyle = `rgba(${INK}, ${(d.alpha * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, Math.max(0.5, d.r * grow), Math.max(0.3, d.r * grow * 0.36), 0, 0, Math.PI * 2);
        ctx.stroke();
        if (d.second && age > 0.12) {
          const a2 = (age - 0.12) / 0.88;
          const r2 = d.r * 0.6 * (1 - (1 - a2) ** 3);
          ctx.strokeStyle = `rgba(${INK}, ${(d.alpha * 0.6 * (1 - a2) ** 1.5).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y, Math.max(0.5, r2), Math.max(0.3, r2 * 0.36), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // A little slant, as if there is some wind.
      for (let i = streaks.length - 1; i >= 0; i -= 1) {
        const s = streaks[i];
        const age = (now - s.born) / s.life;
        if (age >= 1) { streaks.splice(i, 1); continue; }
        const y = s.y + s.fall * age;
        const x = s.x - s.fall * age * 0.12;
        ctx.strokeStyle = `rgba(${INK}, ${(s.alpha * Math.sin(Math.PI * age)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - s.len * 0.12, y + s.len);
        ctx.stroke();
      }

      if (raining || drops.length || streaks.length) frame = requestAnimationFrame(tick);
      else { running = false; ctx.clearRect(0, 0, width, height); }
    };
    wake.current = () => {
      if (running || !state.kind) return;
      running = true;
      last = performance.now();
      if (state.wide) m = 0;
      frame = requestAnimationFrame(tick);
    };
    wake.current();
    return () => {
      wake.current = null;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fit);
      ctx.clearRect(0, 0, width, height);
    };
    // The loop reads the rain live; it sleeps once the last drop has gone and wakes when rain comes again.
  }, [off]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { wake.current?.(); }, [kind]);

  if (off) return null;
  return <canvas ref={canvas} className="lt-rain" aria-hidden="true" />;
}
