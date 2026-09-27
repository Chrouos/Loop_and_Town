# Real-time Anchored Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `test-driven-development` for every implementation task, `systematic-debugging` for unexpected failures, and `verification-before-completion` before claiming a task or branch is complete.

**Goal:** Replace the current global elapsed-time loop model with the approved v0.3 Hybrid Real-time Anchored Timeline: Loop 1 starts at 06:12 in accelerated time, Loop 2+ may choose Accelerated or Live Sync, Live Sync reconstructs the world to the player's entry time, later offline catch-up stops at narrative-critical boundaries, and simulation history remains separate from protagonist knowledge.

**Architecture:** Keep the existing deterministic simulator as the story/event engine. Move wall-clock mapping into a loop-owned `WorldlineClock` under `src/player`, add a thin `EventScheduler` wrapper that advances explicit simulation intervals, and persist clock/history state per loop. Reset becomes an explicit foreground transition that creates a new loop; elapsed wall time must never manufacture loops automatically.

**Tech Stack:** TypeScript 5.6, React 18, Vite 5, Vitest 2, existing deterministic simulator/event queue, browser `localStorage`.

**Approved Spec:** `docs/superpowers/specs/2026-09-28-real-time-anchored-timeline-design.md` (v0.3)

---

## Non-negotiable rules

- `WorldlineClock` only answers “what time is it in Graytide Town?”; it has no event side effects.
- `EventScheduler` answers “what happened between `from` and `to`?”.
- Clock Anchor belongs to a Loop, not a Worldline label.
- Worldline/action changes inside a loop never re-anchor time.
- Loop 1 is always `ACCELERATED`, canonical start `06:12`, initial balance baseline `12x`.
- Loop 2+ chooses `ACCELERATED` or `LIVE_SYNC` only during new-loop creation; no mid-loop toggle.
- `LIVE_SYNC` is unavailable at real local `00:00–06:11`; Accelerated/Memory Entry remains playable.
- Existing `story/schedules/*.yaml` `HH:mm` values remain Graytide Town simulation times.
- **Bootstrap and Offline are different scheduler intents:**
  - `BOOTSTRAP`: reconstruct `06:12 -> Player Entry Point`; critical events strictly before entry are processed into world history and do not stop reconstruction.
  - `OFFLINE`: after the player has entered the loop, catch-up stops at the first Critical Boundary.
  - `FOREGROUND`: resolves a pending boundary exactly once.
- Offline progression never silently creates or consumes a later loop.
- Internal Worldline History never automatically becomes protagonist-visible knowledge.
- Do not migrate `src/playerNarrative/*` in this change; `player.html` mounts `src/player/PlayerApp.tsx`.

## Runtime flow

```text
RealClock
  -> Loop-owned ClockState
  -> WorldlineClock.now()
  -> EventScheduler.advance(from, to, intent)
      ├── BOOTSTRAP   : reconstruct world before Player Entry
      ├── OFFLINE     : stop at first Critical Boundary
      └── FOREGROUND  : consume pending boundary once
  -> existing createSimulation(...)
  -> Worldline History
  -> Knowledge Filter
  -> Player UI

00:00 Reset Boundary
  -> foreground Reset presentation
  -> choose next Time Mode
  -> create next Loop + new Loop Anchor
```

## Persistence target

