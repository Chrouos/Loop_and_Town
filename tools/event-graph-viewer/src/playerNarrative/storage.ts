import { createInitialPlayerSession, type PlayerSessionV2 } from './model';

export const SAVE_KEY = 'ash-town-player-narrative-v2';

export function readPlayerSession(storage: Pick<Storage, 'getItem'>, nowMs: number): PlayerSessionV2 {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return createInitialPlayerSession(nowMs);
    const parsed = JSON.parse(raw) as PlayerSessionV2;
    if (parsed.version !== 2) return createInitialPlayerSession(nowMs);
    return { ...parsed, foregroundFreeze: null, lastSeenRealTimeMs: nowMs };
  } catch {
    return createInitialPlayerSession(nowMs);
  }
}

export function writePlayerSession(storage: Pick<Storage, 'setItem'>, session: PlayerSessionV2): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...session, foregroundFreeze: null }));
    return true;
  } catch {
    return false;
  }
}
