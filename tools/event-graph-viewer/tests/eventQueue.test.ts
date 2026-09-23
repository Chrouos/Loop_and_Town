import { describe, expect, it } from 'vitest';
import { SimulationQueue } from '../src/simulator/eventQueue';

describe('SimulationQueue', () => {
  it('orders by executeAt and preserves insertion order for ties', () => {
    const queue = new SimulationQueue();
    queue.enqueue({ kind: 'scheduled-event', executeAt: 1111, eventId: 'a' });
    queue.enqueue({ kind: 'delayed-effect', executeAt: 1111, delayedEffectId: 'b', effects: [] });
    queue.enqueue({ kind: 'scheduled-event', executeAt: 1100, eventId: 'early' });

    const first = queue.dequeue();
    const second = queue.dequeue();
    const third = queue.dequeue();

    expect(first?.kind).toBe('scheduled-event');
    expect(first && 'eventId' in first ? first.eventId : undefined).toBe('early');
    expect(second && 'eventId' in second ? second.eventId : undefined).toBe('a');
    expect(third?.kind).toBe('delayed-effect');
    expect(third && 'delayedEffectId' in third ? third.delayedEffectId : undefined).toBe('b');
  });

  it('returns a snapshot from peekAll', () => {
    const queue = new SimulationQueue();
    queue.enqueue({ kind: 'scheduled-event', executeAt: 1111, eventId: 'a' });
    const snapshot = queue.peekAll();
    snapshot.length = 0;
    expect(queue.peekAll()).toHaveLength(1);
  });
});
