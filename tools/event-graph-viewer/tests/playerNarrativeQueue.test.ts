import { describe, expect, it } from 'vitest';
import { orderNarrativeQueue, type PlayerNarrativeQueueItem } from '../src/playerNarrative/queue';

const items: PlayerNarrativeQueueItem[] = [
  { id: 'ambient', kind: 'ambient', minute: 100, insertionOrder: 4 },
  { id: 'scene', kind: 'scene', minute: 100, insertionOrder: 3 },
  { id: 'complete', kind: 'activity-complete', minute: 100, insertionOrder: 2 },
  { id: 'phone', kind: 'phone', minute: 100, insertionOrder: 1 },
  { id: 'interrupt', kind: 'urgent-interrupt', minute: 100, insertionOrder: 0 },
];

describe('narrative queue', () => {
  it('uses explicit priority', () => {
    expect(orderNarrativeQueue(items).map((x) => x.id)).toEqual(['interrupt', 'phone', 'complete', 'scene', 'ambient']);
  });
});
