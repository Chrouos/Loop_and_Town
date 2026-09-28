import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { CausalTimelineProjection } from '../lib/causalTimeline';
import type { StoryDagDocument } from '../types/story';

type Props = {
  document: StoryDagDocument;
  projection: CausalTimelineProjection;
  focusedNodeIds?: Set<string>;
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
};

const X_STEP = 2.35;
const LANE_HEIGHT = 150;
const COLLISION_OFFSET = 72;
const BASE_X = 100;
const BASE_Y = 60;

export function CausalTimelineGraph({
  document,
  projection,
  focusedNodeIds,
  selectedNodeId,
  onNodeSelect,
}: Props) {
  const visibleNodes = projection.nodes.filter((node) => !focusedNodeIds || focusedNodeIds.has(node.id));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const timed = visibleNodes.map((node) => node.minute).filter((minute): minute is number => minute !== undefined);
  const minMinute = timed.length > 0 ? Math.min(...timed) : 0;
  const maxMinute = timed.length > 0 ? Math.max(...timed) : minMinute;
  const laneIds = projection.lanes.filter((lane) => visibleNodes.some((node) => node.laneId === lane));
  const laneIndex = new Map(laneIds.map((lane, index) => [lane, index]));
  const collisionCount = new Map<string, number>();

  const nodes: Node[] = visibleNodes.map((timelineNode, sourceIndex) => {
    const minute = timelineNode.minute ?? maxMinute + 30 + sourceIndex * 5;
    const lane = laneIndex.get(timelineNode.laneId) ?? 0;
    const collisionKey = `${timelineNode.laneId}:${minute}`;
    const collision = collisionCount.get(collisionKey) ?? 0;
    collisionCount.set(collisionKey, collision + 1);
    const position = {
      x: BASE_X + (minute - minMinute) * X_STEP,
      y: BASE_Y + lane * LANE_HEIGHT + collision * COLLISION_OFFSET,
    };

    return {
      id: timelineNode.id,
      position,
      draggable: false,
      selectable: true,
      className: timelineNode.id === selectedNodeId ? 'causal-flow-node is-selected' : 'causal-flow-node',
      style: { width: 220, padding: 0, border: 0, background: 'transparent' },
      data: {
        label: (
          <button
            type="button"
            className="causal-node-card"
            data-testid={`causal-node-${timelineNode.id}`}
            data-minute={timelineNode.minute ?? ''}
            data-lane={timelineNode.laneId}
            onClick={() => onNodeSelect(timelineNode.id)}
          >
            <span className="causal-node-time">{timelineNode.time ?? '時間未定'}</span>
            <strong>{timelineNode.title}</strong>
          </button>
        ),
      },
    };
  });

  const edges: Edge[] = document.edges
    .filter((edge) =>
      projection.edgeIds.has(edge.id)
      && visibleIds.has(edge.source)
      && visibleIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      className: 'causal-flow-edge',
    }));

  return (
    <section className="panel causal-timeline-panel">
      <div className="panel-heading causal-timeline-heading">
        <div>
          <p className="eyebrow">世界線因果時間軸</p>
          <h2>Causal Timeline</h2>
        </div>
        <p>時間由左到右 · 角色以 Lane 分開</p>
      </div>

      <div className="causal-lane-key" aria-label="Character lanes">
        {laneIds.map((lane) => <span key={lane}>{lane}</span>)}
      </div>

      <div className="graph-canvas causal-timeline-canvas" aria-label="Causal Timeline canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
        >
          <Background gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
