import { useEffect, useRef, useState } from 'react';

type TypewriterTextProps = {
  text: string;
  speed?: number;
  punctuationDelay?: number;
  cursor?: boolean;
  reducedMotion?: boolean;
  onComplete?: () => void;
};

function revealDelay(character: string, speed: number, punctuationDelay: number): number {
  if (/[。！？!?…]/u.test(character)) return speed + punctuationDelay * 2;
  if (/[，、；：,;:]/u.test(character)) return speed + punctuationDelay;
  return speed;
}

export function TypewriterText({
  text,
  speed = 30,
  punctuationDelay = 90,
  cursor = false,
  reducedMotion = false,
  onComplete,
}: TypewriterTextProps) {
  const [revealed, setRevealed] = useState(() => reducedMotion ? text.length : 0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;
    let complete = false;
    let timer: number | undefined;

    const finish = () => {
      if (cancelled || complete) return;
      complete = true;
      onCompleteRef.current?.();
    };

    if (reducedMotion || text.length === 0) {
      setRevealed(text.length);
      finish();
      return () => { cancelled = true; };
    }

    setRevealed(0);
    let index = 0;
    const revealNext = () => {
      if (cancelled) return;
      index += 1;
      setRevealed(index);
      if (index >= text.length) {
        finish();
        return;
      }
      timer = window.setTimeout(revealNext, revealDelay(text[index], speed, punctuationDelay));
    };

    timer = window.setTimeout(revealNext, speed);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [punctuationDelay, reducedMotion, speed, text]);

  const complete = revealed >= text.length;
  return <span className="typewriter-text" data-testid="typewriter-text" data-complete={complete ? 'true' : 'false'} aria-live="polite">
    {text.slice(0, revealed)}
    {cursor && complete && <span className="typewriter-cursor" data-testid="typewriter-cursor" aria-hidden="true">▌</span>}
  </span>;
}
