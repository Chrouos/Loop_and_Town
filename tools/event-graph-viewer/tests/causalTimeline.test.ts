import { describe, expect, it } from 'vitest';
import {
  compareWorldlinePaths,
  filterProjection,
  getFocusedNodeIds,
  projectWorldlineTrace,
} from '../src/lib/causalTimeline';
import type { StoryDagDocument, StoryWorldlinePath } from '../src/types/story';

const detail = {
  before: [],
  after: [],
  affectedCharacters: [],
  delayedEffects: [],
  knowledgeChanges: [],
  relationshipChanges: [],
  narrativeRefs: [],
};

const doc: StoryDagDocument = {
  id: 'timeline-test',
  title: 'Timeline Test',
  nodes: [
    { id: 'A', title: '早上事件', time: '16:10', actorIds: ['wakaharu'], visibility: 'public', detail },
    { id: 'B', title: '知道車站行程', time: '17:20', actorIds: ['protagonist', 'wakaharu'], visibility: 'public', detail },
    { id: 'C', title: '庭安改變行程', time: '17:20', actorIds: ['reporter'], visibility: 'public', detail },
    { id: 'D', title: '進入維修通道', time: '18:24', actorIds: ['doctor'], visibility: 'public', detail },
    { id: 'E', title: '18:31 Convergence', time: '18:31', actorIds: [], visibility: 'public', detail },
    { id: 'F', title: '沒有時間的附註', actorIds: [], visibility: 'public', detail },
    { id: 'G', title: '另一條獨立線', time: '19:00', actorIds: ['yuan'], visibility: 'public', detail },
  ],
  edges: [
    { id: 'AB', source: 'A', target: 'B', label: 'trust +1', visibility: 'public' },
    { id: 'BC', source: 'B', target: 'C', label: 'tell reporter', visibility: 'public' },
    { id: 'CD', source: 'C', target: 'D', label: 'delay route', visibility: 'public' },
    { id: 'DE', source: 'D', target: 'E', label: 'still nearby', visibility: 'public' },
    { id: 'GE', source: 'G', target: 'E', label: 'converge', visibility: 'public' },
  ],
};

const pathA: StoryWorldlinePath = {
  id: 'loop_a',
  label: 'Loop A',
  nodeIds: ['A', 'B', 'C', 'D', 'E', 'missing-node'],
  edgeIds: ['AB', 'BC', 'CD', 'DE', 'missing-edge'],
  visibility: 'public',
};

const pathB: StoryWorldlinePath = {
  id: 'loop_b',
  label: 'Loop B',
  nodeIds: ['A', 'B', 'G', 'E'],
  edgeIds: ['AB', 'GE'],
  visibility: 'public',
};

describe('causal timeline projection', () => {
  it('uses simulation minute ordering, keeps same-minute source order, and puts missing time last', () => {
    const projection = projectWorldlineTrace(doc);
    expect(projection.nodes.map((node) => node.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'G', 'F']);
    expect(projection.nodes.find((node) => node.id === 'A')?.minute).toBe(16 * 60 + 10);
    expect(projection.nodes.find((node) => node.id === 'B')?.minute).toBe(17 * 60 + 20);
    expect(projection.nodes.find((node) => node.id === 'F')?.minute).toBeUndefined();
  });

  it('projects only valid path members and ignores stale node/edge references', () => {
    const projection = projectWorldlineTrace(doc, pathA);
    expect(projection.nodes.map((node) => node.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect([...projection.edgeIds]).toEqual(['AB', 'BC', 'CD', 'DE']);
    expect(projection.nodeIds.has('missing-node')).toBe(false);
  });

  it('derives stable actor lanes and a system lane', () => {
    const projection = projectWorldlineTrace(doc, pathA);
    expect(projection.nodes.find((node) => node.id === 'A')?.laneId).toBe('wakaharu');
    expect(projection.nodes.find((node) => node.id === 'B')?.laneId).toBe('protagonist');
    expect(projection.nodes.find((node) => node.id === 'E')?.laneId).toBe('system');
    expect(projection.lanes).toEqual(['wakaharu', 'protagonist', 'reporter', 'doctor', 'system']);
  });
});

describe('focus and filtering', () => {
  it('returns upstream and downstream nodes within two hops', () => {
    expect([...getFocusedNodeIds(doc, 'C', 2, 0)]).toEqual(expect.arrayContaining(['A', 'B', 'C']));
    expect([...getFocusedNodeIds(doc, 'C', 0, 2)]).toEqual(expect.arrayContaining(['C', 'D', 'E']));
    expect(getFocusedNodeIds(doc, 'C', 2, 0).has('G')).toBe(false);
  });

  it('combines actor, search, and allowed-node filters without adding unrelated nodes', () => {
    const projection = projectWorldlineTrace(doc, pathA);
    const allowed = new Set(['A', 'B', 'C']);
    const filtered = filterProjection(projection, {
      actorId: 'wakaharu',
      query: '車站',
      allowedNodeIds: allowed,
    });
    expect(filtered.nodes.map((node) => node.id)).toEqual(['B']);
    expect(filtered.nodeIds.has('G')).toBe(false);
  });
});

describe('worldline path comparison', () => {
  it('finds invariant and path-specific nodes across several paths', () => {
    const result = compareWorldlinePaths(doc, [pathA, pathB]);
    expect(result.invariantNodeIds).toEqual(['A', 'B', 'E']);
    expect(result.variableNodeIdsByPath.loop_a).toEqual(['C', 'D']);
    expect(result.variableNodeIdsByPath.loop_b).toEqual(['G']);
  });

  it('handles one path and no common nodes deterministically', () => {
    expect(compareWorldlinePaths(doc, [pathA]).invariantNodeIds).toEqual(['A', 'B', 'C', 'D', 'E']);
    const isolated: StoryWorldlinePath = {
      id: 'isolated', label: 'Isolated', nodeIds: ['G'], edgeIds: [], visibility: 'public',
    };
    expect(compareWorldlinePaths(doc, [pathA, isolated]).invariantNodeIds).toEqual([]);
  });
});
