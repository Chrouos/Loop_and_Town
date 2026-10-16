import { InlineTextTarget } from '../ui/InlineTextTarget';
import { TypewriterText } from '../ui/TypewriterText';

type OpeningSceneProps = {
  label: string;
  lines: string[];
  onOpenLetter: () => void;
  onAttendPaper?: () => void;
  paperAvailable?: boolean;
  paperFocused?: boolean;
  onPreviewPaper?: (focused: boolean) => void;
  observation?: string[];
  note?: string;
  reducedMotion?: boolean;
  onCapture?: () => void;
  capturing?: boolean;
  captured?: boolean;
};

export function OpeningScene({ label, lines, onOpenLetter, onAttendPaper, paperAvailable = false,
  paperFocused = false, onPreviewPaper, observation, note, reducedMotion = false, onCapture, capturing, captured }: OpeningSceneProps) {
  return <section className="opening opening-scene" aria-label="進入灰潮鎮"
    data-inline-focus={paperFocused ? 'true' : 'false'}>
    <p className="opening-scene__main"><TypewriterText text="你是在返鄉列車的晃動裡醒來的。" speed={18} punctuationDelay={60} cursor reducedMotion={reducedMotion} /></p>
    <p className="opening-scene__main">現在是灰潮鎮的{label}。車窗外仍很暗。</p>
    <p className="opening-scene__main">
      手指滑過信封裡的
      <InlineTextTarget available={paperAvailable} focused={paperFocused}
        onAttend={() => onAttendPaper?.()} onPreview={onPreviewPaper}>紙張</InlineTextTarget>。
    </p>
    {lines.map(line => <p key={line} className="opening-scene__aside">{line}</p>)}
    {observation?.length ? <div className="opening-scene__observation" role="status">
      {observation.map(x=><p key={x}>{x}</p>)}
      {capturing ? <span>……正在把這個瞬間留下來</span>
        : captured ? <span>這一刻已被你記下。</span>
        : onCapture ? <button type="button" className="opening-scene__capture" onClick={onCapture}>把這一刻記在心裡</button> : null}
    </div> : null}
    <button type="button" className="envelope-button" onClick={onOpenLetter} aria-label="拆開信封，讀姊姊的信">
      <span className="envelope" aria-hidden="true"><span className="envelope-flap"/><span className="envelope-name">林知夏　寄</span></span>
      <span className="envelope-action">拆開信封</span>
    </button>
    {note && <p className="inline-note" role="status">{note}</p>}
  </section>;
}
