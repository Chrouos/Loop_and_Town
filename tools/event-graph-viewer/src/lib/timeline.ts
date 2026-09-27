import type { WorldlineEntry } from '../types/story';

function minuteOfDay(time: string): number {
  if (typeof time !== 'string') return Number.POSITIVE_INFINITY;
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return Number.POSITIVE_INFINITY;
  }
  return hour * 60 + minute;
}

export function sortTimeline(entries: WorldlineEntry[]): WorldlineEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => minuteOfDay(a.entry.time) - minuteOfDay(b.entry.time) || a.index - b.index)
    .map(({ entry }) => entry);
}
