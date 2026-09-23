export const MINUTE = 60_000;
export const FIRST_MIDNIGHT_MS = 6 * 60 * MINUTE;
export const DAY_MS = 24 * 60 * MINUTE;

export function timeAt(anchorMs: number, nowMs: number) {
  const elapsedMs = Math.max(0, nowMs - anchorMs);
  if (elapsedMs < FIRST_MIDNIGHT_MS) {
    return { loop: 1, minute: 1080 + Math.floor(elapsedMs / MINUTE), elapsedMs, nextMidnightMs: anchorMs + FIRST_MIDNIGHT_MS };
  }
  const afterFirst = elapsedMs - FIRST_MIDNIGHT_MS;
  const loop = 2 + Math.floor(afterFirst / DAY_MS);
  return { loop, minute: Math.floor((afterFirst % DAY_MS) / MINUTE), elapsedMs, nextMidnightMs: anchorMs + FIRST_MIDNIGHT_MS + (loop - 1) * DAY_MS };
}

export function loopMinuteAt(anchorMs: number, loop: number, minute: number) {
  if (loop === 1) return anchorMs + (minute - 1080) * MINUTE;
  return anchorMs + FIRST_MIDNIGHT_MS + (loop - 2) * DAY_MS + minute * MINUTE;
}

export function displayMinute(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
