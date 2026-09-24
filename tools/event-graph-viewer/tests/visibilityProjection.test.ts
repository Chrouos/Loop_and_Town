import { expect, it } from 'vitest';
import { projectPlayerHistory } from '../src/simulator/projection';
import type { WorldlineHistoryEntry } from '../src/simulator/types';

function row(
  sequence: number,
  visibility: 'observable' | 'hidden' | 'debug',
  title: string,
  extra: Partial<WorldlineHistoryEntry> = {},
): WorldlineHistoryEntry {
  return {
    sequence,
    day: 0,
    time: '17:30',
    absoluteMinute: 1050,
    minute: 1050,
    kind: 'event',
    visibility,
    title,
    ...extra,
  } as WorldlineHistoryEntry;
}

it('filters hidden and debug truth from player history', () => {
  expect(projectPlayerHistory([
    row(0, 'observable', '回到灰潮鎮'),
    row(1, 'hidden', 'reporter_return_hotel'),
    row(2, 'debug', 'condition matched'),
  ]).map((entry) => entry.title)).toEqual(['回到灰潮鎮']);
});

it('does not leak a hidden skipped schedule entry', () => {
  expect(projectPlayerHistory([
    row(0, 'hidden', 'doctor_leave_hospital', {
      kind: 'schedule',
      scheduleEntryId: 'doctor_leave_hospital',
      scheduleStatus: 'skipped',
    }),
  ])).toEqual([]);
});

it('omits effect rows even when observable', () => {
  expect(projectPlayerHistory([
    row(0, 'observable', 'internal mutation', { kind: 'effect' }),
  ])).toEqual([]);
});
