import type { PlayerPresentationModel } from '../presentation/types';

type Props = {
  presentation: PlayerPresentationModel;
  onAttend?: (recordId: string) => void;
  onPreview?: (recordId: string | null) => void;
  focusedId?: string | null;
};

const textCue: Record<string, string> = {
  'train-rustle': '沙沙、沙沙——',
  'train-wheel': '喀。',
  'train-announcement': '廣播聲……',
  'station-blackout': '……鐘聲？',
  'signal-ledger': '……螢幕的數字？',
  'backup-relay': '……門邊的銘牌？',
  'track-damage': '……路面的新痕？',
  'external-ack': '……閃爍的紀錄器？',
};

/** Ambient events are actual player-perceivable opportunities, not a debug status feed. */
export function PlayerAmbientLayer({ presentation, onAttend, onPreview, focusedId }: Props) {
  // The word embedded in the narration must not be duplicated as an ambient button.
  const cues = presentation.ambientCues.filter(cue => cue.id !== 'paper-word').slice(0, 2);
  return <aside className="player-ambient-layer" aria-label="周遭動靜" data-ambient-count={cues.length}>
    {cues.map((cue) => (
      <button
        type="button"
        key={cue.id}
        className="player-ambient-layer__cue"
        aria-label={textCue[cue.id] ?? cue.title}
        aria-pressed={focusedId === cue.id}
        data-focus={focusedId === cue.id ? 'true' : 'false'}
        onMouseEnter={() => onPreview?.(cue.id)}
        onMouseLeave={() => onPreview?.(null)}
        onFocus={() => onPreview?.(cue.id)}
        onBlur={() => onPreview?.(null)}
        onClick={() => onAttend?.(cue.id)}
      >
        {textCue[cue.id] ?? cue.title}
      </button>
    ))}
    {cues.length === 0 && presentation.mode === 'waiting' &&
      <span className="player-ambient-layer__state">……</span>}
  </aside>;
}
