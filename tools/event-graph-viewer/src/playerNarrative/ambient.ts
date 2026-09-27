import type { ActivityRun } from '../narrative/activity';
import type { ActivityDefinition, AmbientBeatDefinition } from '../narrative/types';

export function projectAmbientBeats(
  run: ActivityRun,
  definition: ActivityDefinition,
  knownFactIds: Iterable<string>,
): AmbientBeatDefinition[] {
  const known = new Set(knownFactIds);
  return (definition.ambient ?? [])
    .filter((beat) => beat.atMinute <= run.consumedMinutes)
    .filter((beat) => (beat.requiresFacts ?? []).every((id) => known.has(id)))
    .sort((a, b) => a.atMinute - b.atMinute);
}
