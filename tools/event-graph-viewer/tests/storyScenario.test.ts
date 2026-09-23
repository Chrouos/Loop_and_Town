import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { simulate } from '../src/simulator/simulator';
import type { ActionDefinition, EventDefinition, SimulationDefinition, WorldState } from '../src/simulator/types';

async function loadYaml<T>(relativePath: string): Promise<T> {
  const text = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  return yaml.load(text) as T;
}

async function loadCanonicalStory(): Promise<{ initialState: WorldState; definition: SimulationDefinition }> {
  const [initialState, actionsDocument, event1831, event2114] = await Promise.all([
    loadYaml<WorldState>('../../../story/world/day_01_initial.yaml'),
    loadYaml<{ actions: ActionDefinition[] }>('../../../story/actions/day_01_actions.yaml'),
    loadYaml<EventDefinition>('../../../story/events/day_01_1831.yaml'),
    loadYaml<EventDefinition>('../../../story/events/day_01_2114.yaml'),
  ]);

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
  ])('resolves $actions to $station and reporter=$reporter', async ({ actions, station, reporter, reporterEvent }) => {
    const { initialState, definition } = await loadCanonicalStory();
    const result = simulate({ definition, initialState, actions, until: '23:59' });
    const events = result.history.filter((entry) => entry.kind === 'event');

    expect(events.find((entry) => entry.eventId === 'evt_1831_station')?.variantId).toBe(station);
    expect(((result.state.characters as Record<string, any>).reporter).status).toBe(reporter);
    expect(events.some((entry) => entry.eventId === 'evt_2114_reporter_missing')).toBe(reporterEvent);
  });
});
