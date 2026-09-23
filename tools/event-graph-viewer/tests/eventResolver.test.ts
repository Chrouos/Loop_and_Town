import { describe, expect, it } from 'vitest';
import { SimulationQueue } from '../src/simulator/eventQueue';
import { resolveEvent } from '../src/simulator/eventResolver';
import type { EventDefinition, WorldState } from '../src/simulator/types';

function context(state: WorldState, events: EventDefinition[]) {
  return { state, queue: new SimulationQueue(), events: new Map(events.map((event) => [event.id, event])), currentMinute: 1111 };
}

describe('resolveEvent', () => {
  it('chooses the highest-priority matching variant and applies effects', () => {
    const state: WorldState = { flags: { x: false } };
    const event: EventDefinition = {
      id: 'evt', title: 'Event', at: '18:31', variants: [
        { id: 'low', priority: 1, when: { path: 'flags.x', op: 'eq', value: false }, effects: [{ set: { path: 'flags.x', value: 'low' } }] },
        { id: 'high', priority: 10, when: { path: 'flags.x', op: 'eq', value: false }, effects: [{ set: { path: 'flags.x', value: 'high' } }] },
      ],
    };
    const result = resolveEvent(context(state, [event]), event);
    expect(result.variantId).toBe('high');
    expect((state.flags as Record<string, unknown>).x).toBe('high');
  });

  it('uses explicit fallback only when conditional variants do not match', () => {
    const state: WorldState = { flags: { x: false } };
    const event: EventDefinition = {
      id: 'evt', title: 'Event', variants: [
        { id: 'conditional', priority: 10, when: { path: 'flags.x', op: 'eq', value: true }, effects: [] },
        { id: 'fallback', priority: 0, fallback: true, effects: [] },
      ],
    };
    expect(resolveEvent(context(state, [event]), event).variantId).toBe('fallback');
  });

  it('throws when matching variants share a priority', () => {
    const state: WorldState = { flags: { x: false } };
    const event: EventDefinition = {
      id: 'evt', title: 'Event', variants: [
        { id: 'a', priority: 10, when: { path: 'flags.x', op: 'eq', value: false }, effects: [] },
        { id: 'b', priority: 10, when: { path: 'flags.x', op: 'eq', value: false }, effects: [] },
      ],
    };
    expect(() => resolveEvent(context(state, [event]), event)).toThrow('Ambiguous variants in evt at priority 10');
  });
});
