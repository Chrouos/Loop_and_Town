import type { PlayerPresentationModel } from '../presentation/types';

type Props = { presentation: PlayerPresentationModel };

const MODE_LABELS: Record<PlayerPresentationModel['mode'], string> = {
  opening: '剛剛抵達',
  reading: '正在閱讀',
  attention: '正在留意',
  capture: '正在留下',
  waiting: '世界仍在前進',
  reset: '輪迴交接',
};

export function PlayerPresentationHud({ presentation }: Props) {
  return <header className="player-presentation-hud" aria-label="場景上下文">
    <div>
      <span className="player-presentation-hud__location">{presentation.location}</span>
      <span className="player-presentation-hud__mode">{MODE_LABELS[presentation.mode]}</span>
    </div>
    <time dateTime={presentation.timeLabel}>{presentation.timeLabel}</time>
  </header>;
}
