import {
  buildStoryBundleFromManifest,
  loadStoryManifest,
  loadYaml,
  parseNarrativeDocument,
} from './loadSimulationStory';
import type { NarrativeSceneDefinition } from '../narrative/types';
import type { PlayerNarrativeDocument, PlayerStoryBundle } from '../types/playerStory';

function storyPath(path: string): string {
  return path.startsWith('story/') ? path : `story/${path}`;
}

function loopIdForPath(path: string): number | 'final' {
  const finalMatch = /(?:^|\/)final_player\.ya?ml$/.exec(path);
  if (finalMatch) return 'final';
  const loopMatch = /(?:^|\/)loop_(\d+)_player\.ya?ml$/.exec(path);
  if (loopMatch) return Number(loopMatch[1]);
  throw new Error(`Cannot derive player narrative loop id from source: ${storyPath(path)}`);
}

async function loadExtraNarrative(path: string): Promise<PlayerNarrativeDocument> {
  const sourcePath = storyPath(path);
  const scenes = parseNarrativeDocument(await loadYaml(sourcePath));
  return { sourcePath, loopId: loopIdForPath(path), scenes };
}

function validateUniqueSceneIds(documents: PlayerNarrativeDocument[]): void {
  const sceneIds = new Set<string>();
  for (const document of documents) {
    for (const scene of document.scenes) {
      if (sceneIds.has(scene.id)) throw new Error(`Duplicate player narrative scene id: ${scene.id}`);
      sceneIds.add(scene.id);
    }
  }
}

export async function loadPlayerStoryBundle(manifestPath: string): Promise<PlayerStoryBundle> {
  const manifest = await loadStoryManifest(manifestPath);
  const simulation = await buildStoryBundleFromManifest(manifest);
  const baseDocuments: PlayerNarrativeDocument[] = manifest.narrative
    ? [{
      sourcePath: storyPath(manifest.narrative),
      loopId: loopIdForPath(manifest.narrative),
      scenes: simulation.narrative.scenes,
    }]
    : [];
  const extraDocuments = manifest.narratives
    ? await Promise.all(manifest.narratives.map(loadExtraNarrative))
    : [];
  const narrativeDocuments = [...baseDocuments, ...extraDocuments];
  validateUniqueSceneIds(narrativeDocuments);

  return {
    simulation: {
      loop: simulation.loop,
      initialState: simulation.initialState,
      schedules: simulation.schedules,
      definition: simulation.definition,
      worldlines: simulation.worldlines,
      playerChoices: simulation.playerChoices,
      travelEdges: simulation.travelEdges,
    },
    narrativeDocuments,
    artifacts: simulation.narrative.artifacts,
  };
}

export type { NarrativeSceneDefinition };
