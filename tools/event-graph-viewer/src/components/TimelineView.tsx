import { sortTimeline } from '../lib/timeline';
import type { WorldlineEntry } from '../types/story';

export function TimelineView({ entries, loopLabel = 'Loop 04' }: { entries: WorldlineEntry[]; loopLabel?: string }) {
  const timeline = sortTimeline(entries);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{loopLabel}</p>
          <h2>Timeline</h2>
        </div>
        <p>依實際發生時間排列</p>
      </div>
      <div className="timeline">
        {timeline.map((entry) => (
          <article className="timeline-item" key={`${entry.time}:${entry.eventId}`}>
            <time>{entry.time}</time>
            <div>
              <strong>{entry.title}</strong>
              <span>{entry.variantId ?? entry.eventId}</span>
              {entry.source === 'delayed' && <em>延遲後果</em>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
