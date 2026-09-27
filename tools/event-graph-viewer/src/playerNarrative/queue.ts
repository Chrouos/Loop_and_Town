export type PlayerNarrativeQueueKind =
  | 'urgent-interrupt'
  | 'phone'
  | 'activity-complete'
  | 'scene'
  | 'ambient';

export type PlayerNarrativeQueueItem = {
  id: string;
  kind: PlayerNarrativeQueueKind;
  minute: number;
  insertionOrder: number;
};

const PRIORITY: Record<PlayerNarrativeQueueKind, number> = {
  'urgent-interrupt': 0,
  phone: 1,
  'activity-complete': 2,
  scene: 3,
  ambient: 4,
};

export function orderNarrativeQueue<T extends PlayerNarrativeQueueItem>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    PRIORITY[a.kind] - PRIORITY[b.kind]
    || a.minute - b.minute
    || a.insertionOrder - b.insertionOrder,
  );
}
