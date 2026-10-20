import { displayMinute } from './clock';
import type { LoopHistoryEntry, PlayerSave } from './model';
import type { WorldlineHistoryEntry } from '../simulator/types';
import { toAbsoluteMinute } from '../simulator/time';
import type { NarrativeBlock, NarrativeSceneDefinition } from '../narrative/types';
import type { PlayerStoryBundle } from '../types/playerStory';
import type { PlayerNarrativeRecord, RecordAcquisition } from './story';
import { compileSpatialScript } from './spatialText';
import { protagonistLocationAt } from './stationTravel';

const SPEAKER_LABELS: Record<string, string> = {
  protagonist: '你',
  yuan: '予安',
  zhixia: '知夏',
  wakaharu: '若晴',
  doctor: '陳醫師',
  reporter: '庭安',
  detective: '志遠',
};

/** What the player-side runtime can verify about the protagonist when an authored scene happens. */
export type PlayerSceneConditions = {
  locationAt: (minute: number) => string;
  knownFactIds: ReadonlySet<string>;
};

const LETTER_FACT_ID = 'fact_zhixia_letter_received';

export function playerSceneConditions(save: PlayerSave, loop: number): PlayerSceneConditions {
  const letterOpened = save.knowledge.opened.includes(`${loop}:letter`) || save.knowledge.opened.includes('letter');
  return {
    locationAt: (minute) => protagonistLocationAt(save, loop, minute),
    knownFactIds: new Set(letterOpened ? [LETTER_FACT_ID] : []),
  };
}

// Scenes whose conditions cannot be verified stay hidden rather than contradicting each other.
function meetsSceneConditions(
  scene: NarrativeSceneDefinition,
  bundle: PlayerStoryBundle,
  conditions: PlayerSceneConditions | undefined,
): boolean {
  const gated = scene.requiresLocation || scene.requiresFacts?.length || scene.afterActivityId;
  if (!gated) return true;
  if (!conditions) return false;
  const minute = toAbsoluteMinute(scene.at);
  if (scene.requiresLocation && conditions.locationAt(minute) !== scene.requiresLocation) return false;
  if ((scene.requiresFacts ?? []).some((factId) => !conditions.knownFactIds.has(factId))) return false;
  if (scene.afterActivityId
    && !bundle.protagonistSchedule?.entries.some((entry) => entry.activityId === scene.afterActivityId)) return false;
  return true;
}

function speakerLabel(speaker: string): string {
  return SPEAKER_LABELS[speaker] ?? '對方';
}

function visibleText(block: NarrativeBlock): string | undefined {
  if (block.type === 'artifact') return undefined;
  return block.type === 'dialogue' ? `${speakerLabel(block.speaker)}：${block.text}` : block.text;
}

function acquisitionFor(scene: NarrativeSceneDefinition): RecordAcquisition {
  if (scene.observation?.channel === 'phone') return 'message';
  if (scene.observation?.channel === 'present') return 'presence';
  return 'persistent';
}

function matchesScene(scene: NarrativeSceneDefinition, history: WorldlineHistoryEntry[]): boolean {
  if (!scene.sourceEventId) return true;
  return history.some((entry) => (
    entry.kind === 'event'
    && entry.eventId === scene.sourceEventId
    && (!scene.sourceVariantId || entry.variantId === scene.sourceVariantId)
  ));
}

function sceneTitle(scene: NarrativeSceneDefinition, lines: string[]): string {
  if (scene.id === 'loop02_1420_reset_awareness') return '醒來之後';
  if (scene.id === 'loop02_1610_wakaharu_alive') return '若晴還活著';
  if (scene.id === 'loop02_1831_doctor_death') return '18:31 的另一個死者';
  return scene.kind === 'dialogue' ? '鎮上的對話' : '時間線片段';
}

function recordForScene(scene: NarrativeSceneDefinition): PlayerNarrativeRecord {
  const body = scene.blocks.map(visibleText).filter((line): line is string => Boolean(line && line.trim()));
  const minute = toAbsoluteMinute(scene.at);
  const spatialScript = compileSpatialScript(scene.blocks);
  return {
    id: scene.id,
    sceneId: scene.id,
    loopId: 0,
    title: sceneTitle(scene, body),
    source: '時間線紀錄',
    formedAt: displayMinute(minute),
    obtainedAt: displayMinute(minute),
    body,
    excerpts: body.slice(0, 2).map((text, index) => ({ id: `${scene.id}:excerpt:${index}`, text })),
    revealMinute: minute,
    availableUntilMinute: scene.availableUntil ? toAbsoluteMinute(scene.availableUntil) : undefined,
    acquisition: acquisitionFor(scene),
    spatialScript: spatialScript.phrases.length ? spatialScript : undefined,
    matches: (history) => matchesScene(scene, history),
  };
}

export function projectPlayerNarrativeRecords(
  bundle: PlayerStoryBundle,
  loopId: number | 'final',
  history: WorldlineHistoryEntry[] | LoopHistoryEntry[],
  minute: number,
  conditions?: PlayerSceneConditions,
): PlayerNarrativeRecord[] {
  const document = bundle.narrativeDocuments.find((item) => item.loopId === loopId);
  if (!document) return [];
  const records = document.scenes
    .map((scene, authoredIndex) => ({ scene, authoredIndex, minute: toAbsoluteMinute(scene.at) }))
    .filter(({ minute: authoredMinute }) => authoredMinute <= minute)
    .filter(({ scene }) => matchesScene(scene, history as WorldlineHistoryEntry[]))
    .filter(({ scene }) => meetsSceneConditions(scene, bundle, conditions))
    .sort((left, right) => left.minute - right.minute || left.authoredIndex - right.authoredIndex)
    .map(({ scene }) => ({ ...recordForScene(scene), loopId }));
  return records;
}

export function markPlayerNarrativeSeen(save: PlayerSave, loop: number, sceneId: string): void {
  const entry = save.loops[loop];
  if (entry && !entry.seenSceneIds.includes(sceneId)) entry.seenSceneIds.push(sceneId);
}
