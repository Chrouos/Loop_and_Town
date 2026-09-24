import type { PlayerSessionV2 } from './model';

const REAL_MINUTE_MS = 60_000;

export function currentStoryMinute(session: PlayerSessionV2, nowMs: number): number {
  if (session.foregroundFreeze) return session.foregroundFreeze.frozenMinute;
  const elapsed = Math.max(0, nowMs - session.lastSyncedRealTimeMs);
  return session.storyMinuteAtLastSync + Math.floor(elapsed / REAL_MINUTE_MS);
}

export function syncRunningTime(session: PlayerSessionV2, nowMs: number): PlayerSessionV2 {
  const minute = currentStoryMinute(session, nowMs);
  return { ...session, storyMinuteAtLastSync: minute, lastSyncedRealTimeMs: nowMs };
}

export function freezeForeground(session: PlayerSessionV2, sceneId: string, nowMs: number): PlayerSessionV2 {
  const synced = syncRunningTime(session, nowMs);
  return { ...synced, foregroundFreeze: { sceneId, frozenMinute: synced.storyMinuteAtLastSync } };
}

export function resumeWorld(session: PlayerSessionV2, nowMs: number): PlayerSessionV2 {
  const minute = session.foregroundFreeze?.frozenMinute ?? currentStoryMinute(session, nowMs);
  return { ...session, storyMinuteAtLastSync: minute, lastSyncedRealTimeMs: nowMs, foregroundFreeze: null };
}
