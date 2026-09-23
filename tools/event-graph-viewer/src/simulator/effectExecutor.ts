import { setPath } from './state';
import { toAbsoluteMinute } from './time';
import type { Effect, ResolverContext, StateChange } from './types';

export function executeEffects(context: ResolverContext, effects: Effect[]): StateChange[] {
  const changes: StateChange[] = [];

  for (const effect of effects) {
    if ('set' in effect) {
      changes.push(setPath(context.state, effect.set.path, effect.set.value));
      continue;
    }

    if ('add_flag' in effect) {
      changes.push(setPath(context.state, effect.add_flag, true));
      continue;
    }

    if ('emit_event' in effect) {
      const eventId = effect.emit_event.event_id;
      if (!context.events.has(eventId)) throw new Error(`Unknown emitted event: ${eventId}`);
      context.queue.enqueue({
        kind: 'emitted-event',
        executeAt: effect.emit_event.at ? toAbsoluteMinute(effect.emit_event.at) : context.currentMinute,
        eventId,
      });
      continue;
    }

    const unreachable: never = effect;
    throw new Error(`Unknown effect operation: ${JSON.stringify(unreachable)}`);
  }

  return changes;
}
