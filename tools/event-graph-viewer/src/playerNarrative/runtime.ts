import { advanceActivity, type ActivityRun } from '../narrative/activity';
import { projectNarrative } from '../narrative/projection';
import type { PlayerChoiceDefinition } from '../narrative/types';
import type { StoryBundle } from '../lib/loadSimulationStory';
import { simulateStory } from '../simulator/storySimulation';
import { fromAbsoluteMinute } from '../simulator/time';
import type { WorldState, WorldlineHistoryEntry } from '../simulator/types';
import { projectAmbientBeats } from './ambient';
import { availableChoicesForScene } from './choices';
import { currentStoryMinute } from './clock';
import { reconcilePersistentObservations, type InboxItem, type PersistentObservationInput } from './inbox';
import type { PlayerSessionV2 } from './model';
import { orderNarrativeQueue, type PlayerNarrativeQueueItem } from './queue';

export type PlayerRuntimeView = {
  currentStoryMinute: number;
  currentLocation: string;
  worldState: WorldState;
  worldHistory: WorldlineHistoryEntry[];
  queue: PlayerNarrativeQueueItem[];
  activeActivity: ActivityRun | null;
  availableChoices: PlayerChoiceDefinition[];
  inbox: InboxItem[];
};

function observationInputs(
  story: StoryBundle,
  history: WorldlineHistoryEntry[],
): PersistentObservationInput[] {
  const byMinute = new Map<number, WorldlineHistoryEntry[]>();
  for (const entry of history) {
    const minute = entry.absoluteMinute ?? entry.minute;
    const bucket = byMinute.get(minute) ?? [];
    bucket.push(entry);
    byMinute.set(minute, bucket);
  }

  const result: PersistentObservationInput[] = [];
  for (const scene of story.narrative.scenes) {
    if (!scene.observation?.persistence || scene.observation.persistence === 'ephemeral') continue;
    const sceneMinute = scene.at;
    const absoluteMinute = typeof sceneMinute === 'string'
      ? Number(sceneMinute.slice(0, 2)) * 60 + Number(sceneMinute.slice(3, 5))
      : sceneMinute.day * 24 * 60 + Number(sceneMinute.time.slice(0, 2)) * 60 + Number(sceneMinute.time.slice(3, 5));
    for (const entry of byMinute.get(absoluteMinute) ?? []) {
      if (scene.sourceEventId && entry.eventId !== scene.sourceEventId) continue;
      if (scene.sourceVariantId && entry.variantId !== scene.sourceVariantId) continue;
      result.push({ entry, rule: scene.observation });
    }
  }
  return result;
}

export function reconcilePlayerRuntime(
  story: StoryBundle,
  session: PlayerSessionV2,
  nowMs: number,
): PlayerRuntimeView {
  const storyMinute = currentStoryMinute(session, nowMs);
  const simulation = simulateStory({
    story,
    actionIds: session.submittedActionIds,
    until: fromAbsoluteMinute(storyMinute),
  });

  const advancedActivity = session.activeActivity
    ? advanceActivity(session.activeActivity, storyMinute, [])
    : null;

  const travelCompleted = Boolean(
    session.activeTravel && storyMinute >= session.activeTravel.arriveMinute,
  );
  const currentLocation = travelCompleted && session.activeTravel
    ? session.activeTravel.to
    : session.currentLocation;

  const context = {
    protagonistLocation: currentLocation,
    online: true,
    channels: ['present', 'phone', 'artifact'] as const,
    minute: storyMinute,
  };

  const narrativeBeats = projectNarrative({
    story: story.narrative,
    fullHistory: simulation.fullHistory,
    context,
    activeActivity: advancedActivity,
    consumedSceneIds: session.consumedSceneIds,
    knownFactIds: session.knownFactIds,
  });

  let insertionOrder = 0;
  const queue: PlayerNarrativeQueueItem[] = narrativeBeats
    .filter((beat) => beat.kind === 'scene')
    .map((beat) => ({
      id: beat.sourceId,
      kind: 'scene' as const,
      minute: beat.minute,
      insertionOrder: insertionOrder++,
    }));

  if (advancedActivity) {
    const definition = story.narrative.activities.find(
      (item) => item.id === advancedActivity.activityId,
    );
    if (definition) {
      const consumed = new Set(session.consumedAmbientBeatIds);
      for (const beat of projectAmbientBeats(advancedActivity, definition, session.knownFactIds)) {
        if (consumed.has(beat.id)) continue;
        queue.push({
          id: beat.id,
          kind: 'ambient',
          minute: advancedActivity.startedAt + beat.atMinute,
          insertionOrder: insertionOrder++,
        });
      }
    }
    if (advancedActivity.status === 'complete') {
      queue.push({
        id: `activity-complete:${advancedActivity.activityId}:${advancedActivity.startedAt}`,
        kind: 'activity-complete',
        minute: advancedActivity.startedAt + advancedActivity.durationMinutes,
        insertionOrder: insertionOrder++,
      });
    }
  }

  const orderedQueue = orderNarrativeQueue(queue);
  const decisionSceneId = session.foregroundFreeze?.sceneId
    ?? orderedQueue.find((item) => item.kind === 'scene')?.id;
  const choiceMinute = session.foregroundFreeze?.frozenMinute ?? storyMinute;
  const availableChoices = decisionSceneId
    ? availableChoicesForScene(story.playerChoices, decisionSceneId, choiceMinute, session.knownFactIds)
    : [];

  const inbox = reconcilePersistentObservations(
    observationInputs(story, simulation.fullHistory),
    session.inboxItemIds,
  );

  return {
    currentStoryMinute: storyMinute,
    currentLocation,
    worldState: simulation.state,
    worldHistory: simulation.fullHistory,
    queue: orderedQueue,
    activeActivity: advancedActivity,
    availableChoices,
    inbox,
  };
}
