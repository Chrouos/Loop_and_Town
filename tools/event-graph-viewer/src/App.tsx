import { useEffect, useMemo, useState } from 'react';
import yaml from 'js-yaml';
import { CharacterGraphView } from './components/CharacterGraphView';
import { CausalTimelineWorkbench } from './components/CausalTimelineWorkbench';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { TimelineView } from './components/TimelineView';
import { ViewTabs, type ViewName } from './components/ViewTabs';
import { WorldlineDiffView } from './components/WorldlineDiffView';
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

function mergeStoryDags(base: StoryDagDocument, addendum: StoryDagDocument): StoryDagDocument {
  return {
    ...base,
    nodes: [...base.nodes, ...addendum.nodes],
    edges: [...base.edges, ...addendum.edges],
  };
}

function mergeStoryPaths(base: StoryWorldlinePath[], addendum: StoryWorldlinePath[]): StoryWorldlinePath[] {
  const replacementIds = new Set(addendum.map((path) => path.id));
  return [...base.filter((path) => !replacementIds.has(path.id)), ...addendum];
}

export default function App() {
  const [view, setView] = useState<ViewName>('graph');
  const [story, setStory] = useState<StoryBundle | null>(null);
  const [storyDag, setStoryDag] = useState<StoryDagDocument | null>(null);
  const [storyPaths, setStoryPaths] = useState<StoryWorldlinePath[]>([]);
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
      fetchText('story/narrative/loop_03_player.yaml').then(parseNarrativeAddendum),
      fetchText('story/events/loop_03_story_dag.yaml').then(parseStoryDagText),
      fetchText('story/worldlines/loop_03_paths.yaml').then(parseStoryWorldlinePathsText),
      fetchText('story/narrative/loop_04_player.yaml').then(parseNarrativeAddendum),
      fetchText('story/events/loop_04_story_dag.yaml').then(parseStoryDagText),
      fetchText('story/worldlines/loop_04_paths.yaml').then(parseStoryWorldlinePathsText),
      fetchText('story/narrative/loop_05_player.yaml').then(parseNarrativeAddendum),
      fetchText('story/events/loop_05_story_dag.yaml').then(parseStoryDagText),
      fetchText('story/worldlines/loop_05_paths.yaml').then(parseStoryWorldlinePathsText),
      fetchText('story/narrative/loop_06_player.yaml').then(parseNarrativeAddendum),
      fetchText('story/events/loop_06_story_dag.yaml').then(parseStoryDagText),
      fetchText('story/worldlines/loop_06_paths.yaml').then(parseStoryWorldlinePathsText),
      fetchText('story/narrative/loop_07_player.yaml').then(parseNarrativeAddendum),
      fetchText('story/events/loop_07_story_dag.yaml').then(parseStoryDagText),
      fetchText('story/worldlines/loop_07_paths.yaml').then(parseStoryWorldlinePathsText),
      fetchText('story/narrative/final_player.yaml').then(parseNarrativeAddendum),
      fetchText('story/events/final_story_dag.yaml').then(parseStoryDagText),
      fetchText('story/worldlines/final_paths.yaml').then(parseStoryWorldlinePathsText),
    ])
      .then(([
        loadedStory,
        dag,
        paths,
        loop02Scenes,
        loop03Scenes,
        loop03Dag,
        loop03Paths,
        loop04Scenes,
        loop04Dag,
        loop04Paths,
        loop05Scenes,
        loop05Dag,
        loop05Paths,
        loop06Scenes,
        loop06Dag,
        loop06Paths,
        loop07Scenes,
        loop07Dag,
        loop07Paths,
        finalScenes,
        finalDag,
        finalPaths,
      ]) => {
        loadedStory.narrative.scenes.push(
          ...loop02Scenes,
          ...loop03Scenes,
          ...loop04Scenes,
          ...loop05Scenes,
          ...loop06Scenes,
          ...loop07Scenes,
          ...finalScenes,
        );
        const dagWithLoop03 = mergeStoryDags(dag, loop03Dag);
        const dagWithLoop04 = mergeStoryDags(dagWithLoop03, loop04Dag);
        const dagWithLoop05 = mergeStoryDags(dagWithLoop04, loop05Dag);
        const dagWithLoop06 = mergeStoryDags(dagWithLoop05, loop06Dag);
        const dagWithLoop07 = mergeStoryDags(dagWithLoop06, loop07Dag);
        const allDag = mergeStoryDags(dagWithLoop07, finalDag);
        const pathsWithLoop03 = mergeStoryPaths(paths, loop03Paths);
        const pathsWithLoop04 = mergeStoryPaths(pathsWithLoop03, loop04Paths);
        const pathsWithLoop05 = mergeStoryPaths(pathsWithLoop04, loop05Paths);
        const pathsWithLoop06 = mergeStoryPaths(pathsWithLoop05, loop06Paths);
        const pathsWithLoop07 = mergeStoryPaths(pathsWithLoop06, loop07Paths);
        const allPaths = mergeStoryPaths(pathsWithLoop07, finalPaths);

        setStory(loadedStory);
        setStoryDag(allDag);
        setStoryPaths(allPaths);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

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

  const showSimulator = view === 'timeline' || view === 'diff';

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">灰潮鎮 · Narrative Debug Tool</p>
          <h1>Causal Timeline Workbench</h1>
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
          {showSimulator && (
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
            <CausalTimelineWorkbench
              document={storyDag}
              paths={storyPaths}
              narrativeScenes={story.narrative.scenes}
            />
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
