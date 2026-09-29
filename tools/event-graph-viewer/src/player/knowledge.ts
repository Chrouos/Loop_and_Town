import type { SimulationDefinition, WorldState } from '../simulator/types';
import { clockMinuteAt, LOOP_START_MINUTE, realTimestampForSimulationMinute } from './clock';
import { advanceLoop } from './eventScheduler';
import { emptyLoop, type LoopHistoryEntry, type MemoryKind, type PlayerSave, type PersistentMemory } from './model';
import { activeLoop, replayLoop } from './runtime';
import { projectPlayerNarrativeRecords } from './narrativeRecords';
import { STORY_RECORDS, type PlayerNarrativeRecord } from './story';
import type { PlayerStoryBundle } from '../types/playerStory';
import { ATTENTION_OBSERVATION_MS, advanceAttention, beginAttention, redirectAttention } from './attention';

const DEFAULT_PRESENCE_WINDOW_MINUTES = 5;
export const MEMORY_CAPTURE_MS = 1_200;

function staticRecords(loop: number): PlayerNarrativeRecord[] {
  return STORY_RECORDS.map((record) => ({ ...record, sceneId: record.id, loopId: loop }));
}

function recordSource(loop: number, records?: PlayerNarrativeRecord[]): PlayerNarrativeRecord[] {
  return records ?? staticRecords(loop);
}

export function visibleRecords(save: PlayerSave, loop: number, records?: PlayerNarrativeRecord[]): PlayerNarrativeRecord[] {
  const entry = save.loops[loop];
  const ids = new Set(entry?.revealedIds ?? []);
  const perceived = new Set(entry?.perceivedSceneIds ?? []);
  const seen = new Set(entry?.seenSceneIds ?? []);
  return recordSource(loop, records).filter(record => (
    ids.has(`${loop}:${record.id}`)
    && !seen.has(record.sceneId)
    && (record.acquisition !== 'presence' || perceived.has(record.sceneId))
  ));
}

export function availablePresenceRecords(
  save: PlayerSave,
  loop: number,
  minute: number,
  records?: PlayerNarrativeRecord[],
): PlayerNarrativeRecord[] {
  const entry = save.loops[loop];
  if (!entry) return [];
  const ids = new Set(entry.revealedIds);
  const perceived = new Set(entry.perceivedSceneIds);
  return recordSource(loop, records).filter((record) => {
    if (record.acquisition !== 'presence') return false;
    if (!ids.has(`${loop}:${record.id}`) || perceived.has(record.sceneId)) return false;
    if (record.revealMinute < entry.clock.entryMinute) return false;
    const until = record.availableUntilMinute ?? record.revealMinute + DEFAULT_PRESENCE_WINDOW_MINUTES;
    return record.revealMinute <= minute && minute <= until;
  });
}

export function attendPresenceRecord(
  save: PlayerSave,
  loop: number,
  recordId: string,
  minute: number,
  records?: PlayerNarrativeRecord[],
  primaryTargetId?: string,
  nowMs = save.lastConfirmedMs,
): boolean {
  const entry = save.loops[loop];
  if (!entry) return false;
  const candidate = availablePresenceRecords(save, loop, minute, records).find(record => record.id === recordId);
  if (!candidate) return false;
  const observationMs = Math.max(ATTENTION_OBSERVATION_MS, candidate.spatialScript?.totalDurationMs ?? 0);
  entry.attention = entry.attention.phase === 'idle'
    ? beginAttention(primaryTargetId, candidate.id, nowMs, observationMs)
    : redirectAttention(entry.attention, candidate.id, nowMs, observationMs);
  return true;
}

function memoryId(loop: number, recordId: string): string {
  return `memory:${loop}:${recordId}`;
}

