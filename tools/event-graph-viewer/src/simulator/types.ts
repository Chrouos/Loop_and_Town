export type WorldState = Record<string, unknown>;

export type StoryTime = {
  day: number;
  time: string;
};

export type StoryTimeInput = string | StoryTime;

export type LoopDefinition = {
  id: string;
  range: {
    start: StoryTimeInput;
    end: StoryTimeInput;
  };
};

export type Visibility = 'observable' | 'hidden' | 'debug';

export type LeafCondition = {
  path: string;
  op: 'eq' | 'neq' | 'exists' | 'not_exists';
  value?: unknown;
};

export type Condition =
  | LeafCondition
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export type SetEffect = { set: { path: string; value: unknown } };
export type AddFlagEffect = { add_flag: string };
export type EmitEventEffect = { emit_event: { event_id: string; at?: StoryTimeInput } };
export type Effect = SetEffect | AddFlagEffect | EmitEventEffect;

export type DelayedEffectDefinition = {
  id: string;
  delay_minutes: number;
  effects: Effect[];
};

export type EventVariantDefinition = {
  id: string;
  priority: number;
  visibility?: Visibility;
  when?: Condition;
  fallback?: boolean;
  effects: Effect[];
  delayed_effects?: DelayedEffectDefinition[];
};

export type EventDefinition = {
  id: string;
  title: string;
  at?: StoryTimeInput;
  visibility?: Visibility;
  variants: EventVariantDefinition[];
};

export type ActionDefinition = {
  id: string;
  at: StoryTimeInput;
  label: string;
  visibility?: Visibility;
  effects: Effect[];
};

export type ScheduleEntryDefinition = {
  id: string;
  at: StoryTimeInput;
  visibility?: Visibility;
  when?: Condition;
  effects: Effect[];
};

export type ScheduleDefinition = {
  characterId: string;
  entries: ScheduleEntryDefinition[];
};

export type SimulationDefinition = {
  loop?: LoopDefinition;
  actions: ActionDefinition[];
  events: EventDefinition[];
  schedules?: ScheduleDefinition[];
};

export type QueueItemBase = {
  kind: 'schedule' | 'scheduled-event' | 'emitted-event' | 'delayed-effect';
  executeAt: number;
  insertionOrder?: number;
};

export type ScheduleQueueItem = QueueItemBase & {
  kind: 'schedule';
  characterId: string;
  entry: ScheduleEntryDefinition;
};

export type EventQueueItem = QueueItemBase & {
  kind: 'scheduled-event' | 'emitted-event';
  eventId: string;
};

export type DelayedQueueItem = QueueItemBase & {
  kind: 'delayed-effect';
  delayedEffectId: string;
  sourceEventId?: string;
  sourceVariantId?: string;
  effects: Effect[];
};

export type QueueItem = ScheduleQueueItem | EventQueueItem | DelayedQueueItem;
export type QueueItemInput =
  | Omit<ScheduleQueueItem, 'insertionOrder'>
  | Omit<EventQueueItem, 'insertionOrder'>
  | Omit<DelayedQueueItem, 'insertionOrder'>;

export type StateChange = {
  path: string;
  before: unknown;
  after: unknown;
};

export type WorldlineHistoryEntry = {
  sequence: number;
  day?: number;
  time: string;
  absoluteMinute?: number;
  minute: number;
  visibility?: Visibility;
  kind: 'schedule' | 'player-action' | 'event' | 'effect' | 'delayed-effect';
  eventId?: string;
  variantId?: string;
  actionId?: string;
  scheduleEntryId?: string;
  scheduleStatus?: 'applied' | 'skipped';
  characterId?: string;
  title: string;
  sourceId?: string;
  changes?: StateChange[];
};

export type ResolverContext = {
  state: WorldState;
  queue: {
    enqueue(item: QueueItemInput): QueueItem;
  };
  events: Map<string, EventDefinition>;
  currentMinute: number;
};

export type ResolvedEvent = {
  eventId: string;
  variantId: string;
  title: string;
  changes: StateChange[];
};

export type SimulationResult = {
  state: WorldState;
  history: WorldlineHistoryEntry[];
};
