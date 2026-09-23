import { sortTimeline } from './timeline';
import type { DiffRow, WorldlineEntry } from '../types/story';

export function diffWorldlines(left: WorldlineEntry[], right: WorldlineEntry[]): DiffRow[] {
  const leftByEvent = new Map(left.map((entry) => [entry.eventId, entry]));
  const rightByEvent = new Map(right.map((entry) => [entry.eventId, entry]));
  const ids = new Set([...leftByEvent.keys(), ...rightByEvent.keys()]);

  const rows: DiffRow[] = [];
  for (const eventId of ids) {
    const leftEntry = leftByEvent.get(eventId);
    const rightEntry = rightByEvent.get(eventId);
    const time = leftEntry?.time ?? rightEntry?.time ?? '00:00';

    let status: DiffRow['status'];
    if (!leftEntry) status = 'right-only';
    else if (!rightEntry) status = 'left-only';
    else if (leftEntry.variantId === rightEntry.variantId && leftEntry.title === rightEntry.title) status = 'same';
    else status = 'changed';

    rows.push({
      key: `${time}:${eventId}`,
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
