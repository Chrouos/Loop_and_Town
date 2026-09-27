# Real-time Anchored Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `test-driven-development` for every implementation task, `systematic-debugging` for unexpected failures, and `verification-before-completion` before claiming a task or the branch is complete.

**Goal:** Replace the current global elapsed-time loop model with the approved v0.3 Hybrid Real-time Anchored Timeline: Loop 1 starts at 06:12 in accelerated time, Loop 2+ may choose Accelerated or Live Sync, offline catch-up stops at narrative-critical boundaries, and simulation history remains separate from protagonist knowledge.

**Architecture:** Keep the deterministic story simulator as the event-processing engine, but move wall-clock mapping into a loop-owned `WorldlineClock` layer under `src/player`. Add a thin player scheduler wrapper that advances the existing simulator over explicit simulation intervals and clamps offline advancement at Critical Boundaries. Persist one clock state per loop, migrate existing v1 saves without losing player knowledge/actions, and make Reset an explicit foreground transition that creates the next loop instead of deriving loop count from elapsed wall time.

**Tech Stack:** TypeScript 5.6, React 18, Vite 5, Vitest 2, existing deterministic simulator/event queue, browser `localStorage`.

**Approved Spec:** `docs/superpowers/specs/2026-09-28-real-time-anchored-timeline-design.md` (v0.3)

---

## Global constraints

- `story/schedules/*.yaml` keeps existing `HH:mm` semantics; authoring data never receives wall-clock timestamps.
- `WorldlineClock` answers only “what simulation time is it?” and has no event side effects.
- `EventScheduler` answers “what happened between `from` and `to`?” and owns crossed-event processing.
- A Worldline label/action change inside one loop must never re-anchor the clock.
- Offline progression must never silently create or consume a later loop.
- Internal simulation history must not automatically become protagonist-visible knowledge.
- Loop 1 is always `ACCELERATED`, starts at 06:12, and initially uses 12x as balance configuration.
- Loop 2+ chooses `ACCELERATED` or `LIVE_SYNC` only when a new loop is created; the mode is locked for that loop.
- `LIVE_SYNC` is unavailable for real local time 00:00–06:11; Accelerated/Memory Entry remains available.
- Do not migrate `src/playerNarrative/*` in this change. `player.html` currently mounts `src/player/PlayerApp.tsx`; keep this implementation scoped to that player surface unless a failing integration test proves otherwise.

## Target runtime flow

```text
RealClock
  -> Loop-owned ClockState
  -> WorldlineClock.now()
  -> EventScheduler.advance(from, to)
  -> existing createSimulation(...)
  -> Worldline History
  -> Knowledge Filter
  -> Player UI

00:00 Reset Boundary
  -> foreground Reset presentation
  -> choose next Time Mode
  -> create next Loop + new Loop Anchor
```

## Target persistence model

Use a versioned v2 save rather than extending the existing global `anchorMs` contract.

```ts
export type TimeMode = 'ACCELERATED' | 'LIVE_SYNC';
export type CriticalBoundaryId = 'convergence' | 'bell' | 'reset';

export type LoopAnchor = {
  realStartedAtMs: number;
  simulationStartedMinute: number;
  scale: number;
};

export type LoopClockState = {
  mode: TimeMode;
  anchor: LoopAnchor;
  entryMinute: number;
  lastProcessedMinute: number;
  pendingCriticalBoundary?: CriticalBoundaryId;
};

export type LoopHistoryEntry = {
  sequence: number;
  simulationMinute: number;
  realTimestampMs: number;
  kind: string;
  eventId?: string;
  variantId?: string;
  title: string;
  visibility: string;
};

export type LoopSave = {
  actionIds: ActionId[];
  revealedIds: string[];
  sealed: boolean;
  clock: LoopClockState;
  history: LoopHistoryEntry[];
};

export type PlayerSave = {
  version: 2;
  currentLoopId: number;
  lastConfirmedMs: number;
  loops: Record<number, LoopSave>;
  knowledge: KnowledgeSave;
  importedLegacy?: boolean;
};
```

