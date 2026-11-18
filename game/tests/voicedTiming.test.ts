import { describe, expect, it } from 'vitest';
import { READER_LINES, READER_TIMES } from '../src/audio/readerClips';
import { lineTiming, voicedTiming } from '../src/engine/text';

describe('a phone line read from its clip', () => {
  it('every clip has its speech times', () => {
    expect(Object.keys(READER_TIMES).sort()).toEqual(Object.keys(READER_LINES).sort());
    for (const [start, end, gaps] of Object.values(READER_TIMES)) {
      expect(start).toBeLessThan(end);
      expect(gaps.every((gap) => gap > start && gap < end)).toBe(true);
    }
  });

  it('shows each phrase as the voice reaches it, on the quiet spot between words', () => {
    const timing = voicedTiming(lineTiming('鬧鐘。十月三日。六點十二分。', 'phone', 'slow'), [0.28, 2.25, [0.65, 1.03, 1.49]]);
    expect(timing.phrases.map((phrase) => phrase.at)).toEqual([130, 500, 1340]);
    expect(timing.revealMs).toBe(2250);
  });

  it('keeps to its estimate when no quiet spot is near, and never goes backwards', () => {
    const timing = voicedTiming(lineTiming('撥號中。周予安。', 'phone', 'normal'), [0.3, 1.3, []]);
    const [first, second] = timing.phrases.map((phrase) => phrase.at);
    expect(first).toBe(150);
    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThan(1300);
  });
});
