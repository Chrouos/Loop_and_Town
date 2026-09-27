import type { Visibility } from '../simulator/types';
import type { ActivityDefinition } from './types';

export type ActivityRunStatus = 'running' | 'interrupted' | 'complete';

export type ActivityRun = {
  activityId: string;
  startedAt: number;
  durationMinutes: number;
  consumedMinutes: number;
  remainingMinutes: number;
  interruptible: boolean;
  status: ActivityRunStatus;
  interruptedBySceneId?: string;
};

export type ActivityInterruption = {
  minute: number;
  visibility: Visibility;
  observable: boolean;
  sceneId: string;
};

export function startActivity(
  activityId: string,
  startedAt: number,
  definition: ActivityDefinition,
): ActivityRun {
  if (definition.id !== activityId) {
    throw new Error(`Activity definition mismatch: expected ${activityId}, got ${definition.id}`);
  }
  if (!Number.isFinite(startedAt) || !Number.isInteger(startedAt)) {
    throw new Error(`Invalid activity start minute: ${startedAt}`);
  }
  if (!Number.isInteger(definition.durationMinutes) || definition.durationMinutes < 0) {
    throw new Error(`Invalid activity duration: ${definition.durationMinutes}`);
  }

  return {
    activityId,
    startedAt,
    durationMinutes: definition.durationMinutes,
    consumedMinutes: 0,
    remainingMinutes: definition.durationMinutes,
    interruptible: definition.interruptible,
    status: definition.durationMinutes === 0 ? 'complete' : 'running',
  };
}

export function advanceActivity(
  run: ActivityRun,
  targetMinute: number,
  interruptions: ActivityInterruption[],
): ActivityRun {
  if (run.status === 'complete') return run;
  if (targetMinute < run.startedAt) throw new Error('Activity cannot move backward in time');

  const eligibleInterrupt = run.interruptible
    ? interruptions
      .filter((item) => item.observable && item.visibility === 'observable')
      .filter((item) => item.minute >= run.startedAt && item.minute <= targetMinute)
      .sort((a, b) => a.minute - b.minute)[0]
    : undefined;

  const activityEnd = run.startedAt + run.durationMinutes;
  const effectiveMinute = Math.min(targetMinute, eligibleInterrupt?.minute ?? targetMinute, activityEnd);
  const consumedMinutes = Math.min(run.durationMinutes, Math.max(run.consumedMinutes, effectiveMinute - run.startedAt));
  const remainingMinutes = Math.max(0, run.durationMinutes - consumedMinutes);

  if (remainingMinutes === 0) {
    return {
      ...run,
      consumedMinutes,
      remainingMinutes,
      status: 'complete',
      interruptedBySceneId: undefined,
    };
  }

  if (eligibleInterrupt && eligibleInterrupt.minute === effectiveMinute) {
    return {
      ...run,
      consumedMinutes,
      remainingMinutes,
      status: 'interrupted',
      interruptedBySceneId: eligibleInterrupt.sceneId,
    };
  }

  return {
    ...run,
    consumedMinutes,
    remainingMinutes,
    status: 'running',
    interruptedBySceneId: undefined,
  };
}
