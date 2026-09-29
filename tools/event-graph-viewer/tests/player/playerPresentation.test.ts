import { describe, expect, it } from 'vitest';
import { emptyLoop, normalizeSave } from '../../src/player/model';
import { projectPlayerNarrativeRecords } from '../../src/player/narrativeRecords';
import { projectLoopIntegration, projectPlayerPresentation } from '../../src/player/presentation/projectPlayerPresentation';
import type { PlayerPresentationModel } from '../../src/player/presentation/types';
import type { PlayerStoryBundle } from '../../src/types/playerStory';
import type { WorldlineHistoryEntry } from '../../src/simulator/types';
import { loadRealStory } from '../helpers/loadRealStory';

function playerBundle(): PlayerStoryBundle {
  const story = loadRealStory();
  const loopForScene = (id: string): number | 'final' => {
    const match = /^(?:loop(\d+)|final)_/.exec(id);
    return match ? (match[1] ? Number(match[1]) : 'final') : 1;
  };
  const documents = new Map<number | 'final', typeof story.narrative.scenes>();
  for (const scene of story.narrative.scenes) {
    const loopId = loopForScene(scene.id);
    const scenes = documents.get(loopId) ?? [];
    scenes.push(scene);
    documents.set(loopId, scenes);
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
    narrativeDocuments: [...documents.entries()].map(([loopId, scenes]) => ({
      sourcePath: `story/narrative/${loopId}.yaml`,
      loopId,
      scenes,
    })),
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

function saveAt(loopId: number, minute = 1440) {
  const save = normalizeSave(null, 0);
  save.currentLoopId = loopId;
  save.loops[loopId] = emptyLoop(save.loops[1].clock);
  save.loops[loopId].clock.lastProcessedMinute = minute;
  return save;
}

describe('player-safe presentation projection', () => {
  it('loads one unique player document for Loop 01 through Final', () => {
    const bundle = playerBundle();
    expect(bundle.narrativeDocuments.map(document => document.loopId)).toEqual([1, 2, 3, 4, 5, 6, 7, 'final']);
    const sceneIds = bundle.narrativeDocuments.flatMap(document => document.scenes.map(scene => scene.id));
    expect(new Set(sceneIds).size).toBe(sceneIds.length);
  });

  it('projects only the active authored document and matching worldline history', () => {
    const bundle = playerBundle();
    const save = saveAt(2);
    const integration = projectLoopIntegration(bundle, save, historyFor('doctor_dies'), 1440);

    expect(integration.visibleScenes.length).toBeGreaterThan(0);
    expect(integration.visibleScenes.every(scene => scene.sceneId.startsWith('loop02_'))).toBe(true);
    expect(integration.visibleScenes.some(scene => scene.sceneId === 'loop02_1831_doctor_death')).toBe(true);
    expect(integration.visibleScenes.some(scene => scene.sceneId === 'loop02_1831_wakaharu_death')).toBe(false);
  });

  it('keeps a missed presence opportunity absent from the presentation and memory candidates', () => {
    const bundle = playerBundle();
    const save = saveAt(2, 1111);
    const integration = projectLoopIntegration(bundle, save, [], 1111);

    expect(integration.visibleScenes.some(scene => scene.acquisition === 'presence')).toBe(false);
    expect(integration.memoryCandidates).toEqual([]);
  });

  it('preserves player memory and wall state while declaring ordinary NPC reset', () => {
    const bundle = playerBundle();
    const save = saveAt(3);
    save.knowledge.memories.push({
      id: 'memory:2:loop02_1831_doctor_death',
      sourceLoop: 2,
      sourceRecordId: 'loop02_1831_doctor_death',
      sourceSceneId: 'loop02_1831_doctor_death',
      capturedAtMinute: 1111,
      capturedAtMs: 1,
      kind: 'composite',
      title: '18:31 的另一個死者',
      content: ['你看見了不該看見的事。'],
    });
    save.knowledge.wallRefs.push('memory:2:loop02_1831_doctor_death');
    save.knowledge.connections.push('memory:2:loop02_1831_doctor_death->letter');

    const integration = projectLoopIntegration(bundle, save, [], 372);
    expect(integration.persistentMemoryIds).toEqual(['memory:2:loop02_1831_doctor_death']);
    expect(integration.wallRefs).toEqual(['memory:2:loop02_1831_doctor_death']);
    expect(integration.npcState).toBe('reset');
    expect(integration.presentation.reset.npcState).toBe('reset');
  });

  it('keeps the presentation model free of author-only fields', () => {
    const bundle = playerBundle();
    const save = saveAt(2);
    const records = projectPlayerNarrativeRecords(bundle, 2, historyFor('doctor_dies'), 1440);
    const model: PlayerPresentationModel = projectPlayerPresentation({
      save,
      loopId: 2,
      minute: 1440,
      records,
      opportunities: [],
      scene: records[0],
    });
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain('storyDags');
    expect(serialized).not.toContain('hidden');
    expect(serialized).not.toContain('relationship');
    expect(serialized).not.toContain('author');
  });
});
