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

const causalProps = {
  upstreamTitles: ['若晴放下戒心'],
  downstreamTitles: ['庭安改變行程'],
  incomingLabels: ['reveal: station_plan'],
  outgoingLabels: ['tell reporter'],
};

describe('NodeDetailPanel', () => {
  it('shows narrative meaning first and keeps technical data collapsed', () => {
    render(
      <NodeDetailPanel
        node={node}
        narrativeScenes={narrativeScenes}
        {...causalProps}
      />,
    );

    expect(screen.getByRole('heading', { name: '玩家知道若晴要去舊車站' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /N03_station_plan_known/ })).toBeNull();
    expect(screen.getByText('17:20')).toBeTruthy();
    expect(screen.getByText('protagonist / wakaharu')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '為什麼發生？' })).toBeTruthy();
    expect(screen.getByText('若晴信任足夠，主動透露行程。')).toBeTruthy();
    expect(screen.getByText('若晴放下戒心')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '接下來影響' })).toBeTruthy();
    expect(screen.getByText('庭安改變行程')).toBeTruthy();
    expect(screen.getByText('庭安可能改變行程。')).toBeTruthy();
    expect(screen.getByText('我晚點還要去一趟舊車站。很快就回來。')).toBeTruthy();

    const debug = screen.getByText('Debug Data').closest('details');
    expect(debug).toBeTruthy();
    expect(debug?.hasAttribute('open')).toBe(false);
    expect(debug?.textContent).toContain('N03_station_plan_known');
    expect(debug?.textContent).toContain('reveal: station_plan');
    expect(debug?.textContent).toContain('wakaharu.trust_protagonist +1');
    expect(debug?.textContent).toContain('scene_wakaharu_before_leaving');
    expect(debug?.textContent).toContain('tell reporter');
  });

  it('renders safely when a node has no narrative reference or causal neighbor', () => {
    const noNarrative = { ...node, detail: { ...node.detail, narrativeRefs: [] } };
    render(
      <NodeDetailPanel
        node={noNarrative}
        narrativeScenes={[]}
        upstreamTitles={[]}
        downstreamTitles={[]}
        incomingLabels={[]}
        outgoingLabels={[]}
      />,
    );
    expect(screen.getByText('沒有連結小說場景')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '為什麼發生？' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '接下來影響' })).toBeTruthy();
  });
});
