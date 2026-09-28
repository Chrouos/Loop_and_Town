import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorldlinePathSelector } from '../src/components/WorldlinePathSelector';
import type { StoryWorldlinePath } from '../src/types/story';

const paths: StoryWorldlinePath[] = [
  { id: 'loop_01_baseline', label: 'Loop 01｜第一個今天', nodeIds: ['N01', 'N20'], edgeIds: ['E01'], visibility: 'public' },
  { id: 'loop_02_saved', label: 'Loop 02｜若晴存活', nodeIds: ['N02', 'N20'], edgeIds: ['E02'], visibility: 'public' },
  { id: 'author_secret', label: 'Author｜秘密路線', nodeIds: ['N99'], edgeIds: [], visibility: 'author' },
];

describe('WorldlinePathSelector', () => {
  it('switches between named paths', () => {
    const onChange = vi.fn();
    render(<WorldlinePathSelector paths={paths} selectedId="loop_01_baseline" onChange={onChange} mode="author" />);
    fireEvent.change(screen.getByLabelText('Worldline Path'), { target: { value: 'loop_02_saved' } });
    expect(onChange).toHaveBeenCalledWith('loop_02_saved');
  });

  it('hides author-only paths in player mode', () => {
    render(<WorldlinePathSelector paths={paths} selectedId="loop_01_baseline" onChange={() => {}} mode="public" />);
    expect(screen.queryByText('Author｜秘密路線')).toBeNull();
    expect(screen.getByText('Loop 01｜第一個今天')).toBeTruthy();
  });

  it('offers all possibilities to authors', () => {
    render(<WorldlinePathSelector paths={paths} selectedId="all" onChange={() => {}} mode="author" />);
    expect(screen.getByText('All possibilities')).toBeTruthy();
  });
});
