export type RelationshipDimension = 'trust' | 'closeness' | 'respect' | 'pressure';

export type RelationshipState = Record<RelationshipDimension, number>;

export type RelationshipContext = Record<string, unknown>;

export type RelationshipLeafCondition = {
  path: string;
  op: 'eq' | 'neq' | 'gte' | 'lt' | 'lte';
  value: unknown;
};

export type RelationshipCondition =
  | RelationshipLeafCondition
  | { all: RelationshipCondition[] }
  | { any: RelationshipCondition[] }
  | { not: RelationshipCondition };

export type RelationshipOutcome = {
  id: string;
  when?: RelationshipCondition;
  fallback?: boolean;
};

export const EMPTY_RELATIONSHIP_STATE: RelationshipState = {
  trust: 0,
  closeness: 0,
  respect: 0,
  pressure: 0,
};

function getPath(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, root);
}

export function adjustRelationship(
  state: RelationshipState,
  changes: Partial<Record<RelationshipDimension, number>>,
): RelationshipState {
  const next = { ...state };
  for (const dimension of Object.keys(changes) as RelationshipDimension[]) {
    const by = changes[dimension];
    if (by === undefined) continue;
    if (!Number.isFinite(by)) throw new Error(`Invalid relationship adjustment: ${dimension}`);
    next[dimension] += by;
  }
  return next;
}

export function resetRelationshipState(): RelationshipState {
  return { ...EMPTY_RELATIONSHIP_STATE };
}

export function evaluateRelationshipCondition(
  condition: RelationshipCondition,
  context: RelationshipContext,
): boolean {
  if ('all' in condition) return condition.all.every((item) => evaluateRelationshipCondition(item, context));
  if ('any' in condition) return condition.any.some((item) => evaluateRelationshipCondition(item, context));
  if ('not' in condition) return !evaluateRelationshipCondition(condition.not, context);

  const actual = getPath(context, condition.path);
  if (condition.op === 'eq') return Object.is(actual, condition.value);
  if (condition.op === 'neq') return !Object.is(actual, condition.value);

  if (typeof actual !== 'number' || typeof condition.value !== 'number') {
    throw new Error(`Relationship threshold requires numbers: ${condition.path}`);
  }
  if (condition.op === 'gte') return actual >= condition.value;
  if (condition.op === 'lt') return actual < condition.value;
  if (condition.op === 'lte') return actual <= condition.value;

  const unreachable: never = condition.op;
  throw new Error(`Unknown relationship operator: ${String(unreachable)}`);
}

export function resolveRelationshipOutcome(
  outcomes: RelationshipOutcome[],
  context: RelationshipContext,
): string {
  const fallback = outcomes.find((outcome) => outcome.fallback);
  const matched = outcomes.find((outcome) => outcome.when && evaluateRelationshipCondition(outcome.when, context));
  if (matched) return matched.id;
  if (fallback) return fallback.id;
  throw new Error('No relationship outcome matched and no fallback exists');
}
