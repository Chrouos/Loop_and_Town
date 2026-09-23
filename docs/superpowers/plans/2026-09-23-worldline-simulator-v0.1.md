# Worldline Simulator v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a deterministic worldline simulator that generates the four 18:31 acceptance outcomes and propagates the required delayed 21:14 consequence into Timeline and Worldline Diff.

**Architecture:** Keep a framework-independent simulator under `tools/event-graph-viewer/src/simulator/`. Story YAML is normalized into typed definitions, simulation work is resolved through one deterministic queue, and append-only runtime history is projected into the existing Viewer types. React only owns scenario controls and presentation.

**Tech Stack:** TypeScript 5.6, React 18, Vite 5, Vitest 2, js-yaml.

**Spec:** `docs/superpowers/specs/2026-09-23-worldline-simulator-v0.1-design.md`

## Global Constraints

- Story YAML is the Source of Truth.
- No `eval()` or arbitrary JavaScript from story YAML.
- Simulation must be deterministic.
- Queue order is `executeAt`, then insertion order.
- `do_nothing` is `[]`, not an authored action.
- `wakaharu_dies` must cause `evt_2114_reporter_missing` at 21:14; the other 18:31 outcomes must not.
- Maximum processed queue items per run is 1,000.
- Simulator code must not import React/UI modules.
- Implementation branch must descend from `docs/worldline-simulator-v0.1-spec`, which already descends from PR #1 Viewer head.

## Review Focus

- Missing state paths: `eq` / `neq` must throw instead of silently comparing `undefined`.
- Same-time work: queue insertion order must remain stable across scheduled, delayed, and emitted items.
- Fallback semantics: fallback only runs when all conditional variants fail and cannot have `when`.
- Event cycles: repeated `emit_event` must trip the 1,000-item guard instead of locking the browser.
- Public snapshots: mutating values returned by `getState()` / `getHistory()` must not mutate simulator internals.

---

## File Structure

Create:

```text
tools/event-graph-viewer/src/simulator/types.ts
tools/event-graph-viewer/src/simulator/time.ts
tools/event-graph-viewer/src/simulator/state.ts
tools/event-graph-viewer/src/simulator/conditionEvaluator.ts
tools/event-graph-viewer/src/simulator/eventQueue.ts
tools/event-graph-viewer/src/simulator/effectExecutor.ts
tools/event-graph-viewer/src/simulator/eventResolver.ts
tools/event-graph-viewer/src/simulator/validation.ts
tools/event-graph-viewer/src/simulator/simulator.ts
tools/event-graph-viewer/src/simulator/projection.ts
tools/event-graph-viewer/src/lib/loadSimulationStory.ts
tools/event-graph-viewer/src/components/ScenarioSimulator.tsx

tools/event-graph-viewer/tests/conditionEvaluator.test.ts
tools/event-graph-viewer/tests/eventQueue.test.ts
tools/event-graph-viewer/tests/eventResolver.test.ts
tools/event-graph-viewer/tests/simulator.test.ts
tools/event-graph-viewer/tests/scenarioSimulator.test.tsx

story/world/day_01_initial.yaml
story/actions/day_01_actions.yaml
story/events/day_01_2114.yaml
```

Modify:

```text
story/events/day_01_1831.yaml
tools/event-graph-viewer/scripts/sync-story.mjs
tools/event-graph-viewer/src/App.tsx
tools/event-graph-viewer/src/types/story.ts
tools/event-graph-viewer/tests/App.test.tsx
```

---

### Task 1: Simulator primitives — time, state, conditions, queue

**Files:**
- Create: `src/simulator/types.ts`
- Create: `src/simulator/time.ts`
- Create: `src/simulator/state.ts`
- Create: `src/simulator/conditionEvaluator.ts`
- Create: `src/simulator/eventQueue.ts`
- Test: `tests/conditionEvaluator.test.ts`
- Test: `tests/eventQueue.test.ts`

**Interfaces:**
- Produces: `parseTime(time: string): number`, `formatTime(minute: number): string`, `getPath(state, path)`, `setPath(state, path, value)`, `evaluateCondition(condition, state): boolean`, `SimulationQueue`.
- Produces shared types: `WorldState`, `Condition`, `QueueItem`, `StateChange`.

