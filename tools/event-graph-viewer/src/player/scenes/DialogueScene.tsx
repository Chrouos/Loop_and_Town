import { useState } from 'react';
import { AmbientPrompt } from '../ui/AmbientPrompt';
import { TypewriterText } from '../ui/TypewriterText';

export type DialogueChoice = {
  actionId: string;
  label: string;
  disabled?: boolean;
};

type DialogueSceneProps = {
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
  speed?: number;
  reducedMotion?: boolean;
  onAdvance?: () => void;
  onChoose?: (actionId: string) => void;
};

export function DialogueScene({
  speaker,
  text,
  choices = [],
  speed,
  reducedMotion = false,
  onAdvance,
  onChoose,
}: DialogueSceneProps) {
  const [complete, setComplete] = useState(false);
  const ready = reducedMotion || complete;
  return <section className="dialogue-scene" aria-label={`${speaker} 的對話`}>
    <p className="dialogue-scene__speaker">{speaker}</p>
    <p className="dialogue-scene__text"><TypewriterText text={text} speed={speed} reducedMotion={reducedMotion} cursor onComplete={() => setComplete(true)} /></p>
    {ready && choices.length > 0 && <div className="dialogue-scene__choices" aria-label="你的選擇">
      {choices.map(choice => <button
        key={choice.actionId}
        className="dialogue-choice"
        type="button"
        disabled={choice.disabled}
        onClick={() => onChoose?.(choice.actionId)}
      >{choice.label}</button>)}
    </div>}
    {ready && choices.length === 0 && onAdvance && <AmbientPrompt onActivate={onAdvance}>繼續走下去</AmbientPrompt>}
  </section>;
}
