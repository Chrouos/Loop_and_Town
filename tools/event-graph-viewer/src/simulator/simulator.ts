import { executeEffects } from './effectExecutor';
import { SimulationQueue } from './eventQueue';
import { resolveEvent } from './eventResolver';
import { cloneValue } from './state';
import { formatTime, parseTime } from './time';
import type {
  ActionDefinition,
  EventDefinition,
  SimulationDefinition,
  SimulationResult,
  WorldState,
  WorldlineHistoryEntry,
} from './types';
import { validateDefinition } from './validation';

const MAX_PROCESSED_ITEMS = 1000;

export type Simulation = {
  applyAction(action: ActionDefinition | string): void;
  runUntil(time: string): void;
  getState(): WorldState;
  getHistory(): WorldlineHistoryEntry[];
  getPendingEvents(): ReturnType<SimulationQueue['peekAll']>;
};

function initialMinute(state: WorldState): number {
  const clock = state.clock;
  if (!clock || typeof clock !== 'object' || !('time' in clock)) return 0;
  return parseTime(String((clock as Record<string, unknown>).time));
}

export function createSimulation(definition: SimulationDefinition, initialState: WorldState): Simulation {
  validateDefinition(definition, initialState);

  const state = cloneValue(initialState);
  const queue = new SimulationQueue();
  const events = new Map<string, EventDefinition>(definition.events.map((event) => [event.id, event]));
  const actions = new Map<string, ActionDefinition>(definition.actions.map((action) => [action.id, action]));
  const history: WorldlineHistoryEntry[] = [];
  let currentMinute = initialMinute(state);
  let sequence = 0;

  for (const event of definition.events) {
    if (event.at) queue.enqueue({ kind: 'scheduled-event', executeAt: parseTime(event.at), eventId: event.id });
  }

  function record(entry: Omit<WorldlineHistoryEntry, 'sequence' | 'time' | 'minute'> & { minute?: number }): void {
    const minute = entry.minute ?? currentMinute;
    history.push({ ...entry, sequence: sequence++, minute, time: formatTime(minute) });
  }

  function applyAction(actionOrId: ActionDefinition | string): void {
    const action = typeof actionOrId === 'string' ? actions.get(actionOrId) : actionOrId;
    if (!action) throw new Error(`Unknown action: ${String(actionOrId)}`);
    const actionMinute = parseTime(action.at);
    if (actionMinute < currentMinute) {
      throw new Error(`Cannot apply action backwards: ${formatTime(currentMinute)} -> ${action.at}`);
    }
    const next = queue.peek();
    if (next && next.executeAt < actionMinute) {
      throw new Error(`Action ${action.id} occurs after pending event at ${formatTime(next.executeAt)}`);
    }
    currentMinute = actionMinute;
    const changes = executeEffects({ state, queue, events, currentMinute }, action.effects);
    record({ kind: 'player-action', actionId: action.id, title: action.label, changes });
  }

  function runUntil(time: string): void {
    const target = parseTime(time);
    if (target < currentMinute) {
      throw new Error(`Cannot run simulation backwards: ${formatTime(currentMinute)} -> ${time}`);
    }

    let processed = 0;
    while (queue.peek() && queue.peek()!.executeAt <= target) {
      processed += 1;
      if (processed > MAX_PROCESSED_ITEMS) throw new Error(`Processed event limit exceeded: ${MAX_PROCESSED_ITEMS}`);

      const item = queue.dequeue()!;
      currentMinute = item.executeAt;

      if (item.kind === 'delayed-effect') {
        const changes = executeEffects({ state, queue, events, currentMinute }, item.effects);
        record({
          kind: 'delayed-effect',
          title: item.delayedEffectId,
          sourceId: item.sourceEventId,
          eventId: item.sourceEventId,
          variantId: item.sourceVariantId,
          changes,
        });
        continue;
      }

      const event = events.get(item.eventId);
      if (!event) throw new Error(`Unknown emitted event: ${item.eventId}`);
      const resolved = resolveEvent({ state, queue, events, currentMinute }, event);
      record({
        kind: 'event',
        eventId: resolved.eventId,
        variantId: resolved.variantId,
        title: resolved.title,
        changes: resolved.changes,
      });
      if (resolved.changes.length) {
        record({
          kind: 'effect',
          eventId: resolved.eventId,
          variantId: resolved.variantId,
          title: `${resolved.title} effects`,
          changes: resolved.changes,
        });
      }
    }

    currentMinute = target;
    const clock = state.clock;
    if (clock && typeof clock === 'object' && 'time' in clock) {
      (clock as Record<string, unknown>).time = formatTime(target);
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
  until: string;
}): SimulationResult {
  const simulation = createSimulation(input.definition, input.initialState);
  for (const action of input.actions) simulation.applyAction(action);
  simulation.runUntil(input.until);
  return { state: simulation.getState(), history: simulation.getHistory() };
}
