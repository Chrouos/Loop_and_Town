import { describe, expect, it } from 'vitest';
import type {
  StoryDagDocument,
  StoryDagNode,
  StoryDagEdge,
  StoryWorldlinePath,
} from '../src/types/story';
import { parseStoryDagText } from '../src/lib/loadStory';
import { buildStoryDagProjection, validateStoryDag } from '../src/lib/storyDag';

const rawStoryFiles = import.meta.glob('../../../story/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function realStoryFile(suffix: string): string {
  const key = Object.keys(rawStoryFiles).find((candidate) => candidate.endsWith(`/story/${suffix}`));
  if (!key) throw new Error(`Missing story fixture: ${suffix}`);
  return rawStoryFiles[key];
}

const node: StoryDagNode = {
  id: 'N01_wakaharu_photography',
  title: '與若晴聊攝影',
  time: '16:10',
  actorIds: ['protagonist', 'wakaharu'],
  visibility: 'public',
  detail: {
    before: ['若晴對主角保持戒心'],
    after: ['若晴願意談自己的未來'],
    reason: '主角先把若晴當作一個有自己人生的人，而不是知夏案的線索。',
    affectedCharacters: ['wakaharu'],
    delayedEffects: [],
    knowledgeChanges: [],
    relationshipChanges: ['wakaharu.trust_protagonist +1'],
    narrativeRefs: ['scene_wakaharu_cafe'],
  },
};

const edge: StoryDagEdge = {
  id: 'E01_trust',
  source: 'N01_wakaharu_photography',
  target: 'N02_wakaharu_opens_up',
  label: 'trust +1',
  visibility: 'public',
};

const document: StoryDagDocument = {
  id: 'day_01_story_dag',
  title: 'Day 01 因果 DAG',
  nodes: [node],
  edges: [edge],
};

const path: StoryWorldlinePath = {
  id: 'loop_01_baseline',
  label: 'Loop 01｜第一個今天',
  nodeIds: ['N01_wakaharu_photography'],
  edgeIds: [],
  visibility: 'public',
};

const minimalYaml = `
id: test_dag
title: 測試 DAG
nodes:
  - id: N01
    title: 起點
    actor_ids: [protagonist]
    visibility: public
    detail:
      before: [原本狀態]
      after: [改變後狀態]
      affected_characters: [protagonist]
  - id: N20
    title: 18:31 Convergence
    visibility: public
edges:
  - id: E01
    source: N01
    target: N20
    label: trust +1
    visibility: public
`;

describe('Story DAG canonical shape', () => {
  it('keeps causal labels and node detail as first-class data', () => {
    expect(document.nodes[0].detail.before).toEqual(['若晴對主角保持戒心']);
    expect(document.edges[0].label).toBe('trust +1');
    expect(document.nodes[0].detail.narrativeRefs).toEqual(['scene_wakaharu_cafe']);
  });

  it('represents a worldline as a path through the DAG', () => {
    expect(path.nodeIds).toEqual(['N01_wakaharu_photography']);
    expect(path.visibility).toBe('public');
  });

  it('covers the full first day from arrival through reset with three 18:31 outcomes', () => {
    const realDag = parseStoryDagText(realStoryFile('events/day_01_story_dag.yaml'));
    const ids = new Set(realDag.nodes.map((item) => item.id));
    for (const id of [
      'N00_arrival_graytide',
      'N00_letter_discovered',
      'N00_search_zhixia_room',
      'N20_convergence_1831',
      'N21_wakaharu_dies',
      'N22_doctor_dies',
      'N23_no_death',
      'N27_watch_message',
      'N28_impossible_bell',
      'N29_midnight_reset',
    ]) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }

    const afterConvergence = realDag.edges
      .filter((item) => item.source === 'N20_convergence_1831')
      .map((item) => item.target);
    expect(afterConvergence).toEqual(expect.arrayContaining([
      'N21_wakaharu_dies',
      'N22_doctor_dies',
      'N23_no_death',
    ]));

    for (const outcome of ['N21_wakaharu_dies', 'N22_doctor_dies', 'N23_no_death']) {
      expect(realDag.edges.some((edge) => edge.source === outcome && edge.target === 'N24_evening_continues')).toBe(true);
    }
    expect(realDag.edges.some((edge) => edge.source === 'N28_impossible_bell' && edge.target === 'N29_midnight_reset')).toBe(true);
  });

  it('links late Day 01 causal nodes to their readable novel scenes', () => {
    const realDag = parseStoryDagText(realStoryFile('events/day_01_story_dag.yaml'));
    const refsByNode = new Map(realDag.nodes.map((item) => [item.id, item.detail.narrativeRefs]));
    const expected: Record<string, string> = {
      N12_yuan_misses_realtor: 'scene_2000_yuan_realtor',
      N21_wakaharu_dies: 'scene_1831_wakaharu',
      N22_doctor_dies: 'scene_1831_doctor',
      N23_no_death: 'scene_1831_no_death',
      N24_evening_continues: 'scene_1842_station_aftermath',
      N26_case_summary_1831: 'scene_2030_detective_old_case',
      N27_watch_message: 'scene_2240_watch_warning',
      N28_impossible_bell: 'scene_2359_impossible_bell',
      N29_midnight_reset: 'scene_0000_reset',
    };

    for (const [nodeId, sceneId] of Object.entries(expected)) {
      expect(refsByNode.get(nodeId), `${nodeId} should link ${sceneId}`).toContain(sceneId);
    }
  });
});

