import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerEntryGate } from '../../src/player/PlayerEntryGate';

describe('PlayerEntryGate', () => {
  it('requires an explicit decision before loading the saved world', () => {
    vi.useFakeTimers();
    const onEnter = vi.fn();

    render(<PlayerEntryGate reducedMotion onEnter={onEnter} />);

    expect(screen.getByTestId('scene-frame').className).toContain('scene-frame--flat');
    expect(screen.getByText('進入世界……')).toBeDefined();
    expect(screen.getByText(/尚未知道你會出現的人生/)).toBeDefined();
    expect(screen.queryByText('載入存檔……')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /介入這個世界/ }));

    expect(screen.getByText('載入存檔……')).toBeDefined();
    expect(onEnter).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));

    expect(onEnter).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
