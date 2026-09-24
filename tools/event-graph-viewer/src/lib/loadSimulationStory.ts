import yaml from 'js-yaml';
import type {
  ActionDefinition,
  EventDefinition,
  LoopDefinition,
  ScheduleDefinition,
  SimulationDefinition,
  StoryTimeInput,
  WorldState,
} from '../simulator/types';
import { validateDefinition } from '../simulator/validation';
import {
  emptyNarrativeFoundation,
  type ActivityDefinition,
  type ArtifactDefinition,
  type CharacterDefinition,
  type KnowledgeFact,
  type NarrativeFoundation,
  type NarrativeSceneDefinition,
  type ProtagonistScheduleDefinition,
  type RelationshipDefinition,
} from '../narrative/types';

export type StoryManifest = {
  loop: string;
  world: string;
  schedules: string[];
  actions: string;
  events: string[];
  worldlines: string;
  characters?: string[];
  relationships?: string;
  knowledge?: string;
  activities?: string;
  protagonist_schedule?: string;
  narrative?: string;
  artifacts?: string[];
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
  narrative: NarrativeFoundation;
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

  if (record.characters !== undefined && !Array.isArray(record.characters)) throw new Error('Invalid story manifest characters');
  if (record.relationships !== undefined && typeof record.relationships !== 'string') throw new Error('Invalid story manifest relationships');
  if (record.knowledge !== undefined && typeof record.knowledge !== 'string') throw new Error('Invalid story manifest knowledge');
  if (record.activities !== undefined && typeof record.activities !== 'string') throw new Error('Invalid story manifest activities');
  if (record.protagonist_schedule !== undefined && typeof record.protagonist_schedule !== 'string') throw new Error('Invalid story manifest protagonist_schedule');
  if (record.narrative !== undefined && typeof record.narrative !== 'string') throw new Error('Invalid story manifest narrative');
  if (record.artifacts !== undefined && !Array.isArray(record.artifacts)) throw new Error('Invalid story manifest artifacts');

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

function normalizeCharacter(value: unknown): CharacterDefinition {
  if (!value || typeof value !== 'object') throw new Error('Invalid character document');
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') throw new Error('Invalid character document');
  return {
    ...(record as unknown as CharacterDefinition),
    scheduleRef: typeof record.scheduleRef === 'string'
      ? record.scheduleRef
      : typeof record.schedule_ref === 'string'
        ? record.schedule_ref
        : undefined,
  };
}

function normalizeRelationships(value: unknown): RelationshipDefinition[] {
  if (value === undefined || value === null) return [];
  const entries = (value as { relationships?: unknown })?.relationships;
  if (!Array.isArray(entries)) throw new Error('Invalid relationship document');
  return entries as RelationshipDefinition[];
}

function normalizeKnowledge(value: unknown): KnowledgeFact[] {
  if (value === undefined || value === null) return [];
  const facts = (value as { facts?: unknown })?.facts;
  if (!Array.isArray(facts)) throw new Error('Invalid knowledge document');
  return facts as KnowledgeFact[];
}

function normalizeActivities(value: unknown): ActivityDefinition[] {
  if (value === undefined || value === null) return [];
  const entries = (value as { activities?: unknown })?.activities;
  if (!Array.isArray(entries)) throw new Error('Invalid activity document');
  return entries.map((item) => {
    const record = item as Record<string, unknown>;
    const durationMinutes = record.durationMinutes ?? record.duration_minutes;
    if (typeof record.id !== 'string' || typeof durationMinutes !== 'number' || typeof record.interruptible !== 'boolean') {
      throw new Error('Invalid activity definition');
    }
    return {
      ...(record as unknown as ActivityDefinition),
      durationMinutes,
    };
  });
}

function normalizeProtagonistSchedule(value: unknown): ProtagonistScheduleDefinition {
  if (value === undefined || value === null) return emptyNarrativeFoundation().protagonistSchedule;
  const record = value as { character_id?: unknown; characterId?: unknown; entries?: unknown };
  const characterId = record.characterId ?? record.character_id;
  if (characterId !== 'protagonist' || !Array.isArray(record.entries)) throw new Error('Invalid protagonist schedule document');
  return {
    characterId: 'protagonist',
    entries: record.entries.map((item) => {
      const entry = item as { id?: unknown; at?: unknown; activity_id?: unknown; activityId?: unknown };
      const activityId = entry.activityId ?? entry.activity_id;
      if (typeof entry.id !== 'string' || entry.at === undefined || typeof activityId !== 'string') {
        throw new Error('Invalid protagonist schedule entry');
      }
      return { id: entry.id, at: entry.at as StoryTimeInput, activityId };
    }),
  };
}

function normalizeScenes(value: unknown): NarrativeSceneDefinition[] {
  if (value === undefined || value === null) return [];
  const scenes = (value as { scenes?: unknown })?.scenes;
  if (!Array.isArray(scenes)) throw new Error('Invalid narrative document');
  return scenes.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      ...(record as unknown as NarrativeSceneDefinition),
      startsActivity: typeof record.startsActivity === 'string'
        ? record.startsActivity
        : typeof record.starts_activity === 'string'
          ? record.starts_activity
          : undefined,
      artifactId: typeof record.artifactId === 'string'
        ? record.artifactId
        : typeof record.artifact_id === 'string'
          ? record.artifact_id
          : undefined,
    };
  });
}

