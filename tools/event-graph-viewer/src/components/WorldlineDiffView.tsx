import { diffWorldlines } from '../lib/worldlineDiff';
import type { WorldlineEntry } from '../types/story';

function label(entry?: WorldlineEntry) {
  if (!entry) return '未發生';
  const variants: Record<string, string> = {
    wakaharu_dies: '若晴死亡',
    doctor_dies: '醫生死亡',
    no_death: '沒有人死亡',
    reporter_missing: '記者失蹤',
  };
  const time = entry.source === 'player' && entry.durationMinutes === 0
    ? `${entry.time} 立即`
    : entry.source === 'player' && entry.endTime
      ? `${entry.time}–${entry.endTime}`
      : entry.time;
  const title = entry.source === 'event' ? variants[entry.variantId ?? ''] ?? entry.title : entry.title;
  return `${time} ${title}`;
}

export function WorldlineDiffView({ left, right }: { left: WorldlineEntry[]; right: WorldlineEntry[] }) {
  const rows = diffWorldlines(left, right);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">世界線比較</p>
          <h2 aria-label="Worldline Diff">世界線比較</h2>
        </div>
        <p>同一 Event 的 Variant 改變會保留在同一列</p>
      </div>
      <div className="diff-table" role="table" aria-label="Worldline comparison">
        <div className="diff-header" role="row">
          <strong>世界線 A</strong><span>狀態</span><strong>世界線 B</strong>
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
