import { describe, expect, it } from 'vitest';
import { emptyLoop, normalizeSave } from '../../src/player/model';
import { projectLoopIntegration } from '../../src/player/presentation/projectPlayerPresentation';
import type { PlayerStoryBundle } from '../../src/types/playerStory';
import type { WorldlineHistoryEntry } from '../../src/simulator/types';
import { loadRealStory } from '../helpers/loadRealStory';

function bundle(): PlayerStoryBundle {
  const story = loadRealStory();
  const groups = new Map<number | 'final', typeof story.narrative.scenes>();
  for (const scene of story.narrative.scenes) {
    const match = /^(?:loop(\d+)|final)_/.exec(scene.id);
    const loopId = match?.[1] ? Number(match[1]) : match ? 'final' : 1;
    groups.set(loopId, [...(groups.get(loopId) ?? []), scene]);
  }
  return {
    simulation: {
      loop: story.loop,
      initialState: story.initialState,
      schedules: story.schedules,
      definition: story.definition,
      worldlines: story.worldlines,
      playerChoices: story.playerChoices,
      travelEdges: story.travelEdges,
    },
    narrativeDocuments: [...groups].map(([loopId, scenes]) => ({ sourcePath: 'test', loopId, scenes })),
    artifacts: story.narrative.artifacts,
  };
}

describe('M8 loop integration contract', () => {
  it('does not let a later loop project an earlier loop scene', () => {
    const save = normalizeSave(null, 0);
    save.currentLoopId = 6;
    save.loops[6] = emptyLoop(save.loops[1].clock);
    const history: WorldlineHistoryEntry[] = [];
    const result = projectLoopIntegration(bundle(), save, history, 900);

    expect(result.visibleScenes.every(scene => scene.sceneId.startsWith('loop06_'))).toBe(true);
    expect(result.visibleScenes.some(scene => scene.sceneId.startsWith('loop05_'))).toBe(false);
  });

  it('never turns author-only story graph data into automatic player inference', () => {
    const save = normalizeSave(null, 0);
    save.currentLoopId = 7;
    save.loops[7] = emptyLoop(save.loops[1].clock);
    const result = projectLoopIntegration(bundle(), save, [], 900);

    expect(Object.keys(result)).not.toContain('storyDags');
    expect(Object.keys(result.presentation)).not.toContain('relationships');
    expect(result.inference).toBe('player-led');
  });
});
