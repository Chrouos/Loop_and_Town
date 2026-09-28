import { useEffect } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { NarrativeBlock } from '../../narrative/types';
import { isTypewriterComplete, nextRevealDelay } from '../typewriter';

export type PlaybackPhase = 'typing' | 'waiting';

export type NarrativeSurfaceProps = {
  block: NarrativeBlock;
  previousBlocks?: NarrativeBlock[];
  phase: PlaybackPhase;
  revealedCharacters: number;
  speakerNames?: Record<string, string>;
  onReveal: (revealedCharacters: number) => void;
  onAdvance: () => void;
  showCursor?: boolean;
};

function blockText(block: NarrativeBlock): string {
  return block.type === 'artifact' ? '' : block.text;
}

function blockKey(block: NarrativeBlock, index: number): string {
  return `${block.type}-${block.type === 'dialogue' ? block.speaker : ''}-${index}-${blockText(block)}`;
}

function renderBlock(
  block: NarrativeBlock,
  speakerNames: Record<string, string>,
  text: string,
  className: string,
  key: string,
  showCursor = false,
) {
  const cursor = showCursor ? <span className="typing-cursor" aria-hidden="true" /> : null;
  if (block.type === 'dialogue') {
    return (
      <div className={`dialogue-beat ${className}`} key={key}>
        <span className="dialogue-speaker">{speakerNames[block.speaker] ?? block.speaker}</span>
        <p>「{text}」{cursor}</p>
      </div>
    );
  }

  return (
    <p className={`${block.type === 'monologue' ? 'monologue-beat' : 'narration-beat'} ${className}`} key={key}>
      {text}{cursor}
    </p>
  );
}

export function NarrativeSurface({
  block,
  previousBlocks = [],
  phase,
  revealedCharacters,
  speakerNames = {},
  onReveal,
  onAdvance,
  showCursor = true,
}: NarrativeSurfaceProps) {
  const text = blockText(block);
  const visibleText = text.slice(0, Math.max(0, Math.min(revealedCharacters, text.length)));

  useEffect(() => {
    if (phase !== 'typing' || isTypewriterComplete(text, revealedCharacters)) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      onReveal(text.length);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onReveal(revealedCharacters + 1);
    }, nextRevealDelay(text, revealedCharacters));
    return () => window.clearTimeout(timer);
  }, [phase, text, revealedCharacters, onReveal]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    onAdvance();
  }

  function handleClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
    onAdvance();
  }

  return (
    <section
      className="narrative-surface"
      aria-label="故事"
      aria-describedby="narrative-full-text"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="narrative-copy">
        {previousBlocks.slice(-2).map((previous, index) =>
          renderBlock(previous, speakerNames, blockText(previous), `narrative-previous narrative-previous-${index + 1}`, blockKey(previous, index)),
        )}
        {renderBlock(block, speakerNames, visibleText, 'narrative-active', blockKey(block, 2), showCursor)}
        <span id="narrative-full-text" className="sr-only">{text}</span>
      </div>
    </section>
  );
}
