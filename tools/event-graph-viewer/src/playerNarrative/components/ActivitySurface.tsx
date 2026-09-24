export type ActivitySurfaceProps = {
  timeLabel: string;
  title: string;
  prose?: string;
};

export function ActivitySurface({ timeLabel, title, prose }: ActivitySurfaceProps) {
  return (
    <section className="activity-surface" aria-label="目前活動">
      <time>{timeLabel}</time>
      <div className="activity-center">
        <p className="activity-title">{title}</p>
        {prose && <p className="ambient-prose">{prose}</p>}
      </div>
    </section>
  );
}
