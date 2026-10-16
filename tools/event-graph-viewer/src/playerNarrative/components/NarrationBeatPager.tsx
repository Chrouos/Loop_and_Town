import { useEffect, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { NarrativeBlock } from '../../narrative/types';
import { nextRevealDelay } from '../typewriter';
import type { PlaybackPhase } from './NarrativeSurface';

type Props = {
  block: NarrativeBlock;
  phase: PlaybackPhase;
  revealedCharacters: number;
  speakerNames?: Record<string, string>;
  onReveal: (count: number) => void;
  onAdvance: () => void;
  showCursor?: boolean;
};

// Page boundaries remain deterministic, so changing the viewport never loses story progress.
export function splitNarrationPages(text: string, maxCharacters = 105): string[] {
  if (!text) return [''];
  const pages: string[] = [];
  let rest = text;
  while (rest.length > maxCharacters) {
    const candidate = rest.slice(0, maxCharacters + 1);
    const punctuation = Math.max(...['。', '！', '？', '\\n', '；'].map(mark => candidate.lastIndexOf(mark)));
    const breakAt = punctuation >= Math.floor(maxCharacters * .45) ? punctuation + 1 : maxCharacters;
    pages.push(rest.slice(0, breakAt));
    rest = rest.slice(breakAt);
  }
  if (rest) pages.push(rest);
  return pages;
}

export function NarrationBeatPager({ block, phase, revealedCharacters, speakerNames = {}, onReveal, onAdvance, showCursor = true }: Props) {
  const text = block.type === 'artifact' ? '' : block.text;
  const pages = splitNarrationPages(text);
  const [pageIndex, setPageIndex] = useState(0);
  const boundedPage = Math.min(pageIndex, pages.length - 1);
  const start = pages.slice(0, boundedPage).join('').length;
  const end = start + pages[boundedPage].length;
  const pageComplete = revealedCharacters >= end;
  const visible = text.slice(start, Math.min(end, revealedCharacters));
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => { setPageIndex(0); }, [block]);

  useEffect(() => {
    if (pageComplete || phase !== 'typing') return;
    if (reducedMotion) { onReveal(end); return; }
    const timeout = window.setTimeout(() => onReveal(Math.min(end, revealedCharacters + 1)), nextRevealDelay(text, revealedCharacters));
    return () => window.clearTimeout(timeout);
  }, [pageComplete, phase, end, reducedMotion, onReveal, revealedCharacters, text]);

  function advance() {
    if (!pageComplete) { onReveal(end); return; }
    if (boundedPage < pages.length - 1) { setPageIndex(boundedPage + 1); return; }
    onAdvance();
  }
  function handleKeyboard(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    advance();
  }
  function handleClick(e: MouseEvent<HTMLElement>) {
    // Nested interactive words or clues must not advance the story.
    if (e.target instanceof Element && e.target.closest('button, a, [data-clue]')) return;
    e.stopPropagation();
    advance();
  }

  return <section className="narration-beat-pager" aria-label="故事敘事" tabIndex={0} onClick={handleClick} onKeyDown={handleKeyboard}>
    <div className="narration-beat-pager__copy" aria-live="off">
      {block.type === 'dialogue' && <span className="narration-beat-pager__speaker">{speakerNames[block.speaker] ?? block.speaker}</span>}
      <p className={block.type === 'monologue' ? 'narration-beat-pager__monologue' : ''}>{block.type === 'dialogue' ? '「' : ''}{visible}{block.type === 'dialogue' && end === text.length && pageComplete ? '」' : ''}{showCursor && !pageComplete && <span className="typing-cursor" aria-hidden="true" />}</p>
    </div>
    <div className="narration-beat-pager__footer" aria-hidden="true">
      <span>{boundedPage + 1} / {pages.length}</span>
      <span>{pageComplete ? (boundedPage === pages.length - 1 ? '點擊任意處繼續　⌄' : '點擊翻頁　⌄') : '……'}</span>
    </div>
    <span className="sr-only">{text}</span>
  </section>;
}
