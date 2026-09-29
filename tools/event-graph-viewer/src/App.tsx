import { useEffect, useMemo, useState } from 'react';
import { CharacterGraphView } from './components/CharacterGraphView';
import { CausalTimelineWorkbench } from './components/CausalTimelineWorkbench';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { TimelineView } from './components/TimelineView';
import { ViewTabs, type ViewName } from './components/ViewTabs';
import { WorldlineDiffView } from './components/WorldlineDiffView';
import { loadAuthorStoryBundle } from './lib/loadAuthorStoryBundle';
import { projectTimelineEntries } from './simulator/projection';
import { simulateStory } from './simulator/storySimulation';
import { compareWorldlines } from './simulator/worldlineDiff';
import type { StoryDagDocument } from './types/story';
import type { AuthorStoryBundle } from './types/storyBundle';

function mergeStoryDags(documents: StoryDagDocument[]): StoryDagDocument {
  return {
    id: 'complete-story-dag',
    title: '灰潮鎮完整因果 DAG',
    nodes: documents.flatMap((document) => document.nodes),
    edges: documents.flatMap((document) => document.edges),
  };
}

export default function App() {
  const [view, setView] = useState<ViewName>('graph');
  const [bundle, setBundle] = useState<AuthorStoryBundle | null>(null);
  const [leftDraftActionIds, setLeftDraftActionIds] = useState<string[]>([]);
  const [rightDraftActionIds, setRightDraftActionIds] = useState<string[]>([]);
  const [appliedActionIds, setAppliedActionIds] = useState<{ left: string[]; right: string[] }>({ left: [], right: [] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAuthorStoryBundle('story/manifests/loop_01.yaml')
      .then(setBundle)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const story = bundle?.simulation ?? null;
  const storyDag = useMemo(() => bundle ? mergeStoryDags(bundle.storyDags) : null, [bundle]);
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
    setAppliedActionIds({ left: [...leftDraftActionIds], right: [...rightDraftActionIds] });
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
        <section className="panel error-state"><h2>無法載入 Event Graph</h2><p>{error}</p></section>
      ) : !bundle || !story || !storyDag || !generated ? (
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
              paths={bundle.worldlinePaths}
              narrativeScenes={bundle.narratives}
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
