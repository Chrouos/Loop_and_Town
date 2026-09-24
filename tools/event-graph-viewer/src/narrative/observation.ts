import type { WorldlineHistoryEntry } from '../simulator/types';
import type { NarrativeObservationRule, ObservationChannel } from './types';

export type ObservationContext = {
  protagonistLocation: string;
  online: boolean;
  channels: ReadonlyArray<Exclude<ObservationChannel, 'deferred'>>;
  minute: number;
};

export type ObservedNarrativeEntry = {
  sourceId: string;
  channel: ObservationChannel;
  minute: number;
  day?: number;
  time: string;
  title: string;
};

function sourceIdOf(entry: WorldlineHistoryEntry): string {
  return entry.eventId
    ?? entry.actionId
    ?? entry.scheduleEntryId
    ?? entry.sourceId
    ?? `history:${entry.sequence}`;
}

function occursBy(entry: WorldlineHistoryEntry, context: ObservationContext): boolean {
  const minute = entry.absoluteMinute ?? entry.minute;
  return minute <= context.minute;
}

export function canObserve(
  entry: WorldlineHistoryEntry,
  rule: NarrativeObservationRule,
  context: ObservationContext,
): boolean {
  if (entry.visibility !== 'observable') return false;
  if (!occursBy(entry, context)) return false;
  if (!context.channels.includes(rule.channel)) return false;

  if (rule.channel === 'present') {
    if (!context.online) return false;
    return rule.location === undefined || rule.location === context.protagonistLocation;
  }

  if (rule.channel === 'phone') return context.online;
  if (rule.channel === 'artifact') return context.online;
  return false;
}

export function projectObservation(
  entry: WorldlineHistoryEntry,
  rule: NarrativeObservationRule,
  context: ObservationContext,
): ObservedNarrativeEntry | null {
  if (!canObserve(entry, rule, context)) return null;
  return {
    sourceId: sourceIdOf(entry),
    channel: rule.channel,
    minute: entry.absoluteMinute ?? entry.minute,
    day: entry.day,
    time: entry.time,
    title: entry.title,
  };
}