The exact compact history fields may reuse existing `WorldlineHistoryEntry` properties where practical, but the persisted representation must contain both simulation time and real timestamp.

---

## Task 1: Replace global time math with loop-owned clock primitives

**Files:**
- Modify: `tools/event-graph-viewer/src/player/clock.ts`
- Modify: `tools/event-graph-viewer/tests/player/clock.test.ts`
- Modify: `story/world/loop_01_initial.yaml`
- Modify: `story/loops/loop_01.yaml`
- Modify as needed: `tools/event-graph-viewer/tests/storyTime.test.ts`
- Modify as needed: `tools/event-graph-viewer/tests/protagonistScheduleAlignment.test.ts`

### Step 1: Write failing clock tests

Replace the legacy test that expects first visit at 18:00 and automatic next loops with tests for the new clock contract.

Minimum cases:

```ts
it('starts Loop 1 at 06:12 regardless of real start hour');
it('advances accelerated time at 12x without changing loop id');
it('maps Live Sync entry to the same local minute of day');
it('rejects Live Sync during 00:00-06:11');
it('does not change anchor identity when worldline state changes');
it('clamps device-clock rollback through the caller-provided safe now');
```

Expected constants:

```ts
LOOP_START_MINUTE = 372;      // 06:12
CONVERGENCE_MINUTE = 1111;    // 18:31
BELL_MINUTE = 1439;           // 23:59
RESET_MINUTE = 1440;          // Day 1 00:00
DEFAULT_ACCELERATED_SCALE = 12;
```

Run:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/clock.test.ts
```

Expected: FAIL because current `timeAt(anchorMs, nowMs)` still begins Loop 1 at 18:00 and derives future loops from elapsed days.

### Step 2: Implement pure clock primitives

In `src/player/clock.ts`, replace the global-loop formula with loop-owned helpers. Keep wall-clock conversion centralized here.

Required public interface:

```ts
export type TimeMode = 'ACCELERATED' | 'LIVE_SYNC';
export type LoopAnchor = {
  realStartedAtMs: number;
  simulationStartedMinute: number;
  scale: number;
};
export type LoopClockState = {
  mode: TimeMode;
  anchor: LoopAnchor;
  entryMinute: number;
  lastProcessedMinute: number;
  pendingCriticalBoundary?: CriticalBoundaryId;
};

export function localMinuteOfDay(nowMs: number): number;
export function isLiveSyncAvailable(nowMs: number): boolean;
export function createLoopClock(mode: TimeMode, nowMs: number, options?: { scale?: number }): LoopClockState;
export function clockMinuteAt(clock: LoopClockState, safeNowMs: number): number;
export function realTimestampForSimulationMinute(clock: LoopClockState, simulationMinute: number): number;
export function displayMinute(minute: number): string;
```

Behavior:

```text
ACCELERATED
  create at real T -> sim 06:12
  elapsed real * scale -> simulation elapsed
  never derives a new Loop id

LIVE_SYNC
  create at real 17:05 -> entryMinute 17:05
  scale = 1
  world is reconstructable from 06:12 -> 17:05
  unavailable when local minute < 06:12
```

Do not make clock helpers mutate save state or trigger events.

### Step 3: Move canonical story start to 06:12

Change:

`story/world/loop_01_initial.yaml`

```yaml
clock:
  day: 0
  time: "06:12"
```

Change:

`story/loops/loop_01.yaml`

```yaml
range:
  start:
    day: 0
    time: "06:12"
  end:
    day: 1
    time: "00:00"
```

Do not modify NPC schedule `at:` values.

### Step 4: Run focused tests

```bash
cd tools/event-graph-viewer
npm test -- tests/player/clock.test.ts tests/storyTime.test.ts tests/protagonistScheduleAlignment.test.ts tests/firstLoopSchedules.test.ts
```

Expected: PASS.

### Step 5: Commit

```bash
git add tools/event-graph-viewer/src/player/clock.ts \
  tools/event-graph-viewer/tests/player/clock.test.ts \
  story/world/loop_01_initial.yaml story/loops/loop_01.yaml \
  tools/event-graph-viewer/tests/storyTime.test.ts \
  tools/event-graph-viewer/tests/protagonistScheduleAlignment.test.ts
