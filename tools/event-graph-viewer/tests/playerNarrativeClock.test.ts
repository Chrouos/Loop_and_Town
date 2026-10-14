import { describe, expect, it } from 'vitest';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { currentStoryMinute, freezeForeground, resumeWorld, syncRunningTime } from '../src/playerNarrative/clock';

describe('world-never-waits narrative clock', () => {
  it('advances 1 world minute per real minute while running', () => {
    const session = createInitialPlayerSession(1_000);
    expect(currentStoryMinute(session, 1_000)).toBe(372);
    expect(currentStoryMinute(session, 1_000 + 17 * 60_000)).toBe(389);
  });

  it('keeps the clock moving while a foreground scene is being read', () => {
    const session = createInitialPlayerSession(1_000);
    const frozen = freezeForeground(session, 'scene-a', 1_000 + 5 * 60_000);
    expect(currentStoryMinute(frozen, 1_000 + 25 * 60_000)).toBe(397);
  });

  it('resumes from current world time and includes time spent reading', () => {
    const session = createInitialPlayerSession(1_000);
    const frozen = freezeForeground(session, 'scene-a', 1_000 + 5 * 60_000);
    const resumed = resumeWorld(frozen, 1_000 + 25 * 60_000);
    expect(currentStoryMinute(resumed, 1_000 + 30 * 60_000)).toBe(402);
  });

  it('syncs running time into persistent fields', () => {
    const synced = syncRunningTime(createInitialPlayerSession(1_000), 1_000 + 8 * 60_000);
    expect(synced.storyMinuteAtLastSync).toBe(380);
    expect(synced.lastSyncedRealTimeMs).toBe(1_000 + 8 * 60_000);
  });
});
