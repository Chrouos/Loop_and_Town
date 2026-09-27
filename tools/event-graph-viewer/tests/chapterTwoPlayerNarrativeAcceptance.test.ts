import { describe, expect, it } from 'vitest';
import { applyChoiceEffects } from '../src/playerNarrative/choices';
import { reconcilePlayerRuntime } from '../src/playerNarrative/runtime';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { toAbsoluteMinute } from '../src/simulator/time';
import { loadRealStory } from './helpers/loadRealStory';

const LOOP_START = 14 * 60 + 20;
const DOCTOR_DEATH = 18 * 60 + 31;
const WAKAHARU_LIFE = 20 * 60 + 30;
const PORTFOLIO_SENT = 20 * 60 + 38;

function sessionAt(story: ReturnType<typeof loadRealStory>, minute: number) {
  const session = createInitialPlayerSession(0);
  session.currentLocation = 'old_house';
  session.storyMinuteAtLastSync = LOOP_START;
  session.lastSyncedRealTimeMs = 0;
  session.consumedSceneIds = story.narrative.scenes
    .filter((scene) => toAbsoluteMinute(scene.at) < minute)
    .map((scene) => scene.id);
  return session;
}

function nowAt(minute: number) {
  return (minute - LOOP_START) * 60_000;
}

describe('Chapter 2 player narrative', () => {
  it('reports Doctor death from home, then lets Wakaharu send her portfolio', () => {
    const story = loadRealStory();
    const rescue = sessionAt(story, DOCTOR_DEATH);
    rescue.submittedActionIds = ['protect_wakaharu'];

    const doctorReport = reconcilePlayerRuntime(story, rescue, nowAt(DOCTOR_DEATH));
    expect(doctorReport.currentLocation).toBe('old_house');
    expect(doctorReport.queue.some((item) => item.id === 'scene_1831_doctor_report')).toBe(true);

    const life = sessionAt(story, WAKAHARU_LIFE);
    life.submittedActionIds = ['protect_wakaharu'];
    const lifeView = reconcilePlayerRuntime(story, life, nowAt(WAKAHARU_LIFE + 1));
    expect(lifeView.queue.some((item) => item.id === 'scene_2030_wakaharu_life')).toBe(true);

    const choice = lifeView.availableChoices.find((item) => item.id === 'wakaharu_send_portfolio');
    expect(choice).toBeDefined();
    if (!choice) throw new Error('missing portfolio choice');

    const next = applyChoiceEffects(story, life, choice, WAKAHARU_LIFE);
    expect(next.activeActivity).toMatchObject({
      activityId: 'send_wakaharu_portfolio',
      startedAt: WAKAHARU_LIFE,
      durationMinutes: 8,
    });
    next.consumedSceneIds = [...next.consumedSceneIds, 'scene_2030_wakaharu_life'];

    const completed = reconcilePlayerRuntime(story, next, nowAt(PORTFOLIO_SENT));
    expect(completed.queue.some((item) => item.id === 'scene_2038_wakaharu_portfolio_sent')).toBe(true);
  });

  it('does not offer Wakaharu life continuation without the rescue worldline', () => {
    const story = loadRealStory();
    const baseline = sessionAt(story, WAKAHARU_LIFE);
    const view = reconcilePlayerRuntime(story, baseline, nowAt(WAKAHARU_LIFE + 1));

    expect(view.queue.some((item) => item.id === 'scene_2030_wakaharu_life')).toBe(false);
  });
});