git commit -m "feat: add loop-owned timeline clock"
```

---

## Task 2: Introduce v2 loop-owned persistence and migrate v1 saves

**Files:**
- Modify: `tools/event-graph-viewer/src/player/model.ts`
- Modify: `tools/event-graph-viewer/src/player/storage.ts`
- Modify: `tools/event-graph-viewer/tests/player/storage.test.ts`
- Add/Modify: `tools/event-graph-viewer/tests/player/model.test.ts` if normalization cases become too large for `storage.test.ts`

### Step 1: Write failing persistence tests

Required cases:

```ts
it('creates a fresh v2 save with Loop 1 accelerated at 06:12');
it('stores clock state inside each loop rather than one global anchor');
it('migrates a v1 save without losing actions, revealed records, notes, pins, or connections');
it('preserves the v1 current loop/minute at migration time instead of jumping to 06:12');
it('does not manufacture several loops when a v1 save was offline for days');
it('normalizes invalid clock data to a safe active loop');
```

Use a deterministic `nowMs` in every test.

Run:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/storage.test.ts tests/player/model.test.ts
```

Expected: FAIL against the current `version: 1`, global `anchorMs` model.

### Step 2: Add v2 model types and normalization

Update `PlayerSave` to `version: 2` and add `currentLoopId`.

Move clock ownership into `LoopSave`.

`emptyLoop(...)` must accept or create a `LoopClockState`; it must not read `Date.now()` internally.

Keep `normalizeSave(raw, nowMs)` deterministic and pure.

### Step 3: Implement explicit v1 migration

Keep a migration-only helper reproducing legacy `timeAt` semantics so old saves can be interpreted once without retaining the old runtime architecture.

Migration policy:

```text
read v1 save at migration time
  -> calculate its legacy current loop + minute
  -> preserve all known actions / revealedIds / knowledge
  -> set currentLoopId to legacy current loop
  -> create one active v2 clock anchored at migration `nowMs`
     simulationStartedMinute = legacy current minute
     mode = ACCELERATED
     scale = 1
  -> do NOT generate any missing intermediate loops
  -> all future Reset-created loops use v0.3 rules
```

Using scale 1 for the migrated active loop preserves the old user's current pace until the next Reset rather than suddenly accelerating an in-progress legacy run.

### Step 4: Version the storage key safely

Prefer:

```ts
export const SAVE_KEY = 'ash-town-player-v2';
export const PREVIOUS_SAVE_KEY = 'ash-town-player-v1';
```

`readSave` order:

```text
v2 key
  -> if missing: read v1 key and migrate
  -> if missing: create fresh v2
```

`writeSave` writes only v2.

Keep `LEGACY_KEY = 'ash-town-bible-v1'` for the much older knowledge import flow.

### Step 5: Run focused tests

```bash
cd tools/event-graph-viewer
npm test -- tests/player/storage.test.ts tests/player/model.test.ts tests/player/logic.test.ts tests/player/board.test.tsx
```

Expected: PASS and existing evidence-board knowledge survives the schema change.

### Step 6: Commit

```bash
git add tools/event-graph-viewer/src/player/model.ts \
  tools/event-graph-viewer/src/player/storage.ts \
  tools/event-graph-viewer/tests/player/storage.test.ts \
  tools/event-graph-viewer/tests/player/model.test.ts
git commit -m "feat: migrate player saves to loop-owned clocks"
```

---

## Task 3: Add the player EventScheduler boundary layer

**Files:**
- Create: `tools/event-graph-viewer/src/player/eventScheduler.ts`
- Create: `tools/event-graph-viewer/tests/player/eventScheduler.test.ts`
- Reuse: `tools/event-graph-viewer/src/simulator/simulator.ts`
- Reuse: `tools/event-graph-viewer/src/simulator/time.ts`

### Step 1: Write failing scheduler tests

Required cases:

