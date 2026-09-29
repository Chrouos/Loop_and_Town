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

const local = (hour: number, minute = 0) => new Date(2026, 8, 28, hour, minute, 0, 0).getTime();

it('starts Loop 1 at 06:12 regardless of real start hour', () => {
  const start = local(17);
  const clock = createLoopClock('ACCELERATED', start);
  expect(clock.entryMinute).toBe(LOOP_START_MINUTE);
  expect(clockMinuteAt(clock, start)).toBe(LOOP_START_MINUTE);
});

it('advances accelerated time at the default 12x scale without changing loops', () => {
  const start = local(17);
  const clock = createLoopClock('ACCELERATED', start);
  expect(clock.anchor.scale).toBe(DEFAULT_ACCELERATED_SCALE);
  expect(clockMinuteAt(clock, start + 10 * 60_000)).toBe(LOOP_START_MINUTE + 120);
});

it('maps Live Sync entry to the player device local minute of day', () => {
  const start = local(17, 5);
  const clock = createLoopClock('LIVE_SYNC', start);
  expect(localMinuteOfDay(start)).toBe(17 * 60 + 5);
  expect(clock.entryMinute).toBe(17 * 60 + 5);
  expect(clockMinuteAt(clock, start)).toBe(17 * 60 + 5);
});

it('rejects Live Sync during the local inactive 00:00-06:11 gap', () => {
  const start = local(2);
  expect(isLiveSyncAvailable(start)).toBe(false);
  expect(() => createLoopClock('LIVE_SYNC', start)).toThrow(/unavailable/);
});

it('maps a simulation minute back to its real timestamp', () => {
  const start = local(17);
  const clock = createLoopClock('ACCELERATED', start);
  expect(realTimestampForSimulationMinute(clock, LOOP_START_MINUTE + 120)).toBe(start + 10 * 60_000);
});

it('keeps clock functions side-effect free and formats normalized minutes', () => {
  const start = local(17);
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
