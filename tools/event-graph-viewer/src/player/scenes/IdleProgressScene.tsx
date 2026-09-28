import type { SceneEta } from '../presentation/model';
import { AmbientPrompt } from '../ui/AmbientPrompt';

type IdleProgressSceneProps = {
  actor?: string;
  activity: string;
  canIntervene: boolean;
  eta: SceneEta;
  onIntervene?: () => void;
};

function etaLabel(eta: SceneEta): string | undefined {
  if (eta.kind === 'exact') return `預計完成時間：${eta.expectedAt}`;
  if (eta.kind === 'approximate') return `大約還需要 ${eta.minutes} 分鐘`;
  return undefined;
}

export function IdleProgressScene({ actor, activity, canIntervene, eta, onIntervene }: IdleProgressSceneProps) {
  const label = etaLabel(eta);
  return <section className="idle-progress-scene" data-testid="idle-progress" aria-label="等待中的世界">
    {actor && <p className="idle-progress-scene__actor">{actor}</p>}
    <p className="idle-progress-scene__activity">{activity}</p>
    {label ? <p className="idle-progress-scene__eta">{label}</p> : <p className="idle-progress-scene__unknown" aria-label="完成時間未知">...... ▌</p>}
    {canIntervene && <AmbientPrompt onActivate={onIntervene ?? (() => undefined)}>現在介入</AmbientPrompt>}
  </section>;
}
