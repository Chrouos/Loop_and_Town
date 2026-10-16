import { useEffect, useState } from 'react';
import './AutoFlowNarrative.css';

type Props = {
  lines: string[];
  title?: string;
  reducedMotion?: boolean;
  onComplete?: () => void;
};

export function playbackDelay(text: string): number {
  return Math.min(2800, Math.max(1100, text.length * 95 + (/[？！。…]$/.test(text) ? 450 : 0)));
}

// A diegetic renderer: automatic, sequential and deliberately stopped at the final line.
// Changes to world state/choices remain the owning PlayerApp's responsibility.
export function AutoFlowNarrative({ lines, title, reducedMotion = false, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const [letters, setLetters] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const sequence = lines.length ? lines : ['……'];
  const line = sequence[Math.min(index, sequence.length - 1)];
  const fullyVisible = letters >= line.length;

  useEffect(() => {
    if (paused || finished) return;
    if (!fullyVisible) {
      if (reducedMotion) { setLetters(line.length); return; }
      const timer = window.setTimeout(() => setLetters(n => Math.min(line.length, n + 1)), 34);
      return () => window.clearTimeout(timer);
    }
    if (index === sequence.length - 1) {
      setFinished(true);
      onComplete?.();
      return;
    }
    const timer = window.setTimeout(() => {
      setIndex(n => n + 1);
      setLetters(0);
    }, reducedMotion ? 500 : playbackDelay(line));
    return () => window.clearTimeout(timer);
  }, [paused, finished, fullyVisible, reducedMotion, index, line, sequence.length, onComplete]);

  function handleAdvance() {
    if (finished) return;
    if (!fullyVisible) { setLetters(line.length); return; }
    setIndex(n => Math.min(n + 1, sequence.length - 1));
    setLetters(0);
  }

  return <section className="auto-flow-narrative" aria-label="自動播放敘事"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    {title && <p className="auto-flow-narrative__chapter">{title}</p>}
    <div className="auto-flow-narrative__focus" role="status" aria-live="off">
      {index > 0 && <p key={index - 1} className="auto-flow-narrative__echo">{sequence[index - 1]}</p>}
      <p key={index} className="auto-flow-narrative__active">{line.slice(0, letters)}{!fullyVisible && <span className="auto-flow-narrative__cursor" aria-hidden="true">▏</span>}</p>
    </div>
    <div className="auto-flow-narrative__control">
      {!finished ? <>
        <button type="button" onClick={handleAdvance} aria-label="顯示完整句子或接續對話">···</button>
        <button type="button" onClick={() => setPaused(v => !v)} aria-pressed={paused}>{paused ? '播放' : '暫停'}</button>
      </> : <span>……</span>}
    </div>
  </section>;
}