function normalizeArtifact(value: unknown): ArtifactDefinition {
  if (!value || typeof value !== 'object') throw new Error('Invalid artifact document');
  const record = value as Record<string, unknown>;
  const formedAt = record.formedAt ?? record.formed_at;
  if (typeof record.id !== 'string' || typeof record.kind !== 'string' || formedAt === undefined || !Array.isArray(record.content)) {
    throw new Error('Invalid artifact document');
  }
  return {
    ...(record as unknown as ArtifactDefinition),
    formedAt: formedAt as StoryTimeInput,
  };
}

function buildNarrativeFoundation(input: {
  characters?: unknown[];
  relationships?: unknown;
  knowledge?: unknown;
  activities?: unknown;
  protagonistSchedule?: unknown;
  narrative?: unknown;
  artifacts?: unknown[];
}): NarrativeFoundation {
  return {
    characters: (input.characters ?? []).map(normalizeCharacter),
    relationships: normalizeRelationships(input.relationships),
    knowledgeFacts: normalizeKnowledge(input.knowledge),
    activities: normalizeActivities(input.activities),
    protagonistSchedule: normalizeProtagonistSchedule(input.protagonistSchedule),
    scenes: normalizeScenes(input.narrative),
    artifacts: (input.artifacts ?? []).map(normalizeArtifact),
  };
}

export function buildStoryBundleFromDocuments(input: {
  loop: unknown;
  initialState: unknown;
  schedules: unknown[];
  actions: unknown;
  events: unknown[];
  worldlines: unknown;
  characters?: unknown[];
  relationships?: unknown;
  knowledge?: unknown;
  activities?: unknown;
  protagonistSchedule?: unknown;
  narrative?: unknown;
  artifacts?: unknown[];
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
    narrative: buildNarrativeFoundation(input),
  };
}

async function loadManifestStory(manifestPath: string): Promise<StoryBundle> {
  const manifest = asManifest(await loadYaml(manifestPath));
  const base = '/story/';
  const [loop, initialState, actions, worldlines, schedules, events, characters, relationships, knowledge, activities, protagonistSchedule, narrative, artifacts] = await Promise.all([
    loadYaml(base + manifest.loop),
    loadYaml(base + manifest.world),
    loadYaml(base + manifest.actions),
    loadYaml(base + manifest.worldlines),
    Promise.all(manifest.schedules.map((path) => loadYaml(base + path))),
    Promise.all(manifest.events.map((path) => loadYaml(base + path))),
    manifest.characters ? Promise.all(manifest.characters.map((path) => loadYaml(base + path))) : Promise.resolve([]),
    manifest.relationships ? loadYaml(base + manifest.relationships) : Promise.resolve(undefined),
    manifest.knowledge ? loadYaml(base + manifest.knowledge) : Promise.resolve(undefined),
    manifest.activities ? loadYaml(base + manifest.activities) : Promise.resolve(undefined),
    manifest.protagonist_schedule ? loadYaml(base + manifest.protagonist_schedule) : Promise.resolve(undefined),
    manifest.narrative ? loadYaml(base + manifest.narrative) : Promise.resolve(undefined),
    manifest.artifacts ? Promise.all(manifest.artifacts.map((path) => loadYaml(base + path))) : Promise.resolve([]),
  ]);
  return buildStoryBundleFromDocuments({
    loop,
    initialState,
    schedules,
    actions,
    events,
    worldlines,
    characters,
    relationships,
    knowledge,
    activities,
    protagonistSchedule,
    narrative,
    artifacts,
  });
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
    narrative: emptyNarrativeFoundation(),
  };
}

export async function loadSimulationStory(manifestPath?: string): Promise<StoryBundle> {
  return manifestPath ? loadManifestStory(manifestPath) : loadLegacyStory();
}
