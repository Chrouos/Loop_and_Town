import yaml from 'js-yaml';
import type {
  ActionDefinition,
  EventDefinition,
  LoopDefinition,
  ScheduleDefinition,
  SimulationDefinition,
  WorldState,
} from '../simulator/types';
import { validateDefinition } from '../simulator/validation';

export type StoryManifest = {
  loop: string;
  world: string;
  schedules: string[];
  actions: string;
  events: string[];
  worldlines: string;
};

export type WorldlineDefinition = {
  id: string;
  title: string;
  actionIds: string[];
};

export type StoryBundle = {
  loop: LoopDefinition;
  initialState: WorldState;
  schedules: ScheduleDefinition[];
  definition: SimulationDefinition;
  worldlines: WorldlineDefinition[];
};

async function loadYaml(path: string): Promise<unknown> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
  return yaml.load(await response.text());
}

function asManifest(value: unknown): StoryManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid story manifest');
  const record = value as Record<string, unknown>;
  if (
    typeof record.loop !== 'string'
    || typeof record.world !== 'string'
    || !Array.isArray(record.schedules)
    || typeof record.actions !== 'string'
    || !Array.isArray(record.events)
    || typeof record.worldlines !== 'string'
  ) throw new Error('Invalid story manifest');
  return record as unknown as StoryManifest;
}

function normalizeSchedule(value: unknown): ScheduleDefinition {
  const record = value as { character_id?: unknown; characterId?: unknown; entries?: unknown };
  const characterId = record.characterId ?? record.character_id;
  if (typeof characterId !== 'string' || !Array.isArray(record.entries)) throw new Error('Invalid schedule document');
  return { characterId, entries: record.entries as ScheduleDefinition['entries'] };
}

function normalizeWorldlines(value: unknown): WorldlineDefinition[] {
  const entries = (value as { worldlines?: unknown })?.worldlines;
  if (!Array.isArray(entries)) throw new Error('Invalid worldline document');
  return entries.map((item) => {
    const record = item as { id?: unknown; title?: unknown; action_ids?: unknown; actionIds?: unknown };
    const actionIds = record.actionIds ?? record.action_ids;
    if (typeof record.id !== 'string' || typeof record.title !== 'string' || !Array.isArray(actionIds)) {
      throw new Error('Invalid worldline definition');
    }
    return { id: record.id, title: record.title, actionIds: actionIds.map(String) };
  });
}

export function buildStoryBundleFromDocuments(input: {
  loop: unknown;
  initialState: unknown;
  schedules: unknown[];
  actions: unknown;
  events: unknown[];
  worldlines: unknown;
}): StoryBundle {
  const loopRecord = input.loop as { loop?: LoopDefinition };
  const loop = loopRecord?.loop ?? input.loop as LoopDefinition;
  const initialState = input.initialState as WorldState;
  const schedules = input.schedules.map(normalizeSchedule);
  const actions = (input.actions as { actions?: ActionDefinition[] })?.actions;
  if (!loop || typeof loop.id !== 'string' || !loop.range || !initialState || typeof initialState !== 'object' || !Array.isArray(actions)) {
    throw new Error('Invalid simulator story data');
  }

  const definition: SimulationDefinition = {
    loop,
    actions,
    events: input.events as EventDefinition[],
    schedules,
  };
  validateDefinition(definition, initialState);

  return {
    loop,
    initialState,
    schedules,
    definition,
    worldlines: normalizeWorldlines(input.worldlines),
  };
}

async function loadManifestStory(manifestPath: string): Promise<StoryBundle> {
  const manifest = asManifest(await loadYaml(manifestPath));
  const base = '/story/';
  const [loop, initialState, actions, worldlines, schedules, events] = await Promise.all([
    loadYaml(base + manifest.loop),
    loadYaml(base + manifest.world),
    loadYaml(base + manifest.actions),
    loadYaml(base + manifest.worldlines),
    Promise.all(manifest.schedules.map((path) => loadYaml(base + path))),
    Promise.all(manifest.events.map((path) => loadYaml(base + path))),
  ]);
  return buildStoryBundleFromDocuments({ loop, initialState, schedules, actions, events, worldlines });
}

async function loadLegacyStory(): Promise<StoryBundle> {
  const [initialState, actionsDocument, event1831, event2114] = await Promise.all([
    loadYaml('/story/world/day_01_initial.yaml'),
    loadYaml('/story/actions/day_01_actions.yaml'),
    loadYaml('/story/events/day_01_1831.yaml'),
    loadYaml('/story/events/day_01_2114.yaml'),
  ]);
  const actions = (actionsDocument as { actions?: ActionDefinition[] })?.actions;
  if (!initialState || typeof initialState !== 'object' || !Array.isArray(actions)) {
    throw new Error('Invalid simulator story data');
  }
  return {
    loop: { id: 'legacy_day_01', range: { start: '18:20', end: '23:59' } },
    initialState: initialState as WorldState,
    schedules: [],
    definition: { actions, events: [event1831, event2114] as EventDefinition[] },
    worldlines: [],
  };
}

export async function loadSimulationStory(manifestPath?: string): Promise<StoryBundle> {
  return manifestPath ? loadManifestStory(manifestPath) : loadLegacyStory();
}
