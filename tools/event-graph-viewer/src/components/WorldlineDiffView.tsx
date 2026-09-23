import { diffWorldlines } from '../lib/worldlineDiff';
import type { WorldlineEntry } from '../types/story';

function label(entry?: WorldlineEntry) {
  return entry ? `${entry.time} ${entry.title}` : '未發生';
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
        <p>同一 Event 的 Variant 改變會保留在同一列</p>
      </div>
      <div className="diff-table" role="table" aria-label="Worldline comparison">
        <div className="diff-header" role="row">
          <strong>Loop 04</strong><span>狀態</span><strong>Loop 05</strong>
        </div>
        {rows.map((row) => (
          <div className={`diff-row ${row.status}`} role="row" key={row.key}>
            <div>{label(row.left)}</div>
            <div className="diff-status">{row.status === 'same' ? '相同' : '變更'}</div>
            <div>{label(row.right)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
