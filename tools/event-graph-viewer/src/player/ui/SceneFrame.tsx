import type { CSSProperties, ReactNode } from 'react';
import type { SceneBackground } from '../presentation/model';

type SceneFrameProps = {
  children: ReactNode;
  background?: SceneBackground;
  className?: string;
};

export function SceneFrame({ children, background, className = '' }: SceneFrameProps) {
  const backgroundStyle: CSSProperties | undefined = background?.kind === 'color'
    ? { '--scene-background': background.value } as CSSProperties
    : undefined;
  return <section
    className={`scene-frame ${className}`.trim()}
    data-testid="scene-frame"
    data-background={background?.kind ?? 'fallback'}
    style={backgroundStyle}
  >
    {background?.kind === 'image' && <img className="scene-frame__background" src={background.src} alt={background.alt ?? ''} aria-hidden={background.alt ? undefined : 'true'} />}
    <div className="scene-frame__atmosphere" data-testid="scene-atmosphere" aria-hidden="true" />
    <div className="scene-frame__vignette" data-testid="scene-vignette" aria-hidden="true" />
    <div className="scene-frame__grain" data-testid="scene-grain" aria-hidden="true" />
    <div className="scene-frame__content">{children}</div>
  </section>;
}
