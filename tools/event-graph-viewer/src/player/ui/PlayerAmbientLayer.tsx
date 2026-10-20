import type { PlayerPresentationModel } from '../presentation/types';

type Props = { presentation: PlayerPresentationModel; onAttend?: (id: string) => void; focusedId?: string | null };
const labels: Record<string,string> = {
 'train-rustle':'沙沙、沙沙——','train-wheel':'喀。','train-announcement':'廣播聲……',
 'station-blackout':'……鐘聲？','signal-ledger':'……螢幕的數字？',
 'backup-relay':'……門邊的銘牌？','track-damage':'……路面的新痕？',
 'external-ack':'……閃爍的紀錄器？'
};
export function PlayerAmbientLayer({ presentation, onAttend, focusedId }: Props) {
 const cues = presentation.ambientCues.filter(cue => cue.id !== 'paper-word').slice(0,2);
 return <aside className="player-ambient-layer" aria-label="周遭動靜" data-ambient-count={cues.length}>
 {cues.map(cue => <button type="button" key={cue.id} className="player-ambient-layer__cue"
  aria-label={labels[cue.id] ?? cue.title} aria-pressed={focusedId === cue.id}
  onClick={() => onAttend?.(cue.id)}>{labels[cue.id] ?? cue.title}</button>)}
 </aside>;
}
