import type { StoryTimeInput } from '../simulator/types';

export type NarrativeVisibility = 'public' | 'author' | 'player-known';

export type CharacterDefinition = {
  id: string;
  name: string;
  age?: number;
  identity: {
    occupation?: string;
    hometown?: string;
  };
  background: {
    summary: string;
    history: string[];
  };
  personality: {
    traits: string[];
    habits: string[];
    dislikes: string[];
  };
  speech: {
    tone: string;
    calls: Record<string, string>;
  };
  knowledge: {
    initial: string[];
    hidden: string[];
  };
  secrets: string[];
  scheduleRef?: string;
};

export type RelationshipDefinition = {
  from: string;
  to: string;
  type: string;
  visibility: NarrativeVisibility;
  summary: string;
};

export type KnowledgeFact = {
  id: string;
  summary: string;
  characterId?: string;
};

export type CharacterInsightDefinition = {
  id: string;
  characterId: string;
  title: string;
  presentation: string;
  retainedBy: string;
  sourceLoop?: string;
  requiresFacts?: string[];
  learnedFrom?: string;
  resetRule?: string;
  clueUse?: string;
};

export type CharacterQuestionDefinition = {
  id: string;
  characterId: string;
  text: string;
  requiresFacts?: string[];
  resolvedByInsightId?: string;
};

export type AmbientBeatDefinition = {
  id: string;
  atMinute: number;
  text: string;
  requiresFacts?: string[];
};

export type ActivityPresentation = {
  start: string | string[];
  idle: string;
  complete: string | string[];
  eta?: 'exact' | 'approximate' | 'hidden';
};

export type ActivityDefinition = {
  id: string;
  durationMinutes: number;
  interruptible: boolean;
  presentation: ActivityPresentation;
  ambient?: AmbientBeatDefinition[];
};

export type ProtagonistScheduleEntry = {
  id: string;
  at: StoryTimeInput;
  activityId: string;
};

export type ProtagonistScheduleDefinition = {
  characterId: 'protagonist';
  entries: ProtagonistScheduleEntry[];
};

export type ObservationChannel = 'present' | 'phone' | 'artifact' | 'deferred';
export type ObservationPersistence = 'ephemeral' | 'message' | 'missed-call' | 'artifact';

export type NarrativeObservationRule = {
  channel: Exclude<ObservationChannel, 'deferred'>;
  location?: string;
  offlineMode?: 'deferred' | 'missed';
  persistence?: ObservationPersistence;
};

export type NarrativeSpatialAnchor =
  | 'upper-left'
  | 'upper-right'
  | 'left'
  | 'center'
  | 'right'
  | 'lower-left'
  | 'lower-right';

/**
 * Optional author control for M4 presentation.
 *
 * `beats` are semantic speech/narration chunks. The runtime reveals a whole
 * beat at once; it never treats this as a per-character typewriter speed.
 */
export type NarrativeTextPresentation = {
  anchor?: NarrativeSpatialAnchor;
  beats?: string[];
  beatMs?: number;
  pauseAfterMs?: number;
  echoMs?: number;
};

export type NarrativeTextBlock = {
  type: 'narration' | 'monologue';
  text: string;
  factId?: string;
  presentation?: NarrativeTextPresentation;
};

export type NarrativeDialogueBlock = {
  type: 'dialogue';
  speaker: string;
  text: string;
  factId?: string;
  presentation?: NarrativeTextPresentation;
};

export type NarrativeArtifactBlock = {
  type: 'artifact';
  artifactId: string;
};

export type NarrativeBlock = NarrativeTextBlock | NarrativeDialogueBlock | NarrativeArtifactBlock;

export type NarrativeSceneKind = 'narration' | 'dialogue' | 'artifact' | 'activity' | 'transition';

export type NarrativeSceneDefinition = {
  id: string;
  at: StoryTimeInput;
  availableUntil?: StoryTimeInput;
  kind: NarrativeSceneKind;
  participants: string[];
  blocks: NarrativeBlock[];
  observation?: NarrativeObservationRule;
  startsActivity?: string;
  artifactId?: string;
  requiresFacts?: string[];
  requiresLocation?: string;
  afterActivityId?: string;
  sourceEventId?: string;
  sourceVariantId?: string;
};

export type ArtifactDefinition = {
  id: string;
  kind: 'letter' | 'message' | 'photo' | 'document' | 'news';
  author?: string;
  formedAt: StoryTimeInput;
  content: string[];
  presentation?: {
    title?: string;
    format?: string;
  };
};

export type PlayerChoiceEffect =
  | { type: 'start-activity'; activityId: string }
  | { type: 'submit-action'; actionId: string }
  | { type: 'travel'; to: string }
  | { type: 'learn-fact'; factId: string }
  | { type: 'learn-insight'; insightId: string };

export type PlayerChoiceDefinition = {
  id: string;
  sceneId: string;
  label: string;
  availableFrom?: number;
  availableUntil?: number;
  requiresFacts?: string[];
  effects: PlayerChoiceEffect[];
};

export type TravelEdgeDefinition = {
  from: string;
  to: string;
  minutes: number;
};

export type NarrativeFoundation = {
  characters: CharacterDefinition[];
  relationships: RelationshipDefinition[];
  knowledgeFacts: KnowledgeFact[];
  activities: ActivityDefinition[];
  protagonistSchedule: ProtagonistScheduleDefinition;
  scenes: NarrativeSceneDefinition[];
  artifacts: ArtifactDefinition[];
  characterInsights?: CharacterInsightDefinition[];
  characterQuestions?: CharacterQuestionDefinition[];
};

export function emptyNarrativeFoundation(): NarrativeFoundation {
  return {
    characters: [],
    relationships: [],
    knowledgeFacts: [],
    activities: [],
    protagonistSchedule: { characterId: 'protagonist', entries: [] },
    scenes: [],
    artifacts: [],
    characterInsights: [],
    characterQuestions: [],
  };
}