```ts
it('advances normal events in deterministic chronological order');
it('caps offline catch-up at 18:31 Convergence');
it('caps offline catch-up at 23:59 Bell');
it('caps offline catch-up at Day 1 00:00 Reset');
it('does not create a next loop when offline target is many days ahead');
it('records one pending boundary and is idempotent when called again at that boundary');
it('foreground continuation can consume a pending boundary exactly once');
```

Use the real story fixture where practical so this catches integration drift.

Run:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/eventScheduler.test.ts
```

Expected: FAIL because no player scheduler boundary exists.

### Step 2: Implement Critical Boundary lookup

Create:

```ts
export type CriticalBoundary = {
  id: CriticalBoundaryId;
  minute: number;
};

export const CRITICAL_BOUNDARIES: CriticalBoundary[] = [
  { id: 'convergence', minute: CONVERGENCE_MINUTE },
  { id: 'bell', minute: BELL_MINUTE },
  { id: 'reset', minute: RESET_MINUTE },
];

export function firstCriticalBoundary(fromMinute: number, toMinute: number): CriticalBoundary | undefined;
```

Boundary crossing rule:

```text
from < boundary <= target
```

A call starting exactly on an already-pending boundary must not rediscover/replay it.

### Step 3: Wrap the existing simulator instead of duplicating it

Required API:

```ts
export type AdvanceLoopInput = {
  definition: SimulationDefinition;
  initialState: WorldState;
  loop: LoopSave;
  fromMinute: number;
  targetMinute: number;
  foreground: boolean;
};

export type AdvanceLoopResult = {
  reachedMinute: number;
  pendingBoundary?: CriticalBoundaryId;
  simulation: SimulationResult;
};

export function advanceLoop(input: AdvanceLoopInput): AdvanceLoopResult;
```

Implementation rule:

```text
foreground = false
  -> effective target = first boundary crossed OR requested target
  -> run existing createSimulation(...).runUntil(...)
  -> set pending boundary; do not reset

foreground = true
  -> may resolve the currently pending boundary
  -> still does not infer loop count from elapsed real time
```

For Reset at minute 1440, call the simulator with `{ day: 1, time: '00:00' }`; do not try to pass `formatTime(1440)`.

### Step 4: Run focused simulator tests

```bash
cd tools/event-graph-viewer
npm test -- tests/player/eventScheduler.test.ts tests/simulator.test.ts tests/eventQueue.test.ts tests/eventResolver.test.ts
```

Expected: PASS; existing simulator ordering remains unchanged.

### Step 5: Commit

```bash
git add tools/event-graph-viewer/src/player/eventScheduler.ts \
  tools/event-graph-viewer/tests/player/eventScheduler.test.ts
git commit -m "feat: stop offline timeline at critical boundaries"
```

---

## Task 4: Rework player runtime to explicit loop advancement and foreground Reset

**Files:**
- Modify: `tools/event-graph-viewer/src/player/runtime.ts`
- Modify: `tools/event-graph-viewer/src/player/knowledge.ts`
- Modify: `tools/event-graph-viewer/tests/player/runtime.test.ts`
- Modify: `tools/event-graph-viewer/tests/player/knowledge.test.ts`

### Step 1: Write failing runtime tests

Required cases:

```ts
it('reconciles only the current loop instead of deriving loops from elapsed days');
it('offline resume updates lastProcessedMinute only to the first critical boundary');
it('keeps pending reset in the current loop until foreground continuation');
it('foreground reset seals the old loop and creates exactly one next loop');
it('new loop creation requires an explicit TimeMode');
it('changing actions/worldline state does not replace the loop anchor');
it('confirmAction uses current loop simulation minute for deadlines');
```

Run:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/runtime.test.ts tests/player/knowledge.test.ts
```

Expected: FAIL because `runtime.ts`/`knowledge.ts` currently call global `timeAt()` and `reconcilePlayer` loops through up to 365 derived loops.

### Step 2: Replace global time lookup with active loop clock lookup

Add runtime helpers such as:

```ts
export function activeLoop(save: PlayerSave): LoopSave;
export function currentSimulationMinute(save: PlayerSave, safeNowMs: number): number;
```

