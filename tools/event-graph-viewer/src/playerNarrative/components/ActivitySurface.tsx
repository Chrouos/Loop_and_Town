import type { ActivityPresentationView } from '../activityPresentation';

export type ActivitySurfaceProps = {
  timeLabel: string;
  presentation: ActivityPresentationView;
  prose?: string;
};

export function ActivitySurface({ timeLabel, presentation, prose }: ActivitySurfaceProps) {
  return (
    <section className="activity-surface" aria-label="目前活動">
      <time>{timeLabel}</time>
      <div className="activity-center">
        <p className="activity-title">{presentation.title}</p>
        {prose && <p className="ambient-prose">{prose}</p>}
        {presentation.remainingLabel && <p className="activity-remaining">{presentation.remainingLabel}</p>}
        {presentation.etaLabel && <p className="activity-eta">{presentation.etaLabel}</p>}
        <span className="activity-waiting-cursor" aria-hidden="true">.....</span>
      </div>
    </section>
  );
}
