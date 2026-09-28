import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DialogueScene } from '../../src/player/scenes/DialogueScene';

it('renders speaker and dialogue text as a scene', () => {
  render(<DialogueScene speaker="若晴" text="你真的還記得嗎？" reducedMotion />);

  expect(screen.getByText('若晴')).toBeDefined();
  expect(screen.getByTestId('typewriter-text').textContent).toContain('你真的還記得嗎？');
});

it('only exposes advance after typewriter presentation completes', () => {
  vi.useFakeTimers();
  const onAdvance = vi.fn();
  render(<DialogueScene speaker="若晴" text="慢慢說完。" speed={10} onAdvance={onAdvance} />);

  expect(screen.queryByRole('button', { name: '繼續走下去' })).toBeNull();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('button', { name: '繼續走下去' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '繼續走下去' }));
  expect(onAdvance).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

it('uses semantic intention choices and preserves action ids', () => {
  const onChoose = vi.fn();
  render(<DialogueScene
    speaker="予安"
    text="你想怎麼做？"
    reducedMotion
    choices={[
      { actionId: 'protect_wakaharu', label: '保護若晴：「今晚，我陪你留下來。」' },
      { actionId: 'stop_doctor', label: '請予安：「幫我去醫院。」' },
    ]}
    onChoose={onChoose}
  />);

  const choice = screen.getByRole('button', { name: /保護若晴/ });
  expect(choice.className).toContain('dialogue-choice');
  fireEvent.click(choice);
  expect(onChoose).toHaveBeenCalledWith('protect_wakaharu');
});