```ts
export type TimeMode = 'ACCELERATED' | 'LIVE_SYNC';
export type AdvanceIntent = 'BOOTSTRAP' | 'OFFLINE' | 'FOREGROUND';
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

---

# Task 1 — Replace global time math with loop-owned clock primitives

**Files**
- Modify `tools/event-graph-viewer/src/player/clock.ts`
- Modify `tools/event-graph-viewer/tests/player/clock.test.ts`
- Modify `story/world/loop_01_initial.yaml`
- Modify `story/loops/loop_01.yaml`
- Modify as needed `tools/event-graph-viewer/tests/storyTime.test.ts`
- Modify as needed `tools/event-graph-viewer/tests/protagonistScheduleAlignment.test.ts`

## 1.1 Write failing tests

Replace the old assertion “first visit starts 18:00 and elapsed days produce future loops” with:

```ts
it('starts Loop 1 at 06:12 regardless of real start hour');
it('advances accelerated time at 12x without deriving a new loop');
it('maps Live Sync entry to the same local minute of day');
it('rejects Live Sync during 00:00-06:11');
it('maps a simulation minute back to its real timestamp');
it('keeps clock functions side-effect free');
```

Constants:

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

Expected: FAIL against legacy `timeAt(anchorMs, nowMs)`.

## 1.2 Implement pure clock API

Required public surface:

```ts
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
real T -> sim 06:12
elapsed real * scale -> sim elapsed
never changes Loop id

LIVE_SYNC
real 17:05 -> entryMinute 17:05
scale = 1
clock represents only current Loop
00:00–06:11 -> unavailable
```

No function here fires events, Convergence, Bell, or Reset.

## 1.3 Set canonical loop range to 06:12

`story/world/loop_01_initial.yaml`

```yaml
clock:
  day: 0
  time: "06:12"
```

`story/loops/loop_01.yaml`

```yaml
range:
  start: { day: 0, time: "06:12" }
  end:   { day: 1, time: "00:00" }
```

Do not rewrite NPC schedule times in this task.

## 1.4 Verify

```bash
cd tools/event-graph-viewer
npm test -- tests/player/clock.test.ts tests/storyTime.test.ts tests/protagonistScheduleAlignment.test.ts tests/firstLoopSchedules.test.ts
```

Commit:

```bash
git add tools/event-graph-viewer/src/player/clock.ts tools/event-graph-viewer/tests/player/clock.test.ts story/world/loop_01_initial.yaml story/loops/loop_01.yaml tools/event-graph-viewer/tests/storyTime.test.ts tools/event-graph-viewer/tests/protagonistScheduleAlignment.test.ts
git commit -m "feat: add loop-owned timeline clock"
```

---

# Task 2 — Introduce v2 persistence and safe v1 migration

**Files**
- Modify `tools/event-graph-viewer/src/player/model.ts`
- Modify `tools/event-graph-viewer/src/player/storage.ts`
- Modify `tools/event-graph-viewer/tests/player/storage.test.ts`
- Create `tools/event-graph-viewer/tests/player/model.test.ts` if useful

## 2.1 Write failing tests

```ts
it('creates a fresh v2 save with Loop 1 accelerated at 06:12');
it('owns clock state inside each LoopSave');
it('migrates v1 actions, revealed records, notes, pins, and connections');
it('preserves the v1 current loop/minute at migration time');
it('does not manufacture intermediate loops after a long v1 absence');
it('normalizes malformed v2 clock state safely');
```

Run:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/storage.test.ts tests/player/model.test.ts
```

## 2.2 Add v2 schema

- `PlayerSave.version = 2`
- add `currentLoopId`
- move clock/history into `LoopSave`
- `emptyLoop(...)` accepts explicit clock input and never calls `Date.now()`
- `normalizeSave(raw, nowMs)` remains deterministic

## 2.3 Migrate v1 once

Keep a migration-only legacy time calculator, not a runtime dependency.

```text
v1 payload
  -> derive legacy current loop + minute once
  -> preserve actions / revealedIds / knowledge
  -> currentLoopId = legacy current loop
  -> active v2 loop anchored at migration now
     simulationStartedMinute = legacy minute
     mode = ACCELERATED
     scale = 1
  -> do not synthesize missing loops
  -> future Reset-created loops use v0.3 rules
```

The migrated in-progress loop stays 1x until Reset so existing players do not suddenly jump forward.

Storage keys:

```ts
SAVE_KEY = 'ash-town-player-v2';
PREVIOUS_SAVE_KEY = 'ash-town-player-v1';
LEGACY_KEY = 'ash-town-bible-v1';
```

Read order: v2 -> v1 migrate -> fresh v2.

## 2.4 Verify

