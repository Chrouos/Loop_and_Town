import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AmbientPrompt } from '../../src/player/ui/AmbientPrompt';
import { SceneFrame } from '../../src/player/ui/SceneFrame';
import { WorldlineHud } from '../../src/player/ui/WorldlineHud';

it('renders loop, simulation time, and an explicit worldline in the HUD', () => {
  render(<WorldlineHud loop={2} time="14:22" worldline="02-B" />);

  expect(screen.getByText('LOOP 02')).toBeDefined();
  expect(screen.getByText('14:22')).toBeDefined();
  expect(screen.getByText('WORLDLINE 02-B')).toBeDefined();
});

it('omits the worldline line when runtime has no identifier', () => {
  render(<WorldlineHud loop={1} time="06:12" />);

  expect(screen.getByText('LOOP 01')).toBeDefined();
  expect(screen.queryByText(/WORLDLINE/)).toBeNull();
});

it('uses a native button and keyboard activation for an actionable ambient prompt', async () => {
  const onActivate = vi.fn();
  render(<AmbientPrompt onActivate={onActivate}>將記憶交還給世界</AmbientPrompt>);

  const prompt = screen.getByRole('button', { name: '將記憶交還給世界' });
  expect(prompt.tagName).toBe('BUTTON');
  const user = userEvent.setup();
  await user.tab();
  await user.keyboard('{Enter}');
  await user.keyboard(' ');
  expect(onActivate).toHaveBeenCalledTimes(2);
});

it('keeps a passive ambient prompt non-actionable', () => {
  render(<AmbientPrompt>世界正在呼吸。</AmbientPrompt>);

  expect(screen.getByText('世界正在呼吸。').tagName).toBe('P');
  expect(screen.queryByRole('button')).toBeNull();
});

it('hides atmospheric texture layers from assistive technology while keeping fallback content readable', () => {
  render(<SceneFrame><p>沒有背景圖時，故事仍然可讀。</p></SceneFrame>);

  expect(screen.getByText('沒有背景圖時，故事仍然可讀。')).toBeDefined();
  expect(screen.getByTestId('scene-atmosphere').getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByTestId('scene-vignette').getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByTestId('scene-grain').getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByTestId('scene-frame').getAttribute('data-background')).toBe('fallback');
});
