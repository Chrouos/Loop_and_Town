import { useEffect, useMemo, useState } from 'react';
import yaml from 'js-yaml';
import { CharacterGraphView } from './components/CharacterGraphView';
import { EventGraphView } from './components/EventGraphView';
import { NodeDetailPanel } from './components/NodeDetailPanel';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { TimelineView } from './components/TimelineView';
import { ViewTabs, type ViewName } from './components/ViewTabs';
import { WorldlineDiffView } from './components/WorldlineDiffView';
import { WorldlinePathSelector } from './components/WorldlinePathSelector';
import { parseStoryDagText, parseStoryWorldlinePathsText } from './lib/loadStory';
import { loadSimulationStory, type StoryBundle } from './lib/loadSimulationStory';
import type { NarrativeSceneDefinition } from './narrative/types';
import { projectTimelineEntries } from './simulator/projection';
import { simulateStory } from './simulator/storySimulation';
import { compareWorldlines } from './simulator/worldlineDiff';
import type { StoryDagDocument, StoryWorldlinePath } from './types/story';

async function fetchText(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
  return response.text();
}

function parseNarrativeAddendum(text: string): NarrativeSceneDefinition[] {
  const raw = yaml.load(text) as { scenes?: NarrativeSceneDefinition[] } | undefined;
  if (!raw || !Array.isArray(raw.scenes)) throw new Error('Invalid narrative addendum');
  return raw.scenes;
}

export default function App() {
  const [view, setView] = useState<ViewName>('graph');
  const [story, setStory] = useState<StoryBundle | null>(null);
  const [storyDag, setStoryDag] = useState<StoryDagDocument | null>(null);
  const [storyPaths, setStoryPaths] = useState<StoryWorldlinePath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState('loop_01_baseline');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [leftDraftActionIds, setLeftDraftActionIds] = useState<string[]>([]);
  const [rightDraftActionIds, setRightDraftActionIds] = useState<string[]>([]);
  const [appliedActionIds, setAppliedActionIds] = useState<{ left: string[]; right: string[] }>({
    left: [],
    right: [],
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadSimulationStory('story/manifests/loop_01.yaml'),
      fetchText('story/events/day_01_story_dag.yaml').then(parseStoryDagText),
      fetchText('story/worldlines/day_01_paths.yaml').then(parseStoryWorldlinePathsText),
      fetchText('story/narrative/loop_02_player.yaml').then(parseNarrativeAddendum),
    ])
      .then(([loadedStory, dag, paths, loop02Scenes]) => {
        loadedStory.narrative.scenes.push(...loop02Scenes);
        setStory(loadedStory);
        setStoryDag(dag);
        setStoryPaths(paths);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const selectedPath = useMemo(
    () => storyPaths.find((path) => path.id === selectedPathId),
    [storyPaths, selectedPathId],
  );
  const activeNodeIds = useMemo(
    () => selectedPath ? new Set(selectedPath.nodeIds) : undefined,
    [selectedPath],
  );
  const activeEdgeIds = useMemo(
    () => selectedPath ? new Set(selectedPath.edgeIds) : undefined,
    [selectedPath],
  );
  const selectedNode = useMemo(
    () => storyDag?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [storyDag, selectedNodeId],
  );
  const downstreamTitles = useMemo(() => {
    if (!storyDag || !selectedNodeId) return [];
    const targetIds = storyDag.edges
      .filter((edge) => edge.source === selectedNodeId)
      .map((edge) => edge.target);
    return targetIds
      .map((id) => storyDag.nodes.find((node) => node.id === id)?.title)
      .filter((title): title is string => Boolean(title));
  }, [storyDag, selectedNodeId]);

  const generated = useMemo(() => {
    if (!story) return null;
    const left = simulateStory({ story, actionIds: appliedActionIds.left });
    const right = simulateStory({ story, actionIds: appliedActionIds.right });
    return {
      left,
      right,
      leftTimeline: projectTimelineEntries(left.fullHistory),
      rightTimeline: projectTimelineEntries(right.fullHistory),
      diffRows: compareWorldlines(left, right, 'author'),
    };
  }, [story, appliedActionIds]);

  function simulateDrafts() {
    setAppliedActionIds({
      left: [...leftDraftActionIds],
      right: [...rightDraftActionIds],
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">灰潮鎮 · Narrative Debug Tool</p>
          <h1>Event Graph Viewer</h1>
          {story && storyDag && (
            <p className="loaded">
              Loaded: {story.loop.id} / {storyDag.nodes.length} causal nodes · {storyDag.edges.length} causal edges
            </p>
          )}
        </div>
        <ViewTabs value={view} onChange={setView} />
      </header>

      {error ? (
        <section className="panel error-state">
          <h2>無法載入 Event Graph</h2>
          <p>{error}</p>
        </section>
      ) : !story || !storyDag || !generated ? (
        <section className="panel loading-state">載入劇情資料中…</section>
      ) : (
        <>
          {view !== 'characters' && (
            <ScenarioSimulator
              actions={story.definition.actions}
              leftActionIds={leftDraftActionIds}
              rightActionIds={rightDraftActionIds}
              onLeftChange={setLeftDraftActionIds}
              onRightChange={setRightDraftActionIds}
              onSimulate={simulateDrafts}
            />
          )}

          {view === 'graph' ? (
            <>
              <WorldlinePathSelector
                paths={storyPaths}
                selectedId={selectedPathId}
                onChange={setSelectedPathId}
                mode="author"
              />
              <div className="story-dag-reader-layout">
                <EventGraphView
                  dagDocument={storyDag}
                  onNodeSelect={setSelectedNodeId}
                  activeNodeIds={activeNodeIds}
                  activeEdgeIds={activeEdgeIds}
                />
                {selectedNode && (
                  <NodeDetailPanel
                    node={selectedNode}
                    narrativeScenes={story.narrative.scenes}
                    downstreamTitles={downstreamTitles}
                  />
                )}
              </div>
            </>
          ) : view === 'characters' ? (
            <CharacterGraphView story={story.narrative} />
          ) : view === 'timeline' ? (
            <TimelineView leftEntries={generated.leftTimeline} rightEntries={generated.rightTimeline} />
          ) : (
            <WorldlineDiffView rows={generated.diffRows} />
          )}
        </>
      )}
    </main>
  );
}
