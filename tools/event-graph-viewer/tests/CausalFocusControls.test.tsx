import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CausalFocusControls } from '../src/components/CausalFocusControls';

describe('CausalFocusControls', () => {
  it('shows story questions only after a node is selected', () => {
    const { rerender } = render(
      <CausalFocusControls
        selectedNodeId={null}
        activeMode={null}
        onModeChange={() => {}}
      />,
    );
    expect(screen.queryByRole('group', { name: 'Causal Focus' })).toBeNull();

    rerender(
      <CausalFocusControls
        selectedNodeId="N03"
        activeMode={null}
        onModeChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Why did this happen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'What does this affect' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show full chain to 18:31' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show this character only' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear focus' })).toBeTruthy();
  });

  it('emits focus modes and clears back to the selected worldline', () => {
    const onModeChange = vi.fn();
    render(
      <CausalFocusControls
        selectedNodeId="N03"
        activeMode="why"
        onModeChange={onModeChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Why did this happen' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'What does this affect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show full chain to 18:31' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show this character only' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear focus' }));

    expect(onModeChange.mock.calls.map(([mode]) => mode)).toEqual([
      'effects',
      'convergence',
      'character',
      null,
    ]);
  });
});
