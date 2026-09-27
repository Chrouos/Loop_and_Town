import type { WorldlineEntry } from '../types/story';

function minutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function readableVariant(variantId?: string) {
  const labels: Record<string, string> = {
    wakaharu_dies: '若晴死亡',
    doctor_dies: '醫生死亡',
    no_death: '沒有人死亡',
    reporter_missing: '記者失蹤',
  };
  return variantId ? labels[variantId] ?? variantId : undefined;
}

function entryLabel(entry?: WorldlineEntry) {
  if (!entry) return '未發生';
  if (entry.source === 'player') return entry.title;
  if (entry.source === 'event') return readableVariant(entry.variantId) ?? entry.title.replace(/^\d{2}:\d{2}\s*/, '');
  return entry.title.replace(/^\d{2}:\d{2}\s*/, '');
}

function entryDetail(entry?: WorldlineEntry) {
  if (!entry) return '這條世界線沒有走到這裡';
  if (entry.source === 'delayed' || entry.eventId === 'evt_2114_reporter_missing' || entry.title.includes('記者失蹤')) return '由前一個事件延遲觸發';
  if (entry.source === 'player') return entry.hasImmediateStateChange === false ? '沒有立即狀態變化' : '玩家介入';
  return entry.variantId ? `命中 ${readableVariant(entry.variantId)}` : '事件本體';
}

function timelineRows(leftEntries: WorldlineEntry[], rightEntries: WorldlineEntry[]) {
  const entriesByTime = new Map<string, { left: WorldlineEntry[]; right: WorldlineEntry[] }>();
  for (const entry of leftEntries) {
    const group = entriesByTime.get(entry.time) ?? { left: [], right: [] };
    group.left.push(entry);
    entriesByTime.set(entry.time, group);
  }
  for (const entry of rightEntries) {
    const group = entriesByTime.get(entry.time) ?? { left: [], right: [] };
    group.right.push(entry);
    entriesByTime.set(entry.time, group);
  }
  return [...entriesByTime.entries()]
    .map(([time, entries]) => ({ time, ...entries }))
    .sort((a, b) => minutes(a.time) - minutes(b.time));
}

function actionTiming(entry: WorldlineEntry) {
  if (entry.durationMinutes === 0) return '立即';
  if (entry.endTime) return `${entry.time}–${entry.endTime}`;
  return entry.time;
}

function WorldlineCell({ entries }: { entries: WorldlineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="timeline-cell empty">
        <strong>{entryLabel()}</strong>
        <span>{entryDetail()}</span>
      </div>
    );
  }

  return (
    <div className="timeline-cell-list">
      {entries.map((entry, index) => (
        <div
          className={entry.hasImmediateStateChange === false ? 'timeline-cell no-immediate-change' : 'timeline-cell'}
          key={`${entry.eventId}:${index}`}
        >
          {entry.source === 'player' && <span>{actionTiming(entry)}</span>}
          <strong>{entryLabel(entry)}</strong>
          <span>{entryDetail(entry)}</span>
        </div>
      ))}
    </div>
  );
}

function storyNode(entry?: WorldlineEntry) {
  if (!entry) return '車站事件';
  if (entry.source === 'player') return '玩家介入';
  if (entry.source === 'delayed' || entry.eventId === 'evt_2114_reporter_missing' || entry.title.includes('記者失蹤')) return '延遲後果';
  return entry.title.replace(/^\d{2}:\d{2}\s*/, '');
}

function storyNodes(entries: WorldlineEntry[]) {
  return [...new Set(entries.map(storyNode))].join(' / ');
}

export function TimelineView({
  entries,
  leftEntries,
  rightEntries,
  loopLabel = '世界線時間線',
}: {
  entries?: WorldlineEntry[];
  leftEntries?: WorldlineEntry[];
  rightEntries?: WorldlineEntry[];
  loopLabel?: string;
}) {
  const left = leftEntries ?? entries ?? [];
  const right = rightEntries ?? entries ?? [];
  const rows = timelineRows(left, right);

  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{loopLabel}</p>
          <h2>世界線時間線</h2>
        </div>
        <p>同一個故事節點並排比較，延遲後果也會保留。</p>
      </div>
      <div className="timeline-table" role="table" aria-label="世界線時間線">
        <div className="timeline-table-header" role="row">
          <span>時間</span>
          <strong>故事節點</strong>
          <strong>世界線 A</strong>
          <strong>世界線 B</strong>
        </div>
        {rows.map((row) => (
          <div className="timeline-table-row" role="row" key={row.time}>
            <time>{row.time}</time>
            <strong>{storyNodes([...row.left, ...row.right])}</strong>
            <WorldlineCell entries={row.left} />
            <WorldlineCell entries={row.right} />
          </div>
        ))}
      </div>
    </section>
  );
}
