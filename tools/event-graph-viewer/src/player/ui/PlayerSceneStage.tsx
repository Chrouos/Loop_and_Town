import type { ReactNode } from 'react';
import type { PlayerPresentationModel } from '../presentation/types';
import { PlayerAmbientLayer } from './PlayerAmbientLayer';
import { PlayerPresentationHud } from './PlayerPresentationHud';
import { LoopTransitionLayer } from './LoopTransitionLayer';
import { SceneAtmosphere } from './SceneAtmosphere';
import { InputParity, type InputParityProps } from './InputParity';
import './playerSceneStage.css';

type Props = {
  presentation: PlayerPresentationModel;
  children: ReactNode;
  reducedMotion?: boolean;
  audioEnabled?: boolean;
  input?: InputParityProps;
};

export function PlayerSceneStage({ presentation, children, reducedMotion = false, audioEnabled = false, input }: Props) {
  return <section
    className="player-scene-stage"
    aria-label={`玩家場景：${presentation.location}`}
    data-presentation-mode={presentation.mode}
    data-loop={String(presentation.loopId)}
    data-reduced-motion={reducedMotion ? 'true' : 'false'}
    data-audio-cues={audioEnabled ? 'enabled' : 'muted'}
  >
    <SceneAtmosphere presentation={presentation} reducedMotion={reducedMotion} />
    <div className="player-scene-stage__pixel-sky" aria-hidden="true" />
    <div className="player-scene-stage__pixel-horizon" aria-hidden="true" />
    <PlayerPresentationHud presentation={presentation} />
    <PlayerAmbientLayer presentation={presentation} />
    <LoopTransitionLayer presentation={presentation} reducedMotion={reducedMotion} />
    {input && <InputParity {...input} />}
    <div className="player-scene-stage__content">{children}</div>
  </section>;
}