```bash
cd tools/event-graph-viewer
npm test -- tests/player/storage.test.ts tests/player/model.test.ts tests/player/logic.test.ts tests/player/board.test.tsx
```

Commit:

```bash
git add tools/event-graph-viewer/src/player/model.ts tools/event-graph-viewer/src/player/storage.ts tools/event-graph-viewer/tests/player/storage.test.ts tools/event-graph-viewer/tests/player/model.test.ts
git commit -m "feat: migrate player saves to loop-owned clocks"
```

---

# Task 3 — Add EventScheduler intents and Critical Boundaries

**Files**
- Create `tools/event-graph-viewer/src/player/eventScheduler.ts`
- Create `tools/event-graph-viewer/tests/player/eventScheduler.test.ts`
- Reuse `src/simulator/simulator.ts` and `src/simulator/time.ts`

## 3.1 Write failing tests

```ts
it('processes normal events deterministically');
it('OFFLINE stops at 18:31 Convergence');
it('OFFLINE stops at 23:59 Bell');
it('OFFLINE stops at Day 1 00:00 Reset');
it('OFFLINE never creates another loop even when target is days ahead');
it('FOREGROUND consumes a pending boundary exactly once');
it('BOOTSTRAP can reconstruct through a critical boundary before the entry minute');
it('BOOTSTRAP at 21:40 reaches 21:40 even though 18:31 occurred');
it('BOOTSTRAP leaves a boundary at the exact entry minute for foreground handling');
```

The last three tests are essential: Live Sync bootstrap is **not** offline catch-up.

Run:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/eventScheduler.test.ts
```

## 3.2 Implement scheduler API

```ts
export type AdvanceIntent = 'BOOTSTRAP' | 'OFFLINE' | 'FOREGROUND';

export type AdvanceLoopInput = {
  definition: SimulationDefinition;
  initialState: WorldState;
  loop: LoopSave;
  fromMinute: number;
  targetMinute: number;
  intent: AdvanceIntent;
};

export type AdvanceLoopResult = {
  reachedMinute: number;
  pendingBoundary?: CriticalBoundaryId;
  simulation: SimulationResult;
};

export function firstCriticalBoundary(fromMinute: number, toMinute: number): CriticalBoundary | undefined;
export function advanceLoop(input: AdvanceLoopInput): AdvanceLoopResult;
```

Critical boundaries:

```text
18:31 convergence
23:59 bell
24:00 reset
```

Intent semantics:

```text
BOOTSTRAP
  process critical events strictly before entry
  do not pause at 18:31 if entry is 21:40
  if critical minute == entry minute, leave it pending for foreground
  never crosses Reset because Live Sync target is <= 23:59

OFFLINE
  from < first boundary <= target
  effective target = first boundary
  mark pending and stop

FOREGROUND
  resolve existing pending boundary once
  never infer another Loop from elapsed time
```

Use existing `createSimulation(...).runUntil(...)`; do not duplicate event resolution.

For minute `1440`, pass `{ day: 1, time: '00:00' }`, not `formatTime(1440)`.

## 3.3 Verify

```bash
cd tools/event-graph-viewer
npm test -- tests/player/eventScheduler.test.ts tests/simulator.test.ts tests/eventQueue.test.ts tests/eventResolver.test.ts
```

Commit:

```bash
git add tools/event-graph-viewer/src/player/eventScheduler.ts tools/event-graph-viewer/tests/player/eventScheduler.test.ts
git commit -m "feat: add anchored timeline event scheduler"
```

---

# Task 4 — Rework runtime to explicit loop advancement and foreground Reset

**Files**
- Modify `tools/event-graph-viewer/src/player/runtime.ts`
- Modify `tools/event-graph-viewer/src/player/knowledge.ts`
- Modify `tools/event-graph-viewer/tests/player/runtime.test.ts`
- Modify `tools/event-graph-viewer/tests/player/knowledge.test.ts`

## 4.1 Write failing tests

```ts
it('reconciles only currentLoopId');
it('does not derive loops from elapsed wall-clock days');
it('OFFLINE reconciliation stops at first boundary');
it('keeps Reset pending until foreground continuation');
it('foreground Reset seals one loop and creates exactly one next loop');
it('new Loop 2+ requires an explicit TimeMode');
it('worldline/action changes preserve anchor identity');
it('confirmAction uses active loop simulation time for deadlines');
```

## 4.2 Replace global `timeAt()` usage

Add:

```ts
export function activeLoop(save: PlayerSave): LoopSave;
export function currentSimulationMinute(save: PlayerSave, safeNowMs: number): number;
```

Reconciliation:

```text
safeNow = max(nowMs, lastConfirmedMs)
active loop
  -> clock target
  -> EventScheduler.advance(lastProcessedMinute, target, OFFLINE)
  -> persist reached minute/history/pending boundary
  -> Knowledge Filter
  -> update lastConfirmedMs
