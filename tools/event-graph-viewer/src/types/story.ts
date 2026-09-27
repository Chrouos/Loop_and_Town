export type StoryEffect = {
  kind: 'set' | 'add_flag' | 'emit_event' | 'unknown';
  target?: string;
  value?: unknown;
  eventId?: string;
  description: string;
};

export type DelayedEffect = {
  id: string;
  delayMinutes?: number;
  executeAt?: string;
  conditions: string[];
  effects: StoryEffect[];
};

export type EventVariant = {
  id: string;
  priority: number;
  conditions: string[];
  effects: StoryEffect[];
  delayedEffects: DelayedEffect[];
};

export type EventGraphDocument = {
  id: string;
  title: string;
  time: string;
  location?: string;
  conditions: string[];
  variants: EventVariant[];
  notes: string[];
};

export type GraphNodeRole = 'action' | 'schedule' | 'event' | 'variant' | 'delayed';

export type GraphNode = {
  id: string;
  role: GraphNodeRole;
  parentEventId?: string;
  title: string;
  subtitle?: string;
  details: string[];
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type GraphProjection = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type StoryVisibility = 'public' | 'author' | 'player-known';

export type StoryDagNodeDetail = {
  before: string[];
  after: string[];
  reason?: string;
  affectedCharacters: string[];
  delayedEffects: string[];
  knowledgeChanges: string[];
  relationshipChanges: string[];
  narrativeRefs: string[];
};

export type StoryDagNode = {
  id: string;
  title: string;
  time?: string;
  actorIds: string[];
  visibility: StoryVisibility;
  detail: StoryDagNodeDetail;
};

export type StoryDagEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  visibility: StoryVisibility;
};

export type StoryDagDocument = {
  id: string;
  title: string;
  nodes: StoryDagNode[];
  edges: StoryDagEdge[];
};

export type StoryWorldlinePath = {
  id: string;
  label: string;
  nodeIds: string[];
  edgeIds: string[];
  visibility: StoryVisibility;
};

export type WorldlineEntry = {
  day?: number;
  time: string;
  absoluteMinute?: number;
  durationMinutes?: number;
  endTime?: string;
  eventId: string;
  variantId?: string;
  title: string;
  source: 'event' | 'delayed' | 'player';
  hasImmediateStateChange?: boolean;
};

export type DiffRow = {
  key: string;
  time: string;
  left?: WorldlineEntry;
  right?: WorldlineEntry;
  status: 'same' | 'changed' | 'left-only' | 'right-only';
};

export type CharacterGraphMode = 'public' | 'author' | 'player-known';

export type CharacterGraphNode = {
  id: string;
  name: string;
  occupation?: string;
  hometown?: string;
};

export type CharacterGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  summary: string;
  visibility: 'public' | 'author' | 'player-known';
};

export type CharacterGraphDetail = {
  characterId: string;
  name: string;
  backgroundSummary: string;
  traits: string[];
  relationshipEdgeIds: string[];
  knowledgeIds: string[];
  secrets: string[];
  scheduleRef?: string;
  narrativeAppearanceIds: string[];
};

export type CharacterGraphProjection = {
  mode: CharacterGraphMode;
  nodes: CharacterGraphNode[];
  edges: CharacterGraphEdge[];
  details: Record<string, CharacterGraphDetail>;
};
