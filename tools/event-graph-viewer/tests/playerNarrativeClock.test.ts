import { describe, expect, it } from 'vitest';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { currentStoryMinute, freezeForeground, resumeWorld, syncRunningTime } from '../src/playerNarrative/clock';

describe('pause-aware player clock', () => {
  it('advances 1 world minute per real minute while running', () => {
    const session = createInitialPlayerSession(1_000);
    expect(currentStoryMinute(session, 1_000)).toBe(860);
    expect(currentStoryMinute(session, 1_000 + 17 * 60_000)).toBe(877);
  });

  it('freezes while a foreground scene is open', () => {
    const session = createInitialPlayerSession(1_000);
    const frozen = freezeForeground(session, 'scene-a', 1_000 + 5 * 60_000);
    expect(currentStoryMinute(frozen, 1_000 + 25 * 60_000)).toBe(865);
  });

  it('resumes from the frozen minute without charging reading time', () => {
    const session = createInitialPlayerSession(1_000);
    const frozen = freezeForeground(session, 'scene-a', 1_000 + 5 * 60_000);
    const resumed = resumeWorld(frozen, 1_000 + 25 * 60_000);
    expect(currentStoryMinute(resumed, 1_000 + 30 * 60_000)).toBe(870);
  });

  it('syncs running time into persistent fields', () => {
    const synced = syncRunningTime(createInitialPlayerSession(1_000), 1_000 + 8 * 60_000);
    expect(synced.storyMinuteAtLastSync).toBe(868);
    expect(synced.lastSyncedRealTimeMs).toBe(1_000 + 8 * 60_000);
  });
});
