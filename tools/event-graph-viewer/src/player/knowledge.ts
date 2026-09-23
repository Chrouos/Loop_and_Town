import type { SimulationDefinition, WorldState } from '../simulator/types';
import { timeAt } from './clock';
import { emptyLoop, type PlayerSave } from './model';
import { replayLoop } from './runtime';
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
    if (record.revealMinute <= minute && record.matches(history) && !entry.revealedIds.includes(id)) entry.revealedIds.push(id);
  }
}

export function reconcilePlayer(save: PlayerSave, nowMs: number, definition: SimulationDefinition, initial: WorldState): PlayerSave {
  const safeNow = Math.max(nowMs, save.lastConfirmedMs);
  const current = timeAt(save.anchorMs, safeNow);
  const first = Math.max(1, current.loop - 365);
  for (let loop = first; loop <= current.loop; loop++) {
    if (loop < current.loop && save.loops[loop]?.sealed) continue;
    const minute = loop === current.loop ? current.minute : 1439;
    reveal(save, loop, minute, definition, initial);
    if (loop < current.loop) save.loops[loop].sealed = true;
  }
  save.lastConfirmedMs = safeNow;
  return save;
}
