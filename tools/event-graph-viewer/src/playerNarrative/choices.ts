import { startActivity } from '../narrative/activity';
import type { PlayerChoiceDefinition } from '../narrative/types';
import type { StoryBundle } from '../lib/loadSimulationStory';
import type { PlayerSessionV3 } from './model';
import { planTravel } from './travel';

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

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

export function applyChoiceEffects(
  story: StoryBundle,
  session: PlayerSessionV3,
  choice: PlayerChoiceDefinition,
  currentStoryMinute: number,
): PlayerSessionV3 {
  let next: PlayerSessionV3 = {
    ...session,
    submittedActionIds: [...session.submittedActionIds],
    knownFactIds: [...session.knownFactIds],
    knownInsightIds: [...session.knownInsightIds],
  };

  for (const effect of choice.effects) {
    if (effect.type === 'start-activity') {
      const definition = story.narrative.activities.find((item) => item.id === effect.activityId);
      if (!definition) throw new Error(`Unknown activity: ${effect.activityId}`);
      next = {
        ...next,
        activeActivity: startActivity(effect.activityId, currentStoryMinute, definition),
        activeTravel: null,
      };
      continue;
    }

    if (effect.type === 'submit-action') {
      next = { ...next, submittedActionIds: appendUnique(next.submittedActionIds, effect.actionId) };
      continue;
    }

    if (effect.type === 'learn-fact') {
      next = { ...next, knownFactIds: appendUnique(next.knownFactIds, effect.factId) };
      continue;
    }

    if (effect.type === 'learn-insight') {
      next = { ...next, knownInsightIds: appendUnique(next.knownInsightIds, effect.insightId) };
      continue;
    }

    const travel = planTravel(story.travelEdges, next.currentLocation, effect.to, currentStoryMinute);
    next = {
      ...next,
      activeTravel: travel,
      activeActivity: {
        activityId: `travel:${travel.from}:${travel.to}`,
        startedAt: travel.departMinute,
        durationMinutes: travel.durationMinutes,
        consumedMinutes: 0,
        remainingMinutes: travel.durationMinutes,
        interruptible: true,
        status: 'running',
      },
    };
  }

  return next;
}
