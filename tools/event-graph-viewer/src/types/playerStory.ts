import type { NarrativeSceneDefinition, ArtifactDefinition } from '../narrative/types';
import type { StoryBundle } from '../lib/loadSimulationStory';

export type PlayerNarrativeDocument = {
  sourcePath: string;
  loopId: number | 'final';
  scenes: NarrativeSceneDefinition[];
};

export type PlayerStoryBundle = {
  simulation: Pick<
    StoryBundle,
    'loop' | 'initialState' | 'schedules' | 'definition' | 'worldlines' | 'playerChoices' | 'travelEdges'
  >;
  narrativeDocuments: PlayerNarrativeDocument[];
  artifacts: ArtifactDefinition[];
};
