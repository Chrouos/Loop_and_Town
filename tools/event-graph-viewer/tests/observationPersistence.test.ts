import { describe, expect, it } from 'vitest';
import { reconcilePersistentObservations } from '../src/playerNarrative/inbox';
import type { WorldlineHistoryEntry } from '../src/simulator/types';
import type { NarrativeObservationRule } from '../src/narrative/types';

const base: Omit<WorldlineHistoryEntry, 'eventId' | 'visibility'> = {
  minute: 1075,
  absoluteMinute: 1075,
  day: 0,
  time: '17:55',
  sequence: 1,
  title: 'x',
  kind: 'event',
};

const localEvent: WorldlineHistoryEntry = { ...base, eventId: 'local', visibility: 'observable' };
const messageEvent: WorldlineHistoryEntry = { ...base, eventId: 'message', visibility: 'observable' };
const callEvent: WorldlineHistoryEntry = { ...base, eventId: 'call', visibility: 'observable' };
const hiddenEvent: WorldlineHistoryEntry = { ...base, eventId: 'hidden', visibility: 'hidden' };

const localRule: NarrativeObservationRule = { channel: 'present', persistence: 'ephemeral' };
const messageRule: NarrativeObservationRule = { channel: 'phone', persistence: 'message' };
const callRule: NarrativeObservationRule = { channel: 'phone', persistence: 'missed-call' };

describe('offline observation persistence', () => {
  it('does not persist local observations', () => {
    expect(reconcilePersistentObservations([{ entry: localEvent, rule: localRule }])).toEqual([]);
  });

  it('persists messages', () => {
    expect(reconcilePersistentObservations([{ entry: messageEvent, rule: messageRule }])[0]).toMatchObject({
      sourceId: 'message', kind: 'message', occurredMinute: 1075, opened: false,
    });
  });

  it('turns calls into missed calls', () => {
    expect(reconcilePersistentObservations([{ entry: callEvent, rule: callRule }])[0]).toMatchObject({
      sourceId: 'call', kind: 'missed-call', occurredMinute: 1075,
    });
  });

  it('never persists hidden history', () => {
    expect(reconcilePersistentObservations([{ entry: hiddenEvent, rule: messageRule }])).toEqual([]);
  });
});
