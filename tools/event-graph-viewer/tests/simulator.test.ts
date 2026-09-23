import { describe, expect, it } from 'vitest';
import { createSimulation, simulate } from '../src/simulator/simulator';
import type { SimulationDefinition, WorldState } from '../src/simulator/types';

const initialState: WorldState = {
  clock: { day: 1, time: '18:20' },
  characters: {
    wakaharu: { location: 'old_station', status: 'alive' },
    doctor: { location: 'old_station', status: 'alive' },
    reporter: { location: 'hotel', status: 'alive' },
  },
  flags: {
    player_protected_wakaharu: false,
    player_stopped_doctor: false,
  },
};

const definition: SimulationDefinition = {
  actions: [
    {
      id: 'protect_wakaharu', at: '18:20', label: '阻止若晴前往舊車站', effects: [
        { set: { path: 'characters.wakaharu.location', value: 'home' } },
        { add_flag: 'flags.player_protected_wakaharu' },
      ],
    },
    {
      id: 'stop_doctor', at: '18:20', label: '阻止醫生前往舊車站', effects: [
        { set: { path: 'characters.doctor.location', value: 'clinic' } },
        { add_flag: 'flags.player_stopped_doctor' },
      ],
    },
  ],
  events: [
    {
      id: 'evt_1831_station', title: '18:31 車站事件', at: '18:31', variants: [
        {
          id: 'wakaharu_dies', priority: 100,
          when: { path: 'characters.wakaharu.location', op: 'eq', value: 'old_station' },
          effects: [{ set: { path: 'characters.wakaharu.status', value: 'dead' } }],
          delayed_effects: [{
            id: 'reporter_missing_after_wakaharu_death', delay_minutes: 163,
            effects: [{ emit_event: { event_id: 'evt_2114_reporter_missing' } }],
          }],
        },
        {
          id: 'doctor_dies', priority: 90,
          when: { path: 'characters.doctor.location', op: 'eq', value: 'old_station' },
          effects: [{ set: { path: 'characters.doctor.status', value: 'dead' } }],
        },
        { id: 'no_death', priority: 0, fallback: true, effects: [] },
      ],
    },
    {
      id: 'evt_2114_reporter_missing', title: '21:14 記者失蹤', variants: [
        { id: 'reporter_missing', priority: 0, fallback: true, effects: [{ set: { path: 'characters.reporter.status', value: 'missing' } }] },
      ],
    },
  ],
};

function eventVariants(actionIds: string[]) {
  const result = simulate({ definition, initialState, actions: actionIds, until: '23:59' });
  return {
    variants: result.history.filter((entry) => entry.kind === 'event').map((entry) => entry.variantId),
    state: result.state,
    history: result.history,
  };
}

describe('worldline simulator acceptance', () => {
  it.each([
    { actions: [], station: 'wakaharu_dies', reporter: 'missing' },
    { actions: ['protect_wakaharu'], station: 'doctor_dies', reporter: 'alive' },
    { actions: ['stop_doctor'], station: 'wakaharu_dies', reporter: 'missing' },
    { actions: ['protect_wakaharu', 'stop_doctor'], station: 'no_death', reporter: 'alive' },
  ])('$actions resolves $station with reporter=$reporter', ({ actions, station, reporter }) => {
    const result = eventVariants(actions);
    expect(result.variants[0]).toBe(station);
    expect(((result.state.characters as Record<string, any>).reporter).status).toBe(reporter);
    expect(result.variants.includes('reporter_missing')).toBe(reporter === 'missing');
  });

  it('is deterministic for the same inputs', () => {
    expect(simulate({ definition, initialState, actions: [], until: '23:59' }))
      .toEqual(simulate({ definition, initialState, actions: [], until: '23:59' }));
  });

  it('rejects backwards time and protects returned snapshots', () => {
    const simulation = createSimulation(definition, initialState);
    simulation.runUntil('18:31');
    expect(() => simulation.runUntil('18:20')).toThrow('Cannot run simulation backwards');

    const state = simulation.getState();
    (state.characters as Record<string, any>).wakaharu.status = 'alive';
    expect(((simulation.getState().characters as Record<string, any>).wakaharu).status).toBe('dead');

    const history = simulation.getHistory();
    history.length = 0;
    expect(simulation.getHistory().length).toBeGreaterThan(0);
  });
});

describe('story definition validation', () => {
  it('rejects an unknown condition operator before simulation starts', () => {
    const invalid = structuredClone(definition) as any;
    invalid.events[0].variants[0].when.op = 'gt';
    expect(() => createSimulation(invalid, initialState)).toThrow('Unknown condition operator: gt');
  });

  it('rejects an unknown effect operation before simulation starts', () => {
    const invalid = structuredClone(definition) as any;
    invalid.actions[0].effects = [{ teleport: { character: 'wakaharu', to: 'home' } }];
    expect(() => createSimulation(invalid, initialState)).toThrow('Unknown effect operation: teleport');
  });
});
