import yaml from 'js-yaml';
import { buildStoryBundleFromDocuments } from '../../src/lib/loadSimulationStory';

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

export function loadRealStory() {
  const manifest = parse('/manifests/loop_01.yaml') as {
    loop: string;
    world: string;
    schedules: string[];
    actions: string;
    events: string[];
    worldlines: string;
  };

  return buildStoryBundleFromDocuments({
    loop: parse('/' + manifest.loop),
    initialState: parse('/' + manifest.world),
    schedules: manifest.schedules.map((path) => parse('/' + path)),
    actions: parse('/' + manifest.actions),
    events: manifest.events.map((path) => parse('/' + path)),
    worldlines: parse('/' + manifest.worldlines),
  });
}
