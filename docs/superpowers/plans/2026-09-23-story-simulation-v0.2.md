# Story Simulation v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first executable Loop 01 story model so the repository can deterministically simulate WL-00 through WL-07, expose full and player-safe histories, generate an author Event Graph, and compare worldlines before any Player Game UI work begins.

**Architecture:** Extend the existing deterministic Worldline Simulator instead of replacing it. Story data remains YAML source-of-truth; the runtime adds cross-day `StoryTime`, NPC schedule queue items, visibility-aware history, chronological orchestration, manifest loading, named-worldline helpers, and author projections. The existing React Event Graph Viewer remains an author/debug tool and consumes simulator-generated graph/timeline/diff data.

**Tech Stack:** TypeScript 5.6, Vitest 2, React 18, Vite 5, js-yaml 4, @xyflow/react 12.

**Spec:** `docs/superpowers/specs/2026-09-23-first-loop-story-graph-v0.2-design.md`

## Global Constraints

- Loop 01 range is Day 0 14:20 through Day 1 00:00, end inclusive.
- A Loop is an authored range, not synonymous with one day.
- Legacy `at: "HH:mm"` syntax remains valid and means Day 0.
- All runtime ordering uses absolute minutes; display time remains day + `HH:mm`.
- Same-minute precedence is `Schedule → Event → Player Action`; ties inside one class remain stable by authored/input order.
- NPC authored Base Schedules are immutable at runtime; interventions change world state, and schedule `when` conditions determine applied/skipped entries.
- Hidden/debug history is available to author tooling but must not appear in Player History.
- Player actions mutate state; they never select event variants directly.
- `wakaharu_dies` must not cause the 21:14 reporter disappearance.
- No Player Game UI, real-time replay, offline catch-up, loop reset runtime, Loop 02, relationship engine, Evidence Board, or cross-loop persistence in this plan.
- All story acceptance tests must read the real `story/*.yaml` files, not hardcoded duplicate fixtures.

## Review Focus

1. Cross-midnight and range boundaries: Day 1 00:00 must execute, while items outside the Loop Range must fail validation.
2. Schedule safety: `when=false` must record a skipped author-history row without applying effects or leaking the row into Player History.
3. Same-minute determinism: Schedule, Event, then Action; multiple actions in the same minute must preserve caller input order.
4. Visibility safety: `hidden` and `debug` rows must never appear in Player History or Player Diff.
5. Causal independence: changing the 18:31 victim must not affect the reporter chain unless the reporter conditions themselves change.

---

## File Structure Locked by This Plan

### Runtime

- Modify `tools/event-graph-viewer/src/simulator/types.ts` — cross-day time, schedules, visibility, loop/worldline types.
- Modify `tools/event-graph-viewer/src/simulator/time.ts` — parse/format `StoryTimeInput` and absolute minutes.
- Modify `tools/event-graph-viewer/src/simulator/eventQueue.ts` — queue schedule entries alongside events/effects.
- Create `tools/event-graph-viewer/src/simulator/schedule.ts` — resolve/apply one schedule entry.
- Modify `tools/event-graph-viewer/src/simulator/simulator.ts` — chronological orchestration and loop-range execution.
- Modify `tools/event-graph-viewer/src/simulator/projection.ts` — full/player timeline projection.
- Modify `tools/event-graph-viewer/src/simulator/validation.ts` — loop/schedule/time/visibility validation.
- Create `tools/event-graph-viewer/src/simulator/storySimulation.ts` — `simulateStory`, `simulateNamedWorldline`.
- Create `tools/event-graph-viewer/src/simulator/worldlineDiff.ts` — author/player diffs from history.
- Create `tools/event-graph-viewer/src/simulator/storyGraph.ts` — project story definitions to one author graph.

### Loading / Author Viewer

- Modify `tools/event-graph-viewer/src/lib/loadSimulationStory.ts` — manifest-driven browser loader.
- Modify `tools/event-graph-viewer/src/types/story.ts` — graph/timeline source roles required by schedules/actions.
- Modify `tools/event-graph-viewer/src/components/EventGraphView.tsx` — render complete Story Graph projection.
- Modify `tools/event-graph-viewer/src/App.tsx` — run named/custom worldlines through Story Simulation APIs.

### Story Source of Truth

- Create `story/manifests/loop_01.yaml`
- Create `story/loops/loop_01.yaml`
- Create `story/world/loop_01_initial.yaml`
- Create `story/schedules/wakaharu.yaml`
- Create `story/schedules/doctor.yaml`
- Create `story/schedules/reporter.yaml`
- Create `story/schedules/yuan.yaml`
- Create `story/actions/loop_01_actions.yaml`
- Create the Loop 01 event files listed in the spec under `story/events/loop_01_*.yaml`
- Create `story/worldlines/loop_01_worldlines.yaml`
- Modify `tools/event-graph-viewer/scripts/sync-story.mjs` — sync manifests/loops/schedules/worldlines in addition to current story folders.

