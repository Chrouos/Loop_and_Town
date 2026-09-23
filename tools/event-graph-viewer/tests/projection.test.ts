import { describe, expect, it } from 'vitest';
import { projectTimelineEntries, projectWorldlineEvents } from '../src/simulator/projection';
import type { WorldlineHistoryEntry } from '../src/simulator/types';

const history: WorldlineHistoryEntry[] = [
  { sequence: 0, time: '18:20', minute: 1100, kind: 'player-action', actionId: 'protect_wakaharu', title: '阻止若晴' },
  { sequence: 1, time: '18:31', minute: 1111, kind: 'event', eventId: 'evt_1831_station', variantId: 'doctor_dies', title: '18:31 車站事件' },
  { sequence: 2, time: '18:31', minute: 1111, kind: 'effect', eventId: 'evt_1831_station', variantId: 'doctor_dies', title: 'effects' },
];

describe('history projections', () => {
  it('keeps meaningful timeline entries without duplicating raw effect rows', () => {
    const timeline = projectTimelineEntries(history);
    expect(timeline.map((entry) => entry.eventId)).toEqual(['protect_wakaharu', 'evt_1831_station']);
  });

  it('projects only event resolution rows into worldline diff input', () => {
    const events = projectWorldlineEvents(history);
    expect(events).toEqual([
      expect.objectContaining({ eventId: 'evt_1831_station', variantId: 'doctor_dies' }),
    ]);
  });
});
