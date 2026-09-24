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
};

function sceneIsEligible(
  scene: NarrativeSceneDefinition,
  context: ObservationContext,
  history: WorldlineHistoryEntry[],
): boolean {
  const minute = toAbsoluteMinute(scene.at);
  if (minute > context.minute) return false;
  if (!scene.observation) return true;

  const sameMinuteObservable = history.find((entry) => {
    if (entry.visibility !== 'observable') return false;
    return (entry.absoluteMinute ?? entry.minute) === minute;
  });

  if (!sameMinuteObservable) return false;
  return canObserve(sameMinuteObservable, scene.observation, context);
}

export function projectNarrative({
  story,
  fullHistory,
  context,
  activeActivity,
  consumedSceneIds = [],
}: NarrativeProjectionInput): NarrativeBeat[] {
  const consumed = new Set(consumedSceneIds);

  const scenes = story.scenes
    .map((scene, authoredIndex) => ({ scene, authoredIndex, minute: toAbsoluteMinute(scene.at) }))
    .filter(({ scene }) => !consumed.has(scene.id))
    .filter(({ scene }) => sceneIsEligible(scene, context, fullHistory))
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
