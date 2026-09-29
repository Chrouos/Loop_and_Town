import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorldlineSetCompare } from '../src/components/WorldlineSetCompare';
import type { StoryDagDocument, StoryWorldlinePath } from '../src/types/story';

const detail = {
  before: [], after: [], affectedCharacters: [], delayedEffects: [],
  knowledgeChanges: [], relationshipChanges: [], narrativeRefs: [],
};

const document: StoryDagDocument = {
  id: 'compare',
  title: 'Compare',
  nodes: [
    { id: 'A', title: '共同事件', time: '17:20', actorIds: ['protagonist'], visibility: 'public', detail },
    { id: 'B', title: '若晴留在咖啡店', time: '17:35', actorIds: ['wakaharu'], visibility: 'public', detail },
    { id: 'C', title: '柏勳進入維修通道', time: '18:24', actorIds: ['doctor'], visibility: 'public', detail },
    { id: 'D', title: '18:31 Convergence', time: '18:31', actorIds: [], visibility: 'public', detail },
    { id: 'E', title: '若晴去車站', time: '17:35', actorIds: ['wakaharu'], visibility: 'public', detail },
  ],
  edges: [],
};

const paths: StoryWorldlinePath[] = [
  { id: 'loop_01', label: 'Loop 01', nodeIds: ['A', 'E', 'D'], edgeIds: [], visibility: 'public' },
  { id: 'loop_02', label: 'Loop 02', nodeIds: ['A', 'B', 'C', 'D'], edgeIds: [], visibility: 'public' },
  { id: 'loop_03', label: 'Loop 03', nodeIds: ['A', 'D'], edgeIds: [], visibility: 'public' },
];

describe('WorldlineSetCompare', () => {
  it('compares more than two worldlines and separates invariants from variables', () => {
    render(
      <WorldlineSetCompare
        document={document}
        paths={paths}
        selectedPathIds={['loop_01', 'loop_02', 'loop_03']}
        onSelectedPathIdsChange={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Worldline Compare' })).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'Loop 01' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Loop 02' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Loop 03' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('heading', { name: 'Invariant' })).toBeTruthy();
    expect(screen.getByText('共同事件')).toBeTruthy();
    expect(screen.getByText('18:31 Convergence')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Variable · Loop 01' })).toBeTruthy();
    expect(screen.getByText('若晴去車站')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Variable · Loop 02' })).toBeTruthy();
    expect(screen.getByText('若晴留在咖啡店')).toBeTruthy();
    expect(screen.getByText('柏勳進入維修通道')).toBeTruthy();
  });

  it('deduplicates selected ids and toggles a path without forcing A/B semantics', () => {
    const onSelectedPathIdsChange = vi.fn();
    render(
      <WorldlineSetCompare
        document={document}
        paths={paths}
        selectedPathIds={['loop_01', 'loop_01', 'loop_02']}
        onSelectedPathIdsChange={onSelectedPathIdsChange}
        onClose={() => {}}
      />,
    );

    expect(screen.getAllByRole('heading', { name: 'Variable · Loop 01' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Loop 03' }));
    expect(onSelectedPathIdsChange).toHaveBeenCalledWith(['loop_01', 'loop_02', 'loop_03']);
  });

  it('treats one selected path as entirely invariant and handles no common nodes', () => {
    const { rerender } = render(
      <WorldlineSetCompare
        document={document}
        paths={paths}
        selectedPathIds={['loop_02']}
        onSelectedPathIdsChange={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('若晴留在咖啡店')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Variable · Loop 02' })).toBeNull();

    const isolatedPaths: StoryWorldlinePath[] = [
      { id: 'one', label: 'One', nodeIds: ['B'], edgeIds: [], visibility: 'public' },
      { id: 'two', label: 'Two', nodeIds: ['E'], edgeIds: [], visibility: 'public' },
    ];
    rerender(
      <WorldlineSetCompare
        document={document}
        paths={isolatedPaths}
        selectedPathIds={['one', 'two']}
        onSelectedPathIdsChange={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('沒有共同節點')).toBeTruthy();
  });

  it('closes compare without mutating the selected path set', () => {
    const onClose = vi.fn();
    render(
      <WorldlineSetCompare
        document={document}
        paths={paths}
        selectedPathIds={['loop_01', 'loop_02']}
        onSelectedPathIdsChange={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close worldline compare' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
