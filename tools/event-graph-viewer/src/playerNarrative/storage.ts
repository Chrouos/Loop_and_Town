import { createInitialPlayerSession, type PlayerSession, type PlayerSessionV2, type PlayerSessionV3 } from './model';

export const SAVE_KEY = 'ash-town-player-narrative-v3';
export const LEGACY_SAVE_KEY = 'ash-town-player-narrative-v2';

function migrateV2(parsed: PlayerSessionV2): PlayerSessionV3 {
  return { ...parsed, version: 3, knownInsightIds: [] };
}

export function readPlayerSession(storage: Pick<Storage, 'getItem'>, nowMs: number): PlayerSession {
  try {
    const raw = storage.getItem(SAVE_KEY) ?? storage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return createInitialPlayerSession(nowMs);
    const parsed = JSON.parse(raw) as PlayerSessionV2 | PlayerSessionV3;
    if (parsed.version === 2) return { ...migrateV2(parsed), foregroundFreeze: null, lastSeenRealTimeMs: nowMs };
    if (parsed.version !== 3) return createInitialPlayerSession(nowMs);
    return {
      ...parsed,
      knownInsightIds: Array.isArray(parsed.knownInsightIds) ? parsed.knownInsightIds : [],
      foregroundFreeze: null,
      lastSeenRealTimeMs: nowMs,
    };
  } catch {
    return createInitialPlayerSession(nowMs);
  }
}

export function writePlayerSession(storage: Pick<Storage, 'setItem'>, session: PlayerSessionV3): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...session, foregroundFreeze: null }));
    return true;
  } catch {
    return false;
  }
}
