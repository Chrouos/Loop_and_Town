import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CausalTimelineGraph } from '../src/components/CausalTimelineGraph';
import { projectWorldlineTrace } from '../src/lib/causalTimeline';
import type { StoryDagDocument, StoryWorldlinePath } from '../src/types/story';

const detail = {
  before: [], after: [], affectedCharacters: [], delayedEffects: [],
  knowledgeChanges: [], relationshipChanges: [], narrativeRefs: [],
};

const document: StoryDagDocument = {
  id: 'graph-test',
  title: 'Graph Test',
  nodes: [
    { id: 'A', title: '與若晴聊攝影', time: '16:10', actorIds: ['wakaharu'], visibility: 'public', detail },
    { id: 'B', title: '玩家知道若晴要去舊車站', time: '17:20', actorIds: ['protagonist'], visibility: 'public', detail },
    { id: 'C', title: '庭安改變行程', time: '17:20', actorIds: ['reporter'], visibility: 'public', detail },
    { id: 'D', title: '18:31 Convergence', time: '18:31', actorIds: [], visibility: 'public', detail },
    { id: 'X', title: '不在這條世界線', time: '18:00', actorIds: ['doctor'], visibility: 'public', detail },
  ],
  edges: [
    { id: 'AB', source: 'A', target: 'B', label: 'trust +1', visibility: 'public' },
    { id: 'BD', source: 'B', target: 'D', label: 'route changed', visibility: 'public' },
    { id: 'CD', source: 'C', target: 'D', label: 'schedule changed', visibility: 'public' },
    { id: 'XD', source: 'X', target: 'D', label: 'unrelated', visibility: 'public' },
  ],
};

const path: StoryWorldlinePath = {
  id: 'loop', label: 'Loop', nodeIds: ['A', 'B', 'C', 'D'], edgeIds: ['AB', 'BD', 'CD'], visibility: 'public',
};

function renderGraph(focusedNodeIds?: Set<string>) {
  const onNodeSelect = vi.fn();
  render(
    <CausalTimelineGraph
      document={document}
      projection={projectWorldlineTrace(document, path)}
      focusedNodeIds={focusedNodeIds}
      selectedNodeId={null}
      onNodeSelect={onNodeSelect}
    />,
  );
  return onNodeSelect;
}

describe('CausalTimelineGraph', () => {
  it('renders natural story titles, character lanes, and one shared convergence', () => {
    renderGraph();
    expect(screen.getByText('與若晴聊攝影')).toBeTruthy();
    expect(screen.queryByText('[A 與若晴聊攝影]')).toBeNull();
    expect(screen.getByText('wakaharu')).toBeTruthy();
    expect(screen.getByText('protagonist')).toBeTruthy();
    expect(screen.getByText('reporter')).toBeTruthy();
    expect(screen.getByText('system')).toBeTruthy();
    expect(screen.getAllByText('18:31 Convergence')).toHaveLength(1);
    expect(screen.queryByText('不在這條世界線')).toBeNull();
  });

  it('uses minute as the horizontal source and separates same-time events', () => {
    renderGraph();
    const early = screen.getByTestId('causal-node-A');
    const later = screen.getByTestId('causal-node-D');
    const sameA = screen.getByTestId('causal-node-B');
    const sameB = screen.getByTestId('causal-node-C');
    expect(Number(early.dataset.minute)).toBeLessThan(Number(later.dataset.minute));
    expect(sameA.dataset.minute).toBe(sameB.dataset.minute);
    expect(sameA.dataset.lane).not.toBe(sameB.dataset.lane);
  });

  it('renders only the focused intersection and reports node selection', () => {
    const onNodeSelect = renderGraph(new Set(['B', 'D', 'X']));
    expect(screen.queryByText('與若晴聊攝影')).toBeNull();
    expect(screen.getByText('玩家知道若晴要去舊車站')).toBeTruthy();
    expect(screen.getByText('18:31 Convergence')).toBeTruthy();
    expect(screen.queryByText('不在這條世界線')).toBeNull();
    fireEvent.click(screen.getByText('玩家知道若晴要去舊車站'));
    expect(onNodeSelect).toHaveBeenCalledWith('B');
  });
});
