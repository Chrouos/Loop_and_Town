import { hasPath } from './state';
import { parseTime } from './time';
import type { Condition, Effect, SimulationDefinition, WorldState } from './types';

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
  if ((condition.op === 'eq' || condition.op === 'neq') && !hasPath(state, condition.path)) {
    throw new Error(`Unknown state path: ${condition.path}`);
  }
}

function validateEffects(effects: Effect[], state: WorldState, eventIds: Set<string>): void {
  for (const effect of effects) {
    if ('set' in effect && !hasPath(state, effect.set.path)) {
      throw new Error(`Unknown state path: ${effect.set.path}`);
    }
    if ('add_flag' in effect && !hasPath(state, effect.add_flag)) {
      throw new Error(`Unknown state path: ${effect.add_flag}`);
    }
    if ('emit_event' in effect) {
      if (!eventIds.has(effect.emit_event.event_id)) {
        throw new Error(`Unknown emitted event: ${effect.emit_event.event_id}`);
      }
      if (effect.emit_event.at) parseTime(effect.emit_event.at);
    }
  }
}

export function validateDefinition(definition: SimulationDefinition, initialState: WorldState): void {
  assertUnique(definition.events.map((event) => event.id), 'Event ID');
  assertUnique(definition.actions.map((action) => action.id), 'Action ID');
  const eventIds = new Set(definition.events.map((event) => event.id));
  const initialTime = typeof initialState.clock === 'object' && initialState.clock && 'time' in initialState.clock
    ? parseTime(String((initialState.clock as Record<string, unknown>).time))
    : 0;

  for (const action of definition.actions) {
    parseTime(action.at);
    validateEffects(action.effects, initialState, eventIds);
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
