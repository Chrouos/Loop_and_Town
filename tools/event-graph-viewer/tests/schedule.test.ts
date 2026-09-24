import { expect, it } from 'vitest';
import { simulate } from '../src/simulator/simulator';
import type { WorldState } from '../src/simulator/types';

const loop = {
  id: 'schedule_test',
  range: { start: { day: 0, time: '17:00' }, end: { day: 0, time: '18:00' } },
};

function run(route: string, entries: unknown[]) {
  const initialState: WorldState = {
    clock: { day: 0, time: '17:00' },
    characters: { doctor: { route, location: 'hospital' } },
    world: { marker: 'start' },
  };
  const definition = {
    loop,
    actions: [],
    events: [],
    schedules: [{ characterId: 'doctor', entries }],
  };
  return simulate({
    definition: definition as never,
    initialState,
    actions: [],
    until: { day: 0, time: '17:40' },
  });
}

const leaveEntry = {
  id: 'doctor_leave_hospital',
  at: { day: 0, time: '17:40' },
  visibility: 'hidden',
  when: { path: 'characters.doctor.route', op: 'eq', value: 'old_station' },
  effects: [{ set: { path: 'characters.doctor.location', value: 'road_to_old_station' } }],
};

it('applies a base schedule entry when its condition is true', () => {
  const result = run('old_station', [leaveEntry]);
  expect(((result.state.characters as Record<string, any>).doctor).location).toBe('road_to_old_station');
  expect(result.history.find((row: any) => row.scheduleEntryId === 'doctor_leave_hospital')?.scheduleStatus).toBe('applied');
});

it('records a skipped schedule entry without mutating state when condition is false', () => {
  const result = run('stay_hospital', [leaveEntry]);
  expect(((result.state.characters as Record<string, any>).doctor).location).toBe('hospital');
  const row = result.history.find((item: any) => item.scheduleEntryId === 'doctor_leave_hospital') as any;
  expect(row?.scheduleStatus).toBe('skipped');
  expect(row?.changes).toEqual([]);
});

it('preserves authored order for schedule entries at the same minute', () => {
  const result = run('old_station', [
    {
      id: 'schedule_first', at: { day: 0, time: '17:40' }, effects: [
        { set: { path: 'world.marker', value: 'first' } },
      ],
    },
    {
      id: 'schedule_second', at: { day: 0, time: '17:40' }, effects: [
        { set: { path: 'world.marker', value: 'second' } },
      ],
    },
  ]);
  expect(result.history.filter((row: any) => row.kind === 'schedule').map((row: any) => row.scheduleEntryId))
    .toEqual(['schedule_first', 'schedule_second']);
  expect((result.state.world as Record<string, unknown>).marker).toBe('second');
});
