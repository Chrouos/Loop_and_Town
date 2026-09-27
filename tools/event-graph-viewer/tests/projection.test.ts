import { describe, expect, it } from 'vitest';
import { projectTimelineEntries, projectWorldlineEvents } from '../src/simulator/projection';
import type { WorldlineHistoryEntry } from '../src/simulator/types';

const history: WorldlineHistoryEntry[] = [
  {
    sequence: 0,
    time: '18:20',
    minute: 1100,
    kind: 'player-action',
    actionId: 'protect_wakaharu',
    title: '保護若晴',
  },
  {
    sequence: 1,
    time: '18:31',
    minute: 1111,
    kind: 'event',
    eventId: 'evt_1831_station',
    variantId: 'doctor_dies',
    title: '18:31 車站事件',
  },
  {
    sequence: 2,
    time: '21:14',
    minute: 1274,
    kind: 'delayed-effect',
    eventId: 'evt_1831_station',
    variantId: 'wakaharu_dies',
    title: 'reporter_missing_after_wakaharu_death',
    sourceId: 'evt_1831_station',
  },
];

describe('projectTimelineEntries', () => {
  it('keeps player actions, events and delayed effects in execution order', () => {
    const result = projectTimelineEntries(history);

    expect(result.map((entry) => [entry.time, entry.source])).toEqual([
      ['18:20', 'player'],
      ['18:31', 'event'],
      ['21:14', 'delayed'],
    ]);
    expect(result[2].eventId).toBe('delayed:reporter_missing_after_wakaharu_death');
  });

  it('preserves cross-day timing metadata for author timeline ordering', () => {
    const timeline = projectTimelineEntries([
      {
        sequence: 3,
        day: 1,
        time: '00:00',
        absoluteMinute: 1440,
        minute: 1440,
        kind: 'event',
        eventId: 'evt_0000_loop_end',
        variantId: 'loop_end',
        title: '輪迴結束',
      },
    ]);

    expect(timeline[0]).toEqual(expect.objectContaining({ day: 1, absoluteMinute: 1440 }));
  });

  it('projects only event resolution rows into worldline diff input', () => {
    const events = projectWorldlineEvents(history);
    expect(events).toEqual([
      expect.objectContaining({ eventId: 'evt_1831_station', variantId: 'doctor_dies' }),
    ]);
  });
});
