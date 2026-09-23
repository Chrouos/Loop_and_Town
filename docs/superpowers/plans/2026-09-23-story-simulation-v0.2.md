# Story Simulation v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first executable Loop 01 story model so the repository can deterministically simulate WL-00 through WL-07, expose full and player-safe histories, generate the complete author Story Graph, and compare worldlines before any Player Game work begins.

**Architecture:** Extend the existing Worldline Simulator instead of replacing it. YAML remains the story source of truth; runtime layers add cross-day time, NPC base schedules, visibility-aware history, chronological orchestration, manifest loading, named-worldline simulation, graph projection, and worldline diff. The existing React Event Graph Viewer remains an author/debug surface only.

**Tech Stack:** TypeScript 5.6, Vitest 2, React 18, Vite 5, js-yaml 4, @xyflow/react 12.

**Spec:** `docs/superpowers/specs/2026-09-23-first-loop-story-graph-v0.2-design.md`

## Global Constraints

- Loop 01 is Day 0 14:20 → Day 1 00:00, end inclusive.
- Loop is a time range, not a synonym for one day.
- Legacy `at: "HH:mm"` means Day 0 and remains valid.
- Runtime ordering uses absolute minutes.
- Same-minute precedence is `Schedule → Event → Player Action`; ties inside one class are stable.
- Authored Base Schedules are immutable; interventions mutate state and `when` decides which entries apply.
- Hidden/debug history is available to author tooling but never Player History or Player Diff.
- Player actions mutate state only; they never choose an event variant directly.
- `wakaharu_dies` must not trigger the reporter disappearance.
- No Player Game UI, real-time replay, offline catch-up, loop reset runtime, Loop 02, relationship engine, Evidence Board, or cross-loop persistence.
- Story acceptance tests load the real `story/*.yaml` source files.

## Review Focus

1. **Range boundary:** Day 1 00:00 executes; any authored scheduled item after the Loop end fails validation. Covered by Task 1.
2. **Schedule skip safety:** `when=false` records an author-only skipped row and performs zero state mutations. Covered by Tasks 2–3.
3. **Same-minute determinism:** Schedule → Event → Action, with caller order for same-minute actions. Covered by Task 4.
4. **Visibility safety:** hidden/debug rows never enter Player History or Player Diff. Covered by Tasks 3 and 12.
5. **Causal independence:** changing the 18:31 victim does not change the reporter chain unless reporter conditions change. Covered by Tasks 8 and 10.

---

## Locked File Structure

### Runtime
- Modify `tools/event-graph-viewer/src/simulator/types.ts`
- Modify `tools/event-graph-viewer/src/simulator/time.ts`
- Modify `tools/event-graph-viewer/src/simulator/eventQueue.ts`
- Create `tools/event-graph-viewer/src/simulator/schedule.ts`
- Modify `tools/event-graph-viewer/src/simulator/simulator.ts`
- Modify `tools/event-graph-viewer/src/simulator/projection.ts`
- Modify `tools/event-graph-viewer/src/simulator/validation.ts`
- Create `tools/event-graph-viewer/src/simulator/storySimulation.ts`
- Create `tools/event-graph-viewer/src/simulator/storyGraph.ts`
- Create `tools/event-graph-viewer/src/simulator/worldlineDiff.ts`

### Loading / Author Viewer
- Modify `tools/event-graph-viewer/src/lib/loadSimulationStory.ts`
- Modify `tools/event-graph-viewer/src/types/story.ts`
- Modify `tools/event-graph-viewer/src/components/EventGraphView.tsx`
- Modify `tools/event-graph-viewer/src/App.tsx`
- Modify `tools/event-graph-viewer/scripts/sync-story.mjs`

### Story Source
- Create `story/manifests/loop_01.yaml`
- Create `story/loops/loop_01.yaml`
- Create `story/world/loop_01_initial.yaml`
- Create `story/schedules/{wakaharu,doctor,reporter,yuan}.yaml`
- Create `story/actions/loop_01_actions.yaml`
- Create the Loop 01 event files specified by the design under `story/events/`
- Create `story/worldlines/loop_01_worldlines.yaml`

---

### Task 1: StoryTime + Loop Range

**Files:**
- Modify: `tools/event-graph-viewer/src/simulator/types.ts`
- Modify: `tools/event-graph-viewer/src/simulator/time.ts`
- Modify: `tools/event-graph-viewer/src/simulator/validation.ts`
- Create: `tools/event-graph-viewer/tests/storyTime.test.ts`

**Interfaces:**
- Produces `StoryTime`, `StoryTimeInput`, `LoopDefinition`.
- Produces `toAbsoluteMinute(input)`, `fromAbsoluteMinute(value)`, `formatStoryTime(input)`.
- Changes all authored `at` fields and `simulate(...until)` to `StoryTimeInput`.

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, it } from 'vitest';
import { fromAbsoluteMinute, toAbsoluteMinute } from '../src/simulator/time';

it('orders midnight across days', () => {
  expect(toAbsoluteMinute({ day: 0, time: '23:59' })).toBe(1439);
  expect(toAbsoluteMinute({ day: 1, time: '00:00' })).toBe(1440);
});

it('keeps the legacy string syntax on day zero', () => {
  expect(toAbsoluteMinute('18:31')).toBe(1111);
});

