import { setPath } from './state';
import { executeCorrectionCommand } from './correctionSession';
import { toAbsoluteMinute } from './time';
import type { Effect, ResolverContext, StateChange } from './types';

export function executeEffects(context: ResolverContext, effects: Effect[]): StateChange[] {
  const changes: StateChange[] = [];

  for (const effect of effects) {
    if ('correction' in effect) {
      changes.push(executeCorrectionCommand(context.state, effect.correction));
      continue;
    }
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
      const executeAt = effect.emit_event.at ? toAbsoluteMinute(effect.emit_event.at) : context.currentMinute;
      if (executeAt < context.currentMinute) {
        throw new Error(`Cannot emit event into the past: ${eventId}`);
      }
      context.queue.enqueue({ kind: 'emitted-event', executeAt, eventId });
      continue;
    }

    const unreachable: never = effect;
    throw new Error(`Unknown effect operation: ${JSON.stringify(unreachable)}`);
  }

  return changes;
}
