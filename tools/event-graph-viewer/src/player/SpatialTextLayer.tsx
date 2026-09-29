import { useEffect, useRef, useState } from 'react';
import { frameSpatialScript, nextSpatialDeadline, type SpatialScript } from './spatialText';

type Props = {
  script: SpatialScript;
  now?: () => number;
  elapsedMs?: number;
  className?: string;
};

export function SpatialTextLayer({ script, now = Date.now, elapsedMs, className = '' }: Props) {
  const startedAt = useRef(now());
  const [internalElapsed, setInternalElapsed] = useState(0);
  const elapsed = elapsedMs ?? internalElapsed;

  useEffect(() => {
    if (elapsedMs !== undefined) return;
    const next = nextSpatialDeadline(script, internalElapsed);
    if (next === undefined) return;
    const delay = Math.max(1, next - Math.max(internalElapsed, now() - startedAt.current));
    const timer = window.setTimeout(() => {
      setInternalElapsed(Math.max(next, now() - startedAt.current));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [script, internalElapsed, elapsedMs, now]);

  const frame = frameSpatialScript(script, elapsed);

  return (
    <div className={`spatial-text-stage ${className}`.trim()} aria-label="場景文字">
      {frame.echoes.map((echo) => (
        <span
          key={`echo:${echo.id}`}
          className={`spatial-phrase spatial-${echo.kind} text-echo`}
          data-anchor={echo.anchor}
          data-speaker={echo.speaker}
          style={{ opacity: echo.opacity }}
          aria-hidden="true"
        >
          {echo.text}
        </span>
      ))}
      {frame.active && (
        <span
          key={`active:${frame.active.id}`}
          className={`spatial-phrase spatial-${frame.active.kind}`}
          data-anchor={frame.active.anchor}
          data-speaker={frame.active.speaker}
          aria-live="polite"
        >
          {frame.active.visibleText}
        </span>
      )}
    </div>
  );
}
