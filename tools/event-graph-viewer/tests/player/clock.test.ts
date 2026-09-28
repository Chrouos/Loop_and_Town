import { expect, it } from 'vitest';
import {
  DEFAULT_ACCELERATED_SCALE,
  LOOP_START_MINUTE,
  clockMinuteAt,
  createLoopClock,
  displayMinute,
  isLiveSyncAvailable,
  localMinuteOfDay,
  realTimestampForSimulationMinute,
} from '../../src/player/clock';
import { normalizeSave } from '../../src/player/model';

const real = (value: string) => new Date(value).getTime();

it('starts Loop 1 at 06:12 regardless of real start hour', () => {
  const clock = createLoopClock('ACCELERATED', real('2026-09-28T17:00:00+08:00'));
  expect(clock.entryMinute).toBe(LOOP_START_MINUTE);
  expect(clockMinuteAt(clock, real('2026-09-28T17:00:00+08:00'))).toBe(LOOP_START_MINUTE);
});

it('advances accelerated time at the default 12x scale without changing loops', () => {
  const start = real('2026-09-28T17:00:00+08:00');
  const clock = createLoopClock('ACCELERATED', start);
  expect(clock.anchor.scale).toBe(DEFAULT_ACCELERATED_SCALE);
  expect(clockMinuteAt(clock, start + 10 * 60_000)).toBe(LOOP_START_MINUTE + 120);
});

it('maps Live Sync entry to the same local minute of day', () => {
  const start = real('2026-09-28T17:05:00+08:00');
  const clock = createLoopClock('LIVE_SYNC', start);
  expect(clock.entryMinute).toBe(localMinuteOfDay(start));
  expect(clockMinuteAt(clock, start)).toBe(localMinuteOfDay(start));
});

it('rejects Live Sync during the inactive 00:00-06:11 gap', () => {
  const start = real('2026-09-28T02:00:00+08:00');
  expect(isLiveSyncAvailable(start)).toBe(false);
  expect(() => createLoopClock('LIVE_SYNC', start)).toThrow(/unavailable/);
});

it('maps a simulation minute back to its real timestamp', () => {
  const start = real('2026-09-28T17:00:00+08:00');
  const clock = createLoopClock('ACCELERATED', start);
  expect(realTimestampForSimulationMinute(clock, LOOP_START_MINUTE + 120)).toBe(start + 10 * 60_000);
});

it('keeps clock functions side-effect free and formats normalized minutes', () => {
  const start = real('2026-09-28T17:00:00+08:00');
  const clock = createLoopClock('ACCELERATED', start);
  const before = JSON.stringify(clock);
  expect(displayMinute(LOOP_START_MINUTE)).toBe('06:12');
  expect(displayMinute(1440)).toBe('00:00');
  expect(JSON.stringify(clock)).toBe(before);
});

it('keeps confirmed progress when device time goes backwards', () => {
  const save = normalizeSave({ version: 1, anchorMs: 0, lastConfirmedMs: 2000, loops: { 1: { actionIds: ['protect_wakaharu'], revealedIds: [], sealed: false } } }, 1000);
  expect(save.lastConfirmedMs).toBe(2000);
  expect(save.loops[1].actionIds).toEqual(['protect_wakaharu']);
});
