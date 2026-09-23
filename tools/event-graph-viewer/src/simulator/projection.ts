import type { WorldlineEntry } from '../types/story';
import type { WorldlineHistoryEntry } from './types';

export function projectTimelineEntries(history: WorldlineHistoryEntry[]): WorldlineEntry[] {
  return history
    .filter((entry) => entry.kind !== 'effect')
    .map((entry) => ({
      time: entry.time,
      eventId: entry.eventId ?? entry.actionId ?? `history-${entry.sequence}`,
      variantId: entry.variantId,
      title: entry.title,
      source: entry.kind === 'player-action' ? 'player' : entry.kind === 'delayed-effect' ? 'delayed' : 'event',
    }));
}

export function projectWorldlineEvents(history: WorldlineHistoryEntry[]): WorldlineEntry[] {
  return history
    .filter((entry) => entry.kind === 'event' && entry.eventId)
    .map((entry) => ({
      time: entry.time,
      eventId: entry.eventId!,
      variantId: entry.variantId,
      title: entry.title,
      source: 'event' as const,
    }));
}
