import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';
import { applyChoiceEffects } from '../src/playerNarrative/choices';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { reconcilePlayerRuntime } from '../src/playerNarrative/runtime';

describe('player narrative runtime', () => {
  it('replays simulator history from submitted action IDs', () => {
    const story = loadRealStory();
    const session = createInitialPlayerSession(0);
    session.submittedActionIds = ['protect_wakaharu'];
    const view = reconcilePlayerRuntime(story, session, (1111 - 860) * 60_000);
    expect(view.worldHistory.some((entry) => entry.eventId === 'evt_1831_station')).toBe(true);
    expect(JSON.stringify(session)).not.toMatch(/doctorDies|wakaharuDies|victim/);
  });

  it('uses frozen story minute while a foreground scene is open', () => {
    const story = loadRealStory();
    const session = createInitialPlayerSession(0);
    session.storyMinuteAtLastSync = 1075;
    session.foregroundFreeze = { sceneId: 'main_story_handoff', frozenMinute: 1075 };
    expect(reconcilePlayerRuntime(story, session, 30 * 60_000).currentStoryMinute).toBe(1075);
  });

  it('advances after reload because foreground freeze is not persisted', () => {
    const story = loadRealStory();
    const session = createInitialPlayerSession(0);
    session.storyMinuteAtLastSync = 1075;
    session.lastSyncedRealTimeMs = 0;
    session.foregroundFreeze = null;
    expect(reconcilePlayerRuntime(story, session, 13 * 60_000).currentStoryMinute).toBe(1088);
  });

  it('starts ordinary choice activities without instantly adding story minutes', () => {
    const story = loadRealStory();
    const session = createInitialPlayerSession(0);
    const choice = story.playerChoices.find((item) => item.id === 'arrival_coffee');
    if (!choice) throw new Error('missing arrival coffee choice');
    const next = applyChoiceEffects(story, session, choice, 860);
    expect(next.storyMinuteAtLastSync).toBe(860);
    expect(next.activeActivity).toMatchObject({ activityId: 'buy_coffee', startedAt: 860, durationMinutes: 8 });
  });

  it('derives travel arrival after the fixed 18:31 event without blocking departure', () => {
    const story = loadRealStory();
    const session = createInitialPlayerSession(0);
    session.currentLocation = 'old_house';
    const choice = {
      id: 'late-station', sceneId: 'main_story_handoff', label: '直接去車站',
      effects: [{ type: 'travel' as const, to: 'old_station' }],
    };
    const travelling = applyChoiceEffects(story, session, choice, 1092);
    expect(travelling.activeTravel?.arriveMinute).toBe(1114);
    const view = reconcilePlayerRuntime(story, travelling, (1114 - 860) * 60_000);
    expect(view.currentLocation).toBe('old_station');
    expect(view.worldHistory.some((entry) => entry.eventId === 'evt_1831_station')).toBe(true);
  });
});
