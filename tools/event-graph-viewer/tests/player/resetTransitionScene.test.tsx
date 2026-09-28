import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResetTransitionScene } from '../../src/player/scenes/ResetTransitionScene';
import { RESET_TRANSITION_PHASES } from '../../src/player/scenes/resetTransition';

afterEach(() => vi.useRealTimers());

describe('ResetTransitionScene', () => {
  it('follows settling, message, handoff, fade, midnight, and complete in order', () => {
    vi.useFakeTimers();
    const onPresentationComplete = vi.fn();
    render(<ResetTransitionScene onPresentationComplete={onPresentationComplete} />);

    expect(screen.getByTestId('reset-transition').getAttribute('data-phase')).toBe('settling');
    expect(screen.queryByText('世界接手了這一輪。')).toBeNull();

    act(() => vi.advanceTimersByTime(RESET_TRANSITION_PHASES.settling));
    expect(screen.getByTestId('reset-transition').getAttribute('data-phase')).toBe('message');
    expect(screen.getByTestId('typewriter-text')).toBeDefined();
    expect(screen.queryByRole('button', { name: '將記憶交還給世界' })).toBeNull();

    act(() => vi.advanceTimersByTime(RESET_TRANSITION_PHASES.message));
    expect(screen.getByTestId('reset-transition').getAttribute('data-phase')).toBe('handoff');
    const handoff = screen.getByRole('button', { name: '將記憶交還給世界' });
    expect(handoff).toBeDefined();
    expect(screen.queryByText('00:00')).toBeNull();

    fireEvent.click(handoff);
    expect(screen.getByTestId('reset-transition').getAttribute('data-phase')).toBe('fade');
    act(() => vi.advanceTimersByTime(RESET_TRANSITION_PHASES.fade));
    expect(screen.getByTestId('reset-transition').getAttribute('data-phase')).toBe('midnight');
    expect(screen.getByText('00:00')).toBeDefined();
    expect(onPresentationComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(RESET_TRANSITION_PHASES.midnight));
    expect(screen.getByTestId('reset-transition').getAttribute('data-phase')).toBe('complete');
    expect(onPresentationComplete).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(onPresentationComplete).toHaveBeenCalledTimes(1);
  });

  it('preserves the same semantic order with reduced motion', () => {
    vi.useFakeTimers();
    const onPresentationComplete = vi.fn();
    render(<ResetTransitionScene reducedMotion onPresentationComplete={onPresentationComplete} />);

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId('reset-transition').getAttribute('data-phase')).toBe('message');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: '將記憶交還給世界' })).toBeDefined();
    expect(screen.queryByText('00:00')).toBeNull();
  });
});
