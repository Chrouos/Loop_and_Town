import yaml from 'js-yaml';
import type {
  DelayedEffect,
  EventGraphDocument,
  EventVariant,
  StoryDagDocument,
  StoryDagNode,
  StoryDagNodeDetail,
  StoryEffect,
  StoryVisibility,
  StoryWorldlinePath,
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

function asVisibility(value: unknown): StoryVisibility {
  return value === 'author' || value === 'player-known' ? value : 'public';
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

function normalizeDagDetail(value: unknown): StoryDagNodeDetail {
  const detail = asObject(value);
  return {
    before: asStringArray(detail.before),
    after: asStringArray(detail.after),
    reason: typeof detail.reason === 'string' ? detail.reason : undefined,
    affectedCharacters: asStringArray(detail.affected_characters),
    delayedEffects: asStringArray(detail.delayed_effects),
    knowledgeChanges: asStringArray(detail.knowledge_changes),
    relationshipChanges: asStringArray(detail.relationship_changes),
    narrativeRefs: asStringArray(detail.narrative_refs),
  };
}

function normalizeDagNode(value: unknown): StoryDagNode {
  const node = asObject(value);
  return {
    id: String(node.id ?? 'node'),
    title: String(node.title ?? node.id ?? 'Node'),
    time: typeof node.time === 'string' ? node.time : undefined,
    actorIds: asStringArray(node.actor_ids),
    visibility: asVisibility(node.visibility),
    detail: normalizeDagDetail(node.detail),
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

export function parseStoryDagText(text: string): StoryDagDocument {
  const raw = asObject(yaml.load(text));
  if (!raw.id || !raw.title) throw new Error('Story DAG 缺少 id 或 title');

  return {
    id: String(raw.id),
    title: String(raw.title),
    nodes: Array.isArray(raw.nodes) ? raw.nodes.map(normalizeDagNode) : [],
    edges: Array.isArray(raw.edges)
      ? raw.edges.map((value) => {
          const edge = asObject(value);
          return {
            id: String(edge.id ?? 'edge'),
            source: String(edge.source ?? ''),
            target: String(edge.target ?? ''),
            label: String(edge.label ?? ''),
            visibility: asVisibility(edge.visibility),
          };
        })
      : [],
  };
}

export function parseStoryWorldlinePathsText(text: string): StoryWorldlinePath[] {
  const raw = asObject(yaml.load(text));
  if (!Array.isArray(raw.paths)) throw new Error('Story worldline paths 缺少 paths');
  return raw.paths.map((value) => {
    const path = asObject(value);
    if (!path.id || !path.label) throw new Error('Story worldline path 缺少 id 或 label');
    return {
      id: String(path.id),
      label: String(path.label),
      nodeIds: asStringArray(path.node_ids),
      edgeIds: asStringArray(path.edge_ids),
      visibility: asVisibility(path.visibility),
    };
  });
}

export async function loadEventGraph(path: string): Promise<EventGraphDocument> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
  return parseEventGraphText(await response.text());
}
