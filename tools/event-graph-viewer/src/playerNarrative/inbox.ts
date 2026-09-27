import type { WorldlineHistoryEntry } from '../simulator/types';
import type { NarrativeObservationRule } from '../narrative/types';

export type InboxItem = {
  id: string;
  sourceId: string;
  occurredMinute: number;
  kind: 'message' | 'missed-call' | 'artifact';
  opened: boolean;
};

export type PersistentObservationInput = {
  entry: WorldlineHistoryEntry;
  rule: NarrativeObservationRule;
};

function sourceIdOf(entry: WorldlineHistoryEntry): string {
  return entry.eventId
    ?? entry.actionId
    ?? entry.scheduleEntryId
    ?? entry.sourceId
    ?? `history:${entry.sequence}`;
}

export function reconcilePersistentObservations(
  inputs: PersistentObservationInput[],
  existingIds: Iterable<string> = [],
): InboxItem[] {
  const seen = new Set(existingIds);
  const result: InboxItem[] = [];

  for (const { entry, rule } of inputs) {
    if (entry.visibility !== 'observable') continue;
    const sourceId = sourceIdOf(entry);
    if (seen.has(sourceId)) continue;

    let kind: InboxItem['kind'] | null = null;
    if (rule.persistence === 'message') kind = 'message';
    if (rule.persistence === 'missed-call') kind = 'missed-call';
    if (rule.persistence === 'artifact') kind = 'artifact';
    if (!kind) continue;

    result.push({
      id: `inbox:${sourceId}`,
      sourceId,
      occurredMinute: entry.absoluteMinute ?? entry.minute,
      kind,
      opened: false,
    });
    seen.add(sourceId);
  }

  return result.sort((a, b) => a.occurredMinute - b.occurredMinute || a.id.localeCompare(b.id));
}
