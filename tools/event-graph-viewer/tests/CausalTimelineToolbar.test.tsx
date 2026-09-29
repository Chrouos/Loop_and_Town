import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CausalTimelineToolbar } from '../src/components/CausalTimelineToolbar';
import type { StoryWorldlinePath } from '../src/types/story';

const paths: StoryWorldlinePath[] = [
  { id: 'loop_01', label: 'Loop 01｜第一個今天', nodeIds: [], edgeIds: [], visibility: 'public' },
  { id: 'loop_02', label: 'Loop 02｜若晴存活', nodeIds: [], edgeIds: [], visibility: 'public' },
  { id: 'author_path', label: 'Author｜秘密路線', nodeIds: [], edgeIds: [], visibility: 'author' },
];

function renderToolbar(overrides: Partial<Parameters<typeof CausalTimelineToolbar>[0]> = {}) {
  const props = {
    paths,
    selectedPathId: 'loop_01',
    actorIds: ['wakaharu', 'doctor'],
    actorId: '',
    query: '',
    compareEnabled: false,
    onPathChange: vi.fn(),
    onActorChange: vi.fn(),
    onQueryChange: vi.fn(),
    onCompareToggle: vi.fn(),
    ...overrides,
  };
  render(<CausalTimelineToolbar {...props} />);
  return props;
}

describe('CausalTimelineToolbar', () => {
  it('shows only the four primary workbench controls', () => {
    renderToolbar();
    expect(screen.getByLabelText('Loop / Worldline')).toBeTruthy();
    expect(screen.getByLabelText('Character Filter')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compare' })).toBeTruthy();
    expect(screen.queryByText('All possibilities')).toBeNull();
  });

  it('keeps author paths selectable without exposing technical ids as labels', () => {
    const props = renderToolbar();
    expect(screen.getByRole('option', { name: 'Author｜秘密路線' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Loop / Worldline'), { target: { value: 'loop_02' } });
    expect(props.onPathChange).toHaveBeenCalledWith('loop_02');
  });

  it('emits character and search changes', () => {
    const props = renderToolbar();
    fireEvent.change(screen.getByLabelText('Character Filter'), { target: { value: 'doctor' } });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '車站' } });
    expect(props.onActorChange).toHaveBeenCalledWith('doctor');
    expect(props.onQueryChange).toHaveBeenCalledWith('車站');
  });

  it('toggles compare explicitly', () => {
    const props = renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(props.onCompareToggle).toHaveBeenCalledWith(true);

    const enabled = renderToolbar({ compareEnabled: true });
    fireEvent.click(screen.getAllByRole('button', { name: 'Close Compare' }).at(-1)!);
    expect(enabled.onCompareToggle).toHaveBeenCalledWith(false);
  });
});