it('round-trips absolute minutes', () => {
  expect(fromAbsoluteMinute(1440)).toEqual({ day: 1, time: '00:00' });
});

it('rejects a negative story day', () => {
  expect(() => toAbsoluteMinute({ day: -1, time: '12:00' })).toThrow('Invalid story day');
});
```

Add this exact range test after `validateDefinition` accepts a loop argument:

```ts
it('rejects scheduled content after the inclusive loop end', () => {
  expect(() => validateDefinition(definitionWithEventAt({ day: 1, time: '00:01' }), initialState, {
    id: 'loop', range: { start: { day: 0, time: '14:20' }, end: { day: 1, time: '00:00' } },
  })).toThrow('Scheduled item outside loop range');
});
```

Define `definitionWithEventAt` locally in the test as a minimal definition containing one fallback event at the supplied time.

- [ ] **Step 2: Verify RED**

```bash
cd tools/event-graph-viewer
npm test -- storyTime.test.ts
```

Expected: FAIL because cross-day types/functions do not exist.

- [ ] **Step 3: Implement the minimal time model**

```ts
export interface StoryTime { day: number; time: string }
export type StoryTimeInput = string | StoryTime;
export interface LoopDefinition {
  id: string;
  range: { start: StoryTimeInput; end: StoryTimeInput };
}

export function toAbsoluteMinute(input: StoryTimeInput): number {
  const value = typeof input === 'string' ? { day: 0, time: input } : input;
  if (!Number.isInteger(value.day) || value.day < 0) throw new Error(`Invalid story day: ${value.day}`);
  return value.day * 1440 + parseTime(value.time);
}

