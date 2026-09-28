import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { buildEventGraph } from '../lib/eventGraph';
import { buildStoryDagProjection } from '../lib/storyDag';
import type { EventGraphDocument, GraphNode, GraphProjection, StoryDagDocument } from '../types/story';

const ROLE_X: Record<GraphNode['role'], number> = {
  action: 20,
  schedule: 300,
  event: 580,
  variant: 860,
  delayed: 1140,
};

type DagLayout = Record<string, { x: number; y: number }>;

function buildDagLayout(projection: GraphProjection): DagLayout {
  const incoming = new Map<string, string[]>();
  for (const node of projection.nodes) incoming.set(node.id, []);
  for (const edge of projection.edges) incoming.get(edge.target)?.push(edge.source);

  const depth = new Map<string, number>();
  const resolveDepth = (nodeId: string, visiting = new Set<string>()): number => {
    if (depth.has(nodeId)) return depth.get(nodeId)!;
    if (visiting.has(nodeId)) return 0;
    visiting.add(nodeId);
    const parents = incoming.get(nodeId) ?? [];
    const value = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((parent) => resolveDepth(parent, visiting)));
    visiting.delete(nodeId);
    depth.set(nodeId, value);
    return value;
  };

  projection.nodes.forEach((node) => resolveDepth(node.id));
  const rowByDepth = new Map<number, number>();
  const layout: DagLayout = {};
  for (const node of projection.nodes) {
    const column = depth.get(node.id) ?? 0;
    const row = rowByDepth.get(column) ?? 0;
    rowByDepth.set(column, row + 1);
    layout[node.id] = { x: 40 + column * 330, y: 50 + row * 170 };
  }
  return layout;
}

function toFlowNode(
  node: GraphNode,
  position: { x: number; y: number },
  options: { bracketed?: boolean; active?: boolean; onSelect?: (id: string) => void } = {},
): Node {
  const label = options.bracketed ? `[${node.id} ${node.title}]` : node.title;
  return {
    id: node.id,
    position,
    draggable: false,
    selectable: true,
    className: options.active === false ? 'story-dag-node is-dimmed' : 'story-dag-node',
    data: {
      label: (
        <div
          className={`graph-card ${node.role}`}
          onClick={() => options.onSelect?.(node.id)}
          role={options.onSelect ? 'button' : undefined}
          tabIndex={options.onSelect ? 0 : undefined}
        >
          <strong>{label}</strong>
          {node.subtitle && <span>{node.subtitle}</span>}
          {!options.bracketed && node.details.length > 0 && (
            <ul>
              {node.details.slice(0, 4).map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          )}
        </div>
      ),
    },
    style: { width: options.bracketed ? 285 : 260, padding: 0, border: 0, background: 'transparent' },
  };
}

type LegacyProps =
  | { projection: GraphProjection; document?: never; dagDocument?: never; onNodeSelect?: (id: string) => void; activeNodeIds?: Set<string>; activeEdgeIds?: Set<string> }
  | { projection?: never; document: EventGraphDocument; dagDocument?: never; onNodeSelect?: (id: string) => void; activeNodeIds?: Set<string>; activeEdgeIds?: Set<string> };

type DagProps = {
  projection?: never;
  document?: never;
  dagDocument: StoryDagDocument;
  onNodeSelect?: (id: string) => void;
  activeNodeIds?: Set<string>;
  activeEdgeIds?: Set<string>;
};

type Props = LegacyProps | DagProps;

export function EventGraphView(props: Props) {
  let isDag = false;
  let projection: GraphProjection;

  if ('dagDocument' in props && props.dagDocument) {
    isDag = true;
    projection = buildStoryDagProjection(props.dagDocument, 'author');
  } else if ('projection' in props && props.projection) {
    projection = props.projection;
  } else if ('document' in props && props.document) {
    projection = buildEventGraph(props.document);
  } else {
    throw new Error('EventGraphView requires projection, document, or dagDocument');
  }

  const dagLayout = isDag ? buildDagLayout(projection) : null;
  const counters: Record<GraphNode['role'], number> = { action: 0, schedule: 0, event: 0, variant: 0, delayed: 0 };
  const nodes = projection.nodes.map((graphNode) => {
    const position = dagLayout?.[graphNode.id]
      ?? { x: ROLE_X[graphNode.role], y: 60 + counters[graphNode.role]++ * 180 };
    const active = props.activeNodeIds ? props.activeNodeIds.has(graphNode.id) : undefined;
    return toFlowNode(graphNode, position, {
      bracketed: isDag,
      active,
      onSelect: props.onNodeSelect,
    });
  });

  const edges: Edge[] = projection.edges.map((edge) => ({
    ...edge,
    animated: !isDag && (edge.label?.startsWith('+') ?? false),
    label: edge.label,
    className: props.activeEdgeIds && !props.activeEdgeIds.has(edge.id) ? 'is-dimmed' : undefined,
  }));

  return (
    <section className="panel graph-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{isDag ? '故事因果 DAG' : '事件因果圖'}</p>
          <h2>{isDag ? 'Story DAG' : 'Event Graph'}</h2>
        </div>
        <p>{isDag ? '[Node] — effect → [Node] · 分支可再次合流' : 'Action / Schedule / Event / Variant / Delayed Effect'}</p>
      </div>
      {isDag && (
        <div className="story-dag-edge-labels" aria-label="因果關係標籤">
          {projection.edges.map((edge) => (
            <span
              key={edge.id}
              className={props.activeEdgeIds && !props.activeEdgeIds.has(edge.id) ? 'story-dag-edge-chip is-dimmed' : 'story-dag-edge-chip'}
            >
              {edge.label}
            </span>
          ))}
        </div>
      )}
      <div className="graph-canvas" aria-label={isDag ? 'Story DAG canvas' : 'Event Graph canvas'}>
        <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}>
          <Background gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
