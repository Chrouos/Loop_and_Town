import { afterEach, expect, it, vi } from 'vitest';
import { buildStoryBundleFromDocuments, loadSimulationStory } from '../src/lib/loadSimulationStory';

const files: Record<string, string> = {
  'story/manifests/loop_01.yaml': [
    'loop: loops/loop_01.yaml',
    'world: world/loop_01_initial.yaml',
    'schedules:',
    '  - schedules/doctor.yaml',
    'actions: actions/loop_01_actions.yaml',
    'events:',
    '  - events/loop_01_1831.yaml',
    'worldlines: worldlines/loop_01_worldlines.yaml',
    '',
  ].join('\n'),
  'story/loops/loop_01.yaml': [
    'id: gray_tide_loop_01',
    'range:',
    '  start: "14:20"',
    '  end: { day: 1, time: "00:00" }',
    '',
  ].join('\n'),
  'story/world/loop_01_initial.yaml': 'clock: { day: 0, time: "14:20" }\nflags: { x: false }\ncharacters: { doctor: { route: old_station, location: hospital } }\n',
  'story/schedules/doctor.yaml': 'character_id: doctor\nentries: []\n',
  'story/actions/loop_01_actions.yaml': 'actions: []\n',
  'story/events/loop_01_1831.yaml': [
    'id: evt_1831_station',
    'title: station',
    'at: "18:31"',
    'visibility: observable',
    'variants:',
    '  - { id: fallback, priority: 0, fallback: true, effects: [] }',
    '',
  ].join('\n'),
  'story/worldlines/loop_01_worldlines.yaml': 'worldlines:\n  - { id: WL-00, title: Baseline, action_ids: [] }\n',
};

afterEach(() => vi.unstubAllGlobals());

it('builds a StoryBundle from manifest references', async () => {
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const path = String(input);
    return new Response(files[path] ?? '', { status: files[path] ? 200 : 404 });
  });

  const story = await loadSimulationStory('story/manifests/loop_01.yaml');
  expect(story.loop.id).toBe('gray_tide_loop_01');
  expect(story.schedules[0].characterId).toBe('doctor');
  expect(story.worldlines[0]).toEqual(expect.objectContaining({ id: 'WL-00', actionIds: [] }));
  expect(story.definition.loop?.id).toBe('gray_tide_loop_01');
});

it('rejects duplicate event ids across authored documents', () => {
  const loop = { id: 'loop', range: { start: '14:20', end: '23:59' } };
  const initialState = { clock: { day: 0, time: '14:20' }, flags: { x: false } };
  const duplicate = {
    id: 'duplicate', title: 'duplicate', at: '18:31', visibility: 'observable',
    variants: [{ id: 'fallback', priority: 0, fallback: true, effects: [] }],
  };

  expect(() => buildStoryBundleFromDocuments({
    loop,
    initialState,
    schedules: [],
    actions: { actions: [] },
    events: [duplicate, structuredClone(duplicate)],
    worldlines: { worldlines: [] },
  })).toThrow('Duplicate Event ID: duplicate');
});