---

### Task 1: Cross-day StoryTime and Loop Range

**Files:**
- Modify: `tools/event-graph-viewer/src/simulator/types.ts`
- Modify: `tools/event-graph-viewer/src/simulator/time.ts`
- Modify: `tools/event-graph-viewer/src/simulator/validation.ts`
- Create: `tools/event-graph-viewer/tests/storyTime.test.ts`

**Interfaces:**
- Consumes: existing `parseTime("HH:mm")` semantics.
- Produces: `StoryTime`, `StoryTimeInput`, `LoopDefinition`, `toAbsoluteMinute(input)`, `fromAbsoluteMinute(value)`, `formatStoryTime(input)`.

- [ ] **Step 1: Write failing StoryTime and range tests**

```ts
import { describe, expect, it } from 'vitest';
import { fromAbsoluteMinute, toAbsoluteMinute } from '../src/simulator/time';

it('orders cross-midnight StoryTime correctly', () => {
  expect(toAbsoluteMinute({ day: 0, time: '23:59' })).toBe(1439);
  expect(toAbsoluteMinute({ day: 1, time: '00:00' })).toBe(1440);
});

it('keeps legacy string time on day zero', () => {
  expect(toAbsoluteMinute('18:31')).toBe(18 * 60 + 31);
});

it('converts absolute minutes back to story time', () => {
  expect(fromAbsoluteMinute(1440)).toEqual({ day: 1, time: '00:00' });
});

it('rejects negative days', () => {
  expect(() => toAbsoluteMinute({ day: -1, time: '12:00' })).toThrow('Invalid story day');
});
```

Add validation coverage that `loop.range.start <= loop.range.end` and Day 1 00:01 is rejected when the Loop ends at Day 1 00:00.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
cd tools/event-graph-viewer
npm test -- storyTime.test.ts
```

Expected: FAIL because `StoryTime`, conversion helpers, and loop-range validation do not exist.

- [ ] **Step 3: Implement the minimal StoryTime model**

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
  const day = Math.floor(value / 1440);
  return { day, time: formatTime(value % 1440) };
}
```

Update validation to compare all authored times with `toAbsoluteMinute`.

- [ ] **Step 4: Run focused and existing simulator tests**

```bash
npm test -- storyTime.test.ts simulator.test.ts eventQueue.test.ts
```

Expected: PASS, including legacy Day 0 behavior.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator/{types.ts,time.ts,validation.ts} tools/event-graph-viewer/tests/storyTime.test.ts
git commit -m "feat: add cross-day story time"
```

---

### Task 2: NPC Base Schedule Queue and Execution

**Files:**
- Modify: `tools/event-graph-viewer/src/simulator/types.ts`
- Modify: `tools/event-graph-viewer/src/simulator/eventQueue.ts`
- Create: `tools/event-graph-viewer/src/simulator/schedule.ts`
- Modify: `tools/event-graph-viewer/src/simulator/validation.ts`
- Create: `tools/event-graph-viewer/tests/schedule.test.ts`

**Interfaces:**
- Consumes: `Condition`, `Effect`, `StoryTimeInput`, `WorldState`.
- Produces: `ScheduleDefinition`, `ScheduleEntryDefinition`, `ScheduleQueueItem`, `resolveScheduleEntry(context, entry)` returning applied/skipped + changes.

- [ ] **Step 1: Write failing schedule tests**

```ts
it('applies a schedule entry when its condition is true', () => {
  const state = { characters: { doctor: { route: 'old_station', location: 'hospital' } } };
  const result = resolveScheduleEntry(context(state), {
    id: 'doctor_leave_hospital',
    at: { day: 0, time: '17:40' },
    visibility: 'hidden',
    when: { path: 'characters.doctor.route', op: 'eq', value: 'old_station' },
    effects: [{ set: { path: 'characters.doctor.location', value: 'road_to_old_station' } }],
  });
  expect(result.status).toBe('applied');
  expect(state.characters.doctor.location).toBe('road_to_old_station');
});

it('skips without mutating state when condition is false', () => {
  const state = { characters: { doctor: { route: 'stay_hospital', location: 'hospital' } } };
  const result = resolveScheduleEntry(context(state), doctorLeaveEntry);
  expect(result.status).toBe('skipped');
  expect(state.characters.doctor.location).toBe('hospital');
  expect(result.changes).toEqual([]);
});
```

Also assert queue ordering for two same-minute schedules preserves authored insertion order.

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- schedule.test.ts
```

Expected: FAIL because schedule types/queue items/runtime are missing.

- [ ] **Step 3: Implement schedule model and resolver**

```ts
export type Visibility = 'observable' | 'hidden' | 'debug';
export type ScheduleEntryDefinition = {
  id: string;
  at: StoryTimeInput;
  visibility?: Visibility;
  when?: Condition;
  effects: Effect[];
};
export type ScheduleDefinition = { characterId: string; entries: ScheduleEntryDefinition[] };
```

