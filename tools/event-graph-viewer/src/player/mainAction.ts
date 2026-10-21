import type { ActivityDefinition } from '../narrative/types';
import type { ActivityRunSave, PlayerSave } from './model';
import { protagonistLocationAt } from './stationTravel';

/** What the player can choose to do at the old house; the rest of the protagonist's day follows her own schedule. */
export const HOME_ACTIVITIES = ['research_online', 'wait_for_call'] as const;
export type HomeActivityId = typeof HOME_ACTIVITIES[number];

export type ActiveActivity = { run: ActivityRunSave; definition: ActivityDefinition };

const definitionOf = (definitions: ActivityDefinition[], id: string) => definitions.find(item => item.id === id);
const endOf = (run: ActivityRunSave, definition: ActivityDefinition) => run.startMinute + definition.durationMinutes;

export function activeActivity(save: PlayerSave, loop: number, minute: number, definitions: ActivityDefinition[]): ActiveActivity | undefined {
  for (const run of save.loops[loop]?.activityRuns ?? []) {
    const definition = definitionOf(definitions, run.id);
    if (!definition || run.startMinute > minute) continue;
    const end = Math.min(endOf(run, definition), run.stopMinute ?? Infinity);
    if (minute < end) return { run, definition };
  }
  return undefined;
}

/** The minute an activity was carried through to the end this loop; an interrupted run never completes. */
export function activityCompletedAt(save: PlayerSave, loop: number, id: string, definitions: ActivityDefinition[]): number | undefined {
  const definition = definitionOf(definitions, id);
  if (!definition) return undefined;
  const run = save.loops[loop]?.activityRuns?.find(item => item.id === id && (item.stopMinute === undefined || item.stopMinute >= endOf(item, definition)));
  return run ? endOf(run, definition) : undefined;
}

export function startActivity(save: PlayerSave, loop: number, id: HomeActivityId, minute: number, definitions: ActivityDefinition[]): PlayerSave {
  if (!definitionOf(definitions, id)) throw new Error('這件事現在做不了。');
  if (protagonistLocationAt(save, loop, minute) !== 'old_house') throw new Error('這件事得回到老家才能做。');
  if (activeActivity(save, loop, minute, definitions)) throw new Error('你手邊的事還沒做完。');
  const entry = save.loops[loop];
  if (entry.activityRuns?.some(run => run.id === id)) throw new Error('今天已經做過這件事了。');
  entry.activityRuns = [...(entry.activityRuns ?? []), { id, startMinute: minute }];
  return save;
}

export function stopActivity(save: PlayerSave, loop: number, minute: number, definitions: ActivityDefinition[]): PlayerSave {
  const active = activeActivity(save, loop, minute, definitions);
  if (active) active.run.stopMinute = minute;
  return save;
}

/** The lines of the activity the protagonist has lived through so far: start, ambient beats, and the end once reached. */
export function activityLines(active: ActiveActivity, minute: number): string[] {
  const { run, definition } = active;
  const elapsed = minute - run.startMinute;
  const start = ([] as string[]).concat(definition.presentation.start);
  const beats = (definition.ambient ?? []).filter(beat => beat.atMinute <= elapsed).map(beat => beat.text);
  return [...start, ...beats];
}
