import { useEffect, useRef, useState } from 'react';
import { AmbientPrompt } from '../ui/AmbientPrompt';
import { TypewriterText } from '../ui/TypewriterText';
import { resetPhaseDelay, type ResetTransitionPhase } from './resetTransition';

type ResetTransitionSceneProps = {
  reducedMotion?: boolean;
  onPresentationComplete: () => void;
};

export function ResetTransitionScene({ reducedMotion = false, onPresentationComplete }: ResetTransitionSceneProps) {
  const [phase, setPhase] = useState<ResetTransitionPhase>('settling');
  const completeRef = useRef(false);
  const callbackRef = useRef(onPresentationComplete);
  callbackRef.current = onPresentationComplete;

  useEffect(() => {
    if (phase !== 'settling' && phase !== 'message' && phase !== 'fade' && phase !== 'midnight') return;
    const timer = window.setTimeout(() => {
      if (phase === 'settling') setPhase('message');
      if (phase === 'message') setPhase('handoff');
      if (phase === 'fade') setPhase('midnight');
      if (phase === 'midnight') {
        setPhase('complete');
        if (!completeRef.current) {
          completeRef.current = true;
          callbackRef.current();
        }
      }
    }, resetPhaseDelay(phase, reducedMotion));
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  return <section className={`reset-transition reset-transition--${phase}`} data-testid="reset-transition" data-phase={phase} aria-live="polite">
    {phase === 'settling' && <p className="reset-transition__silence" aria-label="世界正在收束">……</p>}
    {phase === 'message' && <p className="reset-transition__message"><TypewriterText text="世界接手了這一輪。" reducedMotion={reducedMotion} cursor /></p>}
    {phase === 'handoff' && <AmbientPrompt onActivate={() => setPhase('fade')}>將記憶交還給世界</AmbientPrompt>}
    {(phase === 'midnight' || phase === 'complete') && <time className="reset-transition__midnight">00:00</time>}
  </section>;
}
