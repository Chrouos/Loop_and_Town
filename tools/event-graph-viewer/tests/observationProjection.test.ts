import { expect, it } from 'vitest';
import type { WorldlineHistoryEntry } from '../src/simulator/types';
import { canObserve, projectObservation } from '../src/narrative/observation';

const stationEntry: WorldlineHistoryEntry = {
  sequence: 1,
  day: 0,
  time: '18:31',
  absoluteMinute: 1111,
  minute: 1111,
  kind: 'event',
  visibility: 'observable',
  eventId: 'evt_1831_station',
  variantId: 'wakaharu_dies',
  title: '18:31 車站事件',
  changes: [{ path: 'characters.wakaharu.alive', before: true, after: false }],
};

it('does not expose a present-only event when protagonist is elsewhere', () => {
  expect(canObserve(stationEntry, { channel: 'present', location: 'old_station' }, {
    protagonistLocation: 'old_house',
    online: true,
    channels: ['present'],
    minute: 1111,
  })).toBe(false);
});

it('allows a present-only event when time and location match', () => {
  expect(canObserve(stationEntry, { channel: 'present', location: 'old_station' }, {
    protagonistLocation: 'old_station',
    online: true,
    channels: ['present'],
    minute: 1111,
  })).toBe(true);
});

it('never exposes hidden history even when location matches', () => {
  expect(canObserve({ ...stationEntry, visibility: 'hidden' }, { channel: 'present', location: 'old_station' }, {
    protagonistLocation: 'old_station',
    online: true,
    channels: ['present'],
    minute: 1111,
  })).toBe(false);
});

it('does not reveal events that have not happened yet', () => {
  expect(canObserve(stationEntry, { channel: 'present', location: 'old_station' }, {
    protagonistLocation: 'old_station',
    online: true,
    channels: ['present'],
    minute: 1110,
  })).toBe(false);
});

it('projects an offline phone event as deferred narrative without raw changes', () => {
  const result = projectObservation(stationEntry, { channel: 'phone', offlineMode: 'deferred' }, {
    protagonistLocation: 'old_house',
    online: false,
    channels: ['phone'],
    minute: 1120,
  });
  expect(result).toEqual(expect.objectContaining({
    channel: 'deferred',
    sourceId: 'evt_1831_station',
  }));
  expect('changes' in (result ?? {})).toBe(false);
});

it('keeps missed in-person events unknown while offline', () => {
  const result = projectObservation(stationEntry, { channel: 'present', location: 'old_station' }, {
    protagonistLocation: 'old_station',
    online: false,
    channels: ['present'],
    minute: 1120,
  });
  expect(result).toBeNull();
});
