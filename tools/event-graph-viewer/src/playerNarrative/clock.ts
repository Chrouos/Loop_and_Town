import type { PlayerSessionV3 } from './model';

const REAL_MINUTE_MS = 60_000;

export function formatStoryMinute(value: number): string {
  const minute = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function currentStoryMinute(session: PlayerSessionV3, nowMs: number): number {
  if (session.foregroundFreeze) return session.foregroundFreeze.frozenMinute;
  const elapsed = Math.max(0, nowMs - session.lastSyncedRealTimeMs);
  return session.storyMinuteAtLastSync + Math.floor(elapsed / REAL_MINUTE_MS);
}

export function syncRunningTime(session: PlayerSessionV3, nowMs: number): PlayerSessionV3 {
  const minute = currentStoryMinute(session, nowMs);
  return { ...session, storyMinuteAtLastSync: minute, lastSyncedRealTimeMs: nowMs };
}

export function freezeForeground(session: PlayerSessionV3, sceneId: string, nowMs: number): PlayerSessionV3 {
  const synced = syncRunningTime(session, nowMs);
  return { ...synced, foregroundFreeze: { sceneId, frozenMinute: synced.storyMinuteAtLastSync } };
}

export function resumeWorld(session: PlayerSessionV3, nowMs: number): PlayerSessionV3 {
  const minute = session.foregroundFreeze?.frozenMinute ?? currentStoryMinute(session, nowMs);
  return { ...session, storyMinuteAtLastSync: minute, lastSyncedRealTimeMs: nowMs, foregroundFreeze: null };
}
