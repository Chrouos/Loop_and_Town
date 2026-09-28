import { useMemo, useState } from 'react';
import {
  filterProjection,
  getFocusedNodeIds,
  projectWorldlineTrace,
} from '../lib/causalTimeline';
import type { StoryDagDocument, StoryWorldlinePath } from '../types/story';
import { CausalFocusControls, type CausalFocusMode } from './CausalFocusControls';
import { CausalTimelineGraph } from './CausalTimelineGraph';
import { CausalTimelineToolbar } from './CausalTimelineToolbar';
import { NodeDetailPanel } from './NodeDetailPanel';
import { WorldlineSetCompare } from './WorldlineSetCompare';
import './causalTimelineWorkbench.css';

type NarrativeScene = {
  id: string;
  blocks?: Array<{ type?: string; speaker?: string; text?: string }>;
};

type Props = {
  document: StoryDagDocument;
  paths: StoryWorldlinePath[];
  narrativeScenes: NarrativeScene[];
};

function intersect(left: Set<string>, right: Set<string>) {
  return new Set([...left].filter((id) => right.has(id)));
}

function descendantsToConvergence(
  document: StoryDagDocument,
  traceNodeIds: Set<string>,
  centerId: string,
): Set<string> {
  const visibleEdges = document.edges.filter((edge) =>
    traceNodeIds.has(edge.source) && traceNodeIds.has(edge.target));
  const outgoing = new Map<string, string[]>();
  for (const edge of visibleEdges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const byId = new Map(document.nodes.map((node) => [node.id, node]));
  const result = new Set<string>([centerId]);
  const queue = [centerId];
  const terminal = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current !== centerId) {
      const node = byId.get(current);
      if (node && (node.time === '18:31' || /18:31.*convergence/i.test(node.title))) {
        terminal.add(current);
        continue;
      }
    }
    for (const next of outgoing.get(current) ?? []) {
      if (result.has(next)) continue;
      result.add(next);
      queue.push(next);
    }
  }

  if (terminal.size === 0) return result;

  const canReachTerminal = new Set<string>(terminal);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of visibleEdges) {
      if (result.has(edge.source) && canReachTerminal.has(edge.target) && !canReachTerminal.has(edge.source)) {
        canReachTerminal.add(edge.source);
        changed = true;
      }
    }
  }
  return intersect(result, canReachTerminal);
}

export function CausalTimelineWorkbench({ document, paths, narrativeScenes }: Props) {
  const [selectedPathId, setSelectedPathId] = useState(paths[0]?.id ?? '');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [actorId, setActorId] = useState('');
  const [query, setQuery] = useState('');
  const [focusMode, setFocusMode] = useState<CausalFocusMode>(null);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparePathIds, setComparePathIds] = useState<string[]>(() => paths.slice(0, 3).map((path) => path.id));

  const selectedPath = useMemo(
    () => paths.find((path) => path.id === selectedPathId) ?? paths[0],
    [paths, selectedPathId],
  );
  const trace = useMemo(
    () => projectWorldlineTrace(document, selectedPath),
    [document, selectedPath],
  );
  const actorIds = useMemo(
    () => [...new Set(trace.nodes.flatMap((node) => node.actorIds))],
    [trace],
  );
  const selectedNode = useMemo(
    () => document.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [document, selectedNodeId],
  );

  const focusIds = useMemo(() => {
    if (!selectedNodeId || !focusMode) return undefined;
    if (focusMode === 'why') {
      return intersect(getFocusedNodeIds(document, selectedNodeId, 2, 0), trace.nodeIds);
    }
    if (focusMode === 'effects') {
      return intersect(getFocusedNodeIds(document, selectedNodeId, 0, 2), trace.nodeIds);
    }
    if (focusMode === 'convergence') {
      return descendantsToConvergence(document, trace.nodeIds, selectedNodeId);
    }
    const actors = new Set(selectedNode?.actorIds ?? []);
    return new Set(trace.nodes
      .filter((node) => node.id === selectedNodeId || node.actorIds.some((id) => actors.has(id)))
      .map((node) => node.id));
  }, [document, focusMode, selectedNode, selectedNodeId, trace]);

  const filteredProjection = useMemo(
    () => filterProjection(trace, {
      actorId: actorId || undefined,
      query: query || undefined,
      allowedNodeIds: focusIds,
    }),
    [trace, actorId, query, focusIds],
  );

  const selectedContext = useMemo(() => {
    if (!selectedNodeId) return { upstreamTitles: [], downstreamTitles: [], incomingLabels: [], outgoingLabels: [] };
    const byId = new Map(document.nodes.map((node) => [node.id, node]));
    const incoming = document.edges.filter((edge) => edge.target === selectedNodeId && trace.nodeIds.has(edge.source));
    const outgoing = document.edges.filter((edge) => edge.source === selectedNodeId && trace.nodeIds.has(edge.target));
    return {
      upstreamTitles: incoming.map((edge) => byId.get(edge.source)?.title).filter((title): title is string => Boolean(title)),
      downstreamTitles: outgoing.map((edge) => byId.get(edge.target)?.title).filter((title): title is string => Boolean(title)),
      incomingLabels: incoming.map((edge) => edge.label),
      outgoingLabels: outgoing.map((edge) => edge.label),
    };
  }, [document, selectedNodeId, trace.nodeIds]);

  function changePath(id: string) {
    setSelectedPathId(id);
    setSelectedNodeId(null);
    setFocusMode(null);
    setActorId('');
    setQuery('');
  }

  return (
    <section className="causal-workbench" aria-label="Causal Timeline Workbench">
      <CausalTimelineToolbar
        paths={paths}
        selectedPathId={selectedPath?.id ?? ''}
        actorIds={actorIds}
        actorId={actorId}
        query={query}
        compareEnabled={compareEnabled}
        onPathChange={changePath}
        onActorChange={setActorId}
        onQueryChange={setQuery}
        onCompareToggle={setCompareEnabled}
      />

      <CausalFocusControls
        selectedNodeId={selectedNodeId}
        activeMode={focusMode}
        onModeChange={setFocusMode}
      />

      <div className={selectedNode ? 'causal-workbench-layout has-inspector' : 'causal-workbench-layout'}>
        <CausalTimelineGraph
          document={document}
          projection={filteredProjection}
          selectedNodeId={selectedNodeId}
          onNodeSelect={(id) => {
            setSelectedNodeId(id);
            setFocusMode(null);
          }}
        />

        {selectedNode && (
          <div className="causal-inspector-drawer">
            <button
              type="button"
              className="causal-inspector-close"
              aria-label="Close node inspector"
              onClick={() => {
                setSelectedNodeId(null);
                setFocusMode(null);
              }}
            >
              ×
            </button>
            <NodeDetailPanel
              node={selectedNode}
              narrativeScenes={narrativeScenes}
              upstreamTitles={selectedContext.upstreamTitles}
              downstreamTitles={selectedContext.downstreamTitles}
              incomingLabels={selectedContext.incomingLabels}
              outgoingLabels={selectedContext.outgoingLabels}
            />
          </div>
        )}
      </div>

      {compareEnabled && (
        <WorldlineSetCompare
          document={document}
          paths={paths}
          selectedPathIds={comparePathIds}
          onSelectedPathIdsChange={setComparePathIds}
          onClose={() => setCompareEnabled(false)}
        />
      )}
    </section>
  );
}
