import type { PlayerPresentationModel } from '../presentation/types';

type Props = { presentation: PlayerPresentationModel };

export function PlayerAmbientLayer({ presentation }: Props) {
  const cue = presentation.ambientCues[0];
  return <aside className="player-ambient-layer" aria-label="環境狀態" data-ambient-count={presentation.ambientCues.length}>
    {cue && <span className="player-ambient-layer__cue"><span>周遭有動靜</span> · {cue.title}</span>}
    {!cue && presentation.mode === 'waiting' && <span className="player-ambient-layer__cue">世界沒有停下來</span>}
    {presentation.attention.phase === 'shifting' && <span className="player-ambient-layer__state">注意力正在移動</span>}
    {presentation.attention.phase === 'observing' && <span className="player-ambient-layer__state">正在留意</span>}
    {presentation.capture.active && <span className="player-ambient-layer__state">正在留下這一刻</span>}
    {presentation.reset.pending && <span className="player-ambient-layer__state">世界正在接手這一輪</span>}
  </aside>;
}
