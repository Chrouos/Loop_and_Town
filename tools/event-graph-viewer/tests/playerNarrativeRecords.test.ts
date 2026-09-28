import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';
import { emptyLoop, normalizeSave } from '../src/player/model';
import { reconcilePlayer, visibleRecords } from '../src/player/knowledge';
import { projectPlayerNarrativeRecords } from '../src/player/narrativeRecords';
import type { PlayerStoryBundle } from '../src/types/playerStory';
import type { WorldlineHistoryEntry } from '../src/simulator/types';

function playerBundle(): PlayerStoryBundle {
  const story = loadRealStory();
  const loop1Scenes = story.narrative.scenes.filter((scene) => !scene.id.startsWith('loop02_'));
  const loop2Scenes = story.narrative.scenes.filter((scene) => scene.id.startsWith('loop02_'));
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
    narrativeDocuments: [
      { sourcePath: 'story/narrative/loop_01_player.yaml', loopId: 1, scenes: loop1Scenes },
      { sourcePath: 'story/narrative/loop_02_player.yaml', loopId: 2, scenes: loop2Scenes },
    ],
    artifacts: story.narrative.artifacts,
  };
}

function historyFor(variantId: string): WorldlineHistoryEntry[] {
  return [{
    sequence: 0,
    time: '18:31',
    minute: 1111,
    absoluteMinute: 1111,
    kind: 'event',
    eventId: 'evt_1831_station',
    variantId,
    title: '18:31 車站異常',
    visibility: 'observable',
  }];
}

describe('player narrative records', () => {
  it('projects the authored Loop 2 scene sequence into safe player records', () => {
    const records = projectPlayerNarrativeRecords(playerBundle(), 2, historyFor('doctor_dies'), 1440);

    expect(records.map((record) => record.sceneId)).toEqual([
      'loop02_1420_reset_awareness',
      'loop02_1610_wakaharu_alive',
      'loop02_1645_wrong_warning',
      'loop02_1718_wakaharu_persuaded',
      'loop02_1742_doctor_departure',
      'loop02_1805_doctor_no_recipient',
      'loop02_1812_doctor_decides_return',
      'loop02_1824_maintenance_passage',
      'loop02_1831_doctor_death',
      'loop02_1910_detective_shift',
      'loop02_1950_reporter_replans',
      'loop02_2030_wakaharu_resignation',
      'loop02_2210_worldline_compare',
      'loop02_2359_bell_again',
      'loop02_0000_reset_again',
    ]);
    expect(records.find((record) => record.sceneId === 'loop02_1610_wakaharu_alive')?.body.join('\n')).toContain('她活著');
    expect(records.every((record) => !('relationship' in record) && !('storyDag' in record))).toBe(true);
  });

  it('does not project scenes before their authored minute or for a wrong source variant', () => {
    const bundle = playerBundle();
    expect(projectPlayerNarrativeRecords(bundle, 2, historyFor('doctor_dies'), 480).map((record) => record.sceneId))
      .toEqual(['loop02_1420_reset_awareness']);
    expect(projectPlayerNarrativeRecords(bundle, 2, historyFor('wakaharu_dies'), 1439)
      .some((record) => record.sceneId === 'loop02_1831_doctor_death')).toBe(false);
  });

  it('hides a scene after it is marked seen in the active loop', () => {
    const save = normalizeSave(null, 0);
    save.currentLoopId = 2;
    save.loops[2] = emptyLoop(save.loops[1].clock);
    save.loops[2].revealedIds = ['2:loop02_1420_reset_awareness', '2:loop02_1610_wakaharu_alive'];
    save.loops[2].seenSceneIds = ['loop02_1420_reset_awareness'];
    const records = projectPlayerNarrativeRecords(playerBundle(), 2, historyFor('doctor_dies'), 500);

    expect(visibleRecords(save, 2, records).map((record) => record.sceneId)).toEqual(['loop02_1610_wakaharu_alive']);
  });

  it('reveals only the active loop document during reconciliation', () => {
    const bundle = playerBundle();
    const save = normalizeSave(null, 0);
    save.currentLoopId = 2;
    save.loops[2] = emptyLoop(save.loops[1].clock);
    reconcilePlayer(save, 640_000, bundle.simulation.definition, bundle.simulation.initialState, bundle);

    expect(save.loops[2].revealedIds).toContain('2:loop02_1420_reset_awareness');
    expect(save.loops[2].revealedIds.some((id) => id.includes('loop01'))).toBe(false);
  });
});
