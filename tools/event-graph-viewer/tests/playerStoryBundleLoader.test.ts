import { afterEach, expect, it, vi } from 'vitest';
import { loadPlayerStoryBundle } from '../src/lib/loadPlayerStoryBundle';

const commonFiles: Record<string, string> = {
  'story/loops/test.yaml': 'id: test\nrange: { start: "06:12", end: { day: 1, time: "00:00" } }\n',
  'story/world/test.yaml': 'clock: { day: 0, time: "06:12" }\nflags: {}\n',
  'story/actions/test.yaml': 'actions: []\n',
  'story/worldlines/test.yaml': 'worldlines: []\n',
  'story/characters/protagonist.yaml': 'id: protagonist\nname: 主角\nidentity: {}\nbackground: { summary: test, history: [] }\npersonality: { traits: [], habits: [], dislikes: [] }\nspeech: { tone: quiet, calls: {} }\nknowledge: { initial: [], hidden: [] }\nsecrets: []\n',
  'story/relationships/test.yaml': 'relationships: []\n',
  'story/knowledge/test.yaml': 'facts: []\n',
  'story/activities/test.yaml': 'activities: []\n',
  'story/schedules/test.yaml': 'character_id: protagonist\nentries: []\n',
  'story/narrative/loop_01_player.yaml': 'scenes:\n  - id: scene_loop_01\n    at: { day: 0, time: "06:12" }\n    kind: narration\n    participants: [protagonist]\n    blocks:\n      - { type: narration, text: "第一圈" }\n',
  'story/narrative/loop_02_player.yaml': 'scenes:\n  - id: scene_loop_02\n    at: { day: 0, time: "06:20" }\n    kind: narration\n    participants: [protagonist]\n    blocks:\n      - { type: narration, text: "第二圈" }\n',
  'story/artifacts/letter.yaml': 'id: letter\nkind: letter\nformed_at: "07:00"\ncontent: ["內容"]\n',
};

function manifest(extra = 'narrative/loop_02_player.yaml'): string {
  return [
    'loop: loops/test.yaml',
    'world: world/test.yaml',
    'schedules: [schedules/test.yaml]',
    'actions: actions/test.yaml',
    'events: []',
    'worldlines: worldlines/test.yaml',
    'characters: [characters/protagonist.yaml]',
    'relationships: relationships/test.yaml',
    'knowledge: knowledge/test.yaml',
    'activities: activities/test.yaml',
    'protagonist_schedule: schedules/test.yaml',
    'narrative: narrative/loop_01_player.yaml',
    `narratives: [${extra}]`,
    'story_dags: [events/author_only.yaml]',
    'worldline_paths: [worldlines/author_only.yaml]',
    'artifacts: [artifacts/letter.yaml]',
  ].join('\n') + '\n';
}

function stubFetch(files: Record<string, string>) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const path = String(input);
    return new Response(files[path] ?? '', { status: files[path] === undefined ? 404 : 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

it('loads player narrative documents and artifacts without author-only files', async () => {
  const fetchMock = stubFetch({
    ...commonFiles,
    'story/manifests/test.yaml': manifest(),
  });

  const bundle = await loadPlayerStoryBundle('story/manifests/test.yaml');

  expect(bundle.narrativeDocuments.map((document) => document.loopId)).toEqual([1, 2]);
  expect(bundle.narrativeDocuments[0].scenes.map((scene) => scene.id)).toEqual(['scene_loop_01']);
  expect(bundle.narrativeDocuments[1].scenes.map((scene) => scene.id)).toEqual(['scene_loop_02']);
  expect(bundle.artifacts.map((artifact) => artifact.id)).toEqual(['letter']);
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes('story_dags'))).toBe(false);
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes('worldline_paths'))).toBe(false);
});

it('rejects duplicate scene IDs across player narrative documents', async () => {
  const fetchMock = stubFetch({
    ...commonFiles,
    'story/manifests/test.yaml': manifest('narrative/loop_02_player.yaml'),
    'story/narrative/loop_02_player.yaml': 'scenes:\n  - id: scene_loop_01\n    at: { day: 0, time: "06:20" }\n    kind: narration\n    participants: [protagonist]\n    blocks: []\n',
  });

  await expect(loadPlayerStoryBundle('story/manifests/test.yaml'))
    .rejects.toThrow('Duplicate player narrative scene id: scene_loop_01');
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes('story_dags'))).toBe(false);
});

it('reports a missing player narrative source path', async () => {
  stubFetch({
    ...commonFiles,
    'story/manifests/test.yaml': manifest('narrative/loop_03_player.yaml'),
  });

  await expect(loadPlayerStoryBundle('story/manifests/test.yaml'))
    .rejects.toThrow('story/narrative/loop_03_player.yaml');
});