describe('Story DAG parser and validation', () => {
  it('normalizes optional node detail arrays', () => {
    const parsed = parseStoryDagText(minimalYaml);
    expect(parsed.nodes[0].actorIds).toEqual(['protagonist']);
    expect(parsed.nodes[1].actorIds).toEqual([]);
    expect(parsed.nodes[1].detail.before).toEqual([]);
    expect(parsed.nodes[1].detail.narrativeRefs).toEqual([]);
    expect(parsed.nodes[1].detail.reason).toBeUndefined();
  });

  it('rejects edges that reference missing nodes', () => {
    const parsed = parseStoryDagText(minimalYaml);
    parsed.edges.push({
      id: 'E_bad',
      source: 'N01',
      target: 'N_missing',
      label: 'broken',
      visibility: 'public',
    });
    expect(validateStoryDag(parsed)).toContain('Edge E_bad target references unknown node N_missing');
  });

  it('allows multiple branches to converge on one node without duplicating it', () => {
    const parsed = parseStoryDagText(`${minimalYaml}\n`);
    parsed.nodes.push({
      id: 'N02',
      title: '另一條路',
      actorIds: [],
      visibility: 'public',
      detail: {
        before: [], after: [], affectedCharacters: [], delayedEffects: [],
        knowledgeChanges: [], relationshipChanges: [], narrativeRefs: [],
      },
    });
    parsed.edges.push({ id: 'E02', source: 'N02', target: 'N20', label: 'converge', visibility: 'public' });
    expect(validateStoryDag(parsed)).toEqual([]);
    const projection = buildStoryDagProjection(parsed, 'author');
    expect(projection.nodes.filter((item) => item.id === 'N20')).toHaveLength(1);
    expect(projection.edges.filter((item) => item.target === 'N20')).toHaveLength(2);
  });

  it('filters author-only nodes and edges outside author mode', () => {
    const parsed = parseStoryDagText(minimalYaml);
    parsed.nodes.push({
      id: 'N_secret', title: '作者秘密', actorIds: [], visibility: 'author',
      detail: { before: [], after: [], affectedCharacters: [], delayedEffects: [], knowledgeChanges: [], relationshipChanges: [], narrativeRefs: [] },
    });
    parsed.edges.push({ id: 'E_secret', source: 'N01', target: 'N_secret', label: 'secret', visibility: 'author' });
    expect(buildStoryDagProjection(parsed, 'public').nodes.some((item) => item.id === 'N_secret')).toBe(false);
    expect(buildStoryDagProjection(parsed, 'author').nodes.some((item) => item.id === 'N_secret')).toBe(true);
  });
});
