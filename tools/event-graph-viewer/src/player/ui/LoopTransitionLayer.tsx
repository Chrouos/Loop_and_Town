import type { PlayerPresentationModel } from '../presentation/types';
import { getPresentationPreferences } from './PresentationPreferences';

type Props = { presentation: PlayerPresentationModel; reducedMotion?: boolean };

export function LoopTransitionLayer({ presentation, reducedMotion = false }: Props) {
  const duration = getPresentationPreferences(reducedMotion).transitionDurationMs;
  return <div
    className={`loop-transition-layer ${presentation.reset.pending ? 'loop-transition-layer--reset' : ''}`}
    data-testid="loop-transition"
    data-transition-kind={presentation.reset.pending ? 'reset' : 'none'}
    data-duration-ms={presentation.reset.pending ? String(duration) : '0'}
    aria-hidden={!presentation.reset.pending}
  >
    {presentation.reset.pending && <p role="status">午夜正在靠近</p>}
  </div>;
}
