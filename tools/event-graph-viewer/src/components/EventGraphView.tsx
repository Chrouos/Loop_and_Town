import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { buildEventGraph } from '../lib/eventGraph';
import type { EventGraphDocument, GraphNode, GraphProjection } from '../types/story';

const ROLE_X: Record<GraphNode['role'], number> = {
  action: 20,
  schedule: 300,
  event: 580,
  variant: 860,
  delayed: 1140,
};

function toFlowNode(node: GraphNode, roleIndex: number): Node {
  return {
    id: node.id,
    position: { x: ROLE_X[node.role], y: 60 + roleIndex * 180 },
    draggable: false,
    selectable: true,
    data: {
      label: (
        <div className={`graph-card ${node.role}`}>
          <strong>{node.title}</strong>
          {node.subtitle && <span>{node.subtitle}</span>}
          {node.details.length > 0 && (
            <ul>
              {node.details.slice(0, 4).map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          )}
        </div>
      ),
    },
    style: { width: 260, padding: 0, border: 0, background: 'transparent' },
  };
}

type Props =
  | { projection: GraphProjection; document?: never }
  | { projection?: never; document: EventGraphDocument };

export function EventGraphView(props: Props) {
  const projection = props.projection ?? buildEventGraph(props.document);
  const counters: Record<GraphNode['role'], number> = { action: 0, schedule: 0, event: 0, variant: 0, delayed: 0 };
  const nodes = projection.nodes.map((graphNode) => toFlowNode(graphNode, counters[graphNode.role]++));
  const edges: Edge[] = projection.edges.map((edge) => ({
    ...edge,
    animated: edge.label?.startsWith('+') ?? false,
    label: edge.label,
  }));

  return (
    <section className="panel graph-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">事件因果圖</p>
          <h2>Event Graph</h2>
        </div>
        <p>Action / Schedule / Event / Variant / Delayed Effect</p>
      </div>
      <div className="graph-canvas" aria-label="Event Graph canvas">
        <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}>
          <Background gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
