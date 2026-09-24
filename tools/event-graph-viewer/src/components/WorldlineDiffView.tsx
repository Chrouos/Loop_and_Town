import { diffWorldlines } from '../lib/worldlineDiff';
import type { StoryDiffRow } from '../simulator/worldlineDiff';
import type { WorldlineHistoryEntry } from '../simulator/types';
import type { WorldlineEntry } from '../types/story';

type Props =
  | { rows: StoryDiffRow[]; left?: undefined; right?: undefined }
  | { rows?: undefined; left: WorldlineEntry[]; right: WorldlineEntry[] };

type DisplayEntry = WorldlineEntry | WorldlineHistoryEntry;

function label(entry?: DisplayEntry) {
  if (!entry) return '未發生';
  const dayPrefix = 'day' in entry && typeof entry.day === 'number' && entry.day > 0 ? `D${entry.day} ` : '';
  const variant = entry.variantId ? ` · ${entry.variantId}` : '';
  return `${dayPrefix}${entry.time} ${entry.title}${variant}`;
}

export function WorldlineDiffView(props: Props) {
  const rows = props.rows ?? diffWorldlines(props.left ?? [], props.right ?? []);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">世界線比較</p>
          <h2>Worldline Diff</h2>
        </div>
        <p>Author History · 包含 hidden schedule 與實際 Event Variant</p>
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
