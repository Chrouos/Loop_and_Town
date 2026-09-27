import { createSimulation } from '../simulator/simulator';
import { cloneValue } from '../simulator/state';
import { formatTime } from '../simulator/time';
import type { SimulationDefinition, SimulationResult, WorldState } from '../simulator/types';
import { timeAt } from './clock';
import { emptyLoop, type ActionId, type PlayerSave } from './model';

const ACTIONS: ActionId[] = ['protect_wakaharu', 'stop_doctor'];

export function confirmAction(save: PlayerSave, id: ActionId, nowMs: number): PlayerSave {
  if (!ACTIONS.includes(id)) throw new Error('這個行動目前無法確認。');
  const current = timeAt(save.anchorMs, Math.max(nowMs, save.lastConfirmedMs));
  if (current.minute >= 1100) throw new Error('約好的時間已經截止，不能把現在的決定寫回過去。');
  const loop = save.loops[current.loop] ?? (save.loops[current.loop] = emptyLoop());
  if (loop.actionIds.includes(id)) throw new Error('這件事已經記下。');
  loop.actionIds.push(id);
  save.lastConfirmedMs = Math.max(save.lastConfirmedMs, nowMs);
  return save;
}

export function replayLoop(definition: SimulationDefinition, initial: WorldState, save: PlayerSave, loop: number, minute: number): SimulationResult {
  if (minute < 1100) return { state: cloneValue(initial), history: [] };
  const simulation = createSimulation(definition, initial);
  for (const id of ACTIONS) {
    if (save.loops[loop]?.actionIds.includes(id)) simulation.applyAction(id);
  }
  simulation.runUntil(formatTime(Math.min(minute, 1439)));
  return { state: simulation.getState(), history: simulation.getHistory() };
}
