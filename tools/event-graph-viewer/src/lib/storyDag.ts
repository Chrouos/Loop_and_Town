import type {
  GraphProjection,
  StoryDagDocument,
  StoryDagNode,
  StoryVisibility,
} from '../types/story';

export type StoryDagViewMode = 'public' | 'player-known' | 'author';

function isVisible(visibility: StoryVisibility, mode: StoryDagViewMode): boolean {
  if (mode === 'author') return true;
  if (mode === 'player-known') return visibility !== 'author';
  return visibility === 'public';
}

export function validateStoryDag(doc: StoryDagDocument): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const node of doc.nodes) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate node id ${node.id}`);
    nodeIds.add(node.id);
  }

  for (const edge of doc.edges) {
    if (edgeIds.has(edge.id)) errors.push(`Duplicate edge id ${edge.id}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) errors.push(`Edge ${edge.id} source references unknown node ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Edge ${edge.id} target references unknown node ${edge.target}`);
  }

  return errors;
}

function nodeDetails(node: StoryDagNode): string[] {
  const details: string[] = [];
  if (node.detail.reason) details.push(node.detail.reason);
  details.push(...node.detail.after.slice(0, 2));
  return details;
}

export function buildStoryDagProjection(
  doc: StoryDagDocument,
  mode: StoryDagViewMode = 'author',
): GraphProjection {
  const visibleNodes = doc.nodes.filter((node) => isVisible(node.visibility, mode));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

  return {
    nodes: visibleNodes.map((node) => ({
      id: node.id,
      role: 'event',
      title: node.title,
      subtitle: [node.time, node.actorIds.join(' / ')].filter(Boolean).join(' · '),
      details: nodeDetails(node),
    })),
    edges: doc.edges
      .filter((edge) =>
        isVisible(edge.visibility, mode)
        && visibleNodeIds.has(edge.source)
        && visibleNodeIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
      })),
  };
}
