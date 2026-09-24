import type { StoryBundle } from '../lib/loadSimulationStory';
import type { GraphEdge, GraphNode, GraphProjection } from '../types/story';
import { formatStoryTime, toAbsoluteMinute } from './time';
import type { Condition, Effect, EventDefinition, EventVariantDefinition, StoryTimeInput } from './types';

export function collectWrittenPaths(effects: Effect[]): string[] {
  const paths = new Set<string>();
  for (const effect of effects) {
    if ('set' in effect) paths.add(effect.set.path);
    else if ('add_flag' in effect) paths.add(effect.add_flag);
  }
  return [...paths].sort();
}

export function collectConditionPaths(condition?: Condition): string[] {
  if (!condition) return [];
  if ('path' in condition) return [condition.path];
  if ('all' in condition) return [...new Set(condition.all.flatMap(collectConditionPaths))].sort();
  if ('any' in condition) return [...new Set(condition.any.flatMap(collectConditionPaths))].sort();
  return collectConditionPaths(condition.not);
}

type TimedDefinition = {
  nodeId: string;
  minute: number;
  writes: string[];
  reads: string[];
};

function node(
  id: string,
  role: GraphNode['role'],
  title: string,
  at: StoryTimeInput,
  details: string[] = [],
  parentEventId?: string,
): GraphNode {
  return {
    id,
    role,
    title,
    subtitle: formatStoryTime(at),
    details,
    parentEventId,
  };
}

function effectDetails(effects: Effect[]): string[] {
  return effects.map((effect) => {
    if ('set' in effect) return `${effect.set.path} = ${String(effect.set.value)}`;
    if ('add_flag' in effect) return `${effect.add_flag} = true`;
    return `emit ${effect.emit_event.event_id}`;
  });
}

function conditionDetails(condition?: Condition): string[] {
  return collectConditionPaths(condition).map((path) => `when ${path}`);
}

function eventReadPaths(event: EventDefinition): string[] {
  return [...new Set(event.variants.flatMap((variant) => collectConditionPaths(variant.when)))].sort();
}

function emittedEventIds(variant: EventVariantDefinition): string[] {
  const ids = variant.effects.flatMap((effect) => 'emit_event' in effect ? [effect.emit_event.event_id] : []);
  for (const delayed of variant.delayed_effects ?? []) {
    ids.push(...delayed.effects.flatMap((effect) => 'emit_event' in effect ? [effect.emit_event.event_id] : []));
  }
  return [...new Set(ids)];
}

export function projectStoryGraph(story: StoryBundle): GraphProjection {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const definitions: TimedDefinition[] = [];
  const nodeMinutes = new Map<string, number>();

  const addNode = (graphNode: GraphNode, minute: number) => {
    nodes.push(graphNode);
    nodeMinutes.set(graphNode.id, minute);
  };
  const addEdge = (source: string, target: string, label?: string, prefix = 'edge') => {
    const id = `${prefix}:${source}->${target}${label ? `:${label}` : ''}`;
    if (!edges.some((edge) => edge.id === id)) edges.push({ id, source, target, label });
  };

  story.definition.actions.forEach((action) => {
    const id = `action:${action.id}`;
    const minute = toAbsoluteMinute(action.at);
    addNode(node(id, 'action', action.label, action.at, effectDetails(action.effects)), minute);
    definitions.push({ nodeId: id, minute, writes: collectWrittenPaths(action.effects), reads: [] });
  });

  story.schedules.forEach((schedule) => {
    const ordered = schedule.entries
      .map((entry, index) => ({ entry, index, minute: toAbsoluteMinute(entry.at) }))
      .sort((a, b) => a.minute - b.minute || a.index - b.index);

    ordered.forEach(({ entry, minute }) => {
      const id = `schedule:${entry.id}`;
      addNode(node(id, 'schedule', entry.id, entry.at, [schedule.characterId, ...conditionDetails(entry.when), ...effectDetails(entry.effects)]), minute);
      definitions.push({
        nodeId: id,
        minute,
        writes: collectWrittenPaths(entry.effects),
        reads: collectConditionPaths(entry.when),
      });
    });

    for (let index = 1; index < ordered.length; index += 1) {
      addEdge(
        `schedule:${ordered[index - 1].entry.id}`,
        `schedule:${ordered[index].entry.id}`,
        'schedule',
        'schedule',
      );
    }
  });

  story.definition.events.forEach((event) => {
    if (!event.at) return;
    const eventId = `event:${event.id}`;
    const minute = toAbsoluteMinute(event.at);
    addNode(node(eventId, 'event', event.title, event.at, eventReadPaths(event).map((path) => `reads ${path}`)), minute);
    definitions.push({ nodeId: eventId, minute, writes: [], reads: eventReadPaths(event) });

    event.variants.forEach((variant) => {
      const variantId = `variant:${event.id}:${variant.id}`;
      addNode(node(
        variantId,
        'variant',
        variant.id,
        event.at!,
        [...conditionDetails(variant.when), ...effectDetails(variant.effects)],
        event.id,
      ), minute);
      addEdge(eventId, variantId, undefined, 'structural');
      definitions.push({
        nodeId: variantId,
        minute,
        writes: collectWrittenPaths(variant.effects),
        reads: [],
      });

      for (const emittedId of emittedEventIds(variant)) {
        if (story.definition.events.some((candidate) => candidate.id === emittedId)) {
          addEdge(variantId, `event:${emittedId}`, 'emit', 'structural');
        }
      }

      for (const delayed of variant.delayed_effects ?? []) {
        const delayedId = `delayed:${event.id}:${variant.id}:${delayed.id}`;
        const delayedMinute = minute + delayed.delay_minutes;
        addNode({
          id: delayedId,
          role: 'delayed',
          title: delayed.id,
          subtitle: `+${delayed.delay_minutes}m`,
          details: effectDetails(delayed.effects),
          parentEventId: event.id,
        }, delayedMinute);
        addEdge(variantId, delayedId, `+${delayed.delay_minutes}m`, 'structural');
        for (const effect of delayed.effects) {
          if ('emit_event' in effect) addEdge(delayedId, `event:${effect.emit_event.event_id}`, 'emit', 'structural');
        }
      }
    });
  });

  for (const writer of definitions) {
    if (writer.writes.length === 0) continue;
    for (const reader of definitions) {
      if (reader.reads.length === 0 || writer.minute > reader.minute || writer.nodeId === reader.nodeId) continue;
      for (const path of writer.writes.filter((candidate) => reader.reads.includes(candidate))) {
        addEdge(writer.nodeId, reader.nodeId, path, 'causal');
      }
    }
  }

  const roleOrder: Record<GraphNode['role'], number> = { action: 0, schedule: 1, event: 2, variant: 3, delayed: 4 };
  nodes.sort((a, b) =>
    (nodeMinutes.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (nodeMinutes.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    || roleOrder[a.role] - roleOrder[b.role]
    || a.id.localeCompare(b.id));

  edges.sort((a, b) =>
    (nodeMinutes.get(a.source) ?? Number.MAX_SAFE_INTEGER) - (nodeMinutes.get(b.source) ?? Number.MAX_SAFE_INTEGER)
    || (nodeMinutes.get(a.target) ?? Number.MAX_SAFE_INTEGER) - (nodeMinutes.get(b.target) ?? Number.MAX_SAFE_INTEGER)
    || a.id.localeCompare(b.id));

  return { nodes, edges };
}
