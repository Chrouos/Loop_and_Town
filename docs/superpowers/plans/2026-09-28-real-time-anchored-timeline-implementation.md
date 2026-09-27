# Real-time Anchored Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement PR #17's Hybrid Real-time Anchored Timeline for the existing player runtime.

**Architecture:** Keep the deterministic simulator as the story engine. Add a pure loop-owned clock, explicit scheduler intents, v2 per-loop persistence, foreground-only reset, dual-clock history with a knowledge filter, and a small Live Sync entry surface in `src/player`; leave `src/playerNarrative/*` unchanged.

**Tech Stack:** TypeScript 5.6, React 18, Vitest 2, Vite 5, browser `localStorage`.

**Spec:** `docs/superpowers/specs/2026-09-28-real-time-anchored-timeline-design.md` and PR #17's implementation plan.

## Global Constraints

- Loop 1 is always `ACCELERATED`, starts at simulation `06:12`, and defaults to `12x`.
- Loop 2+ chooses `ACCELERATED` or `LIVE_SYNC` only when the loop is created.
- `WorldlineClock` reports time and has no event side effects; `EventScheduler` owns interval processing.
- `BOOTSTRAP` crosses earlier critical boundaries; `OFFLINE` stops at the first critical boundary; `FOREGROUND` resolves one pending boundary.
- Reset never happens implicitly from elapsed wall-clock days; only a foreground transition creates the next loop.
- Author-facing `HH:mm` schedule data remains simulation time.
- Internal history is not automatically protagonist knowledge.

## Review Focus

- Real/local time around midnight must not create an impossible Live Sync entry; test the inactive `00:00–06:11` gap.
- Long or backward wall-clock jumps must not manufacture loops; test clamping and multi-day offline resume.
- Bootstrap and offline must differ at `18:31`, `23:59`, and `00:00`; test each intent.
- v1 saves must preserve current progress and knowledge without synthesizing absent loops; test migration and malformed input.
- Explicit message timestamps must not be visible before their send time; test timing consistency and late entry.

### Task 1: Loop-owned clock and canonical story start

**Files:** `src/player/clock.ts`, `tests/player/clock.test.ts`, `story/world/loop_01_initial.yaml`, `story/loops/loop_01.yaml`.

- [ ] Add red tests for accelerated `06:12`, `12x`, Live Sync local entry, inactive gap, reverse mapping, and side-effect freedom.
- [ ] Implement `TimeMode`, `LoopAnchor`, `LoopClockState`, pure clock functions, and constants.
- [ ] Update canonical loop/world start to `06:12` and run focused clock/story tests.

### Task 2: v2 save model and migration

**Files:** `src/player/model.ts`, `src/player/storage.ts`, related player tests.

- [ ] Add red tests for v2 fresh saves, per-loop clocks/history, v1 migration, malformed normalization, and no synthesized loops.
- [ ] Implement v2 normalization, deterministic `emptyLoop(clock)`, v1 migration, and v2/v1/fresh read order.
- [ ] Run storage/model/logic/board tests.

### Task 3: Scheduler intents and critical boundaries

**Files:** create `src/player/eventScheduler.ts` and `tests/player/eventScheduler.test.ts`.

- [ ] Add red tests for deterministic processing, offline boundary stopping, foreground consumption, and bootstrap crossing earlier boundaries.
- [ ] Implement `advanceLoop`, `firstCriticalBoundary`, and explicit `BOOTSTRAP`/`OFFLINE`/`FOREGROUND` behavior using `createSimulation`.
- [ ] Run scheduler plus simulator/event queue/resolver tests.

### Task 4: Runtime and foreground reset

**Files:** `src/player/runtime.ts`, `src/player/knowledge.ts`, related tests.

- [ ] Add red tests proving reconciliation uses only `currentLoopId`, preserves anchors, stops offline at boundaries, and creates exactly one next loop.
- [ ] Replace global elapsed-day math with active-loop clock/scheduler reconciliation; implement `continuePendingBoundary` and `createNextLoop`.
- [ ] Run runtime/knowledge/clock/scheduler tests.

### Task 5: Dual-clock history and knowledge filtering

**Files:** `src/player/model.ts`, `src/player/runtime.ts`, `src/player/knowledge.ts`, `src/player/story.ts`, related tests.

- [ ] Add red tests for history timestamps, late-entry hidden presence, persistent/message/presence acquisition, meta-memory, and explicit story timing.
- [ ] Persist simulator history with simulation and real timestamps; filter records by acquisition and entry/current minute; set message reveal times to authored times.
- [ ] Run history/knowledge/story timing/worldline tests.

### Task 6: Live Sync entry windows and UI

**Files:** create `src/player/entry.ts` and its tests; modify `PlayerApp.tsx`, `player.css`, UI tests.

- [ ] Add red tests for all entry-window boundaries, Loop 1 framing, post-reset mode choices, late bootstrap, and inactive-gap fallback.
- [ ] Implement entry windows, explicit mode choice at reset, Live Sync bootstrap, and no mid-loop toggle.
- [ ] Run entry/UI/scheduler tests.

### Task 7: End-to-end acceptance and verification

**Files:** create `tests/player/anchoredTimelineAcceptance.test.ts`.

- [ ] Add acceptance coverage for first boot, scale, offline boundaries, bootstrap, reset, mode availability, history, knowledge, and multi-day absence.
- [ ] Run the full test suite and production build; inspect generated story changes and retain only intentional artifacts.

