import { evaluateCondition } from './conditionEvaluator';
import { executeEffects } from './effectExecutor';
import type { ResolverContext, ScheduleEntryDefinition, StateChange } from './types';

export type ScheduleResolution = {
  status: 'applied' | 'skipped';
  changes: StateChange[];
};

export function resolveScheduleEntry(
  context: ResolverContext,
  entry: ScheduleEntryDefinition,
): ScheduleResolution {
  if (entry.when && !evaluateCondition(entry.when, context.state)) {
    return { status: 'skipped', changes: [] };
  }

  return {
    status: 'applied',
    changes: executeEffects(context, entry.effects),
  };
}
