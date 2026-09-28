import type { StoryDiffRow } from '../simulator/worldlineDiff';
import type { WorldlineHistoryEntry } from '../simulator/types';

function label(entry?: WorldlineHistoryEntry) {
  if (!entry) return '未發生';
  const dayPrefix = entry.day && entry.day > 0 ? `D${entry.day} ` : '';
  const variant = entry.variantId ? ` · ${entry.variantId}` : '';
  const duration = entry.endTime && entry.endTime !== entry.time ? `–${entry.endTime}` : '';
  return `${dayPrefix}${entry.time}${duration} ${entry.title}${variant}`;
}

function sourceLabel(entry?: WorldlineHistoryEntry) {
  if (!entry) return '';
  if (entry.kind === 'player-action') return '玩家介入';
  if (entry.kind === 'delayed-effect') return '延遲後果';
  if (entry.kind === 'schedule') return '角色行程';
  return entry.variantId ?? entry.eventId ?? entry.title;
}

export function WorldlineDiffView({ rows }: { rows: StoryDiffRow[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">世界線比較</p>
          <h2>Worldline Diff</h2>
        </div>
        <p>玩家介入、事件與延遲後果都會依時間對齊</p>
      </div>
      <div className="diff-table" role="table" aria-label="Worldline comparison">
        <div className="diff-header" role="row">
          <strong>世界線 A</strong><span>狀態</span><strong>世界線 B</strong>
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