export function fromAbsoluteMinute(value: number): StoryTime {
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid absolute minute: ${value}`);
  return { day: Math.floor(value / 1440), time: formatTime(value % 1440) };
}
```

Validation compares loop start/end and every authored scheduled time using absolute minutes.

- [ ] **Step 4: Verify GREEN + regressions**

```bash
npm test -- storyTime.test.ts simulator.test.ts eventQueue.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator/{types.ts,time.ts,validation.ts} tools/event-graph-viewer/tests/storyTime.test.ts
git commit -m "feat: add cross-day story time"
```

---

### Task 2: NPC Base Schedule Runtime

**Files:**
- Modify: `tools/event-graph-viewer/src/simulator/types.ts`
- Modify: `tools/event-graph-viewer/src/simulator/eventQueue.ts`
- Modify: `tools/event-graph-viewer/src/simulator/validation.ts`
- Create: `tools/event-graph-viewer/src/simulator/schedule.ts`
- Create: `tools/event-graph-viewer/tests/schedule.test.ts`

**Interfaces:**
- Produces `Visibility`, `ScheduleDefinition`, `ScheduleEntryDefinition`, `ScheduleQueueItem`.
- Produces `resolveScheduleEntry(context, entry)` → `{ status, changes }`.

- [ ] **Step 1: Write the failing tests with local fixtures**

```ts
import { expect, it } from 'vitest';
import { resolveScheduleEntry } from '../src/simulator/schedule';

const entry = {
  id: 'doctor_leave_hospital',
  at: { day: 0, time: '17:40' },
  visibility: 'hidden' as const,
  when: { path: 'characters.doctor.route', op: 'eq' as const, value: 'old_station' },
  effects: [{ set: { path: 'characters.doctor.location', value: 'road_to_old_station' } }],
};

function makeContext(route: string) {
  return {
    state: { characters: { doctor: { route, location: 'hospital' } } },
    queue: { enqueue: () => { throw new Error('not used'); } },
    events: new Map(),
    currentMinute: 1060,
  };
}

it('applies effects when the schedule condition is true', () => {
  const ctx = makeContext('old_station');
  expect(resolveScheduleEntry(ctx, entry).status).toBe('applied');
  expect(ctx.state.characters.doctor.location).toBe('road_to_old_station');
});

it('skips without mutating when the condition is false', () => {
  const ctx = makeContext('stay_hospital');
  const result = resolveScheduleEntry(ctx, entry);
  expect(result).toEqual({ status: 'skipped', changes: [] });
  expect(ctx.state.characters.doctor.location).toBe('hospital');
});
```

Add a queue test enqueuing two same-minute schedule items and assert dequeue order matches insertion order.

- [ ] **Step 2: Verify RED**

```bash
npm test -- schedule.test.ts eventQueue.test.ts
```

Expected: FAIL because schedule items are unsupported.

- [ ] **Step 3: Implement schedule types, queue item, resolver, validation**

```ts
export type Visibility = 'observable' | 'hidden' | 'debug';
export type ScheduleEntryDefinition = {
  id: string;
  at: StoryTimeInput;
  visibility: Visibility;
  when?: Condition;
  effects: Effect[];
};
export type ScheduleDefinition = { characterId: string; entries: ScheduleEntryDefinition[] };
```

`resolveScheduleEntry` calls `evaluateCondition` when `when` exists and `executeEffects` only when applied.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- schedule.test.ts eventQueue.test.ts conditionEvaluator.test.ts eventResolver.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator tools/event-graph-viewer/tests/schedule.test.ts
git commit -m "feat: add deterministic npc schedules"
```

---

### Task 3: Full History vs Player History

**Files:**
- Modify: `tools/event-graph-viewer/src/simulator/types.ts`
- Modify: `tools/event-graph-viewer/src/simulator/projection.ts`
- Create: `tools/event-graph-viewer/tests/visibilityProjection.test.ts`

**Interfaces:**
- Extends history with `day`, `absoluteMinute`, `visibility`, `scheduleEntryId`, `scheduleStatus`.
- Produces `projectPlayerHistory(history)`.

- [ ] **Step 1: Write the failing visibility tests**

```ts
import { expect, it } from 'vitest';
import { projectPlayerHistory } from '../src/simulator/projection';
import type { WorldlineHistoryEntry } from '../src/simulator/types';

function row(sequence: number, visibility: 'observable' | 'hidden' | 'debug', title: string): WorldlineHistoryEntry {
  return {
    sequence, day: 0, time: '17:30', absoluteMinute: 1050,
    kind: 'event', visibility, title,
  };
}

it('filters hidden and debug truth from player history', () => {
  expect(projectPlayerHistory([
    row(0, 'observable', '回到灰潮鎮'),
    row(1, 'hidden', 'reporter_return_hotel'),
    row(2, 'debug', 'condition matched'),
  ]).map(x => x.title)).toEqual(['回到灰潮鎮']);
});
```

Add a schedule-skipped row with `visibility: hidden` and assert it is absent from Player History.

- [ ] **Step 2: Verify RED**

```bash
npm test -- visibilityProjection.test.ts
```

- [ ] **Step 3: Implement history fields and player projection**

```ts
export function projectPlayerHistory(history: WorldlineHistoryEntry[]): WorldlineHistoryEntry[] {
  return history.filter(entry => entry.visibility === 'observable' && entry.kind !== 'effect');
}
```

Keep full history append-only and preserve all hidden/skipped rows there.

- [ ] **Step 4: Verify GREEN + existing projections**

```bash
npm test -- visibilityProjection.test.ts projection.test.ts timeline.test.ts worldlineDiff.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator/{types.ts,projection.ts} tools/event-graph-viewer/tests/visibilityProjection.test.ts
git commit -m "feat: separate author and player history"
```

---

### Task 4: Chronological Orchestration

**Files:**
- Modify: `tools/event-graph-viewer/src/simulator/simulator.ts`
- Modify: `tools/event-graph-viewer/src/simulator/eventQueue.ts`
- Modify: `tools/event-graph-viewer/src/simulator/effectExecutor.ts`
- Create: `tools/event-graph-viewer/tests/storyOrchestration.test.ts`

**Interfaces:**
- `SimulationDefinition` gains `loop` and `schedules`.
- `simulate(...until)` accepts `StoryTimeInput`.
- One-shot simulation groups actions by absolute minute and runs queued schedule/event work at that minute before actions.

- [ ] **Step 1: Write the failing same-minute ordering test**

```ts
it('orders schedule then event then action at the same minute', () => {
  const initialState = { clock: { day: 0, time: '14:20' }, flags: { scheduled: false, evented: false, acted: false } };
  const definition = {
    loop: { id: 'loop', range: { start: '14:20', end: '15:00' } },
    schedules: [{ characterId: 'x', entries: [{
      id: 'schedule_1500', at: '15:00', visibility: 'observable', effects: [{ add_flag: 'flags.scheduled' }],
    }] }],
    events: [{ id: 'event_1500', title: 'event_1500', at: '15:00', visibility: 'observable', variants: [{
      id: 'resolved', priority: 0, fallback: true, effects: [{ add_flag: 'flags.evented' }],
    }] }],
    actions: [{ id: 'action_1500', at: '15:00', label: 'action_1500', effects: [{ add_flag: 'flags.acted' }] }],
  };
  const result = simulate({ definition, initialState, actions: ['action_1500'], until: '15:00' });
  expect(result.history.filter(x => x.kind !== 'effect').map(x => x.kind)).toEqual(['schedule', 'event', 'player-action']);
});
```

Add two actions at 15:00 and assert action history IDs preserve caller input order. Add an emitted event with `at` before `currentMinute` and assert `Cannot emit event into the past`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- storyOrchestration.test.ts
```

- [ ] **Step 3: Implement stable ordering**

```ts
const orderedActions = resolvedActions
  .map((action, index) => ({ action, index, minute: toAbsoluteMinute(action.at) }))
  .sort((a, b) => a.minute - b.minute || a.index - b.index);

for (const group of groupByMinute(orderedActions)) {
  simulation.runUntil(fromAbsoluteMinute(group.minute));
  for (const item of group.items) simulation.applyAction(item.action);
}
simulation.runUntil(input.until);
```

Queue priority for equal absolute minute is schedule before event before delayed/effect work, with insertion order breaking ties inside a class. `runUntil(target)` processes items at `target` before returning.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- storyOrchestration.test.ts simulator.test.ts eventQueue.test.ts eventResolver.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator tools/event-graph-viewer/tests/storyOrchestration.test.ts
git commit -m "feat: orchestrate story chronology"
```

---

### Task 5: Manifest-driven Story Bundle Loader

**Files:**
- Modify: `tools/event-graph-viewer/src/lib/loadSimulationStory.ts`
- Modify: `tools/event-graph-viewer/scripts/sync-story.mjs`
- Create: `tools/event-graph-viewer/tests/manifestLoader.test.ts`
- Create: `story/manifests/loop_01.yaml`
- Create: `story/loops/loop_01.yaml`

**Interfaces:**
- Produces `StoryManifest`, `WorldlineDefinition`, `StoryBundle`.
- Produces pure `buildStoryBundleFromDocuments(documents)` used by browser loading and real-YAML tests.
- `loadSimulationStory('/story/manifests/loop_01.yaml')` fetches the manifest and all references.

- [ ] **Step 1: Write the failing loader test with complete minimal documents**

```ts
it('builds a StoryBundle from manifest references', async () => {
  const files: Record<string, string> = {
    '/story/manifests/loop_01.yaml': 'loop: loops/loop_01.yaml\nworld: world/loop_01_initial.yaml\nschedules:\n  - schedules/doctor.yaml\nactions: actions/loop_01_actions.yaml\nevents:\n  - events/loop_01_1831.yaml\nworldlines: worldlines/loop_01_worldlines.yaml\n',
    '/story/loops/loop_01.yaml': 'id: gray_tide_loop_01\nrange:\n  start: "14:20"\n  end: { day: 1, time: "00:00" }\n',
    '/story/world/loop_01_initial.yaml': 'clock: { day: 0, time: "14:20" }\nflags: { x: false }\n',
    '/story/schedules/doctor.yaml': 'character_id: doctor\nentries: []\n',
    '/story/actions/loop_01_actions.yaml': 'actions: []\n',
    '/story/events/loop_01_1831.yaml': 'id: evt_1831_station\ntitle: station\nat: "18:31"\nvisibility: observable\nvariants:\n  - { id: fallback, priority: 0, fallback: true, effects: [] }\n',
    '/story/worldlines/loop_01_worldlines.yaml': 'worldlines:\n  - { id: WL-00, title: Baseline, action_ids: [] }\n',
  };
  vi.stubGlobal('fetch', async (path: string) => new Response(files[path], { status: files[path] ? 200 : 404 }));
  const story = await loadSimulationStory('/story/manifests/loop_01.yaml');
  expect(story.loop.id).toBe('gray_tide_loop_01');
  expect(story.schedules[0].characterId).toBe('doctor');
  expect(story.worldlines[0].id).toBe('WL-00');
});
```

Add a second fixture where two event files both declare `id: duplicate` and assert `Duplicate Event ID: duplicate`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- manifestLoader.test.ts
```

- [ ] **Step 3: Implement manifest traversal + pure bundle builder**

```ts
export type StoryManifest = {
  loop: string; world: string; schedules: string[]; actions: string; events: string[]; worldlines: string;
};

export function buildStoryBundleFromDocuments(input: {
  loop: unknown; initialState: unknown; schedules: unknown[]; actions: unknown; events: unknown[]; worldlines: unknown;
}): StoryBundle {
  // parse typed documents, normalize snake_case authored keys, then call runtime validation
  return { loop, initialState, schedules, definition: { loop, schedules, actions, events }, worldlines };
}
```

`loadSimulationStory` performs fetches then delegates to the pure builder. `sync-story.mjs` copies `manifests`, `loops`, `schedules`, and `worldlines` in addition to existing directories.

- [ ] **Step 4: Verify GREEN + sync**

```bash
npm test -- manifestLoader.test.ts
npm run sync-story
```

- [ ] **Step 5: Commit**

```bash
git add story/manifests story/loops tools/event-graph-viewer/src/lib/loadSimulationStory.ts tools/event-graph-viewer/scripts/sync-story.mjs tools/event-graph-viewer/tests/manifestLoader.test.ts
git commit -m "feat: load story simulation manifests"
```

---

### Task 6: Loop 01 Initial State + Four Base Schedules

**Files:**
- Create: `story/world/loop_01_initial.yaml`
- Create: `story/schedules/wakaharu.yaml`
- Create: `story/schedules/doctor.yaml`
- Create: `story/schedules/reporter.yaml`
- Create: `story/schedules/yuan.yaml`
- Create: `tools/event-graph-viewer/tests/firstLoopSchedules.test.ts`

**Interfaces:**
- Consumes `resolveScheduleEntry` and `buildStoryBundleFromDocuments` conventions.
- Produces the baseline physical routes in the approved spec.

- [ ] **Step 1: Write failing tests by parsing the real schedule YAML directly**

```ts
import yaml from 'js-yaml';
import doctorText from '../../../story/schedules/doctor.yaml?raw';
import { resolveScheduleEntry } from '../src/simulator/schedule';

it('doctor leave entry applies only on the old-station route', () => {
  const doc = yaml.load(doctorText) as { entries: ScheduleEntryDefinition[] };
  const entry = doc.entries.find(x => x.id === 'doctor_leave_hospital')!;
  const state = { characters: { doctor: { route: 'old_station', location: 'hospital' } } };
  const context = { state, queue: { enqueue: () => { throw new Error('not used'); } }, events: new Map(), currentMinute: 1060 };
  expect(resolveScheduleEntry(context, entry).status).toBe('applied');
  expect(state.characters.doctor.location).toBe('road_to_old_station');
});
```

Add a reporter test that `reporter_enter_old_lab` skips with route `normal` and applies with `hotel_then_old_lab`; add a Yuan test that station/post-office entries are mutually exclusive by `assignment`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- firstLoopSchedules.test.ts
```

- [ ] **Step 3: Author the initial state and four schedule files**

Doctor example:

```yaml
character_id: doctor
entries:
  - id: doctor_leave_hospital
    at: { day: 0, time: "17:40" }
    visibility: hidden
    when: { path: characters.doctor.route, op: eq, value: old_station }
    effects:
      - set: { path: characters.doctor.location, value: road_to_old_station }
  - id: doctor_arrive_station
    at: { day: 0, time: "17:58" }
    visibility: hidden
    when: { path: characters.doctor.route, op: eq, value: old_station }
    effects:
      - set: { path: characters.doctor.location, value: old_station }
```

Reporter defines hidden `reporter_return_hotel` at 17:30 and `reporter_enter_old_lab` at 19:50. Yuan defines baseline station-area and post-office alternatives. Wakaharu route conditions gate station movements.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- firstLoopSchedules.test.ts schedule.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add story/world/loop_01_initial.yaml story/schedules tools/event-graph-viewer/tests/firstLoopSchedules.test.ts
git commit -m "feat: define loop one base schedules"
```

---

### Task 7: Loop 01 Interventions

**Files:**
- Create: `story/actions/loop_01_actions.yaml`
- Create: `tools/event-graph-viewer/tests/firstLoopActions.test.ts`

**Interfaces:**
- Defines `send_yuan_to_post_office`, `show_letter_to_wakaharu`, `confront_reporter`, `protect_wakaharu`, `stop_doctor`.

- [ ] **Step 1: Write failing raw-YAML action tests**

```ts
import yaml from 'js-yaml';
import actionsText from '../../../story/actions/loop_01_actions.yaml?raw';

it('protect_wakaharu only changes route state', () => {
  const doc = yaml.load(actionsText) as { actions: ActionDefinition[] };
  const action = doc.actions.find(x => x.id === 'protect_wakaharu')!;
  expect(action.effects).toEqual([{ set: { path: 'characters.wakaharu.route', value: 'home' } }]);
});

it('confront_reporter changes the reporter conditions but not final status', () => {
  const doc = yaml.load(actionsText) as { actions: ActionDefinition[] };
  const action = doc.actions.find(x => x.id === 'confront_reporter')!;
  expect(JSON.stringify(action.effects)).not.toContain('missing');
  expect(JSON.stringify(action.effects)).toContain('hotel_then_old_lab');
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- firstLoopActions.test.ts
```

- [ ] **Step 3: Author all five state-only actions**

```yaml
- id: confront_reporter
  at: { day: 0, time: "16:40" }
  label: 拆穿葉庭安
  effects:
    - add_flag: flags.reporter_confronted
    - set: { path: characters.reporter.route, value: hotel_then_old_lab }
```

No action directly sets a death/missing result or event variant.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- firstLoopActions.test.ts storyOrchestration.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add story/actions/loop_01_actions.yaml tools/event-graph-viewer/tests/firstLoopActions.test.ts
git commit -m "feat: define loop one interventions"
```

---

### Task 8: Complete First Loop Event Graph

**Files:**
- Create: `story/events/loop_01_1420.yaml`
- Create: `story/events/loop_01_1500.yaml`
- Create: `story/events/loop_01_1610.yaml`
- Create: `story/events/loop_01_1640.yaml`
- Create: `story/events/loop_01_1805.yaml`
- Create: `story/events/loop_01_1810.yaml`
- Create: `story/events/loop_01_1818.yaml`
- Create: `story/events/loop_01_1831.yaml`
- Create: `story/events/loop_01_1910.yaml`
- Create: `story/events/loop_01_2030.yaml`
- Create: `story/events/loop_01_2114.yaml`
- Create: `story/events/loop_01_2240.yaml`
- Create: `story/events/loop_01_2359.yaml`
- Create: `story/events/loop_01_end.yaml`
- Create: `tools/event-graph-viewer/tests/firstLoopEvents.test.ts`

**Interfaces:**
- Produces the causal spine from 14:20 to Day 1 00:00.

- [ ] **Step 1: Write failing raw-YAML resolver tests**

```ts
import yaml from 'js-yaml';
import stationText from '../../../story/events/loop_01_1831.yaml?raw';
import reporterText from '../../../story/events/loop_01_2114.yaml?raw';

it('18:31 chooses Wakaharu first when she is at the station', () => {
  const event = yaml.load(stationText) as EventDefinition;
  const state = { characters: { wakaharu: { location: 'old_station', status: 'alive' }, doctor: { location: 'old_station', status: 'alive' } }, world: { anomaly_1831_observed: false } };
  expect(resolveEvent(testResolverContext(state), event).variantId).toBe('wakaharu_dies');
});

it('21:14 requires confrontation and old-lab presence', () => {
  const event = yaml.load(reporterText) as EventDefinition;
  const state = { flags: { reporter_confronted: true }, characters: { reporter: { location: 'old_lab', status: 'available' } } };
  expect(resolveEvent(testResolverContext(state), event).variantId).toBe('reporter_missing');
});

it('18:31 no longer schedules reporter disappearance', () => {
  const event = yaml.load(stationText) as EventDefinition;
  expect(event.variants.find(x => x.id === 'wakaharu_dies')?.delayed_effects ?? []).toEqual([]);
});
```

In the test file define `testResolverContext(state)` as `{ state, queue: { enqueue: vi.fn() }, events: new Map(), currentMinute: 1111 }`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- firstLoopEvents.test.ts
```

- [ ] **Step 3: Author all event files**

18:31 variants are exactly `wakaharu_dies` priority 100, `doctor_dies` priority 90, and fallback `no_death` priority 0. 21:14 uses both `flags.reporter_confronted == true` and `characters.reporter.location == old_lab`. 23:59 bells and Day 1 00:00 loop-end events always resolve.

- [ ] **Step 4: Verify GREEN + old resolver regression**

```bash
npm test -- firstLoopEvents.test.ts eventResolver.test.ts storyScenario.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add story/events/loop_01_*.yaml tools/event-graph-viewer/tests/firstLoopEvents.test.ts
git commit -m "feat: author complete loop one event graph"
```

---

### Task 9: Named Worldlines WL-00…WL-07

**Files:**
- Create: `story/worldlines/loop_01_worldlines.yaml`
- Create: `tools/event-graph-viewer/tests/worldlineDefinitions.test.ts`

**Interfaces:**
- Defines `WorldlineDefinition = { id, title, actionIds }`.

- [ ] **Step 1: Write failing real-YAML definition tests**

```ts
import yaml from 'js-yaml';
import text from '../../../story/worldlines/loop_01_worldlines.yaml?raw';

it('defines the eight approved worldlines', () => {
  const doc = yaml.load(text) as { worldlines: Array<{ id: string; title: string; action_ids: string[] }> };
  expect(doc.worldlines.map(x => x.id)).toEqual(['WL-00','WL-01','WL-02','WL-03','WL-04','WL-05','WL-06','WL-07']);
  expect(doc.worldlines.find(x => x.id === 'WL-07')?.action_ids).toEqual(['protect_wakaharu','confront_reporter']);
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- worldlineDefinitions.test.ts
```

- [ ] **Step 3: Author the exact scenario table**

```yaml
worldlines:
  - { id: WL-00, title: Baseline, action_ids: [] }
  - { id: WL-01, title: Postal, action_ids: [send_yuan_to_post_office] }
  - { id: WL-02, title: Trust, action_ids: [show_letter_to_wakaharu] }
  - { id: WL-03, title: Reporter, action_ids: [confront_reporter] }
  - { id: WL-04, title: Rescue, action_ids: [protect_wakaharu] }
  - { id: WL-05, title: Stop Doctor, action_ids: [stop_doctor] }
  - { id: WL-06, title: Both, action_ids: [protect_wakaharu, stop_doctor] }
  - { id: WL-07, title: Independence, action_ids: [protect_wakaharu, confront_reporter] }
```

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- worldlineDefinitions.test.ts manifestLoader.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add story/worldlines/loop_01_worldlines.yaml tools/event-graph-viewer/tests/worldlineDefinitions.test.ts
git commit -m "feat: define loop one worldlines"
```

---

### Task 10: Real Story Loader Helper + Simulation API + WL Acceptance

**Files:**
- Create: `tools/event-graph-viewer/tests/helpers/loadRealStory.ts`
- Create: `tools/event-graph-viewer/src/simulator/storySimulation.ts`
- Create: `tools/event-graph-viewer/tests/storySimulationRunner.test.ts`
- Create: `tools/event-graph-viewer/tests/storySimulationAcceptance.test.ts`

**Interfaces:**
- Produces `loadRealStory()` for tests from real YAML via `import.meta.glob`.
- Produces `simulateStory({ story, actionIds, until? })`.
- Produces `simulateNamedWorldline(story, worldlineId)`.
- Produces `{ state, fullHistory, playerHistory }`.

- [ ] **Step 1: Create the real-story helper and failing acceptance tests**

```ts
// tests/helpers/loadRealStory.ts
import yaml from 'js-yaml';
import { buildStoryBundleFromDocuments } from '../../src/lib/loadSimulationStory';

const rawFiles = import.meta.glob('../../../../story/**/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const parse = (suffix: string) => yaml.load(rawFiles[Object.keys(rawFiles).find(key => key.endsWith(suffix))!]);

export function loadRealStory() {
  const manifest = parse('/manifests/loop_01.yaml') as { loop: string; world: string; schedules: string[]; actions: string; events: string[]; worldlines: string };
  return buildStoryBundleFromDocuments({
    loop: parse('/' + manifest.loop),
    initialState: parse('/' + manifest.world),
    schedules: manifest.schedules.map(path => parse('/' + path)),
    actions: parse('/' + manifest.actions),
    events: manifest.events.map(path => parse('/' + path)),
    worldlines: parse('/' + manifest.worldlines),
  });
}
```

```ts
it.each([
  ['WL-00', 'wakaharu_dies', false, false],
  ['WL-01', 'wakaharu_dies', true, false],
  ['WL-03', 'wakaharu_dies', false, true],
  ['WL-04', 'doctor_dies', false, false],
  ['WL-05', 'wakaharu_dies', false, false],
  ['WL-06', 'no_death', false, false],
  ['WL-07', 'doctor_dies', false, true],
])('%s resolves the approved causal outcome', (id, stationVariant, postal, reporterMissing) => {
  const result = simulateNamedWorldline(loadRealStory(), id);
  const station = result.fullHistory.find(x => x.eventId === 'evt_1831_station' && x.kind === 'event');
  expect(station?.variantId).toBe(stationVariant);
  expect(Boolean((result.state.flags as Record<string, unknown>).postal_record_anomaly_found)).toBe(postal);
  expect(((result.state.characters as any).reporter.status === 'missing')).toBe(reporterMissing);
});
```

Add WL-02 assertion that `evt_1818_wakaharu_last_conversation` resolves `warning_revealed`. Add a determinism test comparing `JSON.stringify(fullHistory)` across two runs of the same worldline.

- [ ] **Step 2: Verify RED**

```bash
npm test -- storySimulationRunner.test.ts storySimulationAcceptance.test.ts
```

- [ ] **Step 3: Implement the high-level API**

```ts
export function simulateNamedWorldline(story: StoryBundle, id: string): StorySimulationResult {
  const worldline = story.worldlines.find(item => item.id === id);
  if (!worldline) throw new Error(`Unknown worldline: ${id}`);
  return simulateStory({ story, actionIds: worldline.actionIds });
}

export function simulateStory({ story, actionIds, until = story.loop.range.end }: StorySimulationInput): StorySimulationResult {
  const raw = simulate({ definition: story.definition, initialState: story.initialState, actions: actionIds, until });
  return { state: raw.state, fullHistory: raw.history, playerHistory: projectPlayerHistory(raw.history) };
}
```

- [ ] **Step 4: Verify GREEN and all eight worldlines**

```bash
npm test -- storySimulationRunner.test.ts storySimulationAcceptance.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator/storySimulation.ts tools/event-graph-viewer/tests/helpers/loadRealStory.ts tools/event-graph-viewer/tests/storySimulation*.test.ts
git commit -m "feat: simulate named story worldlines"
```

---

### Task 11: Complete Author Story Graph Projection

**Files:**
- Create: `tools/event-graph-viewer/src/simulator/storyGraph.ts`
- Modify: `tools/event-graph-viewer/src/types/story.ts`
- Modify: `tools/event-graph-viewer/src/components/EventGraphView.tsx`
- Create: `tools/event-graph-viewer/tests/storyGraphProjection.test.ts`

**Interfaces:**
- Produces `projectStoryGraph(story): GraphProjection`.
- Graph roles become `action | schedule | event | variant | delayed`.

**Deterministic edge rules:**
1. Event → each Event Variant is a structural edge.
2. Event Variant → emitted/delayed event is a structural edge.
3. A definition that writes state path `P` → a later schedule/event whose `when` reads `P` is a causal edge labeled `P`.
4. Consecutive schedule entries for the same character get a chronological schedule edge.
5. Edges are sorted by source absolute time, target absolute time, then stable ID.

- [ ] **Step 1: Write the failing graph tests using the real story**

```ts
it('projects the reporter chain from authored state dependencies', () => {
  const graph = projectStoryGraph(loadRealStory());
  expect(graph.nodes.map(x => x.id)).toEqual(expect.arrayContaining([
    'action:confront_reporter',
    'schedule:reporter_return_hotel',
    'schedule:reporter_enter_old_lab',
    'event:evt_2114_reporter_status',
  ]));
  expect(graph.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'action:confront_reporter', target: 'schedule:reporter_return_hotel', label: 'characters.reporter.route' }),
    expect.objectContaining({ source: 'schedule:reporter_enter_old_lab', target: 'event:evt_2114_reporter_status', label: 'characters.reporter.location' }),
  ]));
});
```

Add an assertion that `evt_1831_station` connects to variants `wakaharu_dies`, `doctor_dies`, `no_death`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- storyGraphProjection.test.ts
```

