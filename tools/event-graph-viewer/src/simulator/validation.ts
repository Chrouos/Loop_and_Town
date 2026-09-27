import { hasPath } from './state';
import { parseTime, toAbsoluteMinute } from './time';
import type { Condition, Effect, SimulationDefinition, StoryTimeInput, WorldState } from './types';

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

function validateEffects(effects: Effect[], state: WorldState, eventIds: Set<string>): void {
  for (const effect of effects) {
    if ('set' in effect) {
      if (!hasPath(state, effect.set.path)) throw new Error(`Unknown state path: ${effect.set.path}`);
      continue;
    }

    if ('add_flag' in effect) {
      if (!hasPath(state, effect.add_flag)) throw new Error(`Unknown state path: ${effect.add_flag}`);
      continue;
    }

    if ('emit_event' in effect) {
      if (!eventIds.has(effect.emit_event.event_id)) {
        throw new Error(`Unknown emitted event: ${effect.emit_event.event_id}`);
      }
      if (effect.emit_event.at) toAbsoluteMinute(effect.emit_event.at);
      continue;
    }

    const operation = Object.keys(effect as Record<string, unknown>)[0] ?? 'unknown';
    throw new Error(`Unknown effect operation: ${operation}`);
  }
}

function initialMinute(definition: SimulationDefinition, initialState: WorldState): number {
  const clock = initialState.clock;
  if (!clock || typeof clock !== 'object' || !('time' in clock)) return 0;
  const record = clock as Record<string, unknown>;
  const time = String(record.time);
  if (!definition.loop) return parseTime(time);
  const day = typeof record.day === 'number' ? record.day : 0;
  return toAbsoluteMinute({ day, time });
}

function assertInLoopRange(
  definition: SimulationDefinition,
  at: StoryTimeInput,
  kind: 'event' | 'action' | 'schedule',
  id: string,
): void {
  if (!definition.loop) return;
  const start = toAbsoluteMinute(definition.loop.range.start);
  const end = toAbsoluteMinute(definition.loop.range.end);
  const value = toAbsoluteMinute(at);
  if (value < start || value > end) {
    const label = kind === 'event' ? 'Scheduled event' : kind === 'schedule' ? 'Schedule entry' : 'Action';
    throw new Error(`${label} outside loop range: ${id}`);
  }
}

export function validateDefinition(definition: SimulationDefinition, initialState: WorldState): void {
  assertUnique(definition.events.map((event) => event.id), 'Event ID');
  assertUnique(definition.actions.map((action) => action.id), 'Action ID');
  const schedules = definition.schedules ?? [];
  assertUnique(schedules.map((schedule) => schedule.characterId), 'Schedule character ID');
  assertUnique(schedules.flatMap((schedule) => schedule.entries.map((entry) => entry.id)), 'Schedule entry ID');
  const eventIds = new Set(definition.events.map((event) => event.id));

  if (definition.loop) {
    const start = toAbsoluteMinute(definition.loop.range.start);
    const end = toAbsoluteMinute(definition.loop.range.end);
    if (start > end) throw new Error(`Invalid loop range: ${definition.loop.id}`);
  }

  const initialTime = initialMinute(definition, initialState);

  for (const action of definition.actions) {
    const actionTime = toAbsoluteMinute(action.at);
    assertInLoopRange(definition, action.at, 'action', action.id);
    if (actionTime < initialTime) throw new Error(`Action before initial clock: ${action.id}`);
    validateEffects(action.effects, initialState, eventIds);
  }

  for (const schedule of schedules) {
    for (const entry of schedule.entries) {
      const entryTime = toAbsoluteMinute(entry.at);
      assertInLoopRange(definition, entry.at, 'schedule', entry.id);
      if (entryTime < initialTime) throw new Error(`Schedule entry before initial clock: ${entry.id}`);
      if (entry.when) validateCondition(entry.when, initialState);
      validateEffects(entry.effects, initialState, eventIds);
    }
  }

  for (const event of definition.events) {
    if (event.at) {
      const eventTime = toAbsoluteMinute(event.at);
      assertInLoopRange(definition, event.at, 'event', event.id);
      if (eventTime < initialTime) throw new Error(`Scheduled event before initial clock: ${event.id}`);
    }
    assertUnique(event.variants.map((variant) => variant.id), `Variant ID in ${event.id}`);
    const fallbacks = event.variants.filter((variant) => variant.fallback);
    if (fallbacks.length > 1) throw new Error(`Multiple fallback variants in ${event.id}`);

    for (const variant of event.variants) {
      if (variant.fallback && variant.when) throw new Error(`Fallback variant must not define when: ${event.id}/${variant.id}`);
      if (!variant.fallback && !variant.when) throw new Error(`Conditional variant missing when: ${event.id}/${variant.id}`);
      if (variant.when) validateCondition(variant.when, initialState);
      validateEffects(variant.effects, initialState, eventIds);

      const delayed = variant.delayed_effects ?? [];
      assertUnique(delayed.map((item) => item.id), `Delayed effect ID in ${event.id}/${variant.id}`);
      for (const item of delayed) {
        if (item.delay_minutes < 0) throw new Error(`Negative delayed effect delay: ${item.id}`);
        validateEffects(item.effects, initialState, eventIds);
      }
    }
  }
}
