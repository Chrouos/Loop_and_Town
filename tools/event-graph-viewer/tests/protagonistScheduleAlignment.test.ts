import { expect, it } from 'vitest';
import { toAbsoluteMinute } from '../src/simulator/time';
import { loadRealStory } from './helpers/loadRealStory';

it('keeps protagonist baseline activities non-overlapping', () => {
  const narrative = loadRealStory().narrative;
  const activities = new Map(narrative.activities.map((activity) => [activity.id, activity]));
  const entries = [...narrative.protagonistSchedule.entries]
    .sort((left, right) => toAbsoluteMinute(left.at) - toAbsoluteMinute(right.at));

  for (let index = 0; index < entries.length - 1; index += 1) {
    const current = entries[index];
    const next = entries[index + 1];
    const definition = activities.get(current.activityId)!;
    const currentEnd = toAbsoluteMinute(current.at) + definition.durationMinutes;
    expect(currentEnd, `${current.id} overlaps ${next.id}`).toBeLessThanOrEqual(toAbsoluteMinute(next.at));
  }
});

it('aligns scheduled protagonist activities with their authored narrative starts', () => {
  const narrative = loadRealStory().narrative;
  for (const entry of narrative.protagonistSchedule.entries) {
    const scene = narrative.scenes.find((candidate) => candidate.startsActivity === entry.activityId);
    if (!scene) continue;
    expect(toAbsoluteMinute(scene.at), `${entry.activityId} scene/schedule mismatch`).toBe(toAbsoluteMinute(entry.at));
  }
});
