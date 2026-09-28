import {
  buildStoryBundleFromManifest,
  loadStoryManifest,
  loadYaml,
  loadYamlText,
  parseNarrativeDocument,
} from './loadSimulationStory';
import { parseStoryDagText, parseStoryWorldlinePathsText } from './loadStory';
import { validateStoryDag } from './storyDag';
import type { AuthorStoryBundle } from '../types/storyBundle';
import type { NarrativeSceneDefinition } from '../narrative/types';
import type { StoryDagDocument, StoryWorldlinePath } from '../types/story';

function storyPath(path: string): string {
  return path.startsWith('story/') ? path : `story/${path}`;
}

async function loadNarratives(paths: string[]): Promise<NarrativeSceneDefinition[]> {
  const documents = await Promise.all(paths.map((path) => loadYaml(storyPath(path))));
  return documents.flatMap(parseNarrativeDocument);
}

async function loadDags(paths: string[]): Promise<StoryDagDocument[]> {
  const documents = await Promise.all(paths.map(async (path) => parseStoryDagText(await loadYamlText(storyPath(path)))));
  return documents;
}

async function loadPaths(paths: string[]): Promise<StoryWorldlinePath[]> {
  const documents = await Promise.all(paths.map(async (path) => parseStoryWorldlinePathsText(await loadYamlText(storyPath(path)))));
  return documents.flat();
}

function validateAuthorStoryBundle(bundle: AuthorStoryBundle): void {
  const sceneIds = new Set<string>();
  for (const scene of bundle.narratives) {
    if (sceneIds.has(scene.id)) throw new Error(`Duplicate narrative scene id: ${scene.id}`);
    sceneIds.add(scene.id);
  }

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const dagIds = new Set<string>();
  for (const dag of bundle.storyDags) {
    if (dagIds.has(dag.id)) throw new Error(`Duplicate story DAG id: ${dag.id}`);
    dagIds.add(dag.id);
    const errors = validateStoryDag(dag);
    if (errors.length) throw new Error(`${dag.id}: ${errors.join('; ')}`);
    for (const node of dag.nodes) {
      if (nodeIds.has(node.id)) throw new Error(`Duplicate story DAG node id: ${node.id}`);
      nodeIds.add(node.id);
      for (const narrativeRef of node.detail.narrativeRefs) {
        if (!sceneIds.has(narrativeRef)) throw new Error(`${dag.id}: unresolved narrative ref ${narrativeRef}`);
      }
    }
    for (const edge of dag.edges) {
      if (edgeIds.has(edge.id)) throw new Error(`Duplicate story DAG edge id: ${edge.id}`);
      edgeIds.add(edge.id);
    }
  }

  const pathIds = new Set<string>();
  for (const path of bundle.worldlinePaths) {
    if (pathIds.has(path.id)) throw new Error(`Duplicate worldline path id: ${path.id}`);
    pathIds.add(path.id);
    for (const nodeId of path.nodeIds) {
      if (!nodeIds.has(nodeId)) throw new Error(`Worldline path ${path.id} references unknown node ${nodeId}`);
    }
    for (const edgeId of path.edgeIds) {
      if (!edgeIds.has(edgeId)) throw new Error(`Worldline path ${path.id} references unknown edge ${edgeId}`);
    }
  }
}

export async function loadAuthorStoryBundle(manifestPath: string): Promise<AuthorStoryBundle> {
  const manifest = await loadStoryManifest(manifestPath);
  const simulation = await buildStoryBundleFromManifest(manifest);
  const extraNarratives = manifest.narratives ? await loadNarratives(manifest.narratives) : [];
  const storyDags = manifest.story_dags ? await loadDags(manifest.story_dags) : [];
  const worldlinePaths = manifest.worldline_paths ? await loadPaths(manifest.worldline_paths) : [];
  const bundle: AuthorStoryBundle = {
    simulation,
    narratives: [...simulation.narrative.scenes, ...extraNarratives],
    storyDags,
    worldlinePaths,
  };
  validateAuthorStoryBundle(bundle);
  return bundle;
}
