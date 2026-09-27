import { describe, expect, it } from 'vitest';
import { diffWorldlines } from '../src/lib/worldlineDiff';
import { projectTimelineEntries, projectWorldlineEvents } from '../src/simulator/projection';
import type { WorldlineHistoryEntry } from '../src/simulator/types';

const history: WorldlineHistoryEntry[] = [
  {
    sequence: 0,
    time: '18:20',
    minute: 1100,
    kind: 'player-action',
    actionId: 'make_coffee',
    title: '泡咖啡',
    durationMinutes: 5,
    endTime: '18:25',
    changes: [],
  },
  { sequence: 1, time: '18:20', minute: 1100, kind: 'player-action', actionId: 'protect_wakaharu', title: '阻止若晴', durationMinutes: 0, endTime: '18:20' },
  { sequence: 2, time: '18:20', minute: 1100, kind: 'player-action', actionId: 'stop_doctor', title: '阻止醫生', durationMinutes: 0, endTime: '18:20' },
  { sequence: 3, time: '18:31', minute: 1111, kind: 'event', eventId: 'evt_1831_station', variantId: 'doctor_dies', title: '18:31 車站事件' },
  { sequence: 4, time: '18:31', minute: 1111, kind: 'effect', eventId: 'evt_1831_station', variantId: 'doctor_dies', title: 'effects' },
  { sequence: 5, time: '21:14', minute: 1274, kind: 'delayed-effect', eventId: 'evt_1831_station', sourceId: 'evt_1831_station', variantId: 'doctor_dies', title: 'reporter_missing_after_station_event' },
  { sequence: 6, time: '21:14', minute: 1274, kind: 'event', eventId: 'evt_2114_reporter_missing', variantId: 'reporter_missing', title: '21:14 記者失蹤' },
];

describe('history projections', () => {
  it('preserves empty-effect action intervals and every same-time entry', () => {
    const timeline = projectTimelineEntries(history);

    expect(timeline.map((entry) => entry.eventId)).toEqual([
      'make_coffee',
      'protect_wakaharu',
      'stop_doctor',
      'evt_1831_station',
      'delayed:evt_1831_station:reporter_missing_after_station_event',
      'evt_2114_reporter_missing',
    ]);
    expect(timeline[0]).toEqual(expect.objectContaining({
      eventId: 'make_coffee',
      source: 'player',
      durationMinutes: 5,
      endTime: '18:25',
    }));
  });

  it('allows full timeline projections including player actions in a worldline diff', () => {
    const rows = diffWorldlines(projectTimelineEntries(history), projectTimelineEntries(history.slice(3)));

    expect(rows.map((row) => row.left?.eventId ?? row.right?.eventId)).toEqual([
      'make_coffee',
      'protect_wakaharu',
      'stop_doctor',
      'evt_1831_station',
      'delayed:evt_1831_station:reporter_missing_after_station_event',
      'evt_2114_reporter_missing',
    ]);
  });

  it('gives delayed effects a unique identity instead of overwriting their source event', () => {
    const timeline = projectTimelineEntries(history);

    expect(new Set(timeline.map((entry) => entry.eventId)).size).toBe(timeline.length);
  });

  it('aligns the same delayed effect across histories with different sequence numbers', () => {
    const delayed = history.find((entry) => entry.kind === 'delayed-effect')!;
    const rows = diffWorldlines(
      projectTimelineEntries([delayed]),
      projectTimelineEntries([{ ...delayed, sequence: 99 }]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('same');
  });

  it('keeps the event-only projection available for event consumers', () => {
    const events = projectWorldlineEvents(history);
    expect(events).toEqual([
      expect.objectContaining({ eventId: 'evt_1831_station', variantId: 'doctor_dies' }),
      expect.objectContaining({ eventId: 'evt_2114_reporter_missing', variantId: 'reporter_missing' }),
    ]);
  });
});
