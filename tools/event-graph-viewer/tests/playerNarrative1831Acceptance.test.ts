import { describe, expect, it } from 'vitest';
import { toAbsoluteMinute } from '../src/simulator/time';
import { applyChoiceEffects } from '../src/playerNarrative/choices';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { reconcilePlayerRuntime } from '../src/playerNarrative/runtime';
import type { PlayerChoiceDefinition } from '../src/narrative/types';
import { loadRealStory } from './helpers/loadRealStory';

const LOOP_START = 14 * 60 + 20;
const EVENT_1831 = 18 * 60 + 31;
const elapsedTo1831Ms = (EVENT_1831 - LOOP_START) * 60_000;

function characterStatus(worldState: Record<string, unknown>, id: string): string | undefined {
  const characters = worldState.characters as Record<string, { status?: string }> | undefined;
  return characters?.[id]?.status;
}

describe('player narrative 18:31 acceptance', () => {
  it('gets different simulator world states from different player actions', () => {
    const story = loadRealStory();
    const baseline = createInitialPlayerSession(0);
    const rescue = createInitialPlayerSession(0);
    rescue.submittedActionIds = ['protect_wakaharu'];

    const a = reconcilePlayerRuntime(story, baseline, elapsedTo1831Ms);
    const b = reconcilePlayerRuntime(story, rescue, elapsedTo1831Ms);

    expect(characterStatus(a.worldState, 'wakaharu')).toBe('dead');
    expect(characterStatus(b.worldState, 'wakaharu')).not.toBe('dead');
    expect(a.worldState).not.toEqual(b.worldState);
    expect(JSON.stringify(rescue)).not.toMatch(/doctorDies|wakaharuDies|victim/);
  });

  it('does not queue hidden world-history source IDs', () => {
    const story = loadRealStory();
    const view = reconcilePlayerRuntime(story, createInitialPlayerSession(0), elapsedTo1831Ms);
    const hidden = new Set(
      view.worldHistory
        .filter((entry) => entry.visibility === 'hidden')
        .map((entry) => entry.eventId ?? entry.actionId ?? entry.scheduleEntryId ?? entry.sourceId)
        .filter((id): id is string => Boolean(id)),
    );

    expect(view.queue.every((item) => !hidden.has(item.id))).toBe(true);
  });

  it('allows late travel while permanently missing the 18:31 station scene', () => {
    const story = loadRealStory();
    const session = createInitialPlayerSession(0);
    session.storyMinuteAtLastSync = 18 * 60 + 12;
    session.lastSyncedRealTimeMs = 0;
    session.currentLocation = 'old_house';

    const lateTravel: PlayerChoiceDefinition = {
      id: 'acceptance_late_station',
      sceneId: 'scene_1820_old_house',
      label: '現在去舊車站',
      effects: [{ type: 'travel', to: 'old_station' }],
    };
    const travelling = applyChoiceEffects(story, session, lateTravel, 18 * 60 + 12);

    expect(travelling.activeTravel).toMatchObject({
      from: 'old_house',
      to: 'old_station',
      departMinute: 1092,
      arriveMinute: 1114,
      durationMinutes: 22,
    });

    const beforeArrival = reconcilePlayerRuntime(story, travelling, 21 * 60_000);
    expect(beforeArrival.currentLocation).toBe('old_house');
    expect(beforeArrival.worldHistory.some((entry) => entry.eventId === 'evt_1831_station')).toBe(true);
    expect(beforeArrival.queue.some((item) => item.id.startsWith('scene_1831_'))).toBe(false);

    const afterArrival = reconcilePlayerRuntime(story, travelling, 22 * 60_000);
    expect(afterArrival.currentLocation).toBe('old_station');
    expect(afterArrival.worldHistory.some((entry) => entry.eventId === 'evt_1831_station')).toBe(true);
    expect(afterArrival.queue.some((item) => item.id.startsWith('scene_1831_'))).toBe(false);
  });

  it('advances offline, keeps the message, and expires the immediate callback', () => {
    const story = loadRealStory();
    const session = createInitialPlayerSession(0);
    session.storyMinuteAtLastSync = 17 * 60 + 55;
    session.lastSyncedRealTimeMs = 0;
    session.foregroundFreeze = null;
    session.consumedSceneIds = story.narrative.scenes
      .filter((scene) => toAbsoluteMinute(scene.at) < 17 * 60 + 55)
      .map((scene) => scene.id);

    const view = reconcilePlayerRuntime(story, session, 13 * 60_000);

    expect(view.currentStoryMinute).toBe(18 * 60 + 8);
    expect(session.foregroundFreeze).toBeNull();
    expect(view.inbox).toContainEqual(expect.objectContaining({
      sourceId: 'evt_1755_wakaharu_message',
      kind: 'message',
      occurredMinute: 17 * 60 + 55,
    }));
    expect(view.availableChoices.some((choice) => choice.id === 'message_call_back')).toBe(false);
    expect(view.availableChoices.some((choice) => choice.id === 'message_note_1831')).toBe(true);
  });
});
