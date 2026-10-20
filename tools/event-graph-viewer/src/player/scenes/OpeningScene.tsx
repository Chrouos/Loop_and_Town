import { InlineTextTarget } from '../ui/InlineTextTarget';
type OpeningSceneProps = {
  label: string;
  lines: string[];
  onOpenLetter: () => void;
  paperAvailable?: boolean;
  onAttendPaper?: () => void;
};

export function OpeningScene({ label, lines, onOpenLetter, paperAvailable = false, onAttendPaper }: OpeningSceneProps) {
  return <section className="opening opening-scene" aria-label="進入灰潮鎮">
    <p>列車沿著鐵軌晃動，你從夢裡醒來。</p>
    <p>現在是灰潮鎮的{label}，你手裡還握著那封不該出現的信。</p>
    <p>手指滑過信封裡的<InlineTextTarget available={paperAvailable} onAttend={() => onAttendPaper?.()}>紙張</InlineTextTarget>。</p>
    {lines.map(line => <p key={line}>{line}</p>)}
    <button className="envelope-button" onClick={onOpenLetter} aria-label="拆開信封，讀姊姊的信">
      <span className="envelope" aria-hidden="true"><span className="envelope-flap"/><span className="envelope-name">林知夏　寄</span></span>
      <span className="envelope-action">拆開信封</span>
    </button>
  </section>;
}
