import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneTransition } from '../src/playerNarrative/components/SceneTransition';

describe('player narrative scene transition', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps the old scene during fade-out before entering the new scene', () => {
    vi.useFakeTimers();
    const view = render(
      <SceneTransition sceneKey="scene-a" variant="scene">
        <p>舊場景</p>
      </SceneTransition>,
    );

    expect(screen.getByText('舊場景')).not.toBeNull();
    expect(view.container.firstElementChild?.getAttribute('data-transition-phase')).toBe('entering');

    view.rerender(
      <SceneTransition sceneKey="scene-b" variant="scene">
        <p>新場景</p>
      </SceneTransition>,
    );
    expect(screen.getByText('舊場景')).not.toBeNull();
    expect(screen.queryByText('新場景')).toBeNull();
    expect(view.container.firstElementChild?.getAttribute('data-transition-phase')).toBe('exiting');

    act(() => vi.advanceTimersByTime(249));
    expect(screen.getByText('舊場景')).not.toBeNull();
    expect(screen.queryByText('新場景')).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('舊場景')).toBeNull();
    expect(screen.getByText('新場景')).not.toBeNull();
    expect(view.container.firstElementChild?.getAttribute('data-transition-phase')).toBe('entering');

    act(() => vi.advanceTimersByTime(400));
    expect(view.container.firstElementChild?.getAttribute('data-transition-phase')).toBe('visible');
  });

  it('uses a black transition variant with a 500ms hold', () => {
    vi.useFakeTimers();
    const view = render(
      <SceneTransition sceneKey="scene-a" variant="black">
        <p>鐘聲前</p>
      </SceneTransition>,
    );

    expect(view.container.firstElementChild?.className).toContain('scene-transition-black');
    view.rerender(
      <SceneTransition sceneKey="scene-b" variant="black">
        <p>鐘聲後</p>
      </SceneTransition>,
    );

    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByText('鐘聲後')).not.toBeNull();
    expect(view.container.firstElementChild?.getAttribute('data-transition-phase')).toBe('entering');
    act(() => vi.advanceTimersByTime(499));
    expect(view.container.firstElementChild?.getAttribute('data-transition-phase')).toBe('entering');
    act(() => vi.advanceTimersByTime(1));
    expect(view.container.firstElementChild?.getAttribute('data-transition-phase')).toBe('visible');
  });
});
