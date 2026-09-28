import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { OpeningScene } from '../../src/player/scenes/OpeningScene';

it('keeps the first-loop opening tied to its explicit letter interaction', () => {
  const onOpenLetter = vi.fn();
  render(<OpeningScene label="清晨" lines={["返程列車剛進站。"]} onOpenLetter={onOpenLetter} />);

  expect(screen.getByText('返程列車剛進站。')).toBeDefined();
  expect(screen.getByRole('button', { name: '拆開信封，讀姊姊的信' })).toBeDefined();
  expect(screen.queryByRole('button', { name: /繼續|下一步/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '拆開信封，讀姊姊的信' }));
  expect(onOpenLetter).toHaveBeenCalledTimes(1);
});
