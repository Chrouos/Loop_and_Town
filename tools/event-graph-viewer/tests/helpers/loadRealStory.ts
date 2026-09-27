import yaml from 'js-yaml';
import { buildStoryBundleFromDocuments } from '../../src/lib/loadSimulationStory';
import type { NarrativeSceneDefinition } from '../../src/narrative/types';

const rawFiles = import.meta.glob('../../../../story/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function parse(suffix: string): unknown {
  const key = Object.keys(rawFiles).find((candidate) => candidate.endsWith(suffix));
  if (!key) throw new Error(`Missing real story file: ${suffix}`);
  return yaml.load(rawFiles[key]);
}

function parseScenes(suffix: string): NarrativeSceneDefinition[] {
  const document = parse(suffix) as { scenes?: NarrativeSceneDefinition[] };
  if (!Array.isArray(document.scenes)) throw new Error(`Invalid narrative addendum: ${suffix}`);
  return document.scenes;
}

export function loadRealStory() {
  const manifest = parse('/manifests/loop_01.yaml') as {
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
    player_choices?: string;
    travel?: string;
  };

  const story = buildStoryBundleFromDocuments({
    loop: parse('/' + manifest.loop),
    initialState: parse('/' + manifest.world),
    schedules: manifest.schedules.map((path) => parse('/' + path)),
    actions: parse('/' + manifest.actions),
    events: manifest.events.map((path) => parse('/' + path)),
    worldlines: parse('/' + manifest.worldlines),
    characters: manifest.characters?.map((path) => parse('/' + path)),
    relationships: manifest.relationships ? parse('/' + manifest.relationships) : undefined,
    knowledge: manifest.knowledge ? parse('/' + manifest.knowledge) : undefined,
    activities: manifest.activities ? parse('/' + manifest.activities) : undefined,
    protagonistSchedule: manifest.protagonist_schedule ? parse('/' + manifest.protagonist_schedule) : undefined,
    narrative: manifest.narrative ? parse('/' + manifest.narrative) : undefined,
    artifacts: manifest.artifacts?.map((path) => parse('/' + path)),
    playerChoices: manifest.player_choices ? parse('/' + manifest.player_choices) : undefined,
    travel: manifest.travel ? parse('/' + manifest.travel) : undefined,
  });

  story.narrative.scenes.push(
    ...parseScenes('/narrative/loop_02_player.yaml'),
    ...parseScenes('/narrative/loop_03_player.yaml'),
    ...parseScenes('/narrative/loop_04_player.yaml'),
  );
  return story;
}
