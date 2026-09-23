import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import actionsText from '../../../story/actions/day_01_actions.yaml?raw';
import event1831Text from '../../../story/events/day_01_1831.yaml?raw';
import event2114Text from '../../../story/events/day_01_2114.yaml?raw';
import initialStateText from '../../../story/world/day_01_initial.yaml?raw';
import { simulate } from '../src/simulator/simulator';
import type { ActionDefinition, EventDefinition, SimulationDefinition, WorldState } from '../src/simulator/types';

function loadCanonicalStory(): { initialState: WorldState; definition: SimulationDefinition } {
  const initialState = yaml.load(initialStateText) as WorldState;
  const actionsDocument = yaml.load(actionsText) as { actions: ActionDefinition[] };
  const event1831 = yaml.load(event1831Text) as EventDefinition;
  const event2114 = yaml.load(event2114Text) as EventDefinition;

  return {
    initialState,
    definition: {
      actions: actionsDocument.actions,
      events: [event1831, event2114],
    },
  };
}

describe('canonical story worldlines', () => {
  it.each([
    { actions: [], station: 'wakaharu_dies', reporter: 'missing', reporterEvent: true },
    { actions: ['protect_wakaharu'], station: 'doctor_dies', reporter: 'alive', reporterEvent: false },
    { actions: ['stop_doctor'], station: 'wakaharu_dies', reporter: 'missing', reporterEvent: true },
    { actions: ['protect_wakaharu', 'stop_doctor'], station: 'no_death', reporter: 'alive', reporterEvent: false },
  ])('resolves $actions to $station and reporter=$reporter', ({ actions, station, reporter, reporterEvent }) => {
    const { initialState, definition } = loadCanonicalStory();
    const result = simulate({ definition, initialState, actions, until: '23:59' });
    const events = result.history.filter((entry) => entry.kind === 'event');

    expect(events.find((entry) => entry.eventId === 'evt_1831_station')?.variantId).toBe(station);
    expect(((result.state.characters as Record<string, any>).reporter).status).toBe(reporter);
    expect(events.some((entry) => entry.eventId === 'evt_2114_reporter_missing')).toBe(reporterEvent);
  });
});
