import { createSimulation } from '../simulator/simulator';
import { cloneValue } from '../simulator/state';
import { fromAbsoluteMinute, toAbsoluteMinute } from '../simulator/time';
import type { SimulationDefinition, SimulationResult, WorldState } from '../simulator/types';
import { clockMinuteAt, createLoopClock, type TimeMode } from './clock';
import { advanceLoop } from './eventScheduler';
import { emptyLoop, type ActionId, type PlayerSave } from './model';

const ACTIONS: ActionId[] = ['protect_wakaharu', 'stop_doctor'];

export function activeLoop(save: PlayerSave) {
  return save.loops[save.currentLoopId] ?? save.loops[1];
}

export function currentSimulationMinute(save: PlayerSave, safeNowMs: number): number {
  const loop = activeLoop(save);
  return clockMinuteAt(loop.clock, Math.max(safeNowMs, save.lastConfirmedMs));
}

export function confirmAction(save: PlayerSave, id: ActionId, nowMs: number): PlayerSave {
  if (!ACTIONS.includes(id)) throw new Error('這個行動目前無法確認。');
  const current = currentSimulationMinute(save, nowMs);
  if (current >= 1100) throw new Error('約好的時間已經截止，不能把現在的決定寫回過去。');
  const loop = activeLoop(save);
  if (loop.actionIds.includes(id)) throw new Error('這件事已經記下。');
  loop.actionIds.push(id);
  save.lastConfirmedMs = Math.max(save.lastConfirmedMs, nowMs);
  return save;
}

export function replayLoop(definition: SimulationDefinition, initial: WorldState, save: PlayerSave, loop: number, minute: number): SimulationResult {
  const simulation = createSimulation(definition, initial);
  const actionMap = new Map(definition.actions.map(action => [action.id, action]));
  for (const id of ACTIONS) {
    const action = actionMap.get(id);
    if (action && save.loops[loop]?.actionIds.includes(id) && toAbsoluteMinute(action.at) <= minute) simulation.applyAction(action);
  }
  simulation.runUntil(fromAbsoluteMinute(Math.min(minute, 1440)));
  return { state: simulation.getState(), history: simulation.getHistory() };
}

export function continuePendingBoundary(save: PlayerSave, definition: SimulationDefinition, initial: WorldState): PlayerSave {
  const loop = activeLoop(save);
  if (!loop.clock.pendingCriticalBoundary) return save;
  const result = advanceLoop({ definition, initialState: initial, loop, fromMinute: loop.clock.lastProcessedMinute, targetMinute: loop.clock.lastProcessedMinute, intent: 'FOREGROUND' });
  if (loop.clock.pendingCriticalBoundary === 'reset') loop.sealed = true;
  loop.clock.lastProcessedMinute = result.reachedMinute;
  loop.clock.pendingCriticalBoundary = undefined;
  return save;
}

export function createNextLoop(save: PlayerSave, mode: TimeMode, nowMs: number): PlayerSave {
  const current = activeLoop(save);
  if (!current.clock.pendingCriticalBoundary && !current.sealed) throw new Error('必須先完成目前輪迴的重置。');
  current.sealed = true;
  const nextId = save.currentLoopId + 1;
  save.currentLoopId = nextId;
  save.loops[nextId] = emptyLoop(createLoopClock(mode, nowMs));
  save.lastConfirmedMs = Math.max(save.lastConfirmedMs, nowMs);
  return save;
}
