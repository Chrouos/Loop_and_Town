import type { NarrativeBlock } from '../../narrative/types';

export type NarrativeSurfaceProps = {
  blocks: NarrativeBlock[];
  visibleCount?: number;
  speakerNames?: Record<string, string>;
  onContinue?: () => void;
  continueLabel?: string;
};

export function NarrativeSurface({
  blocks,
  visibleCount = blocks.length,
  speakerNames = {},
  onContinue,
  continueLabel = '繼續',
}: NarrativeSurfaceProps) {
  const visible = blocks.slice(0, Math.max(0, visibleCount));

  return (
    <section className="narrative-surface" aria-label="故事">
      <div className="narrative-copy">
        {visible.map((block, index) => {
          if (block.type === 'artifact') return null;
          if (block.type === 'dialogue') {
            return (
              <div className="dialogue-beat" key={`${block.speaker}-${index}`}>
                <span className="dialogue-speaker">{speakerNames[block.speaker] ?? block.speaker}</span>
                <p>「{block.text}」</p>
              </div>
            );
          }
          return (
            <p className={block.type === 'monologue' ? 'monologue-beat' : 'narration-beat'} key={index}>
              {block.text}
            </p>
          );
        })}
      </div>
      {onContinue && (
        <button className="continue-button" type="button" onClick={onContinue}>
          {continueLabel}
        </button>
      )}
    </section>
  );
}
