import type { StoryDagDocument, StoryWorldlinePath } from '../types/story';

export type CausalTimelineNode = {
  id: string;
  title: string;
  time?: string;
  minute?: number;
  actorIds: string[];
  laneId: string;
  pathActive: boolean;
};

export type CausalTimelineProjection = {
  nodes: CausalTimelineNode[];
  edgeIds: Set<string>;
  nodeIds: Set<string>;
  lanes: string[];
};

function parseMinute(time?: string): number | undefined {
  if (!time) return undefined;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return undefined;
  return hour * 60 + minute;
}

export function projectWorldlineTrace(
  doc: StoryDagDocument,
  path?: StoryWorldlinePath,
): CausalTimelineProjection {
  const requestedNodeIds = path ? new Set(path.nodeIds) : undefined;
  const sourceOrder = new Map(doc.nodes.map((node, index) => [node.id, index]));
  const nodes = doc.nodes
    .filter((node) => !requestedNodeIds || requestedNodeIds.has(node.id))
    .map<CausalTimelineNode>((node) => ({
      id: node.id,
      title: node.title,
      time: node.time,
      minute: parseMinute(node.time),
      actorIds: [...node.actorIds],
      laneId: node.actorIds[0] ?? 'system',
      pathActive: Boolean(path),
    }))
    .sort((left, right) => {
      if (left.minute === undefined && right.minute === undefined) {
        return (sourceOrder.get(left.id) ?? 0) - (sourceOrder.get(right.id) ?? 0);
      }
      if (left.minute === undefined) return 1;
      if (right.minute === undefined) return -1;
      return left.minute - right.minute
        || (sourceOrder.get(left.id) ?? 0) - (sourceOrder.get(right.id) ?? 0);
    });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const requestedEdgeIds = path ? new Set(path.edgeIds) : undefined;
  const edgeIds = new Set(
    doc.edges
      .filter((edge) =>
        nodeIds.has(edge.source)
        && nodeIds.has(edge.target)
        && (!requestedEdgeIds || requestedEdgeIds.has(edge.id)))
      .map((edge) => edge.id),
  );
  const lanes = [...new Set(nodes.map((node) => node.laneId))];

  return { nodes, edgeIds, nodeIds, lanes };
}

function walk(
  adjacency: Map<string, string[]>,
  centerId: string,
  hops: number,
  target: Set<string>,
) {
  let frontier = [centerId];
  for (let depth = 0; depth < hops; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const adjacent of adjacency.get(id) ?? []) {
        if (!target.has(adjacent)) next.push(adjacent);
        target.add(adjacent);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
}

export function getFocusedNodeIds(
  doc: StoryDagDocument,
  centerId: string,
  upstreamHops: number,
  downstreamHops: number,
): Set<string> {
  const nodeIds = new Set(doc.nodes.map((node) => node.id));
  if (!nodeIds.has(centerId)) return new Set();

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const edge of doc.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const focused = new Set([centerId]);
  walk(incoming, centerId, Math.max(0, upstreamHops), focused);
  walk(outgoing, centerId, Math.max(0, downstreamHops), focused);
  return focused;
}

export function filterProjection(
  projection: CausalTimelineProjection,
  options: { actorId?: string; query?: string; allowedNodeIds?: Set<string> },
): CausalTimelineProjection {
  const query = options.query?.trim().toLocaleLowerCase();
  const nodes = projection.nodes.filter((node) => {
    if (options.allowedNodeIds && !options.allowedNodeIds.has(node.id)) return false;
    if (options.actorId && !node.actorIds.includes(options.actorId)) return false;
    if (query && !`${node.title} ${node.time ?? ''} ${node.actorIds.join(' ')}`.toLocaleLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    nodeIds,
    edgeIds: new Set(projection.edgeIds),
    lanes: [...new Set(nodes.map((node) => node.laneId))],
  };
}

export function compareWorldlinePaths(
  doc: StoryDagDocument,
  paths: StoryWorldlinePath[],
): { invariantNodeIds: string[]; variableNodeIdsByPath: Record<string, string[]> } {
  const uniquePaths = [...new Map(paths.map((path) => [path.id, path])).values()];
  const validNodeIds = new Set(doc.nodes.map((node) => node.id));
  const validByPath = new Map(
    uniquePaths.map((path) => [
      path.id,
      new Set(path.nodeIds.filter((id) => validNodeIds.has(id))),
    ]),
  );

  const invariantSet = uniquePaths.length === 0
    ? new Set<string>()
    : new Set(validByPath.get(uniquePaths[0].id));
  for (const path of uniquePaths.slice(1)) {
    const current = validByPath.get(path.id) ?? new Set<string>();
    for (const id of [...invariantSet]) {
      if (!current.has(id)) invariantSet.delete(id);
    }
  }

  const invariantNodeIds = doc.nodes
    .map((node) => node.id)
    .filter((id) => invariantSet.has(id));
  const variableNodeIdsByPath: Record<string, string[]> = {};
  for (const path of uniquePaths) {
    const current = validByPath.get(path.id) ?? new Set<string>();
    variableNodeIdsByPath[path.id] = doc.nodes
      .map((node) => node.id)
      .filter((id) => current.has(id) && !invariantSet.has(id));
  }

  return { invariantNodeIds, variableNodeIdsByPath };
}
