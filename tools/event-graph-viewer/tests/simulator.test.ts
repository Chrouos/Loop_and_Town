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

function actionDefinition(
  actions: SimulationDefinition['actions'],
  events: SimulationDefinition['events'] = [],
): SimulationDefinition {
  return { actions, events };
}

function emptyEvent(id: string, at: string): SimulationDefinition['events'][number] {
  return {
    id,
    at,
    title: id,
    variants: [{ id: `${id}_fallback`, priority: 0, fallback: true, effects: [] }],
  };
}

const makeCoffee = {
  id: 'make_coffee',
  at: '18:20',
  duration_minutes: 5,
  label: '泡咖啡',
  effects: [],
};

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

  it('records action duration and advances the cursor before later work', () => {
    const laterAction = { id: 'drink_coffee', at: '18:25', label: '喝咖啡', effects: [] };
    const result = simulate({
      definition: actionDefinition([makeCoffee, laterAction], [emptyEvent('evt_1822', '18:22')]),
      initialState,
      actions: ['make_coffee', 'drink_coffee'],
      until: '18:25',
    });

    expect(result.history.map((entry) => `${entry.kind}:${entry.actionId ?? entry.eventId}`)).toEqual([
      'player-action:make_coffee',
      'event:evt_1822',
      'player-action:drink_coffee',
    ]);
    expect(result.history[0]).toEqual(expect.objectContaining({
      time: '18:20',
      endTime: '18:25',
      durationMinutes: 5,
    }));
  });
});

