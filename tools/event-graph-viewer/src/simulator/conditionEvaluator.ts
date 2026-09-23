import { getPath, hasPath } from './state';
import type { Condition, WorldState } from './types';

export function evaluateCondition(condition: Condition, state: WorldState): boolean {
  if ('all' in condition) return condition.all.every((item) => evaluateCondition(item, state));
  if ('any' in condition) return condition.any.some((item) => evaluateCondition(item, state));
  if ('not' in condition) return !evaluateCondition(condition.not, state);

  if (condition.op === 'exists') return hasPath(state, condition.path);
  if (condition.op === 'not_exists') return !hasPath(state, condition.path);

  const actual = getPath(state, condition.path);
  if (condition.op === 'eq') return Object.is(actual, condition.value);
  if (condition.op === 'neq') return !Object.is(actual, condition.value);

  const unreachable: never = condition.op;
  throw new Error(`Unknown condition operator: ${String(unreachable)}`);
}
