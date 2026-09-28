import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NarrativeSurface } from '../src/playerNarrative/components/NarrativeSurface';
import { DEFAULT_TYPEWRITER_TIMING } from '../src/playerNarrative/typewriter';

function PlaybackHarness() {
  const text = '短句';
  const [phase, setPhase] = useState<'typing' | 'waiting'>('typing');
  const [revealedCharacters, setRevealedCharacters] = useState(0);

  return (
    <>
      <output data-testid="phase">{phase}</output>
      <NarrativeSurface
        block={{ type: 'narration', text }}
        phase={phase}
        revealedCharacters={revealedCharacters}
        onReveal={setRevealedCharacters}
        onAdvance={() => {
          if (phase === 'typing') {
            setRevealedCharacters(text.length);
            setPhase('waiting');
          } else {
            setPhase('typing');
            setRevealedCharacters(0);
          }
        }}
      />
    </>
  );
}

describe('player narrative playback', () => {
  afterEach(() => vi.useRealTimers());

  it('reveals the next character while typing', () => {
    vi.useFakeTimers();
    const onReveal = vi.fn();
    render(
      <NarrativeSurface
        block={{ type: 'narration', text: '短句' }}
        phase="typing"
        revealedCharacters={0}
        onReveal={onReveal}
        onAdvance={() => undefined}
      />,
    );

    act(() => vi.advanceTimersByTime(DEFAULT_TYPEWRITER_TIMING.characterMs));

    expect(onReveal).toHaveBeenCalledWith(1);
  });

  it('completes typing on the first click and advances on the second click', () => {
    render(<PlaybackHarness />);
    const surface = screen.getByLabelText('故事');

    act(() => fireEvent.click(surface));
    expect(screen.getByTestId('phase').textContent).toBe('waiting');

    act(() => fireEvent.click(surface));
    expect(screen.getByTestId('phase').textContent).toBe('typing');
  });

  it('supports Space and Enter as advance keys', () => {
    render(<PlaybackHarness />);
    const surface = screen.getByLabelText('故事');

    act(() => fireEvent.keyDown(surface, { key: ' ' }));
    expect(screen.getByTestId('phase').textContent).toBe('waiting');
    act(() => fireEvent.keyDown(surface, { key: 'Enter' }));
    expect(screen.getByTestId('phase').textContent).toBe('typing');
  });

  it('renders no more than three rolling narrative layers', () => {
    render(
      <NarrativeSurface
        block={{ type: 'narration', text: '目前內容' }}
        previousBlocks={[
          { type: 'narration', text: '上一段內容' },
          { type: 'narration', text: '前一段內容' },
        ]}
        phase="waiting"
        revealedCharacters={4}
        onReveal={() => undefined}
        onAdvance={() => undefined}
      />,
    );

    expect(screen.getByText('上一段內容')).not.toBeNull();
    expect(screen.getByText('前一段內容')).not.toBeNull();
    expect(screen.getByText('目前內容', { selector: 'p' })).not.toBeNull();
  });
});
