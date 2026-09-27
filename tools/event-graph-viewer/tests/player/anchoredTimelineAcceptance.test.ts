import { expect, it } from 'vitest';
import { clockMinuteAt, createLoopClock, isLiveSyncAvailable, localMinuteOfDay, MINUTE } from '../../src/player/clock';
import { advanceLoop } from '../../src/player/eventScheduler';
import { normalizeSave } from '../../src/player/model';
import { reconcilePlayer, visibleRecords } from '../../src/player/knowledge';
import { activeLoop, createNextLoop } from '../../src/player/runtime';
import type { SimulationDefinition, WorldState } from '../../src/simulator/types';

const definition: SimulationDefinition = {
  loop: { id: 'loop', range: { start: { day: 0, time: '06:12' }, end: { day: 1, time: '00:00' } } },
  actions: [],
  events: [{
    id: 'evt_1831_station', title: '18:31 車站事件', at: '18:31',
    variants: [{ id: 'wakaharu_dies', priority: 0, fallback: true, effects: [{ set: { path: 'characters.wakaharu.status', value: 'dead' } }] }],
  }],
};
const initial: WorldState = {
  clock: { day: 0, time: '06:12' },
  characters: { wakaharu: { location: 'old_station', status: 'alive' } },
  world: {},
};

it('real 17:00 first boot enters Loop 1 at 06:12 and ten real minutes become 120 simulation minutes', () => {
  const start = new Date('2026-09-28T17:00:00+08:00').getTime();
  const save = normalizeSave(null, start);
  expect(save.currentLoopId).toBe(1);
  expect(activeLoop(save).clock.mode).toBe('ACCELERATED');
  expect(clockMinuteAt(activeLoop(save).clock, start)).toBe(372);
  expect(clockMinuteAt(activeLoop(save).clock, start + 10 * MINUTE)).toBe(492);
});

it('offline catch-up stops at Convergence and never creates a later loop', () => {
  const save = normalizeSave(null, 0);
  const result = reconcilePlayer(save, 4 * 60 * 60_000, definition, initial);
  expect(result.currentLoopId).toBe(1);
  expect(result.loops[1].clock.lastProcessedMinute).toBe(1111);
  expect(result.loops[1].clock.pendingCriticalBoundary).toBe('convergence');
  expect(result.loops[2]).toBeUndefined();
});

it('does not process events after a pending boundary until foreground continuation', () => {
  const first = reconcilePlayer(normalizeSave(null, 0), 4 * 60 * 60_000, definition, initial);
  const historyLength = first.loops[1].history.length;
  const later = reconcilePlayer(first, 8 * 60 * 60_000, definition, initial);
  expect(later.loops[1].clock.pendingCriticalBoundary).toBe('convergence');
  expect(later.loops[1].history.length).toBe(historyLength);
});

it('Live Sync bootstrap reaches 21:40 through the earlier critical event', () => {
  const entryAt = new Date('2026-09-28T21:40:00+08:00').getTime();
  const save = normalizeSave(null, entryAt);
  save.loops[1].sealed = true;
  createNextLoop(save, 'LIVE_SYNC', entryAt);
  const result = reconcilePlayer(save, entryAt, definition, initial);
  expect(activeLoop(result).clock.lastProcessedMinute).toBe(1300);
  expect(activeLoop(result).clock.pendingCriticalBoundary).toBeUndefined();
  expect(activeLoop(result).history.some(item => item.eventId === 'evt_1831_station')).toBe(true);
});

it('foreground reset creates exactly one next loop and keeps the previous anchor', () => {
  const save = normalizeSave(null, 0);
  const previousAnchor = activeLoop(save).clock.anchor;
  activeLoop(save).clock.pendingCriticalBoundary = 'reset';
  createNextLoop(save, 'ACCELERATED', 1_000);
  expect(save.currentLoopId).toBe(2);
  expect(save.loops[1].sealed).toBe(true);
  expect(save.loops[1].clock.anchor).toEqual(previousAnchor);
  expect(save.loops[2].clock.mode).toBe('ACCELERATED');
});

it('Live Sync maps 17:05 to that Player Entry Point and rejects 02:00', () => {
  const afternoon = new Date('2026-09-28T17:05:00+08:00').getTime();
  expect(localMinuteOfDay(afternoon)).toBe(17 * 60 + 5);
  expect(createLoopClock('LIVE_SYNC', afternoon).entryMinute).toBe(17 * 60 + 5);
  const early = new Date('2026-09-28T02:00:00+08:00').getTime();
  expect(isLiveSyncAvailable(early)).toBe(false);
  expect(() => createLoopClock('LIVE_SYNC', early)).toThrow();
  expect(createLoopClock('ACCELERATED', early).entryMinute).toBe(372);
});

it('keeps reconstructed presence history internal and does not reveal the 18:00 message at 06:12', () => {
  const save = reconcilePlayer(normalizeSave(null, 0), 0, definition, initial);
  expect(visibleRecords(save, 1).map(record => record.id)).toContain('letter');
  expect(visibleRecords(save, 1).map(record => record.id)).not.toContain('yu-an-message');
});

it('does not infer a second loop from a multi-day offline target', () => {
  const save = normalizeSave(null, 0);
  const result = advanceLoop({ definition, initialState: initial, loop: activeLoop(save), fromMinute: 1439, targetMinute: 7 * 1440, intent: 'OFFLINE' });
  expect(result.reachedMinute).toBe(1440);
  expect(result.pendingBoundary).toBe('reset');
});
