import { sortTimeline } from './timeline';
import type { DiffRow, WorldlineEntry } from '../types/story';

export function diffWorldlines(left: WorldlineEntry[], right: WorldlineEntry[]): DiffRow[] {
  function indexEntries(entries: WorldlineEntry[]) {
    const occurrences = new Map<string, number>();
    return new Map(entries.map((entry) => {
      const baseKey = entry.source === 'event' ? entry.eventId : `${entry.source}:${entry.eventId}`;
      const occurrence = occurrences.get(baseKey) ?? 0;
      occurrences.set(baseKey, occurrence + 1);
      return [`${baseKey}${occurrence === 0 ? '' : `:${occurrence}`}`, entry] as const;
    }));
  }

  const leftByEvent = indexEntries(left);
  const rightByEvent = indexEntries(right);
  const ids = new Set([...leftByEvent.keys(), ...rightByEvent.keys()]);

  const rows: DiffRow[] = [];
  for (const key of ids) {
    const leftEntry = leftByEvent.get(key);
    const rightEntry = rightByEvent.get(key);
    const time = leftEntry?.time ?? rightEntry?.time ?? '00:00';

    let status: DiffRow['status'];
    if (!leftEntry) status = 'right-only';
    else if (!rightEntry) status = 'left-only';
    else if (leftEntry.variantId === rightEntry.variantId && leftEntry.title === rightEntry.title) status = 'same';
    else status = 'changed';

    rows.push({
      key: `${time}:${key}`,
      time,
      left: leftEntry,
      right: rightEntry,
      status,
    });
  }

  const sorted = sortTimeline(rows.map((row) => ({
    time: row.time,
    eventId: row.key,
    title: row.key,
    source: 'event' as const,
  })));
  const order = new Map(sorted.map((entry, index) => [entry.eventId, index]));
  return rows.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
}
