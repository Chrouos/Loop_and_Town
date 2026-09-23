import type { WorldlineEntry } from '../types/story';

function minuteOfDay(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function sortTimeline(entries: WorldlineEntry[]): WorldlineEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => minuteOfDay(a.entry.time) - minuteOfDay(b.entry.time) || a.index - b.index)
    .map(({ entry }) => entry);
}