`resolveScheduleEntry` must evaluate `when` against current state; false returns `{ status: 'skipped', changes: [] }`; true executes effects through existing `executeEffects`.

- [ ] **Step 4: Run schedule, queue, condition, and effect tests**

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

### Task 3: Visibility-aware Full History and Player History

**Files:**
- Modify: `tools/event-graph-viewer/src/simulator/types.ts`
- Modify: `tools/event-graph-viewer/src/simulator/projection.ts`
- Create: `tools/event-graph-viewer/tests/visibilityProjection.test.ts`

**Interfaces:**
- Consumes: `WorldlineHistoryEntry[]`.
- Produces: history entries with `visibility`, `day`, `absoluteMinute`, schedule metadata; `projectPlayerHistory(history)` and author projections.

- [ ] **Step 1: Write failing visibility projection tests**

```ts
it('removes hidden and debug rows from player history', () => {
  const history = [
    historyEntry({ sequence: 0, visibility: 'observable', title: '回到灰潮鎮' }),
    historyEntry({ sequence: 1, visibility: 'hidden', kind: 'schedule', title: '記者回旅館' }),
    historyEntry({ sequence: 2, visibility: 'debug', title: 'condition matched' }),
  ];
  expect(projectPlayerHistory(history).map(x => x.title)).toEqual(['回到灰潮鎮']);
});

it('always keeps the player own action observable', () => {
  const row = historyEntry({ kind: 'player-action', visibility: 'observable', title: '拆穿葉庭安' });
  expect(projectPlayerHistory([row])).toHaveLength(1);
});
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- visibilityProjection.test.ts
```

Expected: FAIL because history has no visibility/player projection.

- [ ] **Step 3: Add the history fields and projections**

```ts
export type WorldlineHistoryEntry = {
  sequence: number;
  day: number;
  time: string;
  absoluteMinute: number;
  kind: 'schedule' | 'player-action' | 'event' | 'effect' | 'delayed-effect';
  visibility: Visibility;
  scheduleEntryId?: string;
  scheduleStatus?: 'applied' | 'skipped';
  // existing event/action/change fields remain
};

export function projectPlayerHistory(history: WorldlineHistoryEntry[]) {
  return history.filter(entry => entry.visibility === 'observable' && entry.kind !== 'effect');
}
```

Keep `projectTimelineEntries` as author-facing unless the caller explicitly passes Player History.

- [ ] **Step 4: Run projection regression suite**

```bash
npm test -- visibilityProjection.test.ts projection.test.ts timeline.test.ts worldlineDiff.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator/{types.ts,projection.ts} tools/event-graph-viewer/tests/visibilityProjection.test.ts
git commit -m "feat: separate author and player history"
```

---

### Task 4: Chronological Schedule → Event → Action Orchestration

**Files:**
- Modify: `tools/event-graph-viewer/src/simulator/simulator.ts`
- Modify: `tools/event-graph-viewer/src/simulator/eventQueue.ts`
- Modify: `tools/event-graph-viewer/src/simulator/effectExecutor.ts`
- Create: `tools/event-graph-viewer/tests/storyOrchestration.test.ts`

**Interfaces:**
- Consumes: Loop range, schedules, events, actions, absolute-minute queue.
- Produces: `createSimulation` that processes schedules/events in queue; `simulate` that interleaves authored actions by time.

- [ ] **Step 1: Write failing ordering tests**

```ts
it('runs Schedule then Event then Action at the same minute', () => {
  const result = simulate({ definition, initialState, actions: ['act_1500'], until: { day: 0, time: '15:00' } });
  expect(result.history.filter(x => x.kind !== 'effect').map(x => [x.kind, x.title])).toEqual([
    ['schedule', 'schedule_1500'],
    ['event', 'event_1500'],
    ['player-action', 'action_1500'],
  ]);
});

it('preserves caller order for same-minute actions', () => {
  const result = simulate({ definition, initialState, actions: ['action_a', 'action_b'], until: '15:00' });
  expect(result.history.filter(x => x.kind === 'player-action').map(x => x.actionId)).toEqual(['action_a', 'action_b']);
});
```

Add a regression test that an emitted event scheduled before current time throws rather than time-travels backwards.

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- storyOrchestration.test.ts
```

Expected: FAIL because current `simulate()` applies every action before running the queue.

- [ ] **Step 3: Implement stable chronological orchestration**

Use one absolute-minute queue for schedule/event/effect items. For one-shot actions:

```ts
const orderedActions = input.actions
  .map((value, index) => ({ action: resolveAction(value), index }))
  .sort((a, b) => toAbsoluteMinute(a.action.at) - toAbsoluteMinute(b.action.at) || a.index - b.index);

