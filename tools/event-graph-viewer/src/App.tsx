import { useEffect, useMemo, useState } from 'react';
import { EventGraphView } from './components/EventGraphView';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { TimelineView } from './components/TimelineView';
import { ViewTabs, type ViewName } from './components/ViewTabs';
import { WorldlineDiffView } from './components/WorldlineDiffView';
import { loadEventGraph } from './lib/loadStory';
import { loadSimulationStory } from './lib/loadSimulationStory';
import { projectTimelineEntries, projectWorldlineEvents } from './simulator/projection';
import { simulate } from './simulator/simulator';
import type { SimulationDefinition, WorldState } from './simulator/types';
import type { EventGraphDocument } from './types/story';

export default function App() {
  const [view, setView] = useState<ViewName>('graph');
  const [document, setDocument] = useState<EventGraphDocument | null>(null);
  const [definition, setDefinition] = useState<SimulationDefinition | null>(null);
  const [initialState, setInitialState] = useState<WorldState | null>(null);
  const [leftDraftActionIds, setLeftDraftActionIds] = useState<string[]>([]);
  const [rightDraftActionIds, setRightDraftActionIds] = useState<string[]>([]);
  const [appliedActionIds, setAppliedActionIds] = useState<{ left: string[]; right: string[] }>({
    left: [],
    right: [],
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadEventGraph('story/events/day_01_1831.yaml'),
      loadSimulationStory(),
    ])
      .then(([graph, simulationStory]) => {
        setDocument(graph);
        setDefinition(simulationStory.definition);
        setInitialState(simulationStory.initialState);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const generated = useMemo(() => {
    if (!definition || !initialState) return null;
    const left = simulate({ definition, initialState, actions: appliedActionIds.left, until: '23:59' });
    const right = simulate({ definition, initialState, actions: appliedActionIds.right, until: '23:59' });
    return {
      left,
      right,
      timeline: projectTimelineEntries(right.history),
      leftEvents: projectWorldlineEvents(left.history),
      rightEvents: projectWorldlineEvents(right.history),
    };
  }, [definition, initialState, appliedActionIds]);

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
          {document && <p className="loaded">Loaded: {document.id} / {document.title}</p>}
        </div>
        <ViewTabs value={view} onChange={setView} />
      </header>

      {error ? (
        <section className="panel error-state">
          <h2>無法載入 Event Graph</h2>
          <p>{error}</p>
        </section>
      ) : !document || !definition || !initialState || !generated ? (
        <section className="panel loading-state">載入劇情資料中…</section>
      ) : (
        <>
          <ScenarioSimulator
            actions={definition.actions}
            leftActionIds={leftDraftActionIds}
            rightActionIds={rightDraftActionIds}
            onLeftChange={setLeftDraftActionIds}
            onRightChange={setRightDraftActionIds}
            onSimulate={simulateDrafts}
          />

          {view === 'graph' ? (
            <EventGraphView document={document} />
          ) : view === 'timeline' ? (
            <TimelineView entries={generated.timeline} loopLabel="世界線 B" />
          ) : (
            <WorldlineDiffView left={generated.leftEvents} right={generated.rightEvents} />
          )}
        </>
      )}
    </main>
  );
}
