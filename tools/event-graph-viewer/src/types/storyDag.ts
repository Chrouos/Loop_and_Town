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