```

Delete the current loop-for-loop catch-up based on elapsed days.

## 4.3 Add explicit boundary/reset API

```ts
export function continuePendingBoundary(...): PlayerSave;
export function createNextLoop(save: PlayerSave, mode: TimeMode, nowMs: number): PlayerSave;
```

```text
pending reset
  -> FOREGROUND resolves Reset once
  -> seal old loop
  -> preserve meta-knowledge
  -> currentLoopId += 1
  -> UI supplies TimeMode
  -> create next Loop anchor
```

## 4.4 Verify

```bash
cd tools/event-graph-viewer
npm test -- tests/player/runtime.test.ts tests/player/knowledge.test.ts tests/player/clock.test.ts tests/player/eventScheduler.test.ts
```

Commit:

```bash
git add tools/event-graph-viewer/src/player/runtime.ts tools/event-graph-viewer/src/player/knowledge.ts tools/event-graph-viewer/tests/player/runtime.test.ts tools/event-graph-viewer/tests/player/knowledge.test.ts
git commit -m "feat: make loop reset a foreground transition"
```

---

# Task 5 — Persist Worldline History and enforce Knowledge Filter + temporal data consistency

**Files**
- Modify `tools/event-graph-viewer/src/player/model.ts`
- Modify `tools/event-graph-viewer/src/player/runtime.ts`
- Modify `tools/event-graph-viewer/src/player/knowledge.ts`
- Modify `tools/event-graph-viewer/src/player/story.ts`
- Modify `tools/event-graph-viewer/tests/player/knowledge.test.ts`
- Create `tools/event-graph-viewer/tests/player/history.test.ts`
- Create `tools/event-graph-viewer/tests/player/storyTiming.test.ts`

## 5.1 Write failing history/knowledge tests

```ts
it('persists simulationMinute and realTimestampMs');
it('keeps internal history for events before a Live Sync entry');
it('does not reveal presence-only evidence that occurred before Player Entry');
it('allows persistent evidence independent of entry window');
it('allows messages to be received after entry once their send time has passed');
it('preserves protagonist meta-memory across Reset but not loop-local world state');
```

Late entry example:

```text
Live Sync entry 21:40
18:31 station event = present in internal Worldline History
station-blackout acquisition = presence
=> not automatically known to protagonist
```

## 5.2 Add explicit acquisition type

```ts
export type RecordAcquisition = 'persistent' | 'message' | 'presence';
```

Initial classification:

```text
persistent: letter, old-death
message:    yu-an-message, station-bulletin-*, reporter-message
presence:   station-blackout
```

Rules:

```text
persistent -> normal condition only
message    -> revealMinute must have passed; may be read after late entry
presence   -> entryMinute <= revealMinute <= currentMinute
```

`matches(history)` remains a world-condition check, not a knowledge grant.

## 5.3 Fix explicit timing contradictions exposed by 06:12 start

Current `yu-an-message` says it is formed/obtained at 18:00 but has `revealMinute: 0`. That becomes impossible after moving Loop 1 to 06:12.

Make the data internally consistent:

```text
yu-an-message revealMinute = 18:00 = 1080
station-blackout = 18:31 = 1111
station bulletin = 18:40 = 1120
reporter message = 21:20 = 1280
```

Add a table-driven `storyTiming.test.ts` that verifies explicit `formedAt`/`obtainedAt` clock strings do not contradict `revealMinute` for timed messages.

Do **not** broadly retime narrative/story schedules here. Pre-14:20 story-authoring expansion is a separate narrative pass; this implementation only removes impossible record timing and makes 06:12 a valid runtime start.

## 5.4 Persist dual-clock history

Stamp persisted simulator history with:

```ts
realTimestampForSimulationMinute(loop.clock, simulationMinute)
```

Keep history internal; `visibleRecords()` projects only player-known information.

## 5.5 Verify

```bash
cd tools/event-graph-viewer
npm test -- tests/player/history.test.ts tests/player/knowledge.test.ts tests/player/storyTiming.test.ts tests/player/worldlines.test.tsx
```

Commit:

```bash
git add tools/event-graph-viewer/src/player/model.ts tools/event-graph-viewer/src/player/runtime.ts tools/event-graph-viewer/src/player/knowledge.ts tools/event-graph-viewer/src/player/story.ts tools/event-graph-viewer/tests/player/history.test.ts tools/event-graph-viewer/tests/player/knowledge.test.ts tools/event-graph-viewer/tests/player/storyTiming.test.ts
git commit -m "feat: separate world history from player knowledge"
```

---

# Task 6 — Add Live Sync bootstrap + Entry Windows + mode choice UI

**Files**
- Create `tools/event-graph-viewer/src/player/entry.ts`
- Modify `tools/event-graph-viewer/src/player/PlayerApp.tsx`
- Modify `tools/event-graph-viewer/src/player/player.css`
- Modify `tools/event-graph-viewer/tests/player/PlayerApp.test.tsx`
- Create `tools/event-graph-viewer/tests/player/entry.test.ts`

## 6.1 Entry Window pure API

```ts
export type EntryWindow =
  | 'dawn'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'post-convergence'
  | 'late-night';

