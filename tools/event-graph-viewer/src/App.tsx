import { useEffect, useMemo, useState } from 'react';
import { EventGraphView } from './components/EventGraphView';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { StoryOrder } from './components/StoryOrder';
import { TimelineView } from './components/TimelineView';
import { ViewTabs, type ViewName } from './components/ViewTabs';
import { WorldlineDiffView } from './components/WorldlineDiffView';
import { loadEventGraph } from './lib/loadStory';
import { loadSimulationStory } from './lib/loadSimulationStory';
import { projectTimelineEntries } from './simulator/projection';
import { simulate } from './simulator/simulator';
import { formatTime, parseTime } from './simulator/time';
import type { ActionDefinition, SimulationDefinition, SimulationResult, WorldState } from './simulator/types';
import type { EventGraphDocument, WorldlineEntry } from './types/story';

type SimulationOutcome =
  | { ok: true; result: SimulationResult }
  | { ok: false; error: string };

function eventTime(title: string) {
  return title.match(/^\d{2}:\d{2}/)?.[0];
}

function actionMinute(at: unknown) {
  if (typeof at !== 'string') return Number.POSITIVE_INFINITY;
  try {
    return parseTime(at);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function selectedActionSequence(actions: ActionDefinition[], selectedIds: string[]) {
  const selected = new Set(selectedIds);
  return actions
    .map((action, sourceIndex) => ({ action, sourceIndex }))
    .filter(({ action }) => selected.has(action.id))
    .sort((left, right) => actionMinute(left.action.at) - actionMinute(right.action.at) || left.sourceIndex - right.sourceIndex)
    .map(({ action }) => action.id);
}

function actionMilestone(action: ActionDefinition): WorldlineEntry {
  const rawDuration = action.duration_minutes;
  const durationMinutes = typeof rawDuration === 'number' && Number.isInteger(rawDuration) && rawDuration >= 0
    ? rawDuration
    : undefined;
  let endTime: string | undefined;
  if (durationMinutes !== undefined) {
    try {
      endTime = formatTime(parseTime(action.at) + durationMinutes);
    } catch {
      endTime = undefined;
    }
  }

  return {
    time: typeof action.at === 'string' ? action.at : String(action.at ?? '未設定'),
    eventId: action.id,
    title: action.label,
    source: 'player',
    ...(durationMinutes === undefined ? {} : { durationMinutes }),
    ...(endTime === undefined ? {} : { endTime }),
  };
}

function readableSimulationError(reason: unknown, actions: ActionDefinition[]) {
  const message = reason instanceof Error ? reason.message : String(reason);
  const conflict = message.match(/^Action (.+) cannot start at (\d{2}:\d{2}) before current time (\d{2}:\d{2})$/);
  if (!conflict) return `模擬失敗：${message}`;

  const [, actionId, requestedTime, currentTime] = conflict;
  const actionLabel = actions.find((action) => action.id === actionId)?.label ?? actionId;
  return `「${actionLabel}」無法在 ${requestedTime} 開始；前一個行動會持續到 ${currentTime}。`;
}

function runSimulation(
  definition: SimulationDefinition,
  initialState: WorldState,
  actionIds: string[],
): SimulationOutcome {
  try {
    return {
      ok: true,
      result: simulate({ definition, initialState, actions: actionIds, until: '23:59' }),
    };
  } catch (reason) {
    return { ok: false, error: readableSimulationError(reason, definition.actions) };
  }
}

export default function App() {
  const [view, setView] = useState<ViewName>('timeline');
  const [document, setDocument] = useState<EventGraphDocument | null>(null);
  const [definition, setDefinition] = useState<SimulationDefinition | null>(null);
  const [initialState, setInitialState] = useState<WorldState | null>(null);
  const [leftDraftActionIds, setLeftDraftActionIds] = useState<string[]>([]);
  const [rightDraftActionIds, setRightDraftActionIds] = useState<string[]>([]);
  const [appliedActionIds, setAppliedActionIds] = useState<{ left: string[]; right: string[] }>({
    left: [],
    right: [],
  });
  const [loadError, setLoadError] = useState<string | null>(null);

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
      .catch((reason: unknown) => setLoadError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const generated = useMemo(() => {
    if (!definition || !initialState) return null;
    const left = runSimulation(definition, initialState, selectedActionSequence(definition.actions, appliedActionIds.left));
    const right = runSimulation(definition, initialState, selectedActionSequence(definition.actions, appliedActionIds.right));
    const leftTimeline = left.ok ? projectTimelineEntries(left.result.history) : [];
    const rightTimeline = right.ok ? projectTimelineEntries(right.result.history) : [];
    const storyMilestones: WorldlineEntry[] = [
      ...leftTimeline,
      ...rightTimeline,
      ...definition.actions.map(actionMilestone),
      ...definition.events.map((event) => ({
        time: event.at ?? eventTime(event.title) ?? '00:00',
        eventId: event.id,
        title: event.title,
        source: 'event' as const,
      })),
    ];
    const causalOutcomes = definition.actions.map((action) => ({
      action,
      outcome: runSimulation(definition, initialState, [action.id]),
    }));
    const causalBranches = causalOutcomes.flatMap(({ action, outcome }) => outcome.ok ? [{
      action,
      entries: projectTimelineEntries(outcome.result.history).filter((entry) => entry.source !== 'player'),
    }] : []);
    const causalErrors = causalOutcomes.flatMap(({ action, outcome }) => outcome.ok
      ? []
      : [{ actionId: action.id, error: outcome.error }]);
    return {
      leftTimeline,
      rightTimeline,
      storyMilestones,
      causalBranches,
      causalErrors,
      leftError: left.ok ? undefined : left.error,
      rightError: right.ok ? undefined : right.error,
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
          <p className="eyebrow">灰潮鎮 · 故事模擬器</p>
          <h1>主線世界線</h1>
          <p className="loaded">第 1 天 · 18:20 開始 · deterministic simulation</p>
        </div>
        <ViewTabs value={view} onChange={setView} />
      </header>

      {loadError ? (
        <section className="panel error-state">
          <h2>無法載入故事資料</h2>
          <p>{loadError}</p>
        </section>
      ) : !document || !definition || !initialState || !generated ? (
        <section className="panel loading-state">載入劇情資料中…</section>
      ) : (
        <>
          {view === 'timeline' && <StoryOrder entries={generated.storyMilestones} />}

          <ScenarioSimulator
            actions={definition.actions}
            leftActionIds={leftDraftActionIds}
            rightActionIds={rightDraftActionIds}
            leftError={generated.leftError}
            rightError={generated.rightError}
            onLeftChange={setLeftDraftActionIds}
            onRightChange={setRightDraftActionIds}
            onSimulate={simulateDrafts}
          />

          {view === 'graph' ? (
            <>
              <EventGraphView document={document} branches={generated.causalBranches} />
              {generated.causalErrors.length > 0 && (
                <section className="panel simulation-errors" aria-label="事件圖模擬錯誤">
                  {generated.causalErrors.map(({ actionId, error }) => (
                    <p key={actionId} role="alert">{error}</p>
                  ))}
                </section>
              )}
            </>
          ) : view === 'timeline' ? (
            <TimelineView leftEntries={generated.leftTimeline} rightEntries={generated.rightTimeline} />
          ) : (
            <WorldlineDiffView left={generated.leftTimeline} right={generated.rightTimeline} />
          )}
        </>
      )}
    </main>
  );
}
