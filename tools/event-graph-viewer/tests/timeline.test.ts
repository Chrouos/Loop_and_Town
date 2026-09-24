import { describe, expect, it } from 'vitest';
import { sortTimeline } from '../src/lib/timeline';
import type { WorldlineEntry } from '../src/types/story';

const entry = (time: string, eventId: string, day = 0): WorldlineEntry & { day: number } => ({
  day,
  time,
  eventId,
  title: eventId,
  source: 'event',
});

describe('sortTimeline', () => {
  it('sorts by minute of day', () => {
    const result = sortTimeline([
      entry('21:14', 'reporter_missing'),
      entry('17:40', 'doctor_leaves'),
      entry('18:31', 'station_event'),
      entry('18:05', 'meeting'),
    ]);
    expect(result.map((item) => item.time)).toEqual(['17:40', '18:05', '18:31', '21:14']);
  });

  it('preserves input order for equal times', () => {
    const result = sortTimeline([entry('18:31', 'a'), entry('18:31', 'b')]);
    expect(result.map((item) => item.eventId)).toEqual(['a', 'b']);
  });

  it('keeps Day 1 midnight after Day 0 23:59', () => {
    const result = sortTimeline([
      entry('00:00', 'loop_end', 1),
      entry('23:59', 'midnight_bells', 0),
      entry('14:20', 'loop_start', 0),
    ]);

    expect(result.map((item) => item.eventId)).toEqual(['loop_start', 'midnight_bells', 'loop_end']);
  });
});
