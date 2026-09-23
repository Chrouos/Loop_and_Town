import { cloneValue } from './state';
import type { QueueItem, QueueItemInput } from './types';

export class SimulationQueue {
  private items: QueueItem[] = [];
  private nextInsertionOrder = 0;

  enqueue(item: QueueItemInput): QueueItem {
    const queued = { ...cloneValue(item), insertionOrder: this.nextInsertionOrder++ } as QueueItem;
    this.items.push(queued);
    this.items.sort((a, b) => a.executeAt - b.executeAt || (a.insertionOrder ?? 0) - (b.insertionOrder ?? 0));
    return cloneValue(queued);
  }

  dequeue(): QueueItem | undefined {
    const item = this.items.shift();
    return item ? cloneValue(item) : undefined;
  }

  peek(): QueueItem | undefined {
    return this.items[0] ? cloneValue(this.items[0]) : undefined;
  }

  peekAll(): QueueItem[] {
    return cloneValue(this.items);
  }
}
