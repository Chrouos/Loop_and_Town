import { useMemo, useState } from 'react';
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import { projectCharacterGraph } from '../narrative/characterGraph';
import type { NarrativeFoundation } from '../narrative/types';
import type { CharacterGraphMode } from '../types/story';

const MODE_LABELS: Array<{ id: CharacterGraphMode; label: string }> = [
  { id: 'public', label: 'Public' },
  { id: 'author', label: 'Author Truth' },
  { id: 'player-known', label: 'Player Known' },
];

function nodePosition(index: number) {
  return { x: 30 + (index % 3) * 300, y: 40 + Math.floor(index / 3) * 190 };
}

export function CharacterGraphView({ story }: { story: NarrativeFoundation }) {
  const [mode, setMode] = useState<CharacterGraphMode>('public');
  const [selectedId, setSelectedId] = useState('protagonist');
  const projection = useMemo(() => projectCharacterGraph(story, mode), [story, mode]);
  const detail = projection.details[selectedId] ?? projection.details[projection.nodes[0]?.id];
  const names = new Map(projection.nodes.map((node) => [node.id, node.name]));

  const nodes: Node[] = projection.nodes.map((node, index) => ({
    id: node.id,
    position: nodePosition(index),
    draggable: false,
    data: {
      label: (
        <div className="graph-card character-card">
          <strong>{node.name}</strong>
          {node.occupation && <span>{node.occupation}</span>}
        </div>
      ),
    },
    style: { width: 240, padding: 0, border: 0, background: 'transparent' },
  }));

  const edges: Edge[] = projection.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.type,
  }));

  return (
    <section className="panel character-graph-panel">
      <div className="panel-heading character-heading">
        <div>
          <p className="eyebrow">人物設定與關係</p>
          <h2>Character Graph</h2>
        </div>
        <div className="character-modes" aria-label="Character Graph visibility">
          {MODE_LABELS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? 'tab active' : 'tab'}
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="character-layout">
        <div className="graph-canvas character-canvas" aria-label="Character Graph canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, node) => setSelectedId(node.id)}
          >
            <Background gap={18} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {detail && (
          <aside className="character-detail" aria-label="Character details">
            <p className="eyebrow">Selected Character</p>
            <h3>{detail.name}</h3>
            <p>{detail.backgroundSummary}</p>
            {detail.traits.length > 0 && <p><strong>Traits</strong> · {detail.traits.join(' / ')}</p>}
            {detail.scheduleRef && <p><strong>Schedule</strong> · {detail.scheduleRef}</p>}
            {detail.knowledgeIds.length > 0 && (
              <div><strong>Knowledge</strong><ul>{detail.knowledgeIds.map((id) => <li key={id}>{id}</li>)}</ul></div>
            )}
            {detail.secrets.length > 0 && (
              <div><strong>Secrets</strong><ul>{detail.secrets.map((secret) => <li key={secret}>{secret}</li>)}</ul></div>
            )}
          </aside>
        )}
      </div>

      <div className="character-relationships" aria-label="Visible relationships">
        {projection.edges.map((edge) => (
          <article key={edge.id}>
            <strong>{names.get(edge.source)} → {names.get(edge.target)}</strong>
            <span>{edge.type}</span>
            <p>{edge.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
