import { getPath, hasPath } from './state';
import type { Condition, WorldState } from './types';

function numericOperands(actual: unknown, expected: unknown, path: string): [number, number] {
  if (typeof actual !== 'number' || typeof expected !== 'number') {
    throw new Error(`Numeric condition requires numbers: ${path}`);
  }
  return [actual, expected];
}

export function evaluateCondition(condition: Condition, state: WorldState): boolean {
  if ('all' in condition) return condition.all.every((item) => evaluateCondition(item, state));
  if ('any' in condition) return condition.any.some((item) => evaluateCondition(item, state));
  if ('not' in condition) return !evaluateCondition(condition.not, state);

  if (condition.op === 'exists') return hasPath(state, condition.path);
  if (condition.op === 'not_exists') return !hasPath(state, condition.path);

  const actual = getPath(state, condition.path);
  if (condition.op === 'eq') return Object.is(actual, condition.value);
  if (condition.op === 'neq') return !Object.is(actual, condition.value);

  const [left, right] = numericOperands(actual, condition.value, condition.path);
  if (condition.op === 'gt') return left > right;
  if (condition.op === 'gte') return left >= right;
  if (condition.op === 'lt') return left < right;
  if (condition.op === 'lte') return left <= right;

  const unreachable: never = condition.op;
  throw new Error(`Unknown condition operator: ${String(unreachable)}`);
}
