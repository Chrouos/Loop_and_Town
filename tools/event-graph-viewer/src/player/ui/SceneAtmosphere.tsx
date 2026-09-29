import type { PlayerPresentationModel } from '../presentation/types';
import { atmosphereMode } from './PresentationPreferences';

type Props = { presentation: PlayerPresentationModel; reducedMotion?: boolean };

export function SceneAtmosphere({ presentation, reducedMotion = false }: Props) {
  const mode = atmosphereMode(presentation);
  return <div
    className="scene-atmosphere-layer"
    data-testid="scene-atmosphere-layer"
    data-atmosphere-mode={mode}
    data-parallax={reducedMotion ? 'reduced' : 'enabled'}
    data-reduced-motion={reducedMotion ? 'true' : 'false'}
    aria-hidden="true"
  >
    <span className="scene-atmosphere-layer__haze" />
    <span className="scene-atmosphere-layer__grain" />
    <span className="scene-atmosphere-layer__glow" />
  </div>;
}
