import { useEffect, useState } from 'react';
import { EventGraphView } from './components/EventGraphView';
import { TimelineView } from './components/TimelineView';
import { ViewTabs, type ViewName } from './components/ViewTabs';
import { WorldlineDiffView } from './components/WorldlineDiffView';
import worldlines from './fixtures/worldlines.json';
import { loadEventGraph } from './lib/loadStory';
import type { EventGraphDocument, WorldlineEntry } from './types/story';

export default function App() {
  const [view, setView] = useState<ViewName>('graph');
  const [document, setDocument] = useState<EventGraphDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEventGraph('/story/events/day_01_1831.yaml')
      .then(setDocument)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const loop04 = worldlines.loop04 as WorldlineEntry[];
  const loop05 = worldlines.loop05 as WorldlineEntry[];

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
      ) : !document ? (
        <section className="panel loading-state">載入劇情資料中…</section>
      ) : view === 'graph' ? (
        <EventGraphView document={document} />
      ) : view === 'timeline' ? (
        <TimelineView entries={loop04} />
      ) : (
        <WorldlineDiffView left={loop04} right={loop05} />
      )}
    </main>
  );
}
