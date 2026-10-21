import { createSimulation } from '../simulator/simulator';
import { cloneValue } from '../simulator/state';
import { fromAbsoluteMinute, toAbsoluteMinute } from '../simulator/time';
import type { SimulationDefinition, SimulationResult, WorldState } from '../simulator/types';
import { clockMinuteAt, createLoopClock, type TimeMode } from './clock';
import { advanceLoop } from './eventScheduler';
import { emptyLoop, type ActionId, type PlayerSave } from './model';
import { protagonistLocationAt } from './stationTravel';
import { nextChapter, type ChapterRule } from './chapters';

const ACTIONS: ActionId[] = ['protect_wakaharu', 'stop_doctor', 'request_backup_inspection', 'wait_for_wakaharu_at_entrance', 'watch_doctor_on_platform'];
/** Where she stands at the old station tonight; she can only be in one of these places. */
export const STATION_ACTIONS: ActionId[] = ['wait_for_wakaharu_at_entrance', 'watch_doctor_on_platform'];
export const WAKAHARU_ARRIVES_MINUTE = 18 * 60 + 5;
export const DOCTOR_WATCH_UNTIL_MINUTE = 18 * 60 + 12;
export const PROTECT_AWAY_MESSAGE = '你人不在鎮上，今晚趕不回去陪若晴。';

/** At the old station or on the road there is no way to be with Wakaharu tonight; anywhere in town is close enough. */
export function isAwayFromTown(save: PlayerSave, minute: number): boolean {
  const where = protagonistLocationAt(save, save.currentLoopId, minute);
  return where === 'old_station' || where === 'en_route';
}

export function activeLoop(save: PlayerSave) {
  return save.loops[save.currentLoopId] ?? save.loops[1];
}

export function currentSimulationMinute(save: PlayerSave, safeNowMs: number): number {
  const loop = activeLoop(save);
  return clockMinuteAt(loop.clock, Math.max(safeNowMs, save.lastConfirmedMs));
}

export function confirmAction(save: PlayerSave, id: ActionId, nowMs: number): PlayerSave {
  if (!ACTIONS.includes(id)) throw new Error('這個行動目前無法確認。');
  if (id === 'request_backup_inspection' && !save.knowledge.discoveredEvidence.includes('primary_recovery_both_active'))
    throw new Error('還沒有足夠的玩家推論能支持這次查證。');
  const current = currentSimulationMinute(save, nowMs);
  if (current >= 1100) throw new Error('約好的時間已經截止，不能把現在的決定寫回過去。');
  if (id === 'protect_wakaharu' && isAwayFromTown(save, current)) throw new Error(PROTECT_AWAY_MESSAGE);
  const loop = activeLoop(save);
  if (loop.actionIds.includes(id)) throw new Error('這件事已經記下。');
  if (STATION_ACTIONS.includes(id)) {
    if (protagonistLocationAt(save, save.currentLoopId, current) !== 'old_station') throw new Error('你人不在舊車站。');
    if (loop.actionIds.some(other => STATION_ACTIONS.includes(other))) throw new Error('你只能待在一個地方。');
  }
  if (id === 'wait_for_wakaharu_at_entrance' && current >= WAKAHARU_ARRIVES_MINUTE) throw new Error('若晴已經進站了。');
  if (id === 'watch_doctor_on_platform' && current >= DOCTOR_WATCH_UNTIL_MINUTE) throw new Error('陳柏勳已經走到你看不見的地方。');
  if (id === 'watch_doctor_on_platform' && loop.actionIds.includes('stop_doctor')) throw new Error('予安已經去醫院留他了，他今晚不會來。');
  if (id === 'stop_doctor' && loop.actionIds.includes('watch_doctor_on_platform')) throw new Error('你已經決定自己在月台盯著他。');
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

export function createNextLoop(save: PlayerSave, mode: TimeMode, nowMs: number, chapterRules?: ChapterRule[]): PlayerSave {
  const current = activeLoop(save);
  if (!current.clock.pendingCriticalBoundary && !current.sealed) throw new Error('必須先完成目前輪迴的重置。');
  current.sealed = true;
  const nextId = save.currentLoopId + 1;
  save.currentLoopId = nextId;
  save.loops[nextId] = emptyLoop(createLoopClock(mode, nowMs));
  if (chapterRules) save.loops[nextId].chapterId = nextChapter(save, nextId - 1, chapterRules);
  save.lastConfirmedMs = Math.max(save.lastConfirmedMs, nowMs);
  return save;
}
