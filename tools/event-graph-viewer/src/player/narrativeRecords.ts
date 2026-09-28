import { displayMinute } from './clock';
import type { LoopHistoryEntry, PlayerSave } from './model';
import type { WorldlineHistoryEntry } from '../simulator/types';
import { toAbsoluteMinute } from '../simulator/time';
import type { NarrativeBlock, NarrativeSceneDefinition } from '../narrative/types';
import type { PlayerStoryBundle } from '../types/playerStory';
import type { PlayerNarrativeRecord, RecordAcquisition } from './story';

const SPEAKER_LABELS: Record<string, string> = {
  protagonist: '你',
  wakaharu: '若晴',
  doctor: '陳醫師',
  reporter: '庭安',
  detective: '志遠',
};

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
    acquisition: acquisitionFor(scene),
    matches: (history) => matchesScene(scene, history),
  };
}

export function projectPlayerNarrativeRecords(
  bundle: PlayerStoryBundle,
  loopId: number,
  history: WorldlineHistoryEntry[] | LoopHistoryEntry[],
  minute: number,
): PlayerNarrativeRecord[] {
  const document = bundle.narrativeDocuments.find((item) => item.loopId === loopId);
  if (!document) return [];
  const records = document.scenes
    .map((scene, authoredIndex) => ({ scene, authoredIndex, minute: toAbsoluteMinute(scene.at) }))
    .filter(({ minute: authoredMinute }) => authoredMinute <= minute)
    .filter(({ scene }) => matchesScene(scene, history as WorldlineHistoryEntry[]))
    .sort((left, right) => left.minute - right.minute || left.authoredIndex - right.authoredIndex)
    .map(({ scene }) => ({ ...recordForScene(scene), loopId }));
  return records;
}

export function markPlayerNarrativeSeen(save: PlayerSave, loop: number, sceneId: string): void {
  const entry = save.loops[loop];
  if (entry && !entry.seenSceneIds.includes(sceneId)) entry.seenSceneIds.push(sceneId);
}
