import { afterEach, expect, it, vi } from 'vitest';
import { loadAuthorStoryBundle } from '../src/lib/loadAuthorStoryBundle';

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
  'story/narrative/legacy.yaml': 'scenes:\n  - id: scene_legacy\n    at: { day: 0, time: "06:12" }\n    blocks: []\n',
  'story/narrative/extra.yaml': 'scenes:\n  - id: scene_extra\n    at: { day: 0, time: "07:20" }\n    blocks: []\n',
  'story/narrative/duplicate.yaml': 'scenes:\n  - id: scene_legacy\n    at: { day: 0, time: "07:20" }\n    blocks: []\n',
  'story/events/test_dag.yaml': 'id: test_dag\ntitle: Test DAG\nnodes:\n  - id: N01\n    title: Start\n    visibility: public\n    detail:\n      narrative_refs: [scene_legacy]\nedges: []\n',
  'story/events/missing_ref_dag.yaml': 'id: missing_ref_dag\ntitle: Missing Ref\nnodes:\n  - id: N01\n    title: Start\n    visibility: public\n    detail:\n      narrative_refs: [scene_missing]\nedges: []\n',
  'story/worldlines/test_paths.yaml': 'paths:\n  - id: path_test\n    label: Test\n    node_ids: [N01]\n    edge_ids: []\n    visibility: public\n',
  'story/worldlines/invalid_paths.yaml': 'paths:\n  - id: path_invalid\n    label: Invalid\n    node_ids: [N_missing]\n    edge_ids: []\n    visibility: public\n',
};

function manifest(extra: string[] = [], dag = 'story/events/test_dag.yaml', paths = 'story/worldlines/test_paths.yaml'): string {
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
    'narrative: narrative/legacy.yaml',
    extra.length ? `narratives: [${extra.join(', ')}]` : '',
    `story_dags: [${dag}]`,
    `worldline_paths: [${paths}]`,
  ].filter(Boolean).join('\n') + '\n';
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

it('keeps legacy single-narrative manifests valid', async () => {
  const fetchMock = stubFetch({
    ...commonFiles,
    'story/manifests/test.yaml': manifest(),
  });

  const bundle = await loadAuthorStoryBundle('story/manifests/test.yaml');

  expect(bundle.narratives.map((scene) => scene.id)).toEqual(['scene_legacy']);
  expect(bundle.storyDags.map((dag) => dag.id)).toEqual(['test_dag']);
  expect(fetchMock.mock.calls.filter(([input]) => String(input) === 'story/narrative/legacy.yaml')).toHaveLength(1);
});

it('loads multiple narratives and validates cross-document references', async () => {
  const fetchMock = stubFetch({
    ...commonFiles,
    'story/manifests/test.yaml': manifest(['narrative/extra.yaml']),
  });

  const bundle = await loadAuthorStoryBundle('story/manifests/test.yaml');

  expect(bundle.narratives.map((scene) => scene.id)).toEqual(['scene_legacy', 'scene_extra']);
  expect(bundle.worldlinePaths[0].nodeIds).toEqual(['N01']);
  for (const path of ['story/narrative/legacy.yaml', 'story/narrative/extra.yaml', 'story/events/test_dag.yaml', 'story/worldlines/test_paths.yaml']) {
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === path)).toHaveLength(1);
  }
});

it('rejects duplicate narrative scene IDs before rendering', async () => {
  stubFetch({
    ...commonFiles,
    'story/manifests/test.yaml': manifest(['narrative/duplicate.yaml']),
  });

  await expect(loadAuthorStoryBundle('story/manifests/test.yaml')).rejects.toThrow('Duplicate narrative scene id: scene_legacy');
});

it('reports missing story documents with their source path', async () => {
  stubFetch({
    ...commonFiles,
    'story/manifests/test.yaml': manifest([], 'events/missing.yaml'),
  });

  await expect(loadAuthorStoryBundle('story/manifests/test.yaml')).rejects.toThrow('story/events/missing.yaml');
});

it('rejects unresolved narrative references', async () => {
  stubFetch({
    ...commonFiles,
    'story/manifests/test.yaml': manifest([], 'events/missing_ref_dag.yaml'),
  });

  await expect(loadAuthorStoryBundle('story/manifests/test.yaml')).rejects.toThrow('scene_missing');
});

it('rejects worldline paths that reference unknown DAG nodes', async () => {
  stubFetch({
    ...commonFiles,
    'story/manifests/test.yaml': manifest([], 'events/test_dag.yaml', 'worldlines/invalid_paths.yaml'),
  });

  await expect(loadAuthorStoryBundle('story/manifests/test.yaml')).rejects.toThrow('path_invalid');
});