- [ ] **Step 1: Write failing condition tests** for `eq`, `neq`, `exists`, `not_exists`, nested `all`/`any`/`not`, and missing-path errors for `eq`/`neq`.
- [ ] **Step 2: Run** `npm test -- conditionEvaluator.test.ts` from `tools/event-graph-viewer`; expected FAIL because simulator modules do not exist.
- [ ] **Step 3: Implement minimal time/state/condition primitives** with explicit path errors and no dynamic evaluation.
- [ ] **Step 4: Re-run condition tests**; expected PASS.
- [ ] **Step 5: Write failing queue tests** proving chronological order and stable same-time insertion order across mixed item kinds.
- [ ] **Step 6: Run** `npm test -- eventQueue.test.ts`; expected FAIL because `SimulationQueue` does not exist.
- [ ] **Step 7: Implement minimal `SimulationQueue`** with monotonic insertion counter and immutable `peekAll()` result.
- [ ] **Step 8: Run both test files**; expected PASS.
- [ ] **Step 9: Commit** `feat: add deterministic simulator primitives`.

---

### Task 2: Event resolution and effect execution

**Files:**
- Create: `src/simulator/effectExecutor.ts`
- Create: `src/simulator/eventResolver.ts`
- Extend: `src/simulator/types.ts`
- Test: `tests/eventResolver.test.ts`

**Interfaces:**
- Consumes: state/path functions and `SimulationQueue` from Task 1.
- Produces: `executeEffects(context, effects): StateChange[]`, `resolveEvent(context, event): ResolvedEvent`.

- [ ] **Step 1: Write failing tests** for priority selection, explicit fallback, duplicate matching priority ambiguity, no-match error, `set`, `add_flag`, current-time `emit_event`, and absolute-time `emit_event`.
- [ ] **Step 2: Run** `npm test -- eventResolver.test.ts`; expected FAIL because resolver/effect executor are missing.
- [ ] **Step 3: Implement constrained effect execution**; every state mutation returns `{ path, before, after }`; `emit_event` only queues known event IDs.
- [ ] **Step 4: Implement event resolution**: evaluate conditional variants, detect same-priority matching ambiguity, then fallback, then effects/delayed scheduling.
- [ ] **Step 5: Run** `npm test -- eventResolver.test.ts`; expected PASS.
- [ ] **Step 6: Commit** `feat: resolve event variants and effects`.

---

### Task 3: Validation, simulator orchestration, and history

**Files:**
- Create: `src/simulator/validation.ts`
- Create: `src/simulator/simulator.ts`
- Extend: `src/simulator/types.ts`
- Test: `tests/simulator.test.ts`

**Interfaces:**
- Consumes: Task 1 queue/conditions and Task 2 resolver/effects.
- Produces: `createSimulation(definition, initialState)`, `simulate(input)`, `Simulation` methods from the spec, append-only `WorldlineHistoryEntry[]`.

- [ ] **Step 1: Write failing tests** for authored events entering the queue, actions executing before 18:31, backwards-time rejection, deterministic repeat runs, immutable snapshots, delayed-effect execution, and 1,000-item safety guard.
- [ ] **Step 2: Run** `npm test -- simulator.test.ts`; expected FAIL because the simulator API is missing.
- [ ] **Step 3: Implement validation** for duplicate IDs, time format, fallback rules, negative delay, unknown emitted event IDs, and state paths detectable from initial state.
- [ ] **Step 4: Implement `createSimulation` / `simulate`**. At creation, enqueue only authored events with `at`; emitted-only events such as `evt_2114_reporter_missing` are definitions but are not globally scheduled.
- [ ] **Step 5: Record ordered history** for player actions, event resolution, state-changing effects, and delayed-effect execution.
- [ ] **Step 6: Run** `npm test -- simulator.test.ts`; expected PASS.
- [ ] **Step 7: Run** `npm test`; expected all current tests PASS.
- [ ] **Step 8: Commit** `feat: orchestrate deterministic worldline simulation`.

---

### Task 4: Author the binding story scenario

**Files:**
- Create: `story/world/day_01_initial.yaml`
- Create: `story/actions/day_01_actions.yaml`
- Modify: `story/events/day_01_1831.yaml`
- Create: `story/events/day_01_2114.yaml`
- Create/extend: `tests/simulator.test.ts`

**Interfaces:**
- Consumes: simulator API from Task 3.
- Produces: canonical v0.1 story data and four executable acceptance cases.

