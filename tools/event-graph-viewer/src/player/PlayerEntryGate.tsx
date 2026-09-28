import { useEffect, useState } from 'react';
import { SceneFrame } from './ui/SceneFrame';

type Props = {
  onEnter: () => void;
  reducedMotion?: boolean;
};

type EntryPhase = 'invitation' | 'loading';

export function PlayerEntryGate({ onEnter, reducedMotion = false }: Props) {
  const [phase, setPhase] = useState<EntryPhase>('invitation');

  useEffect(() => {
    if (phase !== 'loading') return;
    const timer = window.setTimeout(onEnter, reducedMotion ? 1 : 900);
    return () => window.clearTimeout(timer);
  }, [onEnter, phase, reducedMotion]);

  return <main className="player-entry-shell">
    <SceneFrame className={`scene-frame--flat player-entry-scene player-entry-scene--${phase}`}>
      {phase === 'invitation' ? <div className="player-entry-copy">
        <p className="player-entry-kicker">進入世界……</p>
        <p>一個人正在過她的今天。</p>
        <p>你即將介入一個，尚未知道你會出現的人生。</p>
        <button className="player-entry-action" onClick={() => setPhase('loading')}>介入這個世界<span>讀取你將留下的痕跡</span></button>
      </div> : <div className="player-entry-loading">
        <p>載入存檔……</p>
        <span aria-hidden="true">▌</span>
      </div>}
    </SceneFrame>
  </main>;
}