for (const group of groupActionsByMinute(orderedActions)) {
  simulation.runUntil(group.absoluteMinute); // queue runs schedule/event first
  for (const item of group.actions) simulation.applyAction(item.action);
}
simulation.runUntil(input.until);
```

`runUntil` must process queue items at the target minute before returning.

- [ ] **Step 4: Run all simulator unit tests**

```bash
npm test -- storyOrchestration.test.ts simulator.test.ts eventQueue.test.ts eventResolver.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator tools/event-graph-viewer/tests/storyOrchestration.test.ts
git commit -m "feat: interleave schedules events and actions"
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
- Consumes: manifest paths to loop/world/schedules/actions/events/worldlines.
- Produces: `StoryBundle = { loop, initialState, definition, schedules, worldlines }` and `loadSimulationStory(manifestPath?)`.

- [ ] **Step 1: Write a failing loader test using fetch mocks**

```ts
it('loads every definition declared by the manifest', async () => {
  installStoryFetchFixture({
    '/story/manifests/loop_01.yaml': `loop: loops/loop_01.yaml\nworld: world/loop_01_initial.yaml\nschedules:\n  - schedules/doctor.yaml\nactions: actions/loop_01_actions.yaml\nevents:\n  - events/loop_01_1831.yaml\nworldlines: worldlines/loop_01_worldlines.yaml\n`,
    // fixture bodies for each referenced file
  });
  const story = await loadSimulationStory('/story/manifests/loop_01.yaml');
  expect(story.loop.id).toBe('gray_tide_loop_01');
  expect(story.schedules).toHaveLength(1);
  expect(story.definition.events[0].id).toBe('evt_1831_station');
});
```

Also test duplicate loaded definition IDs throw a descriptive error.

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- manifestLoader.test.ts
```

Expected: FAIL because loader hardcodes two event files.

- [ ] **Step 3: Implement manifest traversal and sync folders**

```ts
export type StoryManifest = {
  loop: string;
  world: string;
  schedules: string[];
  actions: string;
  events: string[];
  worldlines: string;
};

export async function loadSimulationStory(
  manifestPath = '/story/manifests/loop_01.yaml',
): Promise<StoryBundle> {
  const manifest = asManifest(await loadYaml(manifestPath));
  const base = '/story/';
  const [loop, initialState, actionDoc, worldlineDoc] = await Promise.all([
    loadYaml(base + manifest.loop),
    loadYaml(base + manifest.world),
    loadYaml(base + manifest.actions),
    loadYaml(base + manifest.worldlines),
  ]);
  const schedules = await Promise.all(manifest.schedules.map(path => loadYaml(base + path)));
  const events = await Promise.all(manifest.events.map(path => loadYaml(base + path)));
  return buildStoryBundle({ manifest, loop, initialState, actionDoc, worldlineDoc, schedules, events });
}
```

Update `sync-story.mjs` to copy `manifests`, `loops`, `schedules`, and `worldlines`.

- [ ] **Step 4: Run loader and build smoke tests**

```bash
npm test -- manifestLoader.test.ts
npm run sync-story
```

Expected: PASS; synced public story tree contains all six story directories.

- [ ] **Step 5: Commit**

```bash
git add story/manifests story/loops tools/event-graph-viewer/src/lib/loadSimulationStory.ts tools/event-graph-viewer/scripts/sync-story.mjs tools/event-graph-viewer/tests/manifestLoader.test.ts
git commit -m "feat: load story simulation from manifest"
```

---

### Task 6: Loop 01 Initial State and Four NPC Base Schedules

**Files:**
- Create: `story/world/loop_01_initial.yaml`
- Create: `story/schedules/wakaharu.yaml`
- Create: `story/schedules/doctor.yaml`
- Create: `story/schedules/reporter.yaml`
- Create: `story/schedules/yuan.yaml`
- Create: `tools/event-graph-viewer/tests/firstLoopSchedules.test.ts`

**Interfaces:**
- Consumes: schedule runtime from Tasks 1–4.
- Produces: deterministic baseline physical state for Wakaharu, Doctor, Reporter, Yuan.

- [ ] **Step 1: Write failing tests against raw real YAML imports**

```ts
import doctorText from '../../../story/schedules/doctor.yaml?raw';
import reporterText from '../../../story/schedules/reporter.yaml?raw';

it('doctor baseline reaches the old station', () => {
  const result = simulateRealStory([]);
  expect(scheduleRow(result, 'doctor_leave_hospital')?.scheduleStatus).toBe('applied');
  expect(scheduleRow(result, 'doctor_arrive_station')?.scheduleStatus).toBe('applied');
});

