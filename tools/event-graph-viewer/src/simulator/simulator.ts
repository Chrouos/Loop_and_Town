import { executeEffects } from './effectExecutor';
import { SimulationQueue } from './eventQueue';
import { resolveEvent } from './eventResolver';
import { resolveScheduleEntry } from './schedule';
import { cloneValue } from './state';
import { fromAbsoluteMinute, parseTime, toAbsoluteMinute } from './time';
import type {
  ActionDefinition,
  EventDefinition,
  SimulationDefinition,
  SimulationResult,
  StoryTimeInput,
  Visibility,
  WorldState,
  WorldlineHistoryEntry,
} from './types';
import { validateDefinition } from './validation';

const MAX_PROCESSED_ITEMS = 1000;

export type Simulation = {
  applyAction(action: ActionDefinition | string): void;
  runUntil(time: StoryTimeInput): void;
  getState(): WorldState;
  getHistory(): WorldlineHistoryEntry[];
  getPendingEvents(): ReturnType<SimulationQueue['peekAll']>;
};

function initialMinute(definition: SimulationDefinition, state: WorldState): number {
  const clock = state.clock;
  if (!clock || typeof clock !== 'object' || !('time' in clock)) return 0;
  const record = clock as Record<string, unknown>;
  if (!definition.loop) return parseTime(String(record.time));
  return toAbsoluteMinute({
    day: typeof record.day === 'number' ? record.day : 0,
    time: String(record.time),
  });
}

function displayMinute(value: number): string {
  const storyTime = fromAbsoluteMinute(value);
  return storyTime.day === 0 ? storyTime.time : `D${storyTime.day} ${storyTime.time}`;
}

export function createSimulation(definition: SimulationDefinition, initialState: WorldState): Simulation {
  validateDefinition(definition, initialState);

  const state = cloneValue(initialState);
  const queue = new SimulationQueue();
  const events = new Map<string, EventDefinition>(definition.events.map((event) => [event.id, event]));
  const actions = new Map<string, ActionDefinition>(definition.actions.map((action) => [action.id, action]));
  const history: WorldlineHistoryEntry[] = [];
  let currentMinute = initialMinute(definition, state);
  let sequence = 0;

  for (const schedule of definition.schedules ?? []) {
    for (const entry of schedule.entries) {
      queue.enqueue({
        kind: 'schedule',
        executeAt: toAbsoluteMinute(entry.at),
        characterId: schedule.characterId,
        entry,
      });
    }
  }

  for (const event of definition.events) {
    if (event.at) queue.enqueue({ kind: 'scheduled-event', executeAt: toAbsoluteMinute(event.at), eventId: event.id });
  }

  function record(
    entry: Omit<WorldlineHistoryEntry, 'sequence' | 'day' | 'time' | 'absoluteMinute' | 'minute' | 'visibility'> & {
      minute?: number;
      visibility?: Visibility;
    },
  ): void {
    const minute = entry.minute ?? currentMinute;
    const point = fromAbsoluteMinute(minute);
    history.push({
      ...entry,
      sequence: sequence++,
      day: point.day,
      time: point.time,
      absoluteMinute: minute,
      minute,
      visibility: entry.visibility ?? 'debug',
    });
  }

  function applyAction(actionOrId: ActionDefinition | string): void {
    const action = typeof actionOrId === 'string' ? actions.get(actionOrId) : actionOrId;
    if (!action) throw new Error(`Unknown action: ${String(actionOrId)}`);
    const actionMinute = toAbsoluteMinute(action.at);
    if (actionMinute < currentMinute) {
      throw new Error(`Cannot apply action backwards: ${displayMinute(currentMinute)} -> ${displayMinute(actionMinute)}`);
    }
    const next = queue.peek();
    if (next && next.executeAt < actionMinute) {
      throw new Error(`Action ${action.id} occurs after pending event at ${displayMinute(next.executeAt)}`);
    }
    currentMinute = actionMinute;
    const changes = executeEffects({ state, queue, events, currentMinute }, action.effects);
    record({
      kind: 'player-action',
      actionId: action.id,
      title: action.label,
      changes,
      visibility: action.visibility ?? 'observable',
    });
  }

  function runUntil(time: StoryTimeInput): void {
    const target = toAbsoluteMinute(time);
    if (target < currentMinute) {
      throw new Error(`Cannot run simulation backwards: ${displayMinute(currentMinute)} -> ${displayMinute(target)}`);
    }

    let processed = 0;
    while (queue.peek() && queue.peek()!.executeAt <= target) {
      processed += 1;
      if (processed > MAX_PROCESSED_ITEMS) throw new Error(`Processed event limit exceeded: ${MAX_PROCESSED_ITEMS}`);

      const item = queue.dequeue()!;
      currentMinute = item.executeAt;

      if (item.kind === 'schedule') {
        const resolved = resolveScheduleEntry({ state, queue, events, currentMinute }, item.entry);
        record({
          kind: 'schedule',
          title: item.entry.id,
          scheduleEntryId: item.entry.id,
          scheduleStatus: resolved.status,
          characterId: item.characterId,
          changes: resolved.changes,
          visibility: item.entry.visibility ?? 'hidden',
        });
        continue;
      }

      if (item.kind === 'delayed-effect') {
        const changes = executeEffects({ state, queue, events, currentMinute }, item.effects);
        record({
          kind: 'delayed-effect',
          title: item.delayedEffectId,
          sourceId: item.sourceEventId,
          eventId: item.sourceEventId,
          variantId: item.sourceVariantId,
          changes,
          visibility: 'hidden',
        });
        continue;
      }

      const event = events.get(item.eventId);
      if (!event) throw new Error(`Unknown emitted event: ${item.eventId}`);
      const resolved = resolveEvent({ state, queue, events, currentMinute }, event);
      const resolvedVariant = event.variants.find((variant) => variant.id === resolved.variantId);
      const visibility = resolvedVariant?.visibility ?? event.visibility ?? 'observable';
      record({
        kind: 'event',
        eventId: resolved.eventId,
        variantId: resolved.variantId,
        title: resolved.title,
        changes: resolved.changes,
        visibility,
      });
      if (resolved.changes.length) {
        record({
          kind: 'effect',
          eventId: resolved.eventId,
          variantId: resolved.variantId,
          title: `${resolved.title} effects`,
          changes: resolved.changes,
          visibility: 'debug',
        });
      }
    }

    currentMinute = target;
    const clock = state.clock;
    if (clock && typeof clock === 'object' && 'time' in clock) {
      const point = fromAbsoluteMinute(target);
      (clock as Record<string, unknown>).time = point.time;
      if (definition.loop) (clock as Record<string, unknown>).day = point.day;
    }
  }

  return {
    applyAction,
    runUntil,
    getState: () => cloneValue(state),
    getHistory: () => cloneValue(history),
    getPendingEvents: () => queue.peekAll(),
  };
}

export function simulate(input: {
  definition: SimulationDefinition;
  initialState: WorldState;
  actions: Array<ActionDefinition | string>;
  until: StoryTimeInput;
}): SimulationResult {
  const simulation = createSimulation(input.definition, input.initialState);
  for (const action of input.actions) simulation.applyAction(action);
  simulation.runUntil(input.until);
  return { state: simulation.getState(), history: simulation.getHistory() };
}