`confirmAction` must use `save.currentLoopId` and that loop's clock.

Do not mutate clock anchor when an action changes Worldline state.

### Step 3: Make reconcile process only one loop

Replace the current loop-for-loop reconciliation with:

```text
safeNow = max(nowMs, lastConfirmedMs)
active loop
  -> clock target minute
  -> EventScheduler.advance(lastProcessedMinute, target, foreground=false)
  -> persist reached minute/history/pending boundary
  -> run Knowledge Filter
  -> update lastConfirmedMs
```

No `for (loop = old..current)` based on elapsed time remains.

### Step 4: Add explicit foreground Reset transition

Required API shape:

```ts
export function continuePendingBoundary(...): PlayerSave;
export function createNextLoop(save: PlayerSave, mode: TimeMode, nowMs: number): PlayerSave;
```

Reset flow:

```text
pending reset
  -> foreground continuation records/resolves reset once
  -> seal old Loop
  -> preserve protagonist knowledge
  -> increment currentLoopId
  -> create next LoopSave with selected mode
```

Do not choose a mode implicitly for Loop 2+ in the runtime. UI supplies the choice.

### Step 5: Run focused tests

```bash
cd tools/event-graph-viewer
npm test -- tests/player/runtime.test.ts tests/player/knowledge.test.ts tests/player/clock.test.ts tests/player/eventScheduler.test.ts
```

Expected: PASS.

### Step 6: Commit

```bash
git add tools/event-graph-viewer/src/player/runtime.ts \
  tools/event-graph-viewer/src/player/knowledge.ts \
  tools/event-graph-viewer/tests/player/runtime.test.ts \
  tools/event-graph-viewer/tests/player/knowledge.test.ts
git commit -m "feat: make loop reset an explicit foreground transition"
```

---

## Task 5: Persist dual-clock Worldline History and enforce the Knowledge Filter

**Files:**
- Modify: `tools/event-graph-viewer/src/player/model.ts`
- Modify: `tools/event-graph-viewer/src/player/runtime.ts`
- Modify: `tools/event-graph-viewer/src/player/knowledge.ts`
- Modify: `tools/event-graph-viewer/src/player/story.ts`
- Modify: `tools/event-graph-viewer/tests/player/knowledge.test.ts`
- Create: `tools/event-graph-viewer/tests/player/history.test.ts`

### Step 1: Write failing history/knowledge tests

Required cases:

```ts
it('stores simulationMinute and realTimestampMs for persisted history entries');
it('keeps internal history for events that happened before a Live Sync entry');
it('does not reveal a presence-only observation that happened before Player Entry');
it('allows persistent records to exist regardless of entry window');
it('allows messages/broadcasts to become available after entry even if formed earlier');
it('preserves protagonist meta-memory across Reset without preserving loop-local world state');
```

Concrete late-entry case:

```text
Live Sync Player Entry = 21:40
18:31 station event exists in internal history
"station-blackout" source = player presence
=> record must NOT automatically appear as known
```

Run:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/history.test.ts tests/player/knowledge.test.ts
```

Expected: FAIL because current `reveal()` converts matching replay history directly into revealed records.

### Step 2: Add acquisition semantics to `VisibleRecord`

Use an explicit, small enum:

```ts
export type RecordAcquisition = 'persistent' | 'message' | 'presence';
```

Suggested classification:

```text
persistent
  letter
  old-death

message
  yu-an-message
  station-bulletin-*
  reporter-message

presence
  station-blackout