it('reporter hidden baseline route does not enter old lab', () => {
  const result = simulateRealStory([]);
  expect(scheduleRow(result, 'reporter_enter_old_lab')?.scheduleStatus).toBe('skipped');
});
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- firstLoopSchedules.test.ts
```

Expected: FAIL because Loop 01 schedule files do not exist.

- [ ] **Step 3: Author the initial world and schedules**

Use route/assignment conditions exactly from the approved spec. Example doctor entries:

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

Reporter includes 17:30 `reporter_return_hotel` and 19:50 `reporter_enter_old_lab`, both hidden and gated by `characters.reporter.route == hotel_then_old_lab`.

- [ ] **Step 4: Run schedule determinism twice**

```bash
npm test -- firstLoopSchedules.test.ts
```

Expected: PASS and two baseline runs produce byte-equivalent history JSON.

- [ ] **Step 5: Commit**

```bash
git add story/world/loop_01_initial.yaml story/schedules tools/event-graph-viewer/tests/firstLoopSchedules.test.ts
git commit -m "feat: define loop one npc schedules"
```

---

### Task 7: Loop 01 Player and Author Interventions

**Files:**
- Create: `story/actions/loop_01_actions.yaml`
- Create: `tools/event-graph-viewer/tests/firstLoopActions.test.ts`

**Interfaces:**
- Produces action IDs: `send_yuan_to_post_office`, `show_letter_to_wakaharu`, `confront_reporter`, `protect_wakaharu`, `stop_doctor`.

- [ ] **Step 1: Write failing action-state tests**

```ts
it('post-office assignment changes Yuan route state only', () => {
  const result = simulateRealStory(['send_yuan_to_post_office'], { day: 0, time: '15:00' });
  expect(readPath(result.state, 'characters.yuan.assignment')).toBe('post_office');
  expect(readPath(result.state, 'flags.yuan_sent_to_post_office')).toBe(true);
});

it('protecting Wakaharu does not directly select an 18:31 variant', () => {
  const action = realAction('protect_wakaharu');
  expect(action.effects).toEqual([{ set: { path: 'characters.wakaharu.route', value: 'home' } }]);
});
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- firstLoopActions.test.ts
```

Expected: FAIL because Loop 01 action file does not exist.

- [ ] **Step 3: Author all five actions with state-only effects**

```yaml
actions:
  - id: confront_reporter
    at: { day: 0, time: "16:40" }
    label: 拆穿葉庭安
    effects:
      - add_flag: flags.reporter_confronted
      - set: { path: characters.reporter.route, value: hotel_then_old_lab }
```

No action effect may set `variantId`, kill a character directly, or directly set `reporter.status = missing`.

- [ ] **Step 4: Run action and orchestration tests**

```bash
npm test -- firstLoopActions.test.ts storyOrchestration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add story/actions/loop_01_actions.yaml tools/event-graph-viewer/tests/firstLoopActions.test.ts
git commit -m "feat: define loop one interventions"
```

---

### Task 8: Complete First Loop Event Graph YAML

**Files:**
- Create: all `story/events/loop_01_*.yaml` files listed in the spec.
- Create: `tools/event-graph-viewer/tests/firstLoopEvents.test.ts`
- Remove causal dependency from old `story/events/day_01_1831.yaml` only after new manifest no longer references it.

**Interfaces:**
- Consumes: initial state, schedules, actions.
- Produces: complete authored causal spine from 14:20 through Day 1 00:00.

- [ ] **Step 1: Write failing real-story event tests**

```ts
it('baseline 18:31 resolves Wakaharu death', () => {
  const result = simulateRealStory([]);
  expect(eventRow(result, 'evt_1831_station')?.variantId).toBe('wakaharu_dies');
});

it('reporter disappearance requires reporter at old lab', () => {
  const baseline = simulateRealStory([]);
  expect(eventRow(baseline, 'evt_2114_reporter_status')?.variantId).toBe('no_visible_event');
  const confronted = simulateRealStory(['confront_reporter']);
  expect(eventRow(confronted, 'evt_2114_reporter_status')?.variantId).toBe('reporter_missing');
});

it('Wakaharu death has no reporter delayed effect', () => {
  const event = realEvent('evt_1831_station');
  const death = event.variants.find(v => v.id === 'wakaharu_dies')!;
  expect(death.delayed_effects ?? []).toEqual([]);
});
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- firstLoopEvents.test.ts
```

Expected: FAIL because the complete Loop 01 graph is absent.

- [ ] **Step 3: Author the story events**

Critical 18:31 ordering:

```yaml
variants:
  - id: wakaharu_dies
    priority: 100
    when: { path: characters.wakaharu.location, op: eq, value: old_station }
    effects:
      - set: { path: characters.wakaharu.status, value: dead }
  - id: doctor_dies
    priority: 90
    when: { path: characters.doctor.location, op: eq, value: old_station }
    effects:
      - set: { path: characters.doctor.status, value: dead }
  - id: no_death
    priority: 0
    fallback: true
    effects:
      - add_flag: world.anomaly_1831_observed
```

Critical 21:14 condition:

```yaml
when:
  all:
    - { path: flags.reporter_confronted, op: eq, value: true }
    - { path: characters.reporter.location, op: eq, value: old_lab }