export function beginMemoryCapture(
  save: PlayerSave,
  loop: number,
  recordId: string,
  minute: number,
  records?: PlayerNarrativeRecord[],
  nowMs = save.lastConfirmedMs,
): boolean {
  const entry = save.loops[loop];
  if (!entry || entry.attention.phase !== 'idle' || entry.capture) return false;
  const candidate = recordSource(loop, records).find(record => record.id === recordId);
  if (!candidate || !entry.perceivedSceneIds.includes(candidate.sceneId)) return false;
  if (save.knowledge.memories.some(memory => memory.id === memoryId(loop, recordId))) return false;
  entry.capture = { recordId, startedAtMs: nowMs, endsAtMs: nowMs + MEMORY_CAPTURE_MS };
  entry.attention = beginAttention(undefined, `capture:${recordId}`, nowMs, MEMORY_CAPTURE_MS);
  return true;
}

function memoryKind(record: PlayerNarrativeRecord): MemoryKind {
  return record.spatialScript ? 'composite' : 'text';
}

function settleMemoryCapture(
  save: PlayerSave,
  loop: number,
  nowMs: number,
  minute: number,
  records?: PlayerNarrativeRecord[],
): PersistentMemory | undefined {
  const entry = save.loops[loop];
  if (!entry?.capture) return undefined;
  const capture = entry.capture;
  const advanced = advanceAttention(entry.attention, nowMs);
  entry.attention = advanced.state;
  if (advanced.completedTargetId !== `capture:${capture.recordId}`) return undefined;
  const candidate = recordSource(loop, records).find(record => record.id === capture.recordId);
  if (!candidate || !entry.perceivedSceneIds.includes(candidate.sceneId)) {
    entry.capture = undefined;
    return undefined;
  }
  const memory: PersistentMemory = {
    id: memoryId(loop, candidate.id),
    sourceLoop: loop,
    sourceRecordId: candidate.id,
    sourceSceneId: candidate.sceneId,
    capturedAtMinute: minute,
    capturedAtMs: nowMs,
    kind: memoryKind(candidate),
    title: candidate.title,
    content: [...candidate.body],
  };
  if (!save.knowledge.memories.some(item => item.id === memory.id)) save.knowledge.memories.push(memory);
  entry.capture = undefined;
  return memory;
}

export function settlePresenceAttention(
  save: PlayerSave,
  loop: number,
  nowMs: number,
  minute: number,
  records?: PlayerNarrativeRecord[],
): PlayerNarrativeRecord | undefined {
  const entry = save.loops[loop];
  if (!entry || entry.attention.phase === 'idle') return undefined;

  const advanced = advanceAttention(entry.attention, nowMs);
  entry.attention = advanced.state;
  if (!advanced.completedTargetId) return undefined;

  const candidate = recordSource(loop, records).find(record => record.id === advanced.completedTargetId);
  if (!candidate || candidate.acquisition !== 'presence') return undefined;
  if (!entry.revealedIds.includes(`${loop}:${candidate.id}`)) return undefined;
  if (candidate.revealMinute < entry.clock.entryMinute) return undefined;
  const until = candidate.availableUntilMinute ?? candidate.revealMinute + DEFAULT_PRESENCE_WINDOW_MINUTES;
  if (minute < candidate.revealMinute || minute > until) return undefined;

  if (!entry.perceivedSceneIds.includes(candidate.sceneId)) entry.perceivedSceneIds.push(candidate.sceneId);
  entry.lastPerceivedRecordId = candidate.id;
  return candidate;
}

function revealStatic(save: PlayerSave, loop: number, minute: number, definition: SimulationDefinition, initial: WorldState) {
  const entry = save.loops[loop] ?? (save.loops[loop] = emptyLoop());
  const history = replayLoop(definition, initial, save, loop, minute).history;
  for (const record of STORY_RECORDS) {
    const id = `${loop}:${record.id}`;
    const availableToPlayer = record.acquisition !== 'presence'
      || (entry.clock.entryMinute <= record.revealMinute && record.revealMinute <= minute);
    if (availableToPlayer && record.revealMinute <= minute && record.matches(history) && !entry.revealedIds.includes(id)) entry.revealedIds.push(id);
  }
}

