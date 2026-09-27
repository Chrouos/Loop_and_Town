import type { SimulationDefinition, WorldState } from '../simulator/types';
import { clockMinuteAt, LOOP_START_MINUTE, realTimestampForSimulationMinute } from './clock';
import { advanceLoop } from './eventScheduler';
import { emptyLoop, type LoopHistoryEntry, type PlayerSave } from './model';
import { activeLoop, replayLoop } from './runtime';
import { STORY_RECORDS, type VisibleRecord } from './story';

export function visibleRecords(save: PlayerSave, loop: number): VisibleRecord[] {
  const ids = new Set(save.loops[loop]?.revealedIds ?? []);
  return STORY_RECORDS.filter(record => ids.has(`${loop}:${record.id}`));
}

function reveal(save: PlayerSave, loop: number, minute: number, definition: SimulationDefinition, initial: WorldState) {
  const entry = save.loops[loop] ?? (save.loops[loop] = emptyLoop());
  const history = replayLoop(definition, initial, save, loop, minute).history;
  for (const record of STORY_RECORDS) {
    const id = `${loop}:${record.id}`;
    const availableToPlayer = record.acquisition !== 'presence'
      || (entry.clock.entryMinute <= record.revealMinute && record.revealMinute <= minute);
    if (availableToPlayer && record.revealMinute <= minute && record.matches(history) && !entry.revealedIds.includes(id)) entry.revealedIds.push(id);
  }
}

export function reconcilePlayer(save: PlayerSave, nowMs: number, definition: SimulationDefinition, initial: WorldState): PlayerSave {
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
  reveal(save, loopId, result.reachedMinute, definition, initial);
  save.lastConfirmedMs = safeNow;
  return save;
}