```

Rules:

```text
persistent -> available when normal story condition is satisfied
message    -> may be received/read after Player Entry when its reveal time has passed
presence   -> requires entryMinute <= revealMinute <= currentMinute
```

Keep `matches(history)` as the world-condition test. Acquisition controls whether the protagonist actually knows it.

### Step 3: Persist compact dual-clock history

When copying simulator history into `LoopSave.history`, stamp each entry using:

```ts
realTimestampForSimulationMinute(loop.clock, simulationMinute)
```

Do not expose all persisted history to UI. `visibleRecords` remains the knowledge-facing projection.

### Step 4: Run focused tests

```bash
cd tools/event-graph-viewer
npm test -- tests/player/history.test.ts tests/player/knowledge.test.ts tests/player/worldlines.test.tsx
```

Expected: PASS.

### Step 5: Commit

```bash
git add tools/event-graph-viewer/src/player/model.ts \
  tools/event-graph-viewer/src/player/runtime.ts \
  tools/event-graph-viewer/src/player/knowledge.ts \
  tools/event-graph-viewer/src/player/story.ts \
  tools/event-graph-viewer/tests/player/history.test.ts \
  tools/event-graph-viewer/tests/player/knowledge.test.ts
git commit -m "feat: separate world history from player knowledge"
```

---

## Task 6: Add Time Mode selection and time-dependent Entry Windows to the player UI

**Files:**
- Create: `tools/event-graph-viewer/src/player/entry.ts`
- Modify: `tools/event-graph-viewer/src/player/PlayerApp.tsx`
- Modify: `tools/event-graph-viewer/src/player/player.css`
- Modify: `tools/event-graph-viewer/tests/player/PlayerApp.test.tsx`
- Create: `tools/event-graph-viewer/tests/player/entry.test.ts`

### Step 1: Write failing Entry Window tests

Define pure windows:

```text
06:12–08:59  dawn
09:00–11:59  morning
12:00–15:59  afternoon
16:00–18:30  evening
18:31–21:59  post-convergence
22:00–23:59  late-night
```

Required API:

```ts
export type EntryWindow = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'post-convergence' | 'late-night';
export function entryWindowFor(minute: number): EntryWindow;
export function entryPresentation(window: EntryWindow): { label: string; lines: string[] };
```

Test every boundary minute.

Run:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/entry.test.ts
```

Expected: FAIL because helper does not exist.

### Step 2: Add mode-choice UI only at new-loop creation

Loop 1:

```text
No choice
ACCELERATED
Entry 06:12
```

Loop 2+ pending creation screen:

```text
「跟著現在走」
  -> LIVE_SYNC

「回到記憶開始的地方」
  -> ACCELERATED
```

Do not present this as a Settings toggle.

Once chosen, do not render a mode-switch control during that loop.

### Step 3: Handle Live Sync inactive gap

At real local 00:00–06:11:

- show Live Sync as unavailable with short world-facing explanation
- keep Accelerated/Memory Entry enabled
- do not create a fake 02:00 Graytide Town simulation point

### Step 4: Use Entry Window for presentation only

On Live Sync creation:

```text
current real local minute
  -> create LIVE_SYNC clock
  -> bootstrap scheduler 06:12 -> entryMinute
  -> preserve internal world history
  -> Knowledge Filter
  -> Entry Window chooses opening copy
```

The window must not alter event timing.

### Step 5: Add UI tests

Required cases:

```ts
it('never asks for a mode during Loop 1');
it('offers two narrative mode choices after Loop 1 Reset');
it('enters Live Sync at 17:05 and shows the evening entry presentation');
it('does not show a mode toggle after the loop starts');
it('disables Live Sync at 02:00 and keeps Accelerated playable');
it('shows the exact simulation minute in the town clock after Live Sync entry');
```

Run:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/entry.test.ts tests/player/PlayerApp.test.tsx
```

Expected: PASS.

### Step 6: Commit

```bash
git add tools/event-graph-viewer/src/player/entry.ts \
  tools/event-graph-viewer/src/player/PlayerApp.tsx \
  tools/event-graph-viewer/src/player/player.css \
  tools/event-graph-viewer/tests/player/entry.test.ts \
  tools/event-graph-viewer/tests/player/PlayerApp.test.tsx
