import { hasPath } from './state';
import { parseTime } from './time';
import type { ActionDefinition, Condition, SimulationDefinition, WorldState } from './types';

const LAST_MINUTE_OF_DAY = parseTime('23:59');

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function validateCondition(condition: Condition, state: WorldState): void {
  if ('all' in condition) return condition.all.forEach((item) => validateCondition(item, state));
  if ('any' in condition) return condition.any.forEach((item) => validateCondition(item, state));
  if ('not' in condition) return validateCondition(condition.not, state);

  const operator = (condition as { op?: unknown }).op;
  if (!['eq', 'neq', 'exists', 'not_exists'].includes(String(operator))) {
    throw new Error(`Unknown condition operator: ${String(operator)}`);
  }

  if ((operator === 'eq' || operator === 'neq') && !hasPath(state, condition.path)) {
    throw new Error(`Unknown state path: ${condition.path}`);
  }
}

function validateEffects(effects: unknown, state: WorldState, eventIds: Set<string>, owner: string): void {
  if (!Array.isArray(effects)) throw new Error(`Effects must be an array for ${owner}`);

  for (const effect of effects) {
    if (!isRecord(effect)) {
      throw new Error(`Malformed effect for ${owner}`);
    }

    const operations = Object.keys(effect);
    if (operations.length !== 1) {
      throw new Error(`Effect must contain exactly one operation for ${owner}`);
    }

    const operation = operations[0];
    if (operation === 'set') {
      const set = effect.set;
      if (
        !isRecord(set)
        || !hasOnlyKeys(set, ['path', 'value'])
        || typeof set.path !== 'string'
        || !Object.hasOwn(set, 'value')
      ) {
        throw new Error(`Malformed set effect for ${owner}`);
      }
      if (!hasPath(state, set.path)) {
        throw new Error(`Unknown state path: ${set.path}`);
      }
      continue;
    }

    if (operation === 'add_flag') {
      const path = effect.add_flag;
      if (typeof path !== 'string') throw new Error(`Malformed add_flag effect for ${owner}`);
      if (!hasPath(state, path)) {
        throw new Error(`Unknown state path: ${path}`);
      }
      continue;
    }

    if (operation === 'emit_event') {
      const emitted = effect.emit_event;
      if (
        !isRecord(emitted)
        || !hasOnlyKeys(emitted, ['event_id', 'at'])
        || typeof emitted.event_id !== 'string'
      ) {
        throw new Error(`Malformed emit_event effect for ${owner}`);
      }
      if (!eventIds.has(emitted.event_id)) {
        throw new Error(`Unknown emitted event: ${emitted.event_id}`);
      }
      if (Object.hasOwn(emitted, 'at') && typeof emitted.at !== 'string') {
        throw new Error(`Malformed emit_event effect for ${owner}`);
      }
      if (typeof emitted.at === 'string') parseTime(emitted.at);
      continue;
    }

    throw new Error(`Unknown effect operation: ${operation}`);
  }
}

export function validateActionDefinition(
  action: ActionDefinition,
  state: WorldState,
  eventIds: Set<string>,
): { actionMinute: number; durationMinutes: number } {
  const actionMinute = parseTime(action.at);
  const rawDuration = (action as { duration_minutes?: unknown }).duration_minutes;
  const durationMinutes = rawDuration === undefined ? 0 : rawDuration;
  if (typeof durationMinutes !== 'number' || !Number.isInteger(durationMinutes) || durationMinutes < 0) {
    throw new Error(`Invalid duration for action ${action.id}`);
  }
  if (actionMinute + durationMinutes > LAST_MINUTE_OF_DAY) {
    throw new Error(`Action ${action.id} ends after 23:59`);
  }
  validateEffects((action as { effects?: unknown }).effects, state, eventIds, `action ${action.id}`);
  return { actionMinute, durationMinutes };
}

export function validateDefinition(definition: SimulationDefinition, initialState: WorldState): void {
  assertUnique(definition.events.map((event) => event.id), 'Event ID');
  assertUnique(definition.actions.map((action) => action.id), 'Action ID');
  const eventIds = new Set(definition.events.map((event) => event.id));
  const initialTime = typeof initialState.clock === 'object' && initialState.clock && 'time' in initialState.clock
    ? parseTime(String((initialState.clock as Record<string, unknown>).time))
    : 0;

  for (const action of definition.actions) {
    validateActionDefinition(action, initialState, eventIds);
  }

  for (const event of definition.events) {
    if (event.at && parseTime(event.at) < initialTime) {
      throw new Error(`Scheduled event before initial clock: ${event.id}`);
    }
    assertUnique(event.variants.map((variant) => variant.id), `Variant ID in ${event.id}`);
    const fallbacks = event.variants.filter((variant) => variant.fallback);
    if (fallbacks.length > 1) throw new Error(`Multiple fallback variants in ${event.id}`);

    for (const variant of event.variants) {
      if (variant.fallback && variant.when) throw new Error(`Fallback variant must not define when: ${event.id}/${variant.id}`);
      if (!variant.fallback && !variant.when) throw new Error(`Conditional variant missing when: ${event.id}/${variant.id}`);
      if (variant.when) validateCondition(variant.when, initialState);
      validateEffects(variant.effects, initialState, eventIds, `event variant ${event.id}/${variant.id}`);

      const delayed = variant.delayed_effects ?? [];
      assertUnique(delayed.map((item) => item.id), `Delayed effect ID in ${event.id}/${variant.id}`);
      for (const item of delayed) {
        if (item.delay_minutes < 0) throw new Error(`Negative delayed effect delay: ${item.id}`);
        validateEffects(item.effects, initialState, eventIds, `delayed effect ${item.id}`);
      }
    }
  }
}
