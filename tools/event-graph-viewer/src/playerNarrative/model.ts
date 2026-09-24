import type { ActivityRun } from '../narrative/activity';

export type ForegroundFreeze = { sceneId: string; frozenMinute: number };

export type PlayerSessionV2 = {
  version: 2;
  storyMinuteAtLastSync: number;
  lastSyncedRealTimeMs: number;
  lastSeenRealTimeMs: number;
  currentLocation: string;
  activeActivity: ActivityRun | null;
  consumedSceneIds: string[];
  consumedAmbientBeatIds: string[];
  openedArtifactIds: string[];
  submittedActionIds: string[];
  knownFactIds: string[];
  inboxItemIds: string[];
  foregroundFreeze: ForegroundFreeze | null;
};

export function createInitialPlayerSession(nowMs: number): PlayerSessionV2 {
  return {
    version: 2,
    storyMinuteAtLastSync: 14 * 60 + 20,
    lastSyncedRealTimeMs: nowMs,
    lastSeenRealTimeMs: nowMs,
    currentLocation: 'ash_tide_station',
    activeActivity: null,
    consumedSceneIds: [],
    consumedAmbientBeatIds: [],
    openedArtifactIds: [],
    submittedActionIds: [],
    knownFactIds: ['fact_zhixia_dead_five_years'],
    inboxItemIds: [],
    foregroundFreeze: null,
  };
}
