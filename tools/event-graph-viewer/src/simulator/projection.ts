import type { WorldlineEntry } from '../types/story';
import type { WorldlineHistoryEntry } from './types';

export function projectTimelineEntries(history: WorldlineHistoryEntry[]): WorldlineEntry[] {
  return history
    .filter((entry) => entry.kind !== 'effect')
    .map((entry) => ({
      time: entry.time,
      eventId: entry.kind === 'delayed-effect'
        ? `delayed:${entry.sourceId ?? entry.eventId ?? 'history'}:${entry.title}`
        : entry.eventId ?? entry.actionId ?? `history-${entry.sequence}`,
      variantId: entry.variantId,
      title: entry.title,
      source: entry.kind === 'player-action' ? 'player' : entry.kind === 'delayed-effect' ? 'delayed' : 'event',
      ...(entry.kind === 'player-action' ? {
        durationMinutes: entry.durationMinutes,
        endTime: entry.endTime,
        hasImmediateStateChange: (entry.changes?.length ?? 0) > 0,
      } : {}),
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
