import { expect, it } from 'vitest';
import { parseTime } from '../../src/simulator/time';
import { STORY_RECORDS } from '../../src/player/story';

it('does not expose timed messages before their authored send time', () => {
  for (const record of STORY_RECORDS.filter(item => item.acquisition === 'message' && /^\d{2}:\d{2}$/.test(item.formedAt))) {
    expect(record.revealMinute).toBeGreaterThanOrEqual(parseTime(record.formedAt));
  }
});