```

`evt_2359_midnight_bells` and Day 1 `evt_0000_loop_end` are always resolved within range.

- [ ] **Step 4: Run event + regression tests**

```bash
npm test -- firstLoopEvents.test.ts eventResolver.test.ts storyScenario.test.ts
```

Expected: PASS; old v0.1 four-way 18:31 logic still holds under new data.

- [ ] **Step 5: Commit**

```bash
git add story/events tools/event-graph-viewer/tests/firstLoopEvents.test.ts
git commit -m "feat: author complete loop one event graph"
```

---

### Task 9: Named Worldlines WL-00 through WL-07

**Files:**
- Create: `story/worldlines/loop_01_worldlines.yaml`
- Create: `tools/event-graph-viewer/tests/worldlineDefinitions.test.ts`

**Interfaces:**
- Produces: `WorldlineDefinition = { id, title, actionIds }` for WL-00 … WL-07.

- [ ] **Step 1: Write failing worldline-definition tests**

```ts
it('defines exactly WL-00 through WL-07', () => {
  expect(realWorldlines().map(x => x.id)).toEqual([
    'WL-00', 'WL-01', 'WL-02', 'WL-03', 'WL-04', 'WL-05', 'WL-06', 'WL-07',
  ]);
});

it('uses the approved independence actions for WL-07', () => {
  expect(worldline('WL-07').actionIds).toEqual(['protect_wakaharu', 'confront_reporter']);
});
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- worldlineDefinitions.test.ts
```

Expected: FAIL because named worldlines are absent.

- [ ] **Step 3: Author the named scenarios**

```yaml
worldlines:
  - id: WL-00
    title: Baseline
    action_ids: []
  - id: WL-01
    title: Postal
    action_ids: [send_yuan_to_post_office]
  - id: WL-02
    title: Trust
    action_ids: [show_letter_to_wakaharu]
  - id: WL-03
    title: Reporter
    action_ids: [confront_reporter]
  - id: WL-04
    title: Rescue
    action_ids: [protect_wakaharu]
  - id: WL-05
    title: Stop Doctor
    action_ids: [stop_doctor]
  - id: WL-06
    title: Both
    action_ids: [protect_wakaharu, stop_doctor]
  - id: WL-07
    title: Independence
    action_ids: [protect_wakaharu, confront_reporter]
```

- [ ] **Step 4: Run definition validation**

```bash
npm test -- worldlineDefinitions.test.ts manifestLoader.test.ts
```

Expected: PASS; every action ID exists.

- [ ] **Step 5: Commit**

```bash
git add story/worldlines/loop_01_worldlines.yaml tools/event-graph-viewer/tests/worldlineDefinitions.test.ts
git commit -m "feat: define representative loop one worldlines"
```

---

### Task 10: Story Simulation API and Eight-worldline Acceptance

**Files:**
- Create: `tools/event-graph-viewer/src/simulator/storySimulation.ts`
- Create: `tools/event-graph-viewer/tests/storySimulationRunner.test.ts`
- Create: `tools/event-graph-viewer/tests/storySimulationAcceptance.test.ts`

**Interfaces:**
- Produces:
  - `simulateStory({ story, actionIds, until? }): StorySimulationResult`
  - `simulateNamedWorldline(story, worldlineId): StorySimulationResult`
- `StorySimulationResult = { state, fullHistory, playerHistory }`.

- [ ] **Step 1: Write failing API and acceptance tests**

```ts
it('simulates a named worldline to the inclusive loop end', () => {
  const result = simulateNamedWorldline(realStory, 'WL-03');
  expect(result.fullHistory.at(-1)?.eventId).toBe('evt_0000_loop_end');
  expect(result.playerHistory.some(x => x.title.includes('old_lab'))).toBe(false);
});
```

Add a table-driven acceptance test:

```ts
it.each([
  ['WL-00', 'wakaharu_dies', false, false],
  ['WL-01', 'wakaharu_dies', true, false],
  ['WL-03', 'wakaharu_dies', false, true],
  ['WL-04', 'doctor_dies', false, false],
  ['WL-05', 'wakaharu_dies', false, false],
  ['WL-06', 'no_death', false, false],
  ['WL-07', 'doctor_dies', false, true],
])('%s resolves expected causal results', (id, stationVariant, postal, reporterMissing) => {
  const result = simulateNamedWorldline(realStory, id);
  expect(eventRow(result, 'evt_1831_station')?.variantId).toBe(stationVariant);
  expect(Boolean(readPath(result.state, 'flags.postal_record_anomaly_found'))).toBe(postal);
  expect(readPath(result.state, 'characters.reporter.status') === 'missing').toBe(reporterMissing);
});
```

Add WL-02 assertion for `warning_revealed`.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npm test -- storySimulationRunner.test.ts storySimulationAcceptance.test.ts
```

Expected: FAIL because high-level Story Simulation API does not exist.

- [ ] **Step 3: Implement the wrapper using only lower-level simulator APIs**

