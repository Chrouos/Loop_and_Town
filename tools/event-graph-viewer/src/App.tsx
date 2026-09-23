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
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadEventGraph('/story/events/day_01_1831.yaml'),
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
    const baseline = simulate({ definition, initialState, actions: [], until: '23:59' });
    const selected = simulate({ definition, initialState, actions: selectedActionIds, until: '23:59' });
    return {
      baseline,
      selected,
      timeline: projectTimelineEntries(selected.history),
      baselineEvents: projectWorldlineEvents(baseline.history),
      selectedEvents: projectWorldlineEvents(selected.history),
    };
  }, [definition, initialState, selectedActionIds]);

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
            selectedActionIds={selectedActionIds}
            onChange={setSelectedActionIds}
          />

          {view === 'graph' ? (
            <EventGraphView document={document} />
          ) : view === 'timeline' ? (
            <TimelineView entries={generated.timeline} loopLabel="目前世界線" />
          ) : (
            <WorldlineDiffView left={generated.baselineEvents} right={generated.selectedEvents} />
          )}
        </>
      )}
    </main>
  );
}
