import { diffWorldlines } from '../lib/worldlineDiff';
import type { WorldlineEntry } from '../types/story';

function label(entry?: WorldlineEntry) {
  return entry ? entry.title : '未發生';
}

function sourceLabel(entry?: WorldlineEntry) {
  if (!entry) return '';
  if (entry.source === 'player') return '玩家介入';
  if (entry.source === 'delayed') return '延遲後果';
  return entry.variantId ?? entry.eventId;
}

export function WorldlineDiffView({ left, right }: { left: WorldlineEntry[]; right: WorldlineEntry[] }) {
  const rows = diffWorldlines(left, right);
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
            <div><strong>{label(row.left)}</strong>{row.left && <small>{sourceLabel(row.left)}</small>}</div>
            <div className="diff-status"><time>{row.time}</time><span>{row.status === 'same' ? '相同' : row.status === 'changed' ? '改變' : row.status === 'left-only' ? '只在 A' : '只在 B'}</span></div>
            <div><strong>{label(row.right)}</strong>{row.right && <small>{sourceLabel(row.right)}</small>}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
