import { useEffect, useRef, useState, type ReactNode } from 'react';

export type SceneTransitionProps = {
  sceneKey: string;
  variant: 'scene' | 'black';
  children: ReactNode;
};

type TransitionPhase = 'entering' | 'visible' | 'exiting';

export function SceneTransition({ sceneKey, variant, children }: SceneTransitionProps) {
  const displayedKey = useRef(sceneKey);
  const displayedChildren = useRef<ReactNode>(children);
  const [phase, setPhase] = useState<TransitionPhase>('entering');

  useEffect(() => {
    if (displayedKey.current === sceneKey) displayedChildren.current = children;
  }, [children, sceneKey]);

  useEffect(() => {
    if (sceneKey === displayedKey.current) {
      displayedChildren.current = children;
      const timer = window.setTimeout(() => setPhase('visible'), variant === 'black' ? 500 : 400);
      return () => window.clearTimeout(timer);
    }

    setPhase('exiting');
    let enterTimer: number | undefined;
    const exitTimer = window.setTimeout(() => {
      displayedKey.current = sceneKey;
      displayedChildren.current = children;
      setPhase('entering');
      enterTimer = window.setTimeout(() => setPhase('visible'), variant === 'black' ? 500 : 400);
    }, 250);

    return () => {
      window.clearTimeout(exitTimer);
      if (enterTimer !== undefined) window.clearTimeout(enterTimer);
    };
  }, [sceneKey, variant]);

  const visibleChildren = displayedKey.current === sceneKey ? children : displayedChildren.current;
  return (
    <div
      className={`scene-transition scene-transition-${variant} scene-transition-${phase}`}
      data-scene-key={displayedKey.current}
      data-transition-phase={phase}
    >
      {visibleChildren}
    </div>
  );
}
