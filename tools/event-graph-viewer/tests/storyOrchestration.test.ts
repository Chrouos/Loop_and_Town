import { expect, it } from 'vitest';
import { simulate } from '../src/simulator/simulator';
import type { SimulationDefinition, WorldState } from '../src/simulator/types';

const initialState: WorldState = {
  clock: { day: 0, time: '14:20' },
  flags: { scheduled: false, evented: false, acted: false, first: false, second: false },
};

it('orders schedule then event then action at the same minute', () => {
  const definition: SimulationDefinition = {
    loop: { id: 'loop', range: { start: '14:20', end: '15:00' } },
    schedules: [{ characterId: 'x', entries: [{
      id: 'schedule_1500', at: '15:00', visibility: 'observable', effects: [{ add_flag: 'flags.scheduled' }],
    }] }],
    events: [{ id: 'event_1500', title: 'event_1500', at: '15:00', visibility: 'observable', variants: [{
      id: 'resolved', priority: 0, fallback: true, effects: [{ add_flag: 'flags.evented' }],
    }] }],
    actions: [{ id: 'action_1500', at: '15:00', label: 'action_1500', effects: [{ add_flag: 'flags.acted' }] }],
  };

  const result = simulate({ definition, initialState, actions: ['action_1500'], until: '15:00' });
  expect(result.history.filter((entry) => entry.kind !== 'effect').map((entry) => entry.kind))
    .toEqual(['schedule', 'event', 'player-action']);
});

it('preserves caller order for actions at the same minute', () => {
  const definition: SimulationDefinition = {
    loop: { id: 'loop', range: { start: '14:20', end: '15:00' } },
    schedules: [],
    events: [],
    actions: [
      { id: 'second_input', at: '15:00', label: 'second_input', effects: [{ add_flag: 'flags.second' }] },
      { id: 'first_input', at: '15:00', label: 'first_input', effects: [{ add_flag: 'flags.first' }] },
    ],
  };

  const result = simulate({ definition, initialState, actions: ['first_input', 'second_input'], until: '15:00' });
  expect(result.history.filter((entry) => entry.kind === 'player-action').map((entry) => entry.actionId))
    .toEqual(['first_input', 'second_input']);
});

it('rejects an emitted event scheduled into the past', () => {
  const definition: SimulationDefinition = {
    loop: { id: 'loop', range: { start: '14:20', end: '15:00' } },
    schedules: [],
    actions: [],
    events: [
      {
        id: 'event_1500', title: 'event_1500', at: '15:00', visibility: 'observable', variants: [{
          id: 'resolved', priority: 0, fallback: true,
          effects: [{ emit_event: { event_id: 'event_past', at: '14:30' } }],
        }],
      },
      {
        id: 'event_past', title: 'event_past', visibility: 'hidden', variants: [
          { id: 'resolved', priority: 0, fallback: true, effects: [] },
        ],
      },
    ],
  };

  expect(() => simulate({ definition, initialState, actions: [], until: '15:00' }))
    .toThrow('Cannot emit event into the past');
});
