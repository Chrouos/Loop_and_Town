import type { KeyboardEvent } from 'react';

export type InputParityProps = {
  onAdvance?: () => void;
  onAttend?: () => void;
  onCapture?: () => void;
  onRelease?: () => void;
  onSelectMode?: (mode: 'ACCELERATED' | 'LIVE_SYNC') => void;
};

export function InputParity({ onAdvance, onAttend, onCapture, onRelease, onSelectMode }: InputParityProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const action = event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ' ? onAdvance
      : event.key.toLowerCase() === 'a' ? onAttend
        : event.key.toLowerCase() === 'c' ? onCapture
          : event.key === 'Escape' ? onRelease
            : undefined;
    if (!action) return;
    event.preventDefault();
    action();
  }

  if (!onAdvance && !onAttend && !onCapture && !onRelease && !onSelectMode) return null;
  return <div className="input-parity" role="group" aria-label="場景操作" tabIndex={0} onKeyDown={onKeyDown}>
    {onAdvance && <button type="button" aria-keyshortcuts="ArrowRight Enter Space" onClick={onAdvance}>繼續</button>}
    {onAttend && <button type="button" aria-keyshortcuts="A" onClick={onAttend}>留意</button>}
    {onCapture && <button type="button" aria-keyshortcuts="C" onClick={onCapture}>捕捉記憶</button>}
    {onRelease && <button type="button" aria-keyshortcuts="Escape" onClick={onRelease}>放開注意力</button>}
    {onSelectMode && <>
      <button type="button" onClick={() => onSelectMode('ACCELERATED')}>回到記憶開始的地方</button>
      <button type="button" onClick={() => onSelectMode('LIVE_SYNC')}>跟著現在走</button>
    </>}
  </div>;
}

