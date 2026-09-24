import { afterEach, expect, it, vi } from 'vitest';
import { buildStoryBundleFromDocuments, loadSimulationStory } from '../src/lib/loadSimulationStory';

function minimalDocuments() {
  return {
    loop: { id: 'loop', range: { start: '14:20', end: { day: 1, time: '00:00' } } },
    initialState: { clock: { day: 0, time: '14:20' }, flags: {} },
    schedules: [],
    actions: { actions: [] },
    events: [],
    worldlines: { worldlines: [] },
    characters: [{
      id: 'protagonist',
      name: '主角',
      identity: {},
      background: { summary: '回鄉整理老家準備出售', history: [] },
      personality: { traits: [], habits: [], dislikes: [] },
      speech: { tone: 'quiet', calls: {} },
      knowledge: { initial: [], hidden: [] },
      secrets: [],
    }],
    relationships: { relationships: [] },
    knowledge: { facts: [{ id: 'fact_zhixia_dead_five_years', summary: '林知夏五年前死亡' }] },
    activities: { activities: [] },
    protagonistSchedule: { character_id: 'protagonist', entries: [] },
    narrative: { scenes: [] },
    artifacts: [],
  };
}

afterEach(() => vi.unstubAllGlobals());

it('loads narrative documents beside simulation data', () => {
  const bundle = buildStoryBundleFromDocuments(minimalDocuments());
  expect(bundle.narrative.characters.map((item) => item.id)).toEqual(['protagonist']);
  expect(bundle.narrative.knowledgeFacts.map((item) => item.id)).toEqual(['fact_zhixia_dead_five_years']);
  expect(bundle.narrative.protagonistSchedule.characterId).toBe('protagonist');
});

it('fetches each narrative manifest reference exactly once', async () => {
  const files: Record<string, string> = {
    'story/manifests/test.yaml': [
      'loop: loops/loop_01.yaml',
      'world: world/loop_01_initial.yaml',
      'schedules: []',
      'actions: actions/loop_01_actions.yaml',
      'events: []',
      'worldlines: worldlines/loop_01_worldlines.yaml',
      'characters:',
      '  - characters/protagonist.yaml',
      'relationships: relationships/loop_01.yaml',
      'knowledge: knowledge/facts.yaml',
      'activities: activities/protagonist.yaml',
      'protagonist_schedule: schedules/protagonist.yaml',
      'narrative: narrative/loop_01_prologue.yaml',
      'artifacts:',
      '  - artifacts/zhixia_letter.yaml',
      '',
    ].join('\n'),
    'story/loops/loop_01.yaml': 'id: loop\nrange: { start: "14:20", end: { day: 1, time: "00:00" } }\n',
    'story/world/loop_01_initial.yaml': 'clock: { day: 0, time: "14:20" }\nflags: {}\n',
    'story/actions/loop_01_actions.yaml': 'actions: []\n',
    'story/worldlines/loop_01_worldlines.yaml': 'worldlines: []\n',
    'story/characters/protagonist.yaml': [
      'id: protagonist',
      'name: 主角',
      'identity: {}',
      'background: { summary: 回鄉整理老家準備出售, history: [] }',
      'personality: { traits: [], habits: [], dislikes: [] }',
      'speech: { tone: quiet, calls: {} }',
      'knowledge: { initial: [], hidden: [] }',
      'secrets: []',
      '',
    ].join('\n'),
    'story/relationships/loop_01.yaml': 'relationships: []\n',
    'story/knowledge/facts.yaml': 'facts: []\n',
    'story/activities/protagonist.yaml': 'activities: []\n',
    'story/schedules/protagonist.yaml': 'character_id: protagonist\nentries: []\n',
    'story/narrative/loop_01_prologue.yaml': 'scenes: []\n',
    'story/artifacts/zhixia_letter.yaml': [
      'id: zhixia_letter',
      'kind: letter',
      'author: zhixia',
      'formed_at: "15:59"',
      'content: ["回來一趟。"]',
      '',
    ].join('\n'),
  };

  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const path = String(input);
    return new Response(files[path] ?? '', { status: files[path] === undefined ? 404 : 200 });
  });
  vi.stubGlobal('fetch', fetchMock);

  const story = await loadSimulationStory('story/manifests/test.yaml');
  expect(story.narrative.characters[0].id).toBe('protagonist');
  expect(story.narrative.artifacts[0].id).toBe('zhixia_letter');

  for (const path of Object.keys(files)) {
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === path)).toHaveLength(1);
  }
});
