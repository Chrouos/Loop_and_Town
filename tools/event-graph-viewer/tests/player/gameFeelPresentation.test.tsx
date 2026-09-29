import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoopTransitionLayer } from '../../src/player/ui/LoopTransitionLayer';
import { SceneAtmosphere } from '../../src/player/ui/SceneAtmosphere';
import { getPresentationPreferences } from '../../src/player/ui/PresentationPreferences';
import type { PlayerPresentationModel } from '../../src/player/presentation/types';

const presentation = (mode: PlayerPresentationModel['mode'], pending = false): PlayerPresentationModel => ({
  loopId: 2,
  timeLabel: '18:31',
  location: '舊車站',
  mode,
  sceneCandidates: [],
  ambientCues: [],
  attention: { phase: mode === 'attention' ? 'observing' : 'idle' },
  capture: { active: mode === 'capture' },
  reset: { pending, npcState: 'reset' },
  persistentMemoryIds: ['memory:2:station'],
  wallRefs: ['memory:2:station'],
  memoryCandidates: [],
  inference: 'player-led',
});

describe('Game Feel presentation', () => {
  it('maps presentation modes to atmosphere layers without changing content', () => {
    const { rerender } = render(<SceneAtmosphere presentation={presentation('reading')} reducedMotion={false} />);
    expect(screen.getByTestId('scene-atmosphere-layer').getAttribute('data-atmosphere-mode')).toBe('calm');
    expect(screen.getByTestId('scene-atmosphere-layer').getAttribute('data-parallax')).toBe('enabled');

    rerender(<SceneAtmosphere presentation={presentation('capture')} reducedMotion={true} />);
    const layer = screen.getByTestId('scene-atmosphere-layer');
    expect(layer.getAttribute('data-atmosphere-mode')).toBe('capture');
    expect(layer.getAttribute('data-parallax')).toBe('reduced');
    expect(layer.getAttribute('data-reduced-motion')).toBe('true');
  });

  it('renders a reset transition as presentation-only state', () => {
    const base = presentation('reset', true);
    render(<LoopTransitionLayer presentation={base} reducedMotion={false} />);
    const transition = screen.getByTestId('loop-transition');
    expect(transition.getAttribute('data-transition-kind')).toBe('reset');
    expect(transition.getAttribute('data-duration-ms')).toBe('650');
    expect(screen.getByRole('status').textContent).toContain('午夜正在靠近');
  });

  it('makes reduced motion immediate without changing projected time or memory ids', () => {
    const base = presentation('reset', true);
    const prefs = getPresentationPreferences(true, base);
    expect(prefs.transitionDurationMs).toBe(0);
    expect(prefs.parallax).toBe(false);
    expect(prefs.projectedTime).toBe(base.timeLabel);
    expect(prefs.persistentMemoryIds).toEqual(base.persistentMemoryIds);
  });
});
