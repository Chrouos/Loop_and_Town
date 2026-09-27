import { sortTimeline } from '../lib/timeline';
import { diffWorldlines } from '../lib/worldlineDiff';
import type { WorldlineEntry } from '../types/story';

function displayTime(entry: WorldlineEntry): string {
  return entry.day && entry.day > 0 ? `D${entry.day} ${entry.time}` : entry.time;
}

function label(entry?: WorldlineEntry) {
  if (!entry) return '未發生';
  const duration = entry.endTime && entry.endTime !== entry.time ? ` (${entry.time}–${entry.endTime})` : '';
  return `${entry.title}${duration}`;
}

function sourceLabel(entry?: WorldlineEntry) {
  if (!entry) return '';
  if (entry.source === 'player') return '玩家介入';
  if (entry.source === 'delayed') return '延遲後果';
  return entry.variantId ?? entry.eventId;
}

function timelineKey(entry: WorldlineEntry): string {
  return `${entry.absoluteMinute ?? `${entry.day ?? 0}:${entry.time}`}:${entry.eventId}`;
}

export function TimelineView({
  leftEntries,
  rightEntries,
}: {
  leftEntries: WorldlineEntry[];
  rightEntries: WorldlineEntry[];
}) {
  const rows = diffWorldlines(leftEntries, rightEntries);
  const leftKeys = new Set(leftEntries.map(timelineKey));
  const timeline = sortTimeline([
    ...leftEntries,
    ...rightEntries.filter((right) => !leftKeys.has(timelineKey(right))),
  ]);
  const milestones = [...new Map(timeline.map((entry) => [
    entry.absoluteMinute ?? `${entry.day ?? 0}:${entry.time}`,
    { time: displayTime(entry), title: entry.title },
  ])).values()];

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">故事順序 · Timeline</p>
          <h2>兩條世界線的時間差異</h2>
        </div>
        <p>依實際執行時間對齊玩家介入、事件與延遲後果</p>
      </div>
      <div className="story-rail" aria-label="故事順序">
        {milestones.map((milestone, index) => (
          <div className="story-step" key={milestone.time}>
            {index > 0 && <span className="story-arrow" aria-hidden="true">→</span>}
            <time>{milestone.time}</time>
            <strong>{milestone.title}</strong>
          </div>
        ))}
      </div>
      <div className="diff-table timeline-diff" role="table" aria-label="時間線比較">
        <div className="diff-header" role="row">
          <strong>世界線 A</strong><span>故事節點</span><strong>世界線 B</strong>
        </div>
        {rows.map((row) => (
          <div className={`diff-row ${row.status}`} role="row" key={row.key}>
            <div>
              <strong>{label(row.left)}</strong>
              {row.left && <small>{sourceLabel(row.left)}</small>}
            </div>
            <div className="diff-status">
              <time>{row.time}</time>
              <span>{row.status === 'same' ? '相同' : row.status === 'changed' ? '改變' : row.status === 'left-only' ? '只在 A' : '只在 B'}</span>
            </div>
            <div>
              <strong>{label(row.right)}</strong>
              {row.right && <small>{sourceLabel(row.right)}</small>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
