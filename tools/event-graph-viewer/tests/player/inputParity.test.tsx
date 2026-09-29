import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InputParity } from '../../src/player/ui/InputParity';

describe('player input parity', () => {
  it('routes pointer and keyboard actions through the same semantic callbacks', async () => {
    const onAdvance = vi.fn();
    const onAttend = vi.fn();
    const onCapture = vi.fn();
    const onRelease = vi.fn();
    const user = userEvent.setup();
    render(<InputParity onAdvance={onAdvance} onAttend={onAttend} onCapture={onCapture} onRelease={onRelease} />);

    await user.click(screen.getByRole('button', { name: '繼續' }));
    fireEvent.keyDown(screen.getByRole('group', { name: '場景操作' }), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('group', { name: '場景操作' }), { key: 'a' });
    fireEvent.keyDown(screen.getByRole('group', { name: '場景操作' }), { key: 'c' });
    fireEvent.keyDown(screen.getByRole('group', { name: '場景操作' }), { key: 'Escape' });

    expect(onAdvance).toHaveBeenCalledTimes(2);
    expect(onAttend).toHaveBeenCalledTimes(1);
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it('does not render unavailable actions and exposes controller key hints', () => {
    render(<InputParity onAdvance={() => undefined} />);
    expect(screen.getByRole('button', { name: '繼續' }).getAttribute('aria-keyshortcuts')).toContain('ArrowRight');
    expect(screen.queryByRole('button', { name: '留意' })).toBeNull();
    expect(screen.queryByRole('button', { name: '捕捉記憶' })).toBeNull();
  });
});