git commit -m "feat: add live-sync loop entry modes"
```

---

## Task 7: Add anchored-timeline acceptance coverage and run full verification

**Files:**
- Create: `tools/event-graph-viewer/tests/player/anchoredTimelineAcceptance.test.ts`
- Modify only if failures prove necessary: existing player/simulator tests
- Do not change story outcomes merely to satisfy the timeline tests

### Step 1: Write end-to-end acceptance cases

Cover the approved spec as one integrated flow:

```ts
it('first boot at real 17:00 still enters Loop 1 at 06:12');
it('12x Loop 1 advances 10 real minutes to 08:12');
it('offline catch-up stops at 18:31 instead of consuming later events');
it('a pending Reset remains foreground-only and creates exactly one next loop');
it('Loop 2 Live Sync at real 17:05 enters simulation at 17:05');
it('Live Sync bootstrap reconstructs the world from 06:12 without leaking presence-only knowledge');
it('real 02:00 cannot create a Live Sync loop but can create Accelerated');
it('worldline/action changes do not replace the active loop anchor');
it('persisted history contains both simulation and real timestamps');
it('a very long offline absence never auto-creates Loop 2 or later loops');
```

### Step 2: Run acceptance tests

```bash
cd tools/event-graph-viewer
npm test -- tests/player/anchoredTimelineAcceptance.test.ts
```

Expected: PASS.

### Step 3: Run the full test suite

```bash
cd tools/event-graph-viewer
npm test
```

Expected: all Vitest tests pass with zero failures.

If failures appear, do not weaken the acceptance rules. Use `systematic-debugging` and determine whether the failure is:

```text
old test asserting removed global-anchor behavior
vs
actual regression in simulator/story/player behavior
```

Update obsolete tests only when the approved v0.3 spec explicitly replaces their old expectation.

### Step 4: Run production build

```bash
cd tools/event-graph-viewer
npm run build
```

Expected:

```text
sync-story succeeds
tsc --noEmit succeeds
vite build succeeds
exit code 0
```

### Step 5: Inspect generated story sync diff

`npm run build` runs `sync-story`, so check that generated/public story copies are expected and no unrelated story data changed.

```bash
git status --short
git diff -- tools/event-graph-viewer/public/story tools/event-graph-viewer/dist
```

Do not commit unrelated generated artifacts unless repository convention/CI requires them. Match the existing project convention visible on the branch.

### Step 6: Commit acceptance coverage/final fixes

```bash
git add tools/event-graph-viewer/tests/player/anchoredTimelineAcceptance.test.ts
# add only intentional implementation/test changes revealed by verification
git commit -m "test: cover anchored timeline lifecycle"
```

### Step 7: Final verification before PR readiness

Freshly rerun:

```bash
cd tools/event-graph-viewer
npm test
npm run build
```

Then inspect:

```bash
git status --short
git log --oneline --decorate -8
```

Only after both commands exit 0 may the implementation PR/branch be described as passing.

---

## Review focus after implementation

Review the finished branch specifically for these failure modes:

1. **Hidden automatic loops** — any code that derives `currentLoopId` from elapsed wall-clock days is a regression.
2. **Clock side effects** — `WorldlineClock` must not fire events or Reset.
3. **Offline boundary duplication** — 18:31 / 23:59 / 00:00 must be processed at most once per loop.
4. **History leaks** — internal reconstructed history must not equal protagonist knowledge.
5. **Anchor churn** — action/worldline changes must not replace the active loop anchor.
6. **Live Sync gap** — 00:00–06:11 cannot create impossible Graytide Town times.
7. **Legacy save loss** — actions, opened/pinned evidence, notes, connections, and current progress must survive v1 -> v2 migration.
8. **Schedule semantics** — existing `at: "HH:mm"` NPC/story authoring remains Graytide Town simulation time.
9. **Reset ownership** — only explicit foreground Reset creates the next Loop.
10. **UI exploit** — Time Mode cannot be switched mid-loop.

## Expected commit sequence

```text
feat: add loop-owned timeline clock
feat: migrate player saves to loop-owned clocks
feat: stop offline timeline at critical boundaries
feat: make loop reset an explicit foreground transition
feat: separate world history from player knowledge
feat: add live-sync loop entry modes
test: cover anchored timeline lifecycle
```

This sequence intentionally builds from pure time math -> persistence -> scheduler -> runtime -> knowledge -> UI -> acceptance, so every layer can be tested before the next layer depends on it.