```ts
export function simulateNamedWorldline(story: StoryBundle, worldlineId: string): StorySimulationResult {
  const worldline = story.worldlines.find(item => item.id === worldlineId);
  if (!worldline) throw new Error(`Unknown worldline: ${worldlineId}`);
  return simulateStory({ story, actionIds: worldline.actionIds });
}

export function simulateStory(input: StorySimulationInput): StorySimulationResult {
  const raw = simulate({
    definition: { ...input.story.definition, schedules: input.story.schedules, loop: input.story.loop },
    initialState: input.story.initialState,
    actions: input.actionIds,
    until: input.until ?? input.story.loop.range.end,
  });
  return { state: raw.state, fullHistory: raw.history, playerHistory: projectPlayerHistory(raw.history) };
}
```

- [ ] **Step 4: Run all eight-worldline tests twice for determinism**

```bash
npm test -- storySimulationRunner.test.ts storySimulationAcceptance.test.ts
```

Expected: PASS; repeated result history serializes identically.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator/storySimulation.ts tools/event-graph-viewer/tests/storySimulation*.test.ts
git commit -m "feat: simulate named story worldlines"
```

---

### Task 11: Project the Complete Story Definition into an Author Graph

**Files:**
- Create: `tools/event-graph-viewer/src/simulator/storyGraph.ts`
- Modify: `tools/event-graph-viewer/src/types/story.ts`
- Modify: `tools/event-graph-viewer/src/components/EventGraphView.tsx`
- Create: `tools/event-graph-viewer/tests/storyGraphProjection.test.ts`

**Interfaces:**
- Consumes: `StoryBundle`.
- Produces: `projectStoryGraph(story): GraphProjection` with schedule/action/event/variant nodes and causal edges.

- [ ] **Step 1: Write failing graph projection tests**

```ts
it('contains the reporter hidden causal chain', () => {
  const graph = projectStoryGraph(realStory);
  expect(graph.nodes.map(x => x.id)).toEqual(expect.arrayContaining([
    'action:confront_reporter',
    'schedule:reporter_return_hotel',
    'schedule:reporter_enter_old_lab',
    'event:evt_2114_reporter_status',
  ]));
  expect(graph.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'action:confront_reporter', target: 'schedule:reporter_return_hotel' }),
    expect.objectContaining({ source: 'schedule:reporter_enter_old_lab', target: 'event:evt_2114_reporter_status' }),
  ]));
});
```

Also assert the 18:31 event has variant children for `wakaharu_dies`, `doctor_dies`, `no_death`.

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- storyGraphProjection.test.ts
```

Expected: FAIL because the existing graph only projects one event document.

- [ ] **Step 3: Extend graph types and build the complete author projection**

```ts
export type GraphNodeRole = 'action' | 'schedule' | 'event' | 'variant' | 'delayed';
```

Edges must be derived from authored conditions/effects and explicit IDs, not from runtime fixture output. For Loop 01, state-affecting action → gated schedule/event relationships should be explainable in the node details even when an exact automatic static dependency cannot be proven.

- [ ] **Step 4: Run graph and existing event graph tests**

```bash
npm test -- storyGraphProjection.test.ts eventGraph.test.ts App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator/storyGraph.ts tools/event-graph-viewer/src/types/story.ts tools/event-graph-viewer/src/components/EventGraphView.tsx tools/event-graph-viewer/tests/storyGraphProjection.test.ts
git commit -m "feat: project complete story graph"
```

---

### Task 12: Author and Player Worldline Diff from Simulation History

**Files:**
- Create: `tools/event-graph-viewer/src/simulator/worldlineDiff.ts`
- Modify: `tools/event-graph-viewer/src/simulator/projection.ts`
- Create: `tools/event-graph-viewer/tests/storyWorldlineDiff.test.ts`

**Interfaces:**
- Produces: `compareWorldlines(left, right, mode: 'author' | 'player'): DiffRow[]`.

- [ ] **Step 1: Write failing diff tests for Reporter and Yuan**

```ts
it('author diff exposes reporter hidden movements', () => {
  const diff = compareWorldlines(wl00, wl03, 'author');
  expect(diff.map(x => x.right?.title)).toEqual(expect.arrayContaining([
    'reporter_return_hotel',
    'reporter_enter_old_lab',
  ]));
});

it('player diff does not expose reporter hidden movements', () => {
  const diff = compareWorldlines(wl00, wl03, 'player');
  expect(diff.flatMap(x => [x.left?.title, x.right?.title])).not.toContain('reporter_enter_old_lab');
  expect(diff.some(x => x.right?.variantId === 'reporter_missing')).toBe(true);
});

it('Yuan diff shows sighting versus postal anomaly', () => {
  const diff = compareWorldlines(wl00, wl01, 'author');
  expect(diff.some(x => x.left?.variantId === 'saw_reporter' && x.right?.variantId === 'yuan_absent')).toBe(true);
  expect(diff.some(x => x.right?.variantId === 'postal_anomaly')).toBe(true);
});
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
npm test -- storyWorldlineDiff.test.ts
```