export function entryWindowFor(minute: number): EntryWindow;
export function entryPresentation(window: EntryWindow): { label: string; lines: string[] };
```

Windows:

```text
06:12–08:59 dawn
09:00–11:59 morning
12:00–15:59 afternoon
16:00–18:30 evening
18:31–21:59 post-convergence
22:00–23:59 late-night
```

Test every boundary minute.

## 6.2 Loop 1 opening

First boot never asks for Time Mode.

```text
real any time
  -> Loop 1 ACCELERATED
  -> simulation 06:12
  -> return-train opening presentation
```

Update the current hard-coded opening so it no longer claims the player has already returned to the house at 06:12. The letter may remain a persistent pre-loop artifact/memory, but the scene framing must match the return train.

Do not rewrite the separate `src/playerNarrative` surface in this task.

## 6.3 Loop 2+ mode choice

Only after Reset/new-loop creation:

```text
「跟著現在走」 -> LIVE_SYNC
「回到記憶開始的地方」 -> ACCELERATED
```

No settings toggle after creation.

At real `00:00–06:11`:

- Live Sync disabled/unavailable
- Accelerated remains enabled
- do not manufacture a fake 02:00 Graytide Town time

## 6.4 Bootstrap Live Sync correctly

On `LIVE_SYNC` creation at 21:40:

```text
entryMinute = 21:40
EventScheduler.advance(06:12, 21:40, BOOTSTRAP)
  -> 18:31 Convergence occurs internally
  -> reconstruction continues
  -> world reaches 21:40
Knowledge Filter
  -> only legitimately known records visible
Entry Window
  -> post-convergence opening copy
```

Critical boundaries encountered **before** entry do not stop BOOTSTRAP. Offline stopping rules only apply after the player has entered.

## 6.5 UI tests

```ts
it('does not ask for a mode during Loop 1');
it('frames Loop 1 opening at the 06:12 return train');
it('offers two narrative mode choices after Loop 1 Reset');
it('Live Sync at 17:05 reaches 17:05 and uses evening entry');
it('Live Sync at 21:40 reconstructs through 18:31 and reaches 21:40');
it('does not show a mode toggle after the loop starts');
it('disables Live Sync at 02:00 but keeps Accelerated playable');
```

Verify:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/entry.test.ts tests/player/PlayerApp.test.tsx tests/player/eventScheduler.test.ts
```

