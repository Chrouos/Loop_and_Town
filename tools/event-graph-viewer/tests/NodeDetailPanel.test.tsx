import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NodeDetailPanel } from '../src/components/NodeDetailPanel';
import type { StoryDagNode } from '../src/types/story';

const node: StoryDagNode = {
  id: 'N03_station_plan_known',
  title: '玩家知道若晴要去舊車站',
  time: '17:20',
  actorIds: ['protagonist', 'wakaharu'],
  visibility: 'public',
  detail: {
    before: ['若晴預計獨自前往舊車站。'],
    after: ['主角知道目的地，可以選擇介入。'],
    reason: '若晴信任足夠，主動透露行程。',
    affectedCharacters: ['protagonist', 'wakaharu', 'reporter'],
    delayedEffects: ['庭安可能改變行程。'],
    knowledgeChanges: ['reveal: station_plan'],
    relationshipChanges: ['wakaharu.trust_protagonist +1'],
    narrativeRefs: ['scene_wakaharu_before_leaving'],
  },
};

const narrativeScenes = [
  {
    id: 'scene_wakaharu_before_leaving',
    blocks: [
      { type: 'dialogue', speaker: 'wakaharu', text: '我晚點還要去一趟舊車站。很快就回來。' },
    ],
  },
];

describe('NodeDetailPanel', () => {
  it('shows causal before/after context and the linked novel scene', () => {
    render(<NodeDetailPanel node={node} narrativeScenes={narrativeScenes} downstreamTitles={['庭安改變行程']} />);
    expect(screen.getByText('17:20')).toBeTruthy();
    expect(screen.getByText('protagonist / wakaharu')).toBeTruthy();
    expect(screen.getByText('若晴預計獨自前往舊車站。')).toBeTruthy();
    expect(screen.getByText('主角知道目的地，可以選擇介入。')).toBeTruthy();
    expect(screen.getByText('若晴信任足夠，主動透露行程。')).toBeTruthy();
    expect(screen.getByText('reveal: station_plan')).toBeTruthy();
    expect(screen.getByText('庭安改變行程')).toBeTruthy();
    expect(screen.getByText('我晚點還要去一趟舊車站。很快就回來。')).toBeTruthy();
  });

  it('renders safely when a node has no narrative reference', () => {
    const noNarrative = { ...node, detail: { ...node.detail, narrativeRefs: [] } };
    render(<NodeDetailPanel node={noNarrative} narrativeScenes={[]} downstreamTitles={[]} />);
    expect(screen.getByText('沒有連結小說場景')).toBeTruthy();
  });
});
