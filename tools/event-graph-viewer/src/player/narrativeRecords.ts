import { displayMinute } from './clock';
import type { LoopHistoryEntry, PlayerSave } from './model';
import type { WorldlineHistoryEntry } from '../simulator/types';
import { toAbsoluteMinute } from '../simulator/time';
import type { ActivityDefinition, NarrativeBlock, NarrativeSceneDefinition } from '../narrative/types';
import type { PlayerStoryBundle } from '../types/playerStory';
import type { PlayerNarrativeRecord, RecordAcquisition } from './story';
import { compileSpatialScript } from './spatialText';
import { protagonistLocationAt } from './stationTravel';
import { activityCompletedAt } from './mainAction';

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
  /** When the player carried a chosen activity through to its end this loop. */
  activityCompletedAt?: (activityId: string) => number | undefined;
  /** Scenes the player captured words from in an earlier loop. */
  rememberedSceneIds?: ReadonlySet<string>;
};

const LETTER_FACT_ID = 'fact_zhixia_letter_received';

export function playerSceneConditions(save: PlayerSave, loop: number, activities: ActivityDefinition[] = []): PlayerSceneConditions {
  const letterOpened = save.knowledge.opened.includes(`${loop}:letter`) || save.knowledge.opened.includes('letter');
  return {
    locationAt: (minute) => protagonistLocationAt(save, loop, minute),
    knownFactIds: new Set(letterOpened ? [LETTER_FACT_ID] : []),
    activityCompletedAt: (activityId) => activityCompletedAt(save, loop, activityId, activities),
    rememberedSceneIds: new Set(save.knowledge.memories.filter(memory => memory.sourceLoop < loop).map(memory => memory.sourceSceneId)),
  };
}

// The minute a scene reaches the player, or undefined when its conditions cannot be verified; unverifiable
// scenes stay hidden rather than contradicting each other.
function sceneMinute(
  scene: NarrativeSceneDefinition,
  bundle: PlayerStoryBundle,
  conditions: PlayerSceneConditions | undefined,
): number | undefined {
  let minute = toAbsoluteMinute(scene.at);
  const gated = scene.requiresLocation || scene.requiresFacts?.length || scene.afterActivityId || scene.requiresMemory?.length;
  if (!gated) return minute;
  if (!conditions) return undefined;
  if ((scene.requiresFacts ?? []).some((factId) => !conditions.knownFactIds.has(factId))) return undefined;
  if ((scene.requiresMemory ?? []).some((sceneId) => !conditions.rememberedSceneIds?.has(sceneId))) return undefined;
  if (scene.afterActivityId) {
    // A chosen activity ends when the player finishes it; default-day activities keep their authored time.
    const finished = conditions.activityCompletedAt?.(scene.afterActivityId);
    if (finished !== undefined) minute = finished;
    else if (!bundle.protagonistSchedule?.entries.some((entry) => entry.activityId === scene.afterActivityId)) return undefined;
  }
  if (scene.requiresLocation) {
    // Arriving while the scene is still going on is enough; it reaches the player on arrival.
    const until = scene.availableUntil ? toAbsoluteMinute(scene.availableUntil) : minute;
    let present: number | undefined;
    for (let at = minute; at <= until && present === undefined; at += 1) {
      if (conditions.locationAt(at) === scene.requiresLocation) present = at;
    }
    if (present === undefined) return undefined;
    minute = present;
  }
  return minute;
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

function sceneTitle(scene: NarrativeSceneDefinition): string {
  return scene.title ?? (scene.kind === 'dialogue' ? '鎮上的對話' : '時間線片段');
}

// Who the scene is about, in the protagonist's words; phone scenes say so.
function sceneSource(scene: NarrativeSceneDefinition): string {
  const people = scene.participants.filter(id => id !== 'protagonist').map(speakerLabel);
  const who = people.length ? people.join('、') : '你自己';
  return scene.observation?.channel === 'phone' ? `${who}／手機` : who;
}

// Authored memorable words are what the player can keep; scenes without them offer their opening lines.
function sceneExcerpts(scene: NarrativeSceneDefinition, body: string[]): Array<{ id: string; text: string }> {
  const memorable = scene.blocks.flatMap((block, index) => (
    block.type !== 'artifact' && block.memorable ? [{ id: `${scene.id}:memorable:${index}`, text: block.memorable }] : []
  ));
  return memorable.length ? memorable : body.slice(0, 2).map((text, index) => ({ id: `${scene.id}:excerpt:${index}`, text }));
}

function recordForScene(scene: NarrativeSceneDefinition, minute: number): PlayerNarrativeRecord {
  const body = scene.blocks.map(visibleText).filter((line): line is string => Boolean(line && line.trim()));
  const spatialScript = compileSpatialScript(scene.blocks);
  return {
    id: scene.id,
    sceneId: scene.id,
    loopId: 0,
    title: sceneTitle(scene),
    source: sceneSource(scene),
    formedAt: displayMinute(minute),
    obtainedAt: displayMinute(minute),
    body,
    excerpts: sceneExcerpts(scene, body),
    movesTo: scene.movesTo,
    revealMinute: minute,
    availableUntilMinute: scene.availableUntil ? toAbsoluteMinute(scene.availableUntil) : undefined,
    acquisition: acquisitionFor(scene),
    spatialScript: spatialScript.phrases.length ? spatialScript : undefined,
    matches: (history) => matchesScene(scene, history),
  };
}

export function projectPlayerNarrativeRecords(
  bundle: PlayerStoryBundle,
  chapterId: number | 'final',
  history: WorldlineHistoryEntry[] | LoopHistoryEntry[],
  minute: number,
  conditions?: PlayerSceneConditions,
): PlayerNarrativeRecord[] {
  // The chapter's own scenes plus everyday town life, which happens again in every loop.
  const scenes = bundle.narrativeDocuments
    .filter((item) => item.loopId === chapterId || item.loopId === 'daily')
    .flatMap((item) => item.scenes);
  if (!scenes.length) return [];
  const eligible = scenes
    .map((scene, authoredIndex) => ({ scene, authoredIndex, minute: sceneMinute(scene, bundle, conditions) }))
    .filter((item): item is { scene: NarrativeSceneDefinition; authoredIndex: number; minute: number } => item.minute !== undefined && item.minute <= minute)
    .filter(({ scene }) => matchesScene(scene, history as WorldlineHistoryEntry[]));
  const replaced = new Set(eligible.flatMap(({ scene }) => scene.replaces ? [scene.replaces] : []));
  const records = eligible
    .filter(({ scene }) => !replaced.has(scene.id))
    .sort((left, right) => left.minute - right.minute || left.authoredIndex - right.authoredIndex)
    .map(({ scene, minute: reachedAt }) => ({ ...recordForScene(scene, reachedAt), loopId: chapterId }));
  return records;
}

export function markPlayerNarrativeSeen(save: PlayerSave, loop: number, sceneId: string): void {
  const entry = save.loops[loop];
  if (entry && !entry.seenSceneIds.includes(sceneId)) entry.seenSceneIds.push(sceneId);
}