Commit:

```bash
git add tools/event-graph-viewer/src/player/entry.ts tools/event-graph-viewer/src/player/PlayerApp.tsx tools/event-graph-viewer/src/player/player.css tools/event-graph-viewer/tests/player/entry.test.ts tools/event-graph-viewer/tests/player/PlayerApp.test.tsx
git commit -m "feat: add live-sync loop entry modes"
```

---

# Task 7 — End-to-end anchored timeline acceptance

**Files**
- Create `tools/event-graph-viewer/tests/player/anchoredTimelineAcceptance.test.ts`
- Modify existing tests only when the approved v0.3 spec explicitly replaces their old expectation

Acceptance cases:

```ts
it('real 17:00 first boot enters Loop 1 at 06:12');
it('12x advances ten real minutes from 06:12 to 08:12');
it('offline catch-up after entry stops at 18:31');
it('Live Sync bootstrap to 21:40 does not stop at the earlier 18:31 boundary');
it('a pending Reset stays foreground-only and creates exactly one next loop');
it('Loop 2 Live Sync 17:05 enters at 17:05');
it('Live Sync bootstrap reconstructs world history without leaking presence-only knowledge');
it('real 02:00 cannot create Live Sync but can create Accelerated');
it('worldline/action changes preserve the active anchor');
it('persisted history contains simulation and real timestamps');
it('a multi-day offline absence never auto-creates later loops');
it('18:00 messages are not visible at 06:12');
```

Run:

```bash
cd tools/event-graph-viewer
npm test -- tests/player/anchoredTimelineAcceptance.test.ts
```

Then full verification:

```bash
npm test
npm run build
```

If failures occur, use `systematic-debugging`; do not weaken the accepted timing rules to make old tests green.

`npm run build` runs `sync-story`, so inspect generated changes:

```bash
git status --short
git diff -- tools/event-graph-viewer/public/story tools/event-graph-viewer/dist
```

Commit only intentional generated artifacts according to existing repository convention.

Final commit:

```bash
git add tools/event-graph-viewer/tests/player/anchoredTimelineAcceptance.test.ts
# add only intentional fixes from verification
git commit -m "test: cover anchored timeline lifecycle"
```

Freshly rerun before declaring success:

```bash
npm test
npm run build
```

---

# Final review checklist

1. No code derives `currentLoopId` from elapsed wall-clock days.
2. Clock functions have no event/Reset side effects.
3. `BOOTSTRAP` can cross earlier Critical Boundaries to reach a late Entry Point.
4. `OFFLINE` stops at the first Critical Boundary after Player Entry.
5. Pending boundaries execute at most once.
6. Reset is the only operation that creates the next Loop.
7. Worldline/action changes do not replace anchors.
8. Live Sync cannot create impossible `00:00–06:11` Graytide Town entry times.
9. v1 -> v2 migration preserves player evidence/knowledge/actions/current progress.
10. Existing author-facing `HH:mm` schedules remain simulation time.
11. Internal reconstructed history is not the same as protagonist knowledge.
12. Timed messages cannot appear before their own send/obtained time.
13. Loop 1 opening presentation actually matches the 06:12 return-train state.

# Expected commit sequence

```text
feat: add loop-owned timeline clock
feat: migrate player saves to loop-owned clocks
feat: add anchored timeline event scheduler
feat: make loop reset a foreground transition
feat: separate world history from player knowledge
feat: add live-sync loop entry modes
test: cover anchored timeline lifecycle
```

The sequence intentionally builds `clock -> persistence -> scheduler -> runtime -> knowledge -> UI -> acceptance`, so each layer has a red/green test boundary before the next layer depends on it.