Expected: FAIL because current diff only handles old projected event arrays.

- [ ] **Step 3: Implement diff from history projection**

Use full history for author mode and `projectPlayerHistory` for player mode, normalize by `(absoluteMinute, kind, stable id)` and preserve same-minute sequence.

- [ ] **Step 4: Run old and new diff tests**

```bash
npm test -- storyWorldlineDiff.test.ts worldlineDiff.test.ts projection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/simulator/{worldlineDiff.ts,projection.ts} tools/event-graph-viewer/tests/storyWorldlineDiff.test.ts
git commit -m "feat: compare simulated worldlines"
```

---

### Task 13: Wire Story Simulation into the Author Viewer and Verify the Story Gate

**Files:**
- Modify: `tools/event-graph-viewer/src/App.tsx`
- Modify: `tools/event-graph-viewer/src/components/ScenarioSimulator.tsx`
- Modify: `tools/event-graph-viewer/tests/App.test.tsx`
- Modify: `tools/event-graph-viewer/tests/scenarioSimulator.test.tsx`
- Modify: `.github/workflows/event-graph-viewer.yml` only if current CI commands do not already run `npm test` and `npm run build`.

**Interfaces:**
- Consumes: `loadSimulationStory`, `simulateStory`, `projectStoryGraph`, `compareWorldlines`.
- Produces: author/debug Viewer able to select two action sets, run them, view the complete Story Graph, generated Timeline, and generated Worldline Diff.

- [ ] **Step 1: Write failing author-viewer integration tests**

```tsx
it('loads the complete Loop 01 graph rather than a single event file', async () => {
  render(<App />);
  expect(await screen.findByText(/gray_tide_loop_01/i)).toBeInTheDocument();
  expect(await screen.findByText(/reporter_enter_old_lab/i)).toBeInTheDocument();
});

it('recomputes two simulator-generated worldlines', async () => {
  render(<App />);
  await selectAction('世界線 B', '拆穿葉庭安');
  await user.click(screen.getByRole('button', { name: '重算世界線' }));
  await user.click(screen.getByRole('button', { name: /Worldline Diff/i }));
  expect(await screen.findByText(/reporter_missing/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run integration tests and verify RED**

```bash
npm test -- App.test.tsx scenarioSimulator.test.tsx
```

Expected: FAIL because `App.tsx` still loads `/story/events/day_01_1831.yaml` and calls the old simulator directly.

- [ ] **Step 3: Switch the author Viewer to Story Simulation**

Replace the single-event load with manifest loading, generate the graph from `StoryBundle`, and simulate to `story.loop.range.end` rather than hardcoded `23:59`.

The author tool may show hidden rows in its Timeline/Diff. Do not add `/player.html`, timers, localStorage progression, Evidence Board, or playable narrative UI in this task.

- [ ] **Step 4: Run the complete verification suite**

```bash
npm test
npm run build
```

Expected: all tests pass and Vite/TypeScript build succeeds.

Then manually inspect these acceptance outputs in the author Viewer:

```text
WL-00 → 18:31 wakaharu_dies; no 21:14 reporter_missing
WL-01 → 18:10 yuan_absent; 19:10 postal_anomaly
WL-03 → hidden 17:30 + 19:50 chain; 21:14 reporter_missing
WL-04 → 18:31 doctor_dies
WL-06 → 18:31 no_death; midnight bells still occur
WL-07 → doctor_dies + reporter_missing
```

Confirm Player History for WL-03 contains confrontation + disappearance but not the 17:30/19:50 hidden movements.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src tools/event-graph-viewer/tests .github/workflows/event-graph-viewer.yml
git commit -m "feat: expose story simulation in author viewer"
```

---

## Final Verification Before Story Review

Run from `tools/event-graph-viewer`:

```bash
npm test
npm run build
```

Then verify the story-level invariants from generated simulation results, not from prose:

```text
WL-00 / WL-01 / WL-02 / WL-03 / WL-05 → wakaharu_dies
WL-04 / WL-07                         → doctor_dies
WL-06                                 → no_death
WL-03 / WL-07                         → reporter_missing
all WL-00..07                         → evt_2359_midnight_bells
all WL-00..07                         → evt_0000_loop_end after bells
```

Story Review Gate remains manual after code verification:

- Baseline should plausibly imply the false doctor causality without encoding it as truth.
- 18:31 should be salient across all worldlines.
- Yuan information trade-off should emerge from location/schedule, not clue-hiding logic.
- Reporter delayed causality should be visible to author tooling but hidden from Player History.
- Protecting Wakaharu should produce an unintended replacement outcome instead of an immediate happy ending.
- `no_death` must still feel anomalous because the 18:31 event and 23:59 bells remain.

Only after that review passes should a separate Player Game spec/plan start.