- [ ] **Step 3: Implement path-based static dependency projection**

Create helpers `collectWrittenPaths(effects)` and `collectConditionPaths(condition)`. Build edges only when a writer is earlier than/equal to a reader and the path sets intersect. Preserve the structural rules above. Change `EventGraphView` to accept `projection: GraphProjection`; keep the existing single-event `buildEventGraph` tests intact as legacy coverage.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- storyGraphProjection.test.ts eventGraph.test.ts App.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator/storyGraph.ts tools/event-graph-viewer/src/types/story.ts tools/event-graph-viewer/src/components/EventGraphView.tsx tools/event-graph-viewer/tests/storyGraphProjection.test.ts
git commit -m "feat: project complete story graph"
```

---

### Task 12: Author / Player Worldline Diff

**Files:**
- Create: `tools/event-graph-viewer/src/simulator/worldlineDiff.ts`
- Modify: `tools/event-graph-viewer/src/simulator/projection.ts`
- Create: `tools/event-graph-viewer/tests/storyWorldlineDiff.test.ts`

**Interfaces:**
- Produces `compareWorldlines(left, right, mode: 'author' | 'player'): DiffRow[]`.

- [ ] **Step 1: Write the failing real-worldline diff tests**

```ts
const story = loadRealStory();
const wl00 = simulateNamedWorldline(story, 'WL-00');
const wl03 = simulateNamedWorldline(story, 'WL-03');
const wl01 = simulateNamedWorldline(story, 'WL-01');