describe('action duration', () => {
  it('records an empty-effect action with start and end time', () => {
    const result = simulate({
      definition: actionDefinition([makeCoffee]),
      initialState,
      actions: ['make_coffee'],
      until: '18:25',
    });

    expect(result.history).toEqual([
      expect.objectContaining({
        kind: 'player-action',
        actionId: 'make_coffee',
        time: '18:20',
        endTime: '18:25',
        durationMinutes: 5,
        changes: [],
      }),
    ]);
  });

  it('advances the cursor after an action duration', () => {
    const simulation = createSimulation(actionDefinition([makeCoffee]), initialState);

    simulation.applyAction('make_coffee');

    expect(() => simulation.runUntil('18:24')).toThrow('Cannot run simulation backwards: 18:25 -> 18:24');
  });

  it('runs events that become due during an action', () => {
    const laterAction = { id: 'drink_coffee', at: '18:25', label: '喝咖啡', effects: [] };
    const result = simulate({
      definition: actionDefinition([makeCoffee, laterAction], [emptyEvent('evt_1822', '18:22')]),
      initialState,
      actions: ['make_coffee', 'drink_coffee'],
      until: '18:25',
    });

    expect(result.history.map((entry) => `${entry.kind}:${entry.actionId ?? entry.eventId}`)).toEqual([
      'player-action:make_coffee',
      'event:evt_1822',
      'player-action:drink_coffee',
    ]);
  });

  it('runs a later action after an earlier scheduled event', () => {
    const laterAction = { id: 'go_home', at: '18:23', label: '回家', effects: [] };
    const result = simulate({
      definition: actionDefinition([laterAction], [emptyEvent('evt_1822', '18:22')]),
      initialState,
      actions: ['go_home'],
      until: '18:23',
    });

    expect(result.history.map((entry) => `${entry.kind}:${entry.actionId ?? entry.eventId}`)).toEqual([
      'event:evt_1822',
      'player-action:go_home',
    ]);
  });

  it('keeps end-time events after same-minute actions', () => {
    const endTimeAction = { id: 'serve_coffee', at: '18:25', label: '端咖啡', effects: [] };
    const result = simulate({
      definition: actionDefinition([makeCoffee, endTimeAction], [emptyEvent('evt_1825', '18:25')]),
      initialState,
      actions: ['make_coffee', 'serve_coffee'],
      until: '18:25',
    });

    expect(result.history.map((entry) => `${entry.kind}:${entry.actionId ?? entry.eventId}`)).toEqual([
      'player-action:make_coffee',
      'player-action:serve_coffee',
      'event:evt_1825',
    ]);
    expect(result.history[0]).toEqual(expect.objectContaining({ endTime: '18:25', durationMinutes: 5 }));
  });

  it('rejects an action that starts before the occupied cursor', () => {
    const overlappingAction = { id: 'leave_kitchen', at: '18:24', label: '離開廚房', effects: [] };
    const simulation = createSimulation(actionDefinition([makeCoffee, overlappingAction]), initialState);

    simulation.applyAction('make_coffee');

    expect(() => simulation.applyAction('leave_kitchen'))
      .toThrow('Action leave_kitchen cannot start at 18:24 before current time 18:25');
  });

  it('allows multiple zero-duration actions at the same minute', () => {
    const result = simulate({
      definition,
      initialState,
      actions: ['protect_wakaharu', 'stop_doctor'],
      until: '18:20',
    });

    expect(result.history.map((entry) => ({
      actionId: entry.actionId,
      durationMinutes: entry.durationMinutes,
      endTime: entry.endTime,
    }))).toEqual([
      { actionId: 'protect_wakaharu', durationMinutes: 0, endTime: '18:20' },
      { actionId: 'stop_doctor', durationMinutes: 0, endTime: '18:20' },
    ]);
  });

  it('defaults missing duration to zero', () => {
    const result = simulate({
      definition,
      initialState,
      actions: ['protect_wakaharu'],
      until: '18:20',
    });

    expect(result.history[0]).toEqual(expect.objectContaining({
      actionId: 'protect_wakaharu',
      durationMinutes: 0,
      endTime: '18:20',
    }));
  });

  it('rejects invalid durations and malformed effects', () => {
    const invalidCases: Array<{ mutate(action: any): void; message: string }> = [
      { mutate: (action) => { action.duration_minutes = -1; }, message: 'Invalid duration for action invalid_action' },
      { mutate: (action) => { action.duration_minutes = 1.5; }, message: 'Invalid duration for action invalid_action' },
      { mutate: (action) => { action.duration_minutes = '5'; }, message: 'Invalid duration for action invalid_action' },
      { mutate: (action) => { action.duration_minutes = null; }, message: 'Invalid duration for action invalid_action' },
      {
        mutate: (action) => { action.at = '23:58'; action.duration_minutes = 2; },
        message: 'Action invalid_action ends after 23:59',
      },
      { mutate: (action) => { delete action.effects; }, message: 'Effects must be an array for action invalid_action' },
      { mutate: (action) => { action.effects = {}; }, message: 'Effects must be an array for action invalid_action' },
    ];

    for (const invalidCase of invalidCases) {
      const action: any = { id: 'invalid_action', at: '18:20', label: 'Invalid', effects: [] };
      invalidCase.mutate(action);
      expect(() => createSimulation(actionDefinition([action]), initialState)).toThrow(invalidCase.message);
    }
  });

  it('rejects invalid inline actions before mutating state', () => {
    const invalidCases: Array<{ mutate(action: any): void; message: string }> = [
      { mutate: (action) => { action.duration_minutes = -1; }, message: 'Invalid duration for action inline_action' },
      { mutate: (action) => { action.duration_minutes = 1.5; }, message: 'Invalid duration for action inline_action' },
      { mutate: (action) => { action.duration_minutes = '5'; }, message: 'Invalid duration for action inline_action' },
      { mutate: (action) => { action.duration_minutes = null; }, message: 'Invalid duration for action inline_action' },
      {
        mutate: (action) => { action.at = '23:58'; action.duration_minutes = 2; },
        message: 'Action inline_action ends after 23:59',
      },
      { mutate: (action) => { delete action.effects; }, message: 'Effects must be an array for action inline_action' },
      { mutate: (action) => { action.effects = {}; }, message: 'Effects must be an array for action inline_action' },
      {
        mutate: (action) => { action.effects = [{ set: { path: 'flags.player_protected_wakaharu' } }]; },
        message: 'Malformed set effect for action inline_action',
      },
    ];

    for (const invalidCase of invalidCases) {
      const simulation = createSimulation(actionDefinition([]), initialState);
      const action: any = {
        id: 'inline_action',
        at: '18:20',
        duration_minutes: 0,
        label: 'Inline',
        effects: [{ set: { path: 'flags.player_protected_wakaharu', value: true } }],
      };
      invalidCase.mutate(action);

      expect(() => simulation.applyAction(action)).toThrow(invalidCase.message);
      expect(simulation.getState()).toEqual(initialState);
      expect(simulation.getHistory()).toEqual([]);
    }
  });

  it('validates an inline action before processing queued events', () => {
    const queuedEvent = emptyEvent('evt_1821', '18:21');
    queuedEvent.variants[0].effects = [{ set: { path: 'flags.player_protected_wakaharu', value: true } }];
    const simulation = createSimulation(actionDefinition([], [queuedEvent]), initialState);
    const invalidAction: any = {
      id: 'inline_action',
      at: '18:22',
      duration_minutes: -1,
      label: 'Inline',
      effects: [],
    };

    expect(() => simulation.applyAction(invalidAction)).toThrow('Invalid duration for action inline_action');
    expect(simulation.getState()).toEqual(initialState);
    expect(simulation.getHistory()).toEqual([]);
    expect(simulation.getPendingEvents()).toHaveLength(1);
  });

  it('rejects malformed nested effect shapes', () => {
    const invalidEffects: Array<{ effect: unknown; message: string }> = [
      {
        effect: {
          set: { path: 'flags.player_protected_wakaharu', value: true },
          add_flag: 'flags.player_protected_wakaharu',
        },
        message: 'Effect must contain exactly one operation for action invalid_action',
      },
      {
        effect: { add_flag: 'flags.player_protected_wakaharu', note: 'extra operation' },
        message: 'Effect must contain exactly one operation for action invalid_action',
      },
      { effect: { set: null }, message: 'Malformed set effect for action invalid_action' },
      {
        effect: { set: { path: 'flags.player_protected_wakaharu' } },
        message: 'Malformed set effect for action invalid_action',
      },
      { effect: { set: { path: 42, value: true } }, message: 'Malformed set effect for action invalid_action' },
      { effect: { add_flag: 42 }, message: 'Malformed add_flag effect for action invalid_action' },
      {
        effect: { add_flag: { path: 'flags.player_protected_wakaharu', typo: true } },
        message: 'Malformed add_flag effect for action invalid_action',
      },
      { effect: { emit_event: null }, message: 'Malformed emit_event effect for action invalid_action' },
      { effect: { emit_event: {} }, message: 'Malformed emit_event effect for action invalid_action' },
      { effect: { emit_event: { event_id: 42 } }, message: 'Malformed emit_event effect for action invalid_action' },
      {
        effect: { emit_event: { event_id: 'evt_valid', at: 42 } },
        message: 'Malformed emit_event effect for action invalid_action',
      },
      {
        effect: { emit_event: { event_id: 'evt_valid', at: '' } },
        message: 'Invalid time: ',
      },
    ];

    for (const invalid of invalidEffects) {
      const action: any = { id: 'invalid_action', at: '18:20', label: 'Invalid', effects: [invalid.effect] };
      expect(() => createSimulation(
        actionDefinition([action], [emptyEvent('evt_valid', '18:30')]),
        initialState,
      )).toThrow(invalid.message);
    }
  });

  it('rejects unknown keys in stored set payloads', () => {
    const action: any = {
      id: 'invalid_action',
      at: '18:20',
      label: 'Invalid',
      effects: [{
        set: {
          path: 'flags.player_protected_wakaharu',
          value: true,
          typo: true,
        },
      }],
    };

    expect(() => createSimulation(actionDefinition([action]), initialState))
      .toThrow('Malformed set effect for action invalid_action');
  });

  it('rejects unknown inline emit-event keys before any mutation', () => {
    const emittedEvent = emptyEvent('evt_valid', '18:30');
    delete emittedEvent.at;
    const simulation = createSimulation(actionDefinition([], [emittedEvent]), initialState);
    const action: any = {
      id: 'inline_action',
      at: '18:20',
      label: 'Inline',
      effects: [
        { set: { path: 'flags.player_protected_wakaharu', value: true } },
        { emit_event: { event_id: 'evt_valid', att: '18:30' } },
      ],
    };

    expect(() => simulation.applyAction(action))
      .toThrow('Malformed emit_event effect for action inline_action');
    expect(simulation.getState()).toEqual(initialState);
    expect(simulation.getHistory()).toEqual([]);
    expect(simulation.getPendingEvents()).toEqual([]);
  });

  it('repeats the same action sequence deterministically', () => {
    const laterAction = { id: 'drink_coffee', at: '18:25', label: '喝咖啡', effects: [] };
    const input = {
      definition: actionDefinition([makeCoffee, laterAction], [emptyEvent('evt_1822', '18:22')]),
      initialState,
      actions: ['make_coffee', 'drink_coffee'],
      until: '18:25',
    };

    const first = simulate(input);
    const second = simulate(input);

    expect(first).toEqual(second);
    expect(first.history.map((entry) => [entry.kind, entry.time, entry.endTime])).toEqual([
      ['player-action', '18:20', '18:25'],
      ['event', '18:22', undefined],
      ['player-action', '18:25', '18:25'],
    ]);
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
