import type { SimulationDefinition, WorldState } from '../simulator/types';
import { clockMinuteAt, LOOP_START_MINUTE, realTimestampForSimulationMinute } from './clock';
import { advanceLoop } from './eventScheduler';
import { emptyLoop, type LoopHistoryEntry, type PlayerSave } from './model';
import { activeLoop, replayLoop } from './runtime';
import { projectPlayerNarrativeRecords } from './narrativeRecords';
import { STORY_RECORDS, type PlayerNarrativeRecord, type VisibleRecord } from './story';
import type { PlayerStoryBundle } from '../types/playerStory';

const DEFAULT_PRESENCE_WINDOW_MINUTES = 5;

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
): boolean {
  const entry = save.loops[loop];
  if (!entry) return false;
  const candidate = availablePresenceRecords(save, loop, minute, records).find(record => record.id === recordId);
  if (!candidate) return false;
  if (!entry.perceivedSceneIds.includes(candidate.sceneId)) entry.perceivedSceneIds.push(candidate.sceneId);
  return true;
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
  if (loop.clock.pendingCriticalBoundary) {
    save.lastConfirmedMs = safeNow;
    return save;
  }
  const targetMinute = clockMinuteAt(loop.clock, safeNow);
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
  const existingPending = loop.clock.pendingCriticalBoundary;
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
  loop.clock.pendingCriticalBoundary = result.pendingBoundary ?? existingPending;
  if (story) revealNarrative(save, loopId, result.reachedMinute, result.simulation.history, story);
  if (!story || loopId === 1) revealStatic(save, loopId, result.reachedMinute, definition, initial);
  save.lastConfirmedMs = safeNow;
  return save;
}
