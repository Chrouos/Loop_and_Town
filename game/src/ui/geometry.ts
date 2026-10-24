import { DIRECTION_ANGLE } from '../audio/catalog';
import type { Pos } from '../script/types';

const RADIUS: Record<Pos['dist'], number> = { near: 0.68, mid: 0.9, far: 1.04 };

/** Screen placement for a sound around the listener: front = top, back = bottom (an XY plane seen from above). */
export function placeOf(pos: Pos): { left: string; top: string; x: number; y: number } {
  // Her own hands: just below what she is listening to, never on top of it.
  if (pos.dir === 'center') return { left: '50%', top: 'calc(50% + 0.5 * min(38vh, 380px))', x: 0, y: 0.5 };
  const angle = (DIRECTION_ANGLE[pos.dir] * Math.PI) / 180;
  const r = RADIUS[pos.dist];
  const x = Math.sin(angle) * r;
  const y = -Math.cos(angle) * r;
  // Ellipse radii: wide on desktop, tighter on phones; kept inside the viewport.
  return {
    left: `calc(50% + ${x.toFixed(3)} * min(40vw, 560px))`,
    top: `calc(50% + ${y.toFixed(3)} * min(38vh, 380px))`,
    x,
    y,
  };
}

/** The centre text leans a little toward whoever is speaking. */
export function leanOf(pos: Pos): string {
  if (pos.dir === 'center') return 'translate(0, 0)';
  const angle = (DIRECTION_ANGLE[pos.dir] * Math.PI) / 180;
  const x = Math.sin(angle) * 22;
  const y = -Math.cos(angle) * 10;
  return `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
}

/** Interpolated clock between two "HH:MM" strings. */
export function interpolateClock(from: string | undefined, to: string | undefined, fraction: number): string | undefined {
  const parse = (value?: string) => {
    const match = value ? /(\d{1,2}):(\d{2})/.exec(value) : null;
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const a = parse(from);
  const b = parse(to);
  if (a === null) return from;
  if (b === null) return from;
  const minutes = Math.floor(a + (b - a) * Math.max(0, Math.min(1, fraction)));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export type Box = { l: number; t: number; r: number; b: number };

// How far out along its free stretch a sound sits: near ones hug what she is listening to, far ones the edge of the screen.
const REACH: Record<Pos['dist'], number> = { near: 0.18, mid: 0.5, far: 0.85 };

/**
 * Where a sound of size `w`×`h` goes on a `W`×`H` screen: along its own direction, outside every `keepOut` box
 * (the line she is listening to, its echo, the choices, other sounds), inside the screen. When its own direction
 * has no room (a phone has none beside the text), it turns a little toward front or back until there is.
 */
export function placeLabel(pos: Pos, w: number, h: number, W: number, H: number, keepOut: Box[]): { x: number; y: number; crowded?: boolean } {
  const margin = 10;
  const cx = W / 2;
  const cy = H / 2;
  const fits = (x: number, y: number) => {
    if (x - w / 2 < margin || x + w / 2 > W - margin || y - h / 2 < margin || y + h / 2 > H - margin) return false;
    return !keepOut.some((box) => x + w / 2 > box.l && x - w / 2 < box.r && y + h / 2 > box.t && y - h / 2 < box.b);
  };
  const reach = Math.hypot(W, H) / 2;
  // First free stretch along a ray from the centre; null when the ray never gets clear.
  const stretch = (degrees: number): [number, number] | null => {
    const sx = Math.sin((degrees * Math.PI) / 180);
    const sy = -Math.cos((degrees * Math.PI) / 180);
    let start = -1;
    for (let t = 0; t <= reach; t += 3) {
      const ok = fits(cx + sx * t, cy + sy * t);
      if (ok && start < 0) start = t;
      if (!ok && start >= 0) return [start, t - 3];
    }
    return start >= 0 ? [start, reach] : null;
  };
  const along = (degrees: number, t: number) => ({ x: cx + Math.sin((degrees * Math.PI) / 180) * t, y: cy - Math.cos((degrees * Math.PI) / 180) * t });

  // Her own hands: the first free spot straight below.
  if (pos.dir === 'center') {
    const run = stretch(180);
    if (run) return along(180, run[0]);
  } else {
    const angle = DIRECTION_ANGLE[pos.dir];
    const signed = angle > 180 ? angle - 360 : angle;
    // Turn toward whichever of front/back is nearer, then try the other way.
    const toward = Math.abs(signed) <= 90 ? -Math.sign(signed) || 1 : Math.sign(signed) || 1;
    // Its own direction first; past 75° it no longer reads as that direction, but anywhere clear beats covering the text.
    for (const step of [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]) {
      for (const turn of step ? [toward, -toward] : [1]) {
        const degrees = signed + turn * step;
        const run = stretch(degrees);
        if (!run) continue;
        return along(degrees, run[0] + (run[1] - run[0]) * REACH[pos.dist]);
      }
    }
  }
  // Nowhere clear at all (a small screen full of choices): the old ellipse, kept on screen, marked so it can step aside.
  const fallback = placeOf(pos);
  const x = Math.min(Math.max(cx + fallback.x * Math.min(0.4 * W, 560), w / 2 + margin), W - w / 2 - margin);
  const y = Math.min(Math.max(cy + fallback.y * Math.min(0.38 * H, 380), h / 2 + margin), H - h / 2 - margin);
  return { x, y, crowded: true };
}
