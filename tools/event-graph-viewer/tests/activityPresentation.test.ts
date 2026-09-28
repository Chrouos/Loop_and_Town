import { describe, expect, it } from 'vitest';
import type { ActivityRun } from '../src/narrative/activity';
import type { ActivityDefinition } from '../src/narrative/types';
import { projectActivityPresentation, projectTravelPresentation, type ActivityClockProjection } from '../src/playerNarrative/activityPresentation';

const clock: ActivityClockProjection = {
  formatStoryMinute: (minute) => `TIME-${minute}`,
  estimatedCompletionMinute: () => 1122,
};

const activity: ActivityDefinition = {
  id: 'sort_mail',
  durationMinutes: 10,
  interruptible: true,
  presentation: {
    start: '開始整理',
    idle: '正在整理郵件……',
    complete: '整理完成',
    eta: 'exact',
  },
};

function run(overrides: Partial<ActivityRun> = {}): ActivityRun {
  return {
    activityId: 'sort_mail',
    startedAt: 1112,
    durationMinutes: 10,
    consumedMinutes: 5,
    remainingMinutes: 5,
    interruptible: true,
    status: 'running',
    ...overrides,
  };
}

describe('activity presentation projection', () => {
  it('projects exact ETA through the injected clock', () => {
    expect(projectActivityPresentation(run(), activity, clock)).toEqual({
      title: '正在整理郵件……',
      remainingLabel: undefined,
      etaLabel: '預計 TIME-1122 完成',
      etaMode: 'exact',
    });
  });

  it('projects approximate remaining time without exposing an exact ETA', () => {
    const approximate = { ...activity, presentation: { ...activity.presentation, eta: 'approximate' as const } };
    expect(projectActivityPresentation(run(), approximate, clock)).toEqual({
      title: '正在整理郵件……',
      remainingLabel: '大約還要 5 分鐘',
      etaLabel: undefined,
      etaMode: 'approximate',
    });
  });

  it('hides both time labels when the activity policy is hidden or missing', () => {
    const hidden = { ...activity, presentation: { ...activity.presentation, eta: 'hidden' as const } };
    const missing = { ...activity, presentation: { start: '開始整理', idle: '正在整理郵件……', complete: '整理完成' } };
    const hiddenView = projectActivityPresentation(run(), hidden, clock);
    expect(hiddenView.remainingLabel).toBeUndefined();
    expect(hiddenView.etaLabel).toBeUndefined();
    expect(hiddenView.etaMode).toBe('hidden');
    expect(projectActivityPresentation(run(), missing, clock).etaMode).toBe('hidden');
  });

  it('uses completion copy and hides ETA after completion', () => {
    expect(projectActivityPresentation(run({ status: 'complete', remainingMinutes: 0 }), activity, clock)).toEqual({
      title: '整理完成',
      remainingLabel: undefined,
      etaLabel: undefined,
      etaMode: 'hidden',
    });
  });

  it('projects remaining time and arrival time for travel activities', () => {
    expect(projectTravelPresentation(run({
      activityId: 'travel:station:old_house',
      startedAt: 860,
      durationMinutes: 22,
      remainingMinutes: 22,
    }), clock)).toEqual({
      title: '正在路上……',
      remainingLabel: '還有 22 分鐘',
      etaLabel: '預計 TIME-882 抵達',
      etaMode: 'exact',
    });
  });
});
