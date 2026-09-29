import type { AttentionPhase, PlayerSave } from '../model';
import type { PlayerNarrativeRecord } from '../story';
import type { SpatialScript } from '../spatialText';

export type PlayerLoopId = number | 'final';
export type PlayerPresentationMode = 'opening' | 'reading' | 'attention' | 'capture' | 'waiting' | 'reset';

export type PlayerVisibleScene = {
  id: string;
  sceneId: string;
  loopId: PlayerLoopId;
  title: string;
  source: string;
  formedAt: string;
  obtainedAt: string;
  body: string[];
  excerpts: Array<{ id: string; text: string }>;
  revealMinute: number;
  availableUntilMinute?: number;
  acquisition: PlayerNarrativeRecord['acquisition'];
  spatialScript?: SpatialScript;
};
export type PlayerPresentationModel = {
  loopId: PlayerLoopId;
  timeLabel: string;
  location: string;
  mode: PlayerPresentationMode;
  scene?: PlayerVisibleScene;
  sceneCandidates: PlayerVisibleScene[];
  ambientCues: PlayerVisibleScene[];
  attention: {
    phase: AttentionPhase;
    targetId?: string;
  };
  capture: {
    active: boolean;
    recordId?: string;
    memoryId?: string;
  };
  reset: {
    pending: boolean;
    npcState: 'current' | 'reset';
  };
  persistentMemoryIds: string[];
  wallRefs: string[];
  memoryCandidates: PlayerVisibleScene[];
  inference: 'player-led';
};

export type PlayerPresentationInput = {
  save: PlayerSave;
  loopId: PlayerLoopId;
  minute: number;
  records: PlayerNarrativeRecord[];
  opportunities: PlayerNarrativeRecord[];
  scene?: PlayerNarrativeRecord;
  location?: string;
};
