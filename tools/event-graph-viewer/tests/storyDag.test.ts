import { describe, expect, it } from 'vitest';
import type {
  StoryDagDocument,
  StoryDagNode,
  StoryDagEdge,
  StoryWorldlinePath,
} from '../src/types/story';

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
});
