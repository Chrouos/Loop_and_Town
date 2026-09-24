import type { WorldlineHistoryEntry } from './types';
import type { StorySimulationResult } from './storySimulation';

export type WorldlineDiffMode = 'author' | 'player';

export type StoryDiffRow = {
  key: string;
  time: string;
  left?: WorldlineHistoryEntry;
  right?: WorldlineHistoryEntry;
  status: 'same' | 'changed' | 'left-only' | 'right-only';
};

function identity(entry: WorldlineHistoryEntry): string {
  const id = entry.eventId
    ?? entry.scheduleEntryId
    ?? entry.actionId
    ?? entry.sourceId
    ?? entry.title;
  return `${entry.absoluteMinute ?? entry.minute}|${entry.kind}|${id}`;
}

function indexHistory(history: WorldlineHistoryEntry[]): Map<string, WorldlineHistoryEntry> {
  const occurrences = new Map<string, number>();
  const indexed = new Map<string, WorldlineHistoryEntry>();

  for (const entry of history) {
    const base = identity(entry);
    const occurrence = occurrences.get(base) ?? 0;
    occurrences.set(base, occurrence + 1);
    indexed.set(`${base}|${occurrence}`, entry);
  }

  return indexed;
}

function comparable(entry: WorldlineHistoryEntry): string {
  return JSON.stringify({
    title: entry.title,
    variantId: entry.variantId,
    actionId: entry.actionId,
    scheduleStatus: entry.scheduleStatus,
    visibility: entry.visibility,
    changes: entry.changes,
  });
}

export function compareWorldlines(
  leftResult: StorySimulationResult,
  rightResult: StorySimulationResult,
  mode: WorldlineDiffMode,
): StoryDiffRow[] {
  const leftHistory = mode === 'author' ? leftResult.fullHistory : leftResult.playerHistory;
  const rightHistory = mode === 'author' ? rightResult.fullHistory : rightResult.playerHistory;
  const left = indexHistory(leftHistory);
  const right = indexHistory(rightHistory);
  const keys = [...new Set([...left.keys(), ...right.keys()])];

  const rows = keys.map((key): StoryDiffRow => {
    const leftEntry = left.get(key);
    const rightEntry = right.get(key);
    const entry = leftEntry ?? rightEntry!;

    let status: StoryDiffRow['status'];
    if (!leftEntry) status = 'right-only';
    else if (!rightEntry) status = 'left-only';
    else status = comparable(leftEntry) === comparable(rightEntry) ? 'same' : 'changed';

    return {
      key,
      time: entry.day && entry.day > 0 ? `D${entry.day} ${entry.time}` : entry.time,
      left: leftEntry,
      right: rightEntry,
      status,
    };
  });

  return rows.sort((a, b) => {
    const leftMinute = a.left?.absoluteMinute ?? a.right?.absoluteMinute ?? a.left?.minute ?? a.right?.minute ?? 0;
    const rightMinute = b.left?.absoluteMinute ?? b.right?.absoluteMinute ?? b.left?.minute ?? b.right?.minute ?? 0;
    return leftMinute - rightMinute || a.key.localeCompare(b.key);
  });
}