- [ ] **Step 1: Add four failing scenario tests** using parsed story definitions:
  - `[] → wakaharu_dies → reporter missing at 21:14`
  - `[protect_wakaharu] → doctor_dies → reporter remains alive`
  - `[stop_doctor] → wakaharu_dies → reporter missing at 21:14`
  - `[protect_wakaharu, stop_doctor] → no_death → reporter remains alive`
- [ ] **Step 2: Run scenario tests**; expected FAIL because canonical world/action/21:14 data are missing or old 18:31 data use legacy syntax.
- [ ] **Step 3: Author structured AST story data** exactly matching the spec. `evt_2114_reporter_missing` has no global `at`; it is emitted by the delayed chain.
- [ ] **Step 4: Run scenario tests**; expected PASS with exact variant IDs and reporter statuses.
- [ ] **Step 5: Commit** `feat: add first causal worldline scenario`.

---

### Task 5: Story loader and Viewer projections

**Files:**
- Create: `src/lib/loadSimulationStory.ts`
- Create: `src/simulator/projection.ts`
- Modify: `src/types/story.ts`
- Modify: `scripts/sync-story.mjs`
- Test: `tests/simulator.test.ts`

**Interfaces:**
- Consumes: canonical YAML and simulator history.
- Produces: `loadSimulationStory()`, `projectTimelineEntries(history)`, `projectWorldlineEvents(history)` compatible with existing `TimelineView` and `WorldlineDiffView`.

- [ ] **Step 1: Write failing projection tests** proving action/effect history is retained by the simulator but Diff receives only event-resolution rows and does not collapse unrelated history.
- [ ] **Step 2: Run relevant tests**; expected FAIL because projection/loader are missing.
- [ ] **Step 3: Extend story sync** to copy world/actions/events into `public/story` without changing Source-of-Truth ownership.
- [ ] **Step 4: Implement loader + projection** and keep existing Event Graph normalization available for Graph view.
- [ ] **Step 5: Run** `npm test`; expected PASS.
- [ ] **Step 6: Commit** `feat: project simulator history into viewer models`.

---

### Task 6: Scenario UI integration

**Files:**
- Create: `src/components/ScenarioSimulator.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/App.test.tsx`
- Create: `tests/scenarioSimulator.test.tsx`

**Interfaces:**
- Consumes: `loadSimulationStory`, `simulate`, history projections.
- Produces: two action-set controls whose generated histories feed existing Timeline and Worldline Diff views.

- [ ] **Step 1: Write failing UI test** selecting `protect_wakaharu`, simulating, and asserting Timeline contains `doctor_dies` rather than fixture data.
- [ ] **Step 2: Write failing Diff UI test** comparing `[]` with `[protect_wakaharu, stop_doctor]` and asserting 18:31 differs and 21:14 is present on only the first worldline.
- [ ] **Step 3: Run** `npm test -- scenarioSimulator.test.tsx App.test.tsx`; expected FAIL because runtime scenario controls are absent.
- [ ] **Step 4: Implement minimal `ScenarioSimulator`** with two checkboxes per worldline and a Simulate action; no free-form commands.
- [ ] **Step 5: Replace `worldlines.json` usage in `App.tsx`** with generated histories while leaving Graph view definition-driven.
- [ ] **Step 6: Run targeted UI tests**; expected PASS.
- [ ] **Step 7: Run full `npm test`**; expected PASS.
- [ ] **Step 8: Commit** `feat: drive viewer from generated worldlines`.

---

### Task 7: Final verification and cleanup

**Files:**
- Modify only files required by failures found during verification.

**Interfaces:**
- Consumes: entire v0.1 implementation.
- Produces: verified branch ready for review.

- [ ] **Step 1: Run** `npm test` in `tools/event-graph-viewer`; expected PASS.
- [ ] **Step 2: Run** `npm run build`; expected PASS including story sync and TypeScript checks.
- [ ] **Step 3: Re-run the four acceptance cases** and inspect generated histories for exact 18:31/21:14 causal differences.
- [ ] **Step 4: Verify no production import from `src/simulator/**` points to React/UI modules.**
- [ ] **Step 5: Verify no remaining runtime import of `src/fixtures/worldlines.json`.**
- [ ] **Step 6: Commit any verification fixes** using RED → GREEN for behavioral fixes.
