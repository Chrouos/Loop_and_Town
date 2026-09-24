import { useEffect, useMemo, useState } from 'react';
import { CharacterGraphView } from './components/CharacterGraphView';
import { EventGraphView } from './components/EventGraphView';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { TimelineView } from './components/TimelineView';
import { ViewTabs, type ViewName } from './components/ViewTabs';
import { WorldlineDiffView } from './components/WorldlineDiffView';
import { loadSimulationStory, type StoryBundle } from './lib/loadSimulationStory';
import { projectTimelineEntries } from './simulator/projection';
import { projectStoryGraph } from './simulator/storyGraph';
import { simulateStory } from './simulator/storySimulation';
import { compareWorldlines } from './simulator/worldlineDiff';

export default function App() {
  const [view, setView] = useState<ViewName>('graph');
  const [story, setStory] = useState<StoryBundle | null>(null);
  const [leftDraftActionIds, setLeftDraftActionIds] = useState<string[]>([]);
  const [rightDraftActionIds, setRightDraftActionIds] = useState<string[]>([]);
  const [appliedActionIds, setAppliedActionIds] = useState<{ left: string[]; right: string[] }>({ left: [], right: [] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSimulationStory('/story/manifests/loop_01.yaml')
      .then(setStory)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const graphProjection = useMemo(() => story ? projectStoryGraph(story) : null, [story]);
  const generated = useMemo(() => {
    if (!story) return null;
    const left = simulateStory({ story, actionIds: appliedActionIds.left });
    const right = simulateStory({ story, actionIds: appliedActionIds.right });
    return { left, right, timeline: projectTimelineEntries(right.fullHistory), diffRows: compareWorldlines(left, right, 'author') };
  }, [story, appliedActionIds]);

  function simulateDrafts() {
    setAppliedActionIds({ left: [...leftDraftActionIds], right: [...rightDraftActionIds] });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">灰潮鎮 · Narrative Debug Tool</p>
          <h1>Event Graph Viewer</h1>
          {story && <p className="loaded">Loaded: {story.loop.id} / {story.definition.events.length} events · {story.definition.actions.length} actions</p>}
        </div>
        <ViewTabs value={view} onChange={setView} />
      </header>
      {error ? (
        <section className="panel error-state"><h2>無法載入 Event Graph</h2><p>{error}</p></section>
      ) : !story || !graphProjection || !generated ? (
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
            <EventGraphView projection={graphProjection} />
          ) : view === 'characters' ? (
            <CharacterGraphView story={story.narrative} />
          ) : view === 'timeline' ? (
            <TimelineView entries={generated.timeline} loopLabel="世界線 B · Author History" />
          ) : (
            <WorldlineDiffView rows={generated.diffRows} />
          )}
        </>
      )}
    </main>
  );
}
