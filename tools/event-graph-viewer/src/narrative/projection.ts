import type { WorldlineHistoryEntry } from '../simulator/types';
import { toAbsoluteMinute } from '../simulator/time';
import type { ActivityRun } from './activity';
import { canObserve, type ObservationContext } from './observation';
import type { NarrativeFoundation, NarrativeSceneDefinition } from './types';

export type NarrativeBeat =
  | {
      kind: 'scene';
      sourceId: string;
      minute: number;
      scene: NarrativeSceneDefinition;
    }
  | {
      kind: 'activity';
      sourceId: string;
      minute: number;
      activity: ActivityRun;
    };

export type NarrativeProjectionInput = {
  story: NarrativeFoundation;
  fullHistory: WorldlineHistoryEntry[];
  context: ObservationContext;
  activeActivity?: ActivityRun | null;
  consumedSceneIds?: Iterable<string>;
  knownFactIds?: Iterable<string>;
};

function matchingSourceEntry(
  scene: NarrativeSceneDefinition,
  context: ObservationContext,
  history: WorldlineHistoryEntry[],
): WorldlineHistoryEntry | undefined {
  if (!scene.sourceEventId) return undefined;
  return history.find((entry) => {
    const minute = entry.absoluteMinute ?? entry.minute;
    if (minute > context.minute) return false;
    if (entry.eventId !== scene.sourceEventId) return false;
    if (scene.sourceVariantId && entry.variantId !== scene.sourceVariantId) return false;
    return true;
  });
}

function sceneIsEligible(
  scene: NarrativeSceneDefinition,
  context: ObservationContext,
  history: WorldlineHistoryEntry[],
  activeActivity: ActivityRun | null | undefined,
  knownFacts: Set<string>,
): boolean {
  const minute = toAbsoluteMinute(scene.at);
  if (minute > context.minute) return false;
  if (scene.availableUntil !== undefined && context.minute > toAbsoluteMinute(scene.availableUntil)) return false;
  if (scene.requiresLocation && scene.requiresLocation !== context.protagonistLocation) return false;
  if ((scene.requiresFacts ?? []).some((factId) => !knownFacts.has(factId))) return false;
  if (scene.afterActivityId) {
    if (!activeActivity || activeActivity.activityId !== scene.afterActivityId || activeActivity.status !== 'complete') return false;
  }

  const sourceEntry = matchingSourceEntry(scene, context, history);
  if (scene.sourceEventId && !sourceEntry) return false;
  if (!scene.observation) return true;

  const observableEntry = sourceEntry ?? history.find((entry) => {
    if (entry.visibility !== 'observable') return false;
    return (entry.absoluteMinute ?? entry.minute) === minute;
  });

  if (!observableEntry) return false;
  return canObserve(observableEntry, scene.observation, context);
}

export function projectNarrative({
  story,
  fullHistory,
  context,
  activeActivity,
  consumedSceneIds = [],
  knownFactIds = [],
}: NarrativeProjectionInput): NarrativeBeat[] {
  const consumed = new Set(consumedSceneIds);
  const knownFacts = new Set(knownFactIds);

  const scenes = story.scenes
    .map((scene, authoredIndex) => ({ scene, authoredIndex, minute: toAbsoluteMinute(scene.at) }))
    .filter(({ scene }) => !consumed.has(scene.id))
    .filter(({ scene }) => sceneIsEligible(scene, context, fullHistory, activeActivity, knownFacts))
    .sort((a, b) => a.minute - b.minute || a.authoredIndex - b.authoredIndex)
    .map(({ scene, minute }): NarrativeBeat => ({
      kind: 'scene',
      sourceId: scene.id,
      minute,
      scene,
    }));

  if (!activeActivity || activeActivity.status === 'complete') return scenes;

  return [
    ...scenes,
    {
      kind: 'activity',
      sourceId: activeActivity.activityId,
      minute: Math.max(activeActivity.startedAt, context.minute),
      activity: activeActivity,
    },
  ];
}
