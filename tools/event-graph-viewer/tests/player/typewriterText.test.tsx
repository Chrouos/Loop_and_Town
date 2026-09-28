import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TypewriterText } from '../../src/player/ui/TypewriterText';

afterEach(() => {
  vi.useRealTimers();
});

describe('TypewriterText', () => {
  it('begins partially revealed and eventually reveals the complete string', () => {
    vi.useFakeTimers();
    render(<TypewriterText text="灰潮鎮" speed={10} />);

    expect(screen.getByTestId('typewriter-text').textContent).toBe('');
    act(() => vi.advanceTimersByTime(10));
    expect(screen.getByTestId('typewriter-text').textContent).toBe('灰');
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getByTestId('typewriter-text').textContent).toBe('灰潮鎮');
  });

  it('waits longer after punctuation than after an ordinary character', () => {
    vi.useFakeTimers();
    render(<TypewriterText text="甲，乙" speed={10} punctuationDelay={30} />);

    act(() => vi.advanceTimersByTime(10));
    expect(screen.getByTestId('typewriter-text').textContent).toBe('甲');
    act(() => vi.advanceTimersByTime(10));
    expect(screen.getByTestId('typewriter-text').textContent).toBe('甲');
    act(() => vi.advanceTimersByTime(30));
    expect(screen.getByTestId('typewriter-text').textContent).toBe('甲，');
  });

  it('fires onComplete once and can show a cursor after completion', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<TypewriterText text="好。" speed={10} punctuationDelay={10} cursor onComplete={onComplete} />);

    act(() => vi.advanceTimersByTime(1000));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('typewriter-cursor')).toBeDefined();
    expect(screen.getByTestId('typewriter-text').getAttribute('data-complete')).toBe('true');
  });

  it('renders the complete text immediately in reduced-motion mode', () => {
    const onComplete = vi.fn();
    render(<TypewriterText text="完整出現" reducedMotion cursor onComplete={onComplete} />);

    expect(screen.getByTestId('typewriter-text').firstChild?.textContent).toBe('完整出現');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
