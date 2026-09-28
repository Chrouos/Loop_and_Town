import type { StoryBundle } from '../lib/loadSimulationStory';
import type { NarrativeSceneDefinition } from '../narrative/types';
import type { StoryDagDocument, StoryWorldlinePath } from './storyDag';

export type AuthorStoryBundle = {
  simulation: StoryBundle;
  narratives: NarrativeSceneDefinition[];
  storyDags: StoryDagDocument[];
  worldlinePaths: StoryWorldlinePath[];
};
