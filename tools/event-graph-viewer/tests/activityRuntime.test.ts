import { expect, it } from 'vitest';
import { advanceActivity, startActivity } from '../src/narrative/activity';
import type { ActivityDefinition } from '../src/narrative/types';
import { loadRealStory } from './helpers/loadRealStory';

const reading: ActivityDefinition = {
  id: 'rest_and_read',
  durationMinutes: 20,
  interruptible: true,
  presentation: {
    start: '我泡了杯茶。',
    idle: '正在看書……',
    complete: '我把書闔上。',
  },
};

it('advances by canonical world minutes', () => {
  const run = startActivity('rest_and_read', 930, reading);
  expect(advanceActivity(run, 949, []).status).toBe('running');
  expect(advanceActivity(run, 950, []).status).toBe('complete');
});

it('does not interrupt for hidden world activity', () => {
  const run = startActivity('rest_and_read', 930, reading);
  const next = advanceActivity(run, 940, [{
    minute: 940,
    visibility: 'hidden',
    observable: false,
    sceneId: 'hidden_scene',
  }]);
  expect(next.status).toBe('running');
  expect(next.consumedMinutes).toBe(10);
});

it('interrupts and retains remaining minutes for an eligible observed event', () => {
  const run = startActivity('rest_and_read', 930, reading);
  const next = advanceActivity(run, 940, [{
    minute: 940,
    visibility: 'observable',
    observable: true,
    sceneId: 'phone_call',
  }]);
  expect(next.status).toBe('interrupted');
  expect(next.consumedMinutes).toBe(10);
  expect(next.remainingMinutes).toBe(10);
  expect(next.interruptedBySceneId).toBe('phone_call');
});

it('does not interrupt a non-interruptible activity', () => {
  const run = startActivity('wait_for_call', 930, { ...reading, id: 'wait_for_call', interruptible: false });
  const next = advanceActivity(run, 940, [{
    minute: 935,
    visibility: 'observable',
    observable: true,
    sceneId: 'phone_call',
  }]);
  expect(next.status).toBe('running');
  expect(next.interruptedBySceneId).toBeUndefined();
});

it('loads the protagonist baseline schedule outside NPC simulator schedules', () => {
  const story = loadRealStory();
  const activityIds = new Set(story.narrative.activities.map((activity) => activity.id));
  expect(story.narrative.protagonistSchedule.characterId).toBe('protagonist');
  expect(story.definition.schedules?.some((schedule) => schedule.characterId === 'protagonist')).toBe(false);
  for (const entry of story.narrative.protagonistSchedule.entries) {
    expect(activityIds.has(entry.activityId), `unknown protagonist activity ${entry.activityId}`).toBe(true);
  }
});
