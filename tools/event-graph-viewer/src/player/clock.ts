export const MINUTE = 60_000;
export const DAY_MS = 24 * 60 * MINUTE;
export const LOOP_START_MINUTE = 6 * 60 + 12;
export const CONVERGENCE_MINUTE = 18 * 60 + 31;
export const BELL_MINUTE = 23 * 60 + 59;
export const RESET_MINUTE = 24 * 60;
export const DEFAULT_ACCELERATED_SCALE = 12;

export type TimeMode = 'ACCELERATED' | 'LIVE_SYNC';

export type LoopAnchor = {
  realStartedAtMs: number;
  simulationStartedMinute: number;
  scale: number;
};

export type CriticalBoundaryId = 'convergence' | 'bell' | 'reset';

export type LoopClockState = {
  mode: TimeMode;
  anchor: LoopAnchor;
  entryMinute: number;
  lastProcessedMinute: number;
  pendingCriticalBoundary?: CriticalBoundaryId;
};

export function localMinuteOfDay(nowMs: number): number {
  const date = new Date(nowMs);
  return date.getHours() * 60 + date.getMinutes();
}

export function isLiveSyncAvailable(nowMs: number): boolean {
  return localMinuteOfDay(nowMs) >= LOOP_START_MINUTE;
}

export function createLoopClock(
  mode: TimeMode,
  nowMs: number,
  options: { scale?: number } = {},
): LoopClockState {
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error(`Invalid real timestamp: ${nowMs}`);
  if (mode === 'LIVE_SYNC' && !isLiveSyncAvailable(nowMs)) {
    throw new Error('LIVE_SYNC is unavailable before 06:12 local time.');
  }

  const entryMinute = mode === 'LIVE_SYNC' ? localMinuteOfDay(nowMs) : LOOP_START_MINUTE;
  const scale = mode === 'LIVE_SYNC' ? 1 : options.scale ?? DEFAULT_ACCELERATED_SCALE;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Invalid clock scale: ${scale}`);

  return {
    mode,
    anchor: {
      realStartedAtMs: mode === 'LIVE_SYNC'
        ? nowMs - (entryMinute - LOOP_START_MINUTE) * MINUTE / scale
        : nowMs,
      simulationStartedMinute: LOOP_START_MINUTE,
      scale,
    },
    entryMinute,
    lastProcessedMinute: LOOP_START_MINUTE,
  };
}

export function clockMinuteAt(clock: LoopClockState, safeNowMs: number): number {
  const elapsedMs = Math.max(0, safeNowMs - clock.anchor.realStartedAtMs);
  return clock.anchor.simulationStartedMinute + Math.floor((elapsedMs * clock.anchor.scale) / MINUTE);
}

export function realTimestampForSimulationMinute(clock: LoopClockState, simulationMinute: number): number {
  return clock.anchor.realStartedAtMs
    + (simulationMinute - clock.anchor.simulationStartedMinute) * MINUTE / clock.anchor.scale;
}

export function displayMinute(minute: number): string {
  const normalized = ((Math.floor(minute) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

/** @deprecated Runtime code should use a LoopClockState instead. */
export function timeAt(anchorMs: number, nowMs: number) {
  const clock = createLoopClock('ACCELERATED', anchorMs, { scale: 1 });
  return {
    loop: 1,
    minute: clockMinuteAt(clock, nowMs),
    elapsedMs: Math.max(0, nowMs - anchorMs),
    nextMidnightMs: realTimestampForSimulationMinute(clock, RESET_MINUTE),
  };
}

/** @deprecated Runtime code should keep loop identity in PlayerSave. */
export function loopMinuteAt(anchorMs: number, _loop: number, minute: number) {
  return anchorMs + (minute - LOOP_START_MINUTE) * MINUTE;
}
