import { describe, expect, it } from 'vitest';
import { createLoopClock, LOOP_START_MINUTE } from '../../src/player/clock';
import { emptyLoop } from '../../src/player/model';
import { advanceLoop, firstCriticalBoundary } from '../../src/player/eventScheduler';
import type { SimulationDefinition, WorldState } from '../../src/simulator/types';

const definition: SimulationDefinition = {
  loop: { id: 'loop', range: { start: { day: 0, time: '06:12' }, end: { day: 1, time: '00:00' } } },
  actions: [],
  events: [
    { id: 'convergence', title: 'Convergence', at: '18:31', variants: [{ id: 'default', priority: 0, fallback: true, effects: [{ add_flag: 'flags.convergence' }] }] },
    { id: 'bell', title: 'Bell', at: '23:59', variants: [{ id: 'default', priority: 0, fallback: true, effects: [{ add_flag: 'flags.bell' }] }] },
  ],
};
const initialState: WorldState = { clock: { day: 0, time: '06:12' }, flags: { convergence: false, bell: false } };
const loop = () => emptyLoop(createLoopClock('ACCELERATED', 0));

describe('anchored event scheduler', () => {
  it('finds critical boundaries in chronological order', () => {
    expect(firstCriticalBoundary(LOOP_START_MINUTE, 1300)).toMatchObject({ id: 'convergence', minute: 1111 });
    expect(firstCriticalBoundary(1120, 1440)).toMatchObject({ id: 'bell', minute: 1439 });
    expect(firstCriticalBoundary(1439, 1440)).toMatchObject({ id: 'reset', minute: 1440 });
  });

  it('processes normal events deterministically', () => {
    const result = advanceLoop({ definition, initialState, loop: loop(), fromMinute: LOOP_START_MINUTE, targetMinute: 1120, intent: 'BOOTSTRAP' });
    expect(result.reachedMinute).toBe(1120);
    expect(result.pendingBoundary).toBeUndefined();
    expect(result.simulation.state.flags).toEqual({ convergence: true, bell: false });
    expect(result.simulation.history.map(item => item.eventId)).toContain('convergence');
  });

  it('OFFLINE stops at Convergence and marks it pending', () => {
    const result = advanceLoop({ definition, initialState, loop: loop(), fromMinute: LOOP_START_MINUTE, targetMinute: 1300, intent: 'OFFLINE' });
    expect(result.reachedMinute).toBe(1111);
    expect(result.pendingBoundary).toBe('convergence');
    expect(result.simulation.state.flags).toEqual({ convergence: true, bell: false });
  });

  it('OFFLINE stops at Bell, then at Reset, without creating another loop', () => {
    const atBell = advanceLoop({ definition, initialState, loop: loop(), fromMinute: 1120, targetMinute: 1440, intent: 'OFFLINE' });
    expect(atBell.reachedMinute).toBe(1439);
    expect(atBell.pendingBoundary).toBe('bell');

    const atReset = advanceLoop({ definition, initialState, loop: loop(), fromMinute: 1439, targetMinute: 4 * 1440, intent: 'OFFLINE' });
    expect(atReset.reachedMinute).toBe(1440);
    expect(atReset.pendingBoundary).toBe('reset');
  });

  it('FOREGROUND consumes a pending boundary exactly once', () => {
    const pendingLoop = loop();
    pendingLoop.clock.pendingCriticalBoundary = 'convergence';
    const result = advanceLoop({ definition, initialState, loop: pendingLoop, fromMinute: 1111, targetMinute: 1400, intent: 'FOREGROUND' });
    expect(result.reachedMinute).toBe(1111);
    expect(result.pendingBoundary).toBeUndefined();
  });

  it('BOOTSTRAP crosses an earlier boundary to reach a late entry point', () => {
    const result = advanceLoop({ definition, initialState, loop: loop(), fromMinute: LOOP_START_MINUTE, targetMinute: 21 * 60 + 40, intent: 'BOOTSTRAP' });
    expect(result.reachedMinute).toBe(1300);
    expect(result.pendingBoundary).toBeUndefined();
    expect(result.simulation.state.flags).toEqual({ convergence: true, bell: false });
  });

  it('BOOTSTRAP leaves a boundary at the exact entry minute pending', () => {
    const result = advanceLoop({ definition, initialState, loop: loop(), fromMinute: LOOP_START_MINUTE, targetMinute: 1111, intent: 'BOOTSTRAP' });
    expect(result.reachedMinute).toBe(1111);
    expect(result.pendingBoundary).toBe('convergence');
    expect(result.simulation.state.flags).toEqual({ convergence: false, bell: false });
  });
});
