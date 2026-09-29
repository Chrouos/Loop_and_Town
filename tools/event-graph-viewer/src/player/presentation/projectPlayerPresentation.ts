import { displayMinute } from '../clock';
import { projectPlayerNarrativeRecords } from '../narrativeRecords';
import type { LoopHistoryEntry, PlayerSave } from '../model';
import type { WorldlineHistoryEntry } from '../../simulator/types';
import type { PlayerStoryBundle } from '../../types/playerStory';
import type {
  PlayerLoopId,
  PlayerPresentationInput,
  PlayerPresentationModel,
  PlayerVisibleScene,
} from './types';

function visibleScene(record: PlayerPresentationInput['records'][number]): PlayerVisibleScene {
  return {
    id: record.id,
    sceneId: record.sceneId,
    loopId: record.loopId,
    title: record.title,
    source: record.source,
    formedAt: record.formedAt,
    obtainedAt: record.obtainedAt,
    body: [...record.body],
    excerpts: record.excerpts.map(excerpt => ({ ...excerpt })),
    revealMinute: record.revealMinute,
    availableUntilMinute: record.availableUntilMinute,
    acquisition: record.acquisition,
    spatialScript: record.spatialScript,
  };
}
function loopSave(save: PlayerSave, loopId: PlayerLoopId) {
  return typeof loopId === 'number' ? save.loops[loopId] : undefined;
}

export function projectPlayerPresentation(input: PlayerPresentationInput): PlayerPresentationModel {
  const currentLoop = loopSave(input.save, input.loopId);
  const attention = currentLoop?.attention ?? { phase: 'idle' as const };
  const capture = currentLoop?.capture;
  const sceneCandidates = input.records.map(visibleScene);
  const ambientCues = input.opportunities.map(visibleScene);
  const persistedIds = new Set(input.save.knowledge.memories.map(memory => memory.id));
  const memoryCandidates = input.records
    .filter(record => currentLoop?.perceivedSceneIds.includes(record.sceneId))
    .filter(record => !persistedIds.has(`memory:${String(input.loopId)}:${record.id}`))
    .map(visibleScene);
  const resetPending = currentLoop?.clock.pendingCriticalBoundary === 'reset';
  const mode = resetPending
    ? 'reset'
    : capture
      ? 'capture'
      : attention.phase !== 'idle'
        ? 'attention'
        : input.scene
          ? 'reading'
          : 'waiting';
  const recordScene = input.scene ? visibleScene(input.scene) : undefined;

  return {
    loopId: input.loopId,
    timeLabel: displayMinute(input.minute),
    location: input.location ?? '灰潮鎮',
    mode,
    scene: recordScene,
    sceneCandidates,
    ambientCues,
    attention: { phase: attention.phase, targetId: attention.targetId },
    capture: {
      active: Boolean(capture),
      recordId: capture?.recordId,
      memoryId: capture ? `memory:${String(input.loopId)}:${capture.recordId}` : undefined,
    },
    reset: {
      pending: Boolean(resetPending),
      npcState: input.loopId === 1 ? 'current' : 'reset',
    },
    persistentMemoryIds: input.save.knowledge.memories.map(memory => memory.id),
    wallRefs: [...input.save.knowledge.wallRefs],
    memoryCandidates,
    inference: 'player-led',
  };
}

export type PlayerLoopIntegration = {
  presentation: PlayerPresentationModel;
  visibleScenes: PlayerVisibleScene[];
  memoryCandidates: PlayerVisibleScene[];
  persistentMemoryIds: string[];
  wallRefs: string[];
  npcState: 'current' | 'reset';
  inference: 'player-led';
};

export function projectLoopIntegration(
  bundle: PlayerStoryBundle,
  save: PlayerSave,
  history: WorldlineHistoryEntry[] | LoopHistoryEntry[],
  minute: number,
): PlayerLoopIntegration {
  const loopId = save.currentLoopId;
  const records = projectPlayerNarrativeRecords(bundle, loopId, history, minute);
  const currentLoop = save.loops[loopId];
  const opportunities = records.filter(record => (
    record.acquisition === 'presence'
    && !currentLoop?.perceivedSceneIds.includes(record.sceneId)
    && record.revealMinute <= minute
    && minute <= (record.availableUntilMinute ?? record.revealMinute + 5)
  ));
  const scene = records.find(record => record.acquisition !== 'presence') ?? records[0];
  const presentation = projectPlayerPresentation({ save, loopId, minute, records, opportunities, scene });
  return {
    presentation,
    visibleScenes: presentation.sceneCandidates,
    memoryCandidates: presentation.memoryCandidates,
    persistentMemoryIds: presentation.persistentMemoryIds,
    wallRefs: presentation.wallRefs,
    npcState: presentation.reset.npcState,
    inference: presentation.inference,
  };
}
