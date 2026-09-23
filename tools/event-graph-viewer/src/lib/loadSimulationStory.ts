import yaml from 'js-yaml';
import type { ActionDefinition, EventDefinition, SimulationDefinition, WorldState } from '../simulator/types';

async function loadYaml(path: string): Promise<unknown> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
  return yaml.load(await response.text());
}

export async function loadSimulationStory(): Promise<{
  initialState: WorldState;
  definition: SimulationDefinition;
}> {
  const [initialState, actionsDocument, event1831, event2114] = await Promise.all([
    loadYaml('story/world/day_01_initial.yaml'),
    loadYaml('story/actions/day_01_actions.yaml'),
    loadYaml('story/events/day_01_1831.yaml'),
    loadYaml('story/events/day_01_2114.yaml'),
  ]);

  const actions = (actionsDocument as { actions?: ActionDefinition[] })?.actions;
  if (!initialState || typeof initialState !== 'object' || !Array.isArray(actions)) {
    throw new Error('Invalid simulator story data');
  }

  return {
    initialState: initialState as WorldState,
    definition: {
      actions,
      events: [event1831, event2114] as EventDefinition[],
    },
  };
}
