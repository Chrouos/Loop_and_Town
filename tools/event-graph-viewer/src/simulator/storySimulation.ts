import type { StoryBundle } from '../lib/loadSimulationStory';
import { projectPlayerHistory } from './projection';
import { simulate } from './simulator';
import type { SimulationResult, StoryTimeInput, WorldlineHistoryEntry } from './types';

export type StorySimulationResult = SimulationResult & {
  fullHistory: WorldlineHistoryEntry[];
  playerHistory: WorldlineHistoryEntry[];
};

export function simulateStory(input: {
  story: StoryBundle;
  actionIds: string[];
  until?: StoryTimeInput;
}): StorySimulationResult {
  const result = simulate({
    definition: input.story.definition,
    initialState: input.story.initialState,
    actions: input.actionIds,
    until: input.until ?? input.story.loop.range.end,
  });

  return {
    state: result.state,
    history: result.history,
    fullHistory: result.history,
    playerHistory: projectPlayerHistory(result.history),
  };
}

export function simulateNamedWorldline(story: StoryBundle, worldlineId: string): StorySimulationResult {
  const worldline = story.worldlines.find((candidate) => candidate.id === worldlineId);
  if (!worldline) throw new Error(`Unknown worldline: ${worldlineId}`);
  return simulateStory({ story, actionIds: worldline.actionIds });
}