function revealNarrative(
  save: PlayerSave,
  loop: number,
  minute: number,
  history: ReturnType<typeof replayLoop>['history'],
  story: PlayerStoryBundle,
): void {
  const entry = save.loops[loop] ?? (save.loops[loop] = emptyLoop());
  const records = projectPlayerNarrativeRecords(story, loop, history, minute);
  for (const record of records) {
    const id = `${loop}:${record.id}`;
    if (record.revealMinute <= minute && record.matches(history) && !entry.revealedIds.includes(id)) entry.revealedIds.push(id);
  }
}

export function reconcilePlayer(
  save: PlayerSave,
  nowMs: number,
  definition: SimulationDefinition,
  initial: WorldState,
  story?: PlayerStoryBundle,
): PlayerSave {
  const safeNow = Math.max(nowMs, save.lastConfirmedMs);
  const loopId = save.currentLoopId;
  const loop = activeLoop(save);
  const targetMinute = clockMinuteAt(loop.clock, safeNow);
  const attentionRecords = story && loopId !== 1
    ? projectPlayerNarrativeRecords(
      story,
      loopId,
      replayLoop(story.simulation.definition, story.simulation.initialState, save, loopId, targetMinute).history,
      targetMinute,
    )
    : undefined;
  settleMemoryCapture(save, loopId, safeNow, targetMinute, attentionRecords);
  settlePresenceAttention(save, loopId, safeNow, targetMinute, attentionRecords);

  // Reset is the only lifecycle boundary that may wait for the next-loop
  // transaction. Legacy saves may still contain convergence/bell pending
  // markers from the old foreground-wait model; clear them and catch up.
  if (loop.clock.pendingCriticalBoundary === 'reset') {
    save.lastConfirmedMs = safeNow;
    return save;
  }
  if (loop.clock.pendingCriticalBoundary) loop.clock.pendingCriticalBoundary = undefined;

  const bootstrap = loop.clock.mode === 'LIVE_SYNC'
    && loop.clock.lastProcessedMinute === LOOP_START_MINUTE
    && loop.clock.entryMinute > LOOP_START_MINUTE;
  const result = advanceLoop({
    definition,
    initialState: initial,
    loop,
    fromMinute: loop.clock.lastProcessedMinute,
    targetMinute,
    intent: bootstrap ? 'BOOTSTRAP' : 'OFFLINE',
  });
  const history: LoopHistoryEntry[] = result.simulation.history.map((item, index) => ({
    sequence: loop.history.length + index,
    simulationMinute: item.absoluteMinute ?? item.minute,
    realTimestampMs: realTimestampForSimulationMinute(loop.clock, item.absoluteMinute ?? item.minute),
    kind: item.kind,
    eventId: item.eventId,
    variantId: item.variantId,
    title: item.title,
    visibility: item.visibility ?? 'debug',
    playerPresent: (item.absoluteMinute ?? item.minute) >= loop.clock.entryMinute,
  }));
  const seen = new Set(loop.history.map(item => `${item.simulationMinute}:${item.kind}:${item.eventId ?? item.title}`));
  for (const item of history) {
    const key = `${item.simulationMinute}:${item.kind}:${item.eventId ?? item.title}`;
    if (!seen.has(key)) { loop.history.push(item); seen.add(key); }
  }
  loop.clock.lastProcessedMinute = result.reachedMinute;
  loop.clock.pendingCriticalBoundary = result.pendingBoundary;
  if (story) revealNarrative(save, loopId, result.reachedMinute, result.simulation.history, story);
  if (!story || loopId === 1) revealStatic(save, loopId, result.reachedMinute, definition, initial);
  save.lastConfirmedMs = safeNow;
  return save;
}
