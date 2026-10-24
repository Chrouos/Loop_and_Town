import { DIRECTION_ANGLE } from '../audio/catalog';
import type { Pos } from '../script/types';

const RADIUS: Record<Pos['dist'], number> = { near: 0.68, mid: 0.9, far: 1.04 };

/** Screen placement for a sound around the listener: front = top, back = bottom (an XY plane seen from above). */
export function placeOf(pos: Pos): { left: string; top: string; x: number; y: number } {
  if (pos.dir === 'center') return { left: '50%', top: '50%', x: 0, y: 0 };
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
