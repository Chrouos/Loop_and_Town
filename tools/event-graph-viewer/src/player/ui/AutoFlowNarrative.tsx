import { useEffect, useState, type ReactNode } from 'react';
import './AutoFlowNarrative.css';
import { inlineAnchors, type InlineExcerpt } from './inlineMemory';

type Props = {
  lines: string[];
  title?: string;
  reducedMotion?: boolean;
  onComplete?: () => void;
  excerpts?: InlineExcerpt[];
  onRemember?: (id: string) => boolean | void;
  rememberedIds?: string[];
};

export function playbackDelay(text: string): number {
  return Math.min(2800, Math.max(1100, text.length * 95 + (/[？！。…]$/.test(text) ? 450 : 0)));
}

// A diegetic renderer: automatic, sequential and deliberately stopped at the final line.
// Changes to world state/choices remain the owning PlayerApp's responsibility.
export function AutoFlowNarrative({ lines, title, reducedMotion = false, onComplete, excerpts = [], onRemember, rememberedIds = [] }: Props) {
  const [index, setIndex] = useState(0);
  const [letters, setLetters] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [recentlyRemembered, setRecentlyRemembered] = useState<string | null>(null);
  const sequence = lines.length ? lines : ['……'];
  const line = sequence[Math.min(index, sequence.length - 1)];
  const fullyVisible = letters >= line.length;
  const anchoredIds = new Set(sequence.flatMap(text => inlineAnchors(text, excerpts).map(anchor => anchor.id)));
  const unanchored = excerpts.filter(excerpt => !anchoredIds.has(excerpt.id));

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

  useEffect(() => {
    if (!recentlyRemembered) return;
    const timer = window.setTimeout(() => setRecentlyRemembered(null), 1100);
    return () => window.clearTimeout(timer);
  }, [recentlyRemembered]);

  function remember(id: string) {
    if (rememberedIds.includes(id)) return;
    const accepted = onRemember?.(id);
    if (accepted !== false && accepted !== undefined) setRecentlyRemembered(id);
  }

  function renderVisibleText(visible: string) {
    const anchors = inlineAnchors(line, excerpts).filter(anchor => anchor.end <= visible.length);
    const nodes: ReactNode[] = [];
    let cursor = 0;
    for (const anchor of anchors) {
      nodes.push(visible.slice(cursor, anchor.start));
      nodes.push(<button type="button" key={anchor.id} className={`auto-flow-narrative__memory${rememberedIds.includes(anchor.id) ? " auto-flow-narrative__memory--saved" : ""}${recentlyRemembered === anchor.id ? " auto-flow-narrative__memory--just-saved" : ""}`} title={rememberedIds.includes(anchor.id) ? "已收進推理桌" : "記住這個線索"} aria-label={`${rememberedIds.includes(anchor.id) ? "已記住" : "記住"}：${visible.slice(anchor.start, anchor.end)}`} disabled={rememberedIds.includes(anchor.id)} onClick={() => remember(anchor.id)}>{visible.slice(anchor.start, anchor.end)}</button>);
      cursor = anchor.end;
    }
    nodes.push(visible.slice(cursor));
    return nodes;
  }

  function handleAdvance() {
    if (finished) return;
    if (!fullyVisible) { setLetters(line.length); return; }
    setIndex(n => Math.min(n + 1, sequence.length - 1));
    setLetters(0);
  }

  return <section className="auto-flow-narrative" aria-label="自動播放敘事">
    {title && <p className="auto-flow-narrative__chapter">{title}</p>}
    <div className="auto-flow-narrative__focus" role="status" aria-live="off">
      {index > 0 && <p key={index - 1} className="auto-flow-narrative__echo">{sequence[index - 1]}</p>}
      <p key={index} className="auto-flow-narrative__active">{renderVisibleText(line.slice(0, letters))}{!fullyVisible && <span className="auto-flow-narrative__cursor" aria-hidden="true">▏</span>}</p>
    </div>
    <div className="auto-flow-narrative__transcript" aria-label="完整敘事紀錄">{sequence.map((item, i) => <p key={i}>{item}</p>)}</div>
    {moreOpen && <div className="auto-flow-narrative__other-clues" aria-label="其他可記住的線索">{unanchored.map(item => <button type="button" key={item.id} disabled={rememberedIds.includes(item.id)} onClick={() => { remember(item.id); setMoreOpen(false); }}>{item.text}</button>)}</div>}
    <div className="auto-flow-narrative__control">
      {unanchored.length > 0 && <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(v => !v)}>其他線索</button>}
      {!finished ? <>
        <button type="button" onClick={handleAdvance} aria-label="顯示完整句子或接續對話">···</button>
        <button type="button" onClick={() => setPaused(v => !v)} aria-pressed={paused}>{paused ? '播放' : '暫停'}</button>
      </> : <span>……</span>}
    </div>
  </section>;
}
