import type { ActivityDefinition, NarrativeSceneDefinition, ArtifactDefinition, ProtagonistScheduleDefinition } from '../narrative/types';
import type { StoryBundle } from '../lib/loadSimulationStory';
import type { ChapterRule } from '../player/chapters';

export type PlayerNarrativeDocument = {
  sourcePath: string;
  /** A chapter, or 'daily' for the everyday town life that repeats in every loop. */
  loopId: number | 'final' | 'daily';
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
  /** What the protagonist can spend time doing; the player chooses some of them at the old house. */
  activities?: ActivityDefinition[];
  /** Absent: each loop plays the chapter matching its number. */
  chapterProgression?: ChapterRule[];
};
