import type { ActivityRun } from '../narrative/activity';
import type { ActivityDefinition } from '../narrative/types';

export type ActivityClockProjection = {
  formatStoryMinute: (minute: number) => string;
  estimatedCompletionMinute: (run: ActivityRun) => number;
};

export type ActivityPresentationView = {
  title: string;
  prose?: string;
  remainingLabel?: string;
  etaLabel?: string;
  etaMode: 'exact' | 'approximate' | 'hidden';
};

function firstCopy(value: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}

export function projectActivityPresentation(
  run: ActivityRun,
  definition: ActivityDefinition,
  clock: ActivityClockProjection,
): ActivityPresentationView {
  const completed = run.status === 'complete';
  const title = completed ? firstCopy(definition.presentation.complete) : definition.presentation.idle;
  if (completed || run.status === 'interrupted') {
    return { title, etaMode: 'hidden' };
  }

  const etaMode = definition.presentation.eta ?? 'hidden';
  if (etaMode === 'exact') {
    const completionMinute = clock.estimatedCompletionMinute(run);
    return {
      title,
      etaLabel: `預計 ${clock.formatStoryMinute(completionMinute)} 完成`,
      etaMode,
    };
  }

  if (etaMode === 'approximate') {
    return {
      title,
      remainingLabel: `大約還要 ${run.remainingMinutes} 分鐘`,
      etaMode,
    };
  }

  return { title, etaMode };
}

export function projectTravelPresentation(
  run: ActivityRun,
  clock: ActivityClockProjection,
): ActivityPresentationView {
  if (run.status !== 'running') return { title: '正在路上……', etaMode: 'hidden' };
  return {
    title: '正在路上……',
    remainingLabel: `還有 ${run.remainingMinutes} 分鐘`,
    etaLabel: `預計 ${clock.formatStoryMinute(run.startedAt + run.durationMinutes)} 抵達`,
    etaMode: 'exact',
  };
}
