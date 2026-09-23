import yaml from 'js-yaml';
import type {
  DelayedEffect,
  EventGraphDocument,
  EventVariant,
  StoryEffect,
} from '../types/story';

type RawObject = Record<string, unknown>;

function asObject(value: unknown): RawObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RawObject)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function conditionToStrings(value: unknown): string[] {
  const condition = asObject(value);
  if ('path' in condition && 'op' in condition) {
    const suffix = 'value' in condition ? ` ${String(condition.value)}` : '';
    return [`${String(condition.path)} ${String(condition.op)}${suffix}`];
  }
  if (Array.isArray(condition.all)) return condition.all.flatMap(conditionToStrings);
  if (Array.isArray(condition.any)) return [`ANY(${condition.any.flatMap(conditionToStrings).join(' | ')})`];
  if ('not' in condition) return [`NOT(${conditionToStrings(condition.not).join(', ')})`];
  return asStringArray(condition.all);
}

function normalizeEffect(value: unknown): StoryEffect {
  const effect = asObject(value);

  if ('set' in effect) {
    const set = effect.set;
    if (set && typeof set === 'object') {
      const object = set as RawObject;
      const target = String(object.path ?? 'unknown');
      return { kind: 'set', target, value: object.value, description: `${target} = ${String(object.value)}` };
    }
    const target = String(effect.set);
    return { kind: 'set', target, value: effect.value, description: `${target} = ${String(effect.value)}` };
  }

  if ('add_flag' in effect) {
    const target = String(effect.add_flag);
    return { kind: 'add_flag', target, description: `flag + ${target}` };
  }

  if ('emit_event' in effect) {
    const emitted = effect.emit_event;
    const eventId = emitted && typeof emitted === 'object'
      ? String((emitted as RawObject).event_id ?? 'unknown')
      : String(emitted);
    return { kind: 'emit_event', eventId, description: `emit ${eventId}` };
  }

  return { kind: 'unknown', description: JSON.stringify(effect) };
}

function normalizeDelayedEffect(value: unknown): DelayedEffect {
  const delayed = asObject(value);
  return {
    id: String(delayed.id ?? 'delayed-effect'),
    delayMinutes: typeof delayed.delay_minutes === 'number' ? delayed.delay_minutes : undefined,
    executeAt: typeof delayed.execute_at === 'string' ? delayed.execute_at : undefined,
    conditions: conditionToStrings(delayed.when),
    effects: Array.isArray(delayed.effects) ? delayed.effects.map(normalizeEffect) : [],
  };
}

function normalizeVariant(value: unknown): EventVariant {
  const variant = asObject(value);
  return {
    id: String(variant.id ?? 'variant'),
    priority: typeof variant.priority === 'number' ? variant.priority : 0,
    conditions: variant.fallback ? ['fallback'] : conditionToStrings(variant.when),
    effects: Array.isArray(variant.effects) ? variant.effects.map(normalizeEffect) : [],
    delayedEffects: Array.isArray(variant.delayed_effects)
      ? variant.delayed_effects.map(normalizeDelayedEffect)
      : [],
  };
}

export function parseEventGraphText(text: string): EventGraphDocument {
  const raw = asObject(yaml.load(text));
  const time = raw.time ?? raw.at;

  if (!raw.id || !raw.title || !time) {
    throw new Error('Event Graph 缺少 id、title 或 time/at');
  }

  return {
    id: String(raw.id),
    title: String(raw.title),
    time: String(time),
    location: typeof raw.location === 'string' ? raw.location : undefined,
    conditions: conditionToStrings(raw.conditions),
    variants: Array.isArray(raw.variants) ? raw.variants.map(normalizeVariant) : [],
    notes: asStringArray(raw.notes),
  };
}

export async function loadEventGraph(path: string): Promise<EventGraphDocument> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
  return parseEventGraphText(await response.text());
}
