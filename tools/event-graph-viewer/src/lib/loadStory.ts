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

function normalizeConditions(value: unknown): string[] {
  const object = asObject(value);
  return asStringArray(object.all);
}

function normalizeEffect(value: unknown): StoryEffect {
  const effect = asObject(value);

  if ('set' in effect) {
    const target = String(effect.set);
    return {
      kind: 'set',
      target,
      value: effect.value,
      description: `${target} = ${String(effect.value)}`,
    };
  }

  if ('add_flag' in effect) {
    const target = String(effect.add_flag);
    return {
      kind: 'add_flag',
      target,
      description: `flag + ${target}`,
    };
  }

  if ('emit_event' in effect) {
    const eventId = String(effect.emit_event);
    return {
      kind: 'emit_event',
      eventId,
      description: `emit ${eventId}`,
    };
  }

  return {
    kind: 'unknown',
    description: JSON.stringify(effect),
  };
}

function normalizeDelayedEffect(value: unknown): DelayedEffect {
  const delayed = asObject(value);
  return {
    id: String(delayed.id ?? 'delayed-effect'),
    delayMinutes:
      typeof delayed.delay_minutes === 'number' ? delayed.delay_minutes : undefined,
    executeAt:
      typeof delayed.execute_at === 'string' ? delayed.execute_at : undefined,
    conditions: normalizeConditions(delayed.when),
    effects: Array.isArray(delayed.effects)
      ? delayed.effects.map(normalizeEffect)
      : [],
  };
}

function normalizeVariant(value: unknown): EventVariant {
  const variant = asObject(value);
  return {
    id: String(variant.id ?? 'variant'),
    priority: typeof variant.priority === 'number' ? variant.priority : 0,
    conditions: normalizeConditions(variant.when),
    effects: Array.isArray(variant.effects)
      ? variant.effects.map(normalizeEffect)
      : [],
    delayedEffects: Array.isArray(variant.delayed_effects)
      ? variant.delayed_effects.map(normalizeDelayedEffect)
      : [],
  };
}

export function parseEventGraphText(text: string): EventGraphDocument {
  const raw = asObject(yaml.load(text));

  if (!raw.id || !raw.title || !raw.time) {
    throw new Error('Event Graph 缺少 id、title 或 time');
  }

  return {
    id: String(raw.id),
    title: String(raw.title),
    time: String(raw.time),
    location: typeof raw.location === 'string' ? raw.location : undefined,
    conditions: normalizeConditions(raw.conditions),
    variants: Array.isArray(raw.variants) ? raw.variants.map(normalizeVariant) : [],
    notes: asStringArray(raw.notes),
  };
}

export async function loadEventGraph(path: string): Promise<EventGraphDocument> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${path}`);
  }
  return parseEventGraphText(await response.text());
}
