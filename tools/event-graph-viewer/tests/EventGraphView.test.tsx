import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventGraphView } from '../src/components/EventGraphView';
import type { StoryDagDocument } from '../src/types/story';

const detail = {
  before: [], after: [], affectedCharacters: [], delayedEffects: [],
  knowledgeChanges: [], relationshipChanges: [], narrativeRefs: [],
};

const dag: StoryDagDocument = {
  id: 'reader_test',
  title: 'Reader Test',
  nodes: [
    { id: 'N01', title: '與若晴聊攝影', actorIds: ['wakaharu'], visibility: 'public', detail },
    { id: 'N02', title: '若晴放下戒心', actorIds: ['wakaharu'], visibility: 'public', detail },
    { id: 'N03', title: '另一條路', actorIds: [], visibility: 'public', detail },
    { id: 'N20', title: '18:31 Convergence', actorIds: [], visibility: 'public', detail },
  ],
  edges: [
    { id: 'E01', source: 'N01', target: 'N02', label: 'trust +1', visibility: 'public' },
    { id: 'E02', source: 'N02', target: 'N20', label: 'reveal: station_plan', visibility: 'public' },
    { id: 'E03', source: 'N03', target: 'N20', label: 'converge', visibility: 'public' },
  ],
};

describe('EventGraphView story DAG reader', () => {
  it('renders bracketed node labels, causal edge labels and one shared convergence node', () => {
    render(<EventGraphView dagDocument={dag} />);
    expect(screen.getByText('[N01 與若晴聊攝影]')).toBeTruthy();
    expect(screen.getByText('trust +1')).toBeTruthy();
    expect(screen.getByText('reveal: station_plan')).toBeTruthy();
    expect(screen.getAllByText('[N20 18:31 Convergence]')).toHaveLength(1);
  });

  it('reports the selected node id', () => {
    const onNodeSelect = vi.fn();
    render(<EventGraphView dagDocument={dag} onNodeSelect={onNodeSelect} />);
    fireEvent.click(screen.getByText('[N01 與若晴聊攝影]'));
    expect(onNodeSelect).toHaveBeenCalledWith('N01');
  });
});
