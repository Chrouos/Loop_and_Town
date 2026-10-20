import type { NarrativeSceneDefinition, ArtifactDefinition, ProtagonistScheduleDefinition } from '../narrative/types';
import type { StoryBundle } from '../lib/loadSimulationStory';
import type { ChapterRule } from '../player/chapters';

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
  /** Default-day activities; scenes gated by `afterActivityId` only unlock for these. */
  protagonistSchedule?: ProtagonistScheduleDefinition;
  /** Absent: each loop plays the chapter matching its number. */
  chapterProgression?: ChapterRule[];
};
