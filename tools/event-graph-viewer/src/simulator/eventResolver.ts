import { evaluateCondition } from './conditionEvaluator';
import { executeEffects } from './effectExecutor';
import type { EventDefinition, ResolvedEvent, ResolverContext } from './types';

export function resolveEvent(context: ResolverContext, event: EventDefinition): ResolvedEvent {
  const conditional = event.variants.filter((variant) => !variant.fallback && variant.when);
  const matching = conditional.filter((variant) => evaluateCondition(variant.when!, context.state));

  let selected = matching.sort((a, b) => b.priority - a.priority)[0];
  if (selected) {
    const samePriority = matching.filter((variant) => variant.priority === selected!.priority);
    if (samePriority.length > 1) {
      throw new Error(`Ambiguous variants in ${event.id} at priority ${selected.priority}`);
    }
  } else {
    selected = event.variants.find((variant) => variant.fallback);
  }

  if (!selected) throw new Error(`No matching variant for ${event.id}`);

  const changes = executeEffects(context, selected.effects);

  for (const delayed of selected.delayed_effects ?? []) {
    context.queue.enqueue({
      kind: 'delayed-effect',
      executeAt: context.currentMinute + delayed.delay_minutes,
      delayedEffectId: delayed.id,
      sourceEventId: event.id,
      sourceVariantId: selected.id,
      effects: delayed.effects,
    });
  }

  return {
    eventId: event.id,
    variantId: selected.id,
    title: event.title,
    changes,
  };
}
