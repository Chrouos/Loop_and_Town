import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IdleProgressScene } from '../../src/player/scenes/IdleProgressScene';

it('renders an exact completion time without doing clock arithmetic', () => {
  render(<IdleProgressScene actor="庭安" activity="正在回旅館。" canIntervene={false} eta={{ kind: 'exact', expectedAt: '14:27' }} />);

  expect(screen.getByText('庭安')).toBeDefined();
  expect(screen.getByText('正在回旅館。')).toBeDefined();
  expect(screen.getByText('預計完成時間：14:27')).toBeDefined();
  expect(screen.queryByRole('button')).toBeNull();
});

it('renders an approximate duration supplied by the authoritative projection', () => {
  render(<IdleProgressScene activity="有人正在處理鎮上的通報。" canIntervene eta={{ kind: 'approximate', minutes: 5 }} />);

  expect(screen.getByText('大約還需要 5 分鐘')).toBeDefined();
  expect(screen.getByRole('button', { name: '現在介入' })).toBeDefined();
});

it('keeps an unknown ETA unknown and does not expose intervention when forbidden', () => {
  const onIntervene = vi.fn();
  render(<IdleProgressScene actor="庭安" activity="還沒有回來。" canIntervene={false} eta={{ kind: 'unknown' }} onIntervene={onIntervene} />);

  expect(screen.getByText('還沒有回來。')).toBeDefined();
  expect(screen.getByText('...... ▌')).toBeDefined();
  expect(screen.queryByText(/分鐘|時間/)).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  expect(onIntervene).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('idle-progress'));
  expect(onIntervene).not.toHaveBeenCalled();
});
