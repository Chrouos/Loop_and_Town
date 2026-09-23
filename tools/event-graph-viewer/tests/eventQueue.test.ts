import { describe, expect, it } from 'vitest';
import { SimulationQueue } from '../src/simulator/eventQueue';

describe('SimulationQueue', () => {
  it('orders by executeAt and preserves insertion order for ties', () => {
    const queue = new SimulationQueue();
    queue.enqueue({ kind: 'scheduled-event', executeAt: 1111, eventId: 'a' });
    queue.enqueue({ kind: 'delayed-effect', executeAt: 1111, delayedEffectId: 'b', effects: [] });
    queue.enqueue({ kind: 'scheduled-event', executeAt: 1100, eventId: 'early' });

    expect(queue.dequeue()?.eventId).toBe('early');
    expect(queue.dequeue()?.eventId).toBe('a');
    expect(queue.dequeue()?.delayedEffectId).toBe('b');
  });

  it('returns a snapshot from peekAll', () => {
    const queue = new SimulationQueue();
    queue.enqueue({ kind: 'scheduled-event', executeAt: 1111, eventId: 'a' });
    const snapshot = queue.peekAll();
    snapshot.length = 0;
    expect(queue.peekAll()).toHaveLength(1);
  });
});
