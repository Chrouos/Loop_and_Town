import { expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';
import { parseStoryDagText } from '../src/lib/loadStory';

const dagFiles = import.meta.glob('../../../story/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

it('uses the canonical 06:12 opening and preserves the fixed convergence boundaries', () => {
  const story = loadRealStory();
  expect(story.loop.range.start).toEqual({ day: 0, time: '06:12' });
  expect(story.initialState.clock).toEqual({ day: 0, time: '06:12' });
  expect(story.loop.range.end).toEqual({ day: 1, time: '00:00' });

  const scenes = new Map(story.narrative.scenes.map((scene) => [scene.id, scene]));
  expect(scenes.get('prologue_arrival')?.at).toEqual({ day: 0, time: '06:12' });
  expect(scenes.get('prologue_letter_discovery')?.at).toEqual({ day: 0, time: '09:00' });
  expect(scenes.get('loop02_1420_reset_awareness')?.at).toEqual({ day: 0, time: '14:20' });
  expect(scenes.get('loop03_1420_third_awake')?.at).toEqual({ day: 0, time: '14:20' });
  expect(scenes.get('loop02_2359_bell_again')?.at).toEqual({ day: 0, time: '23:59' });
  expect(scenes.get('loop02_0000_reset_again')?.at).toEqual({ day: 1, time: '00:00' });

  const dagKey = Object.keys(dagFiles).find((candidate) => candidate.endsWith('/story/events/day_01_story_dag.yaml'));
  expect(dagKey).toBeDefined();
  const dag = parseStoryDagText(dagFiles[dagKey!]);
  expect(dag.nodes.find((node) => node.id === 'N00_arrival_graytide')?.time).toBe('14:20');
});
