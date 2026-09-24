import type { PlayerChoiceDefinition } from '../narrative/types';

export function availableChoicesForScene(
  choices: PlayerChoiceDefinition[],
  sceneId: string,
  minute: number,
  knownFactIds: Iterable<string>,
): PlayerChoiceDefinition[] {
  const known = new Set(knownFactIds);
  return choices.filter((choice) => {
    if (choice.sceneId !== sceneId) return false;
    if (choice.availableFrom !== undefined && minute < choice.availableFrom) return false;
    if (choice.availableUntil !== undefined && minute > choice.availableUntil) return false;
    return (choice.requiresFacts ?? []).every((factId) => known.has(factId));
  });
}