it('author diff shows the hidden reporter movements', () => {
  const titles = compareWorldlines(wl00, wl03, 'author').flatMap(x => [x.left?.title, x.right?.title]);
  expect(titles).toContain('reporter_return_hotel');
  expect(titles).toContain('reporter_enter_old_lab');
});

it('player diff hides those movements but keeps reporter_missing', () => {
  const rows = compareWorldlines(wl00, wl03, 'player');
  const titles = rows.flatMap(x => [x.left?.title, x.right?.title]);
  expect(titles).not.toContain('reporter_enter_old_lab');
  expect(rows.some(x => x.right?.variantId === 'reporter_missing')).toBe(true);
});

it('Yuan diff exposes station sighting versus postal anomaly', () => {
  const rows = compareWorldlines(wl00, wl01, 'author');
  expect(rows.some(x => x.left?.variantId === 'saw_reporter' && x.right?.variantId === 'yuan_absent')).toBe(true);
  expect(rows.some(x => x.right?.variantId === 'postal_anomaly')).toBe(true);
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- storyWorldlineDiff.test.ts
```

- [ ] **Step 3: Implement diff from simulation history**

Author mode compares `fullHistory`; player mode compares `playerHistory`. Normalize each row key as `absoluteMinute|kind|eventId/scheduleEntryId/actionId|sequence-within-minute`, then reuse the existing `DiffRow` status model.

- [ ] **Step 4: Verify GREEN + legacy diff**

```bash
npm test -- storyWorldlineDiff.test.ts worldlineDiff.test.ts projection.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator/{worldlineDiff.ts,projection.ts} tools/event-graph-viewer/tests/storyWorldlineDiff.test.ts
git commit -m "feat: compare simulated worldlines"
```

---

### Task 13: Author Viewer Integration + Story Review Gate

**Files:**
- Modify: `tools/event-graph-viewer/src/App.tsx`
- Modify: `tools/event-graph-viewer/src/components/ScenarioSimulator.tsx`
- Modify: `tools/event-graph-viewer/tests/App.test.tsx`
- Modify: `tools/event-graph-viewer/tests/scenarioSimulator.test.tsx`

**Interfaces:**
- App loads the Loop 01 manifest once.
- Graph view uses `projectStoryGraph(story)`.
- Timeline uses simulator-generated author history.
- Diff uses `compareWorldlines`.
- Scenario controls remain an author/debug tool.

- [ ] **Step 1: Write the failing author-viewer integration test**

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('recomputes a reporter worldline from the story simulator', async () => {
  const user = userEvent.setup();
  render(<App />);
  const right = await screen.findByRole('group', { name: '世界線 B' });
  await user.click(within(right).getByRole('checkbox', { name: '拆穿葉庭安' }));
  await user.click(screen.getByRole('button', { name: '重算世界線' }));
  await user.click(screen.getByRole('button', { name: /Worldline Diff/i }));
  expect(await screen.findByText(/reporter_missing/i)).toBeInTheDocument();
});
```

Add a graph assertion that the rendered author graph contains `reporter_enter_old_lab`, proving App no longer loads only `day_01_1831.yaml`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- App.test.tsx scenarioSimulator.test.tsx
```

- [ ] **Step 3: Wire the author Viewer to Story Simulation**

Replace `loadEventGraph('/story/events/day_01_1831.yaml')` with manifest loading + `projectStoryGraph`. Replace direct old `simulate()` calls with `simulateStory`, defaulting each run to `story.loop.range.end`. Keep the author view allowed to show hidden rows.

Do not add `player.html`, timers, localStorage progression, offline replay, Evidence Board, or narrative gameplay UI.

- [ ] **Step 4: Run complete verification**

```bash
npm test
npm run build
```

The existing `.github/workflows/event-graph-viewer.yml` already runs both commands on pull requests, so this plan makes no workflow change.

Verify these generated outcomes in tests and the author Viewer:

```text
WL-00 → 18:31 wakaharu_dies; no reporter_missing
WL-01 → yuan_absent + postal_anomaly
WL-02 → warning_revealed
WL-03 → hidden 17:30/19:50 + reporter_missing
WL-04 → doctor_dies
WL-05 → wakaharu_dies
WL-06 → no_death + midnight bells
WL-07 → doctor_dies + reporter_missing
```

Player History for WL-03 must contain the confrontation and disappearance but omit both hidden movements.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/App.tsx tools/event-graph-viewer/src/components/ScenarioSimulator.tsx tools/event-graph-viewer/tests/{App.test.tsx,scenarioSimulator.test.tsx}
git commit -m "feat: expose story simulation in author viewer"
```

---

## Final Verification Before Story Review

Run from `tools/event-graph-viewer`:

```bash
npm test
npm run build
```

The generated simulation, not the prose spec, must prove:

```text
WL-00 / WL-01 / WL-02 / WL-03 / WL-05 → wakaharu_dies
WL-04 / WL-07                         → doctor_dies
WL-06                                 → no_death
WL-03 / WL-07                         → reporter_missing
WL-01                                 → postal anomaly and no station sighting
all WL-00..07                         → evt_2359_midnight_bells
all WL-00..07                         → evt_0000_loop_end after the bells
```

Then perform the manual Story Review Gate:

- Baseline plausibly creates the false doctor causality without encoding it as truth.
- 18:31 remains salient in every representative worldline.
- Yuan information trade-off emerges from location/schedule, not clue-hiding logic.
- Reporter delayed causality is visible in Author History but hidden from Player History.
- Protecting Wakaharu creates an unintended replacement outcome rather than an immediate happy ending.
- `no_death` still feels anomalous because the 18:31 event and 23:59 bells remain.

Only after this review passes should a separate Player Game spec/plan begin.
