import type { ActivityRun } from '../narrative/activity';
import type { PlannedTravel } from './travel';

export type ForegroundFreeze = { sceneId: string; frozenMinute: number };

type PlayerSessionFields = {
  storyMinuteAtLastSync: number;
  lastSyncedRealTimeMs: number;
  lastSeenRealTimeMs: number;
  currentLocation: string;
  activeActivity: ActivityRun | null;
  activeTravel?: PlannedTravel | null;
  consumedSceneIds: string[];
  consumedAmbientBeatIds: string[];
  openedArtifactIds: string[];
  submittedActionIds: string[];
  knownFactIds: string[];
  inboxItemIds: string[];
  foregroundFreeze: ForegroundFreeze | null;
};

export type PlayerSessionV2 = PlayerSessionFields & {
  version: 2;
};

export type PlayerSessionV3 = PlayerSessionFields & {
  version: 3;
  knownInsightIds: string[];
};

export type PlayerSession = PlayerSessionV3;

export function createInitialPlayerSession(nowMs: number): PlayerSessionV3 {
  return {
    version: 3,
    storyMinuteAtLastSync: 14 * 60 + 20,
    lastSyncedRealTimeMs: nowMs,
    lastSeenRealTimeMs: nowMs,
    currentLocation: 'ash_tide_station',
    activeActivity: null,
    activeTravel: null,
    consumedSceneIds: [],
    consumedAmbientBeatIds: [],
    openedArtifactIds: [],
    submittedActionIds: [],
    knownFactIds: ['fact_zhixia_dead_five_years'],
    knownInsightIds: [],
    inboxItemIds: [],
    foregroundFreeze: null,
  };
}
