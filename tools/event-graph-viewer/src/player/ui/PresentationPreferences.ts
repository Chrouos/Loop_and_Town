import type { PlayerPresentationModel } from '../presentation/types';

export type PresentationPreferences = {
  reducedMotion: boolean;
  parallax: boolean;
  transitionDurationMs: number;
  projectedTime: string;
  persistentMemoryIds: string[];
};

export function getPresentationPreferences(reducedMotion: boolean, presentation?: PlayerPresentationModel): PresentationPreferences {
  return {
    reducedMotion,
    parallax: !reducedMotion,
    transitionDurationMs: reducedMotion ? 0 : 650,
    projectedTime: presentation?.timeLabel ?? '00:00',
    persistentMemoryIds: [...(presentation?.persistentMemoryIds ?? [])],
  };
}

export function atmosphereMode(presentation: PlayerPresentationModel): 'calm' | 'attention' | 'capture' | 'waiting' | 'reset' {
  if (presentation.mode === 'attention') return 'attention';
  if (presentation.mode === 'capture') return 'capture';
  if (presentation.mode === 'waiting') return 'waiting';
  if (presentation.mode === 'reset') return 'reset';
  return 'calm';
}

