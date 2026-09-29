# Causal Timeline Workbench v0.1 Implementation Plan

> Gameplay authority: `docs/core-gameplay-spec-v0.1.md` is the canonical source of truth. This plan defines Author / Debug tooling only and must not redefine Player Perception, Memory Capture, or Investigation Wall behavior.
>
> Reconciliation status: implemented on the latest `main` line after replaying the valid PR #18 commits. The original stacked PR branch is historical and must not be merged over the canonical docs.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default full-DAG Event Graph reading experience with a time-oriented Causal Timeline Workbench that lets an author follow one worldline, focus on a causal chain, inspect narrative meaning, and compare several worldlines without exposing runtime field noise by default.

**Architecture:** Keep `story/**/*.yaml` and the existing Story DAG / worldline path schema as source of truth. Add a pure projection layer that derives time positions, character lanes, focused upstream/downstream neighborhoods, search results, and path-set comparisons; render those projections in a new workbench component while retaining the existing Character Graph, simulator Timeline, and legacy Worldline Diff tools. Do not mutate story YAML or write layout state back to canon.

**Tech Stack:** React 18, TypeScript 5.6, `@xyflow/react`, Vitest, Testing Library, existing YAML loaders and Story DAG types.

**Spec:** `docs/superpowers/specs/2026-09-28-causal-timeline-workbench-design.md`

## Global Constraints

- `story/**/*.yaml` remains the canonical story source; no layout state is written back to story data.
- Main Event Graph surface is story-first: natural-language node titles and causal labels are visible; technical IDs/state fields are hidden by default.
- Simulation time is the primary horizontal coordinate; DAG depth must not be used as the default Story DAG x-axis.
- Worldlines are traces over one shared DAG; never duplicate the DAG per worldline.
- Default graph view must not render the complete merged DAG when a named worldline or focus context is available.
- Node Inspector opens only after node selection and defaults to narrative meaning; Debug Data is collapsed.
- Compare mode supports a set of named worldlines, not a hard-coded A/B pair.
- Existing Story DAG schema stays backward compatible in v0.1; comparison is derived from path membership and existing node metadata rather than adding required YAML fields.
- Existing Character Graph, simulator Timeline, and simulator Worldline Diff remain available as separate author tools.

## Review Focus

- Nodes missing `time` must remain readable and deterministic instead of collapsing at x=0 or crashing.
- Multiple events at the same time must occupy distinct lanes/rows and preserve stable ordering.
- A selected worldline may reference a node/edge absent from the merged DAG; the workbench must ignore stale references safely and surface no phantom node.
- Search and character filters combined with focus mode must never reintroduce unrelated full-DAG nodes.
- Compare mode with one selected path, duplicate selections, or no common nodes must still render a useful empty/common-state summary without throwing.

---

### Task 1: Add pure Causal Timeline projections

**Files:**
- Create: `tools/event-graph-viewer/src/lib/causalTimeline.ts`
- Create: `tools/event-graph-viewer/tests/causalTimeline.test.ts`
- Reuse: `tools/event-graph-viewer/src/types/storyDag.ts`

**Interfaces:**
- Consumes: `StoryDagDocument`, `StoryWorldlinePath`.
- Produces:
  - `type CausalTimelineNode = { id: string; title: string; time?: string; minute?: number; actorIds: string[]; laneId: string; pathActive: boolean }`
  - `type CausalTimelineProjection = { nodes: CausalTimelineNode[]; edgeIds: Set<string>; nodeIds: Set<string>; lanes: string[] }`
  - `projectWorldlineTrace(doc: StoryDagDocument, path?: StoryWorldlinePath): CausalTimelineProjection`
  - `getFocusedNodeIds(doc: StoryDagDocument, centerId: string, upstreamHops: number, downstreamHops: number): Set<string>`
  - `filterProjection(projection: CausalTimelineProjection, options: { actorId?: string; query?: string; allowedNodeIds?: Set<string> }): CausalTimelineProjection`
  - `compareWorldlinePaths(doc: StoryDagDocument, paths: StoryWorldlinePath[]): { invariantNodeIds: string[]; variableNodeIdsByPath: Record<string, string[]> }`

- [ ] **Step 1: Write failing projection tests**

Cover: chronological x-source minute parsing, stable same-minute ordering, missing-time nodes, stale path references, two-hop upstream/downstream focus, combined actor+query+focus filtering, and one/many/no-common-node comparisons.

- [ ] **Step 2: Run tests to verify RED**

Run: `cd tools/event-graph-viewer && npm test -- causalTimeline.test.ts`

Expected: FAIL because `src/lib/causalTimeline.ts` does not exist.

- [ ] **Step 3: Implement the projection interfaces**

Use existing `HH:mm` values as simulation time within the current loop. Nodes without time sort after timed nodes while preserving source order. `projectWorldlineTrace` includes only referenced path nodes when a named path is supplied; undefined path means all valid DAG nodes for author fallback only.

- [ ] **Step 4: Run targeted tests**

Run: `cd tools/event-graph-viewer && npm test -- causalTimeline.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/lib/causalTimeline.ts tools/event-graph-viewer/tests/causalTimeline.test.ts
git commit -m "feat(viewer): add causal timeline projections"
```

---

### Task 2: Build the workbench toolbar and path/filter state

**Files:**
- Create: `tools/event-graph-viewer/src/components/CausalTimelineToolbar.tsx`
- Create: `tools/event-graph-viewer/tests/CausalTimelineToolbar.test.tsx`
- Reuse: `tools/event-graph-viewer/src/components/WorldlinePathSelector.tsx`

**Interfaces:**
- Consumes: `StoryWorldlinePath[]`, available actor IDs, current filter/search/compare state.
- Produces:
  - `CausalTimelineToolbar({ paths, selectedPathId, actorIds, actorId, query, compareEnabled, onPathChange, onActorChange, onQueryChange, onCompareToggle })`

- [ ] **Step 1: Write failing toolbar tests**

Assert exactly the primary controls from the spec are present: Loop/Worldline selector, Character Filter, Search, Compare. Verify author-only paths remain available in author mode, search emits text changes, character filter emits actor changes, and Compare toggles explicitly.

- [ ] **Step 2: Run tests to verify RED**

Run: `cd tools/event-graph-viewer && npm test -- CausalTimelineToolbar.test.tsx`

Expected: FAIL because the toolbar does not exist.

- [ ] **Step 3: Implement the toolbar**

Reuse the existing named-path data but do not show `All possibilities` as the default workbench state. Keep labels narrative-facing; technical path IDs remain option values only.

- [ ] **Step 4: Run targeted tests**

Run: `cd tools/event-graph-viewer && npm test -- CausalTimelineToolbar.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/components/CausalTimelineToolbar.tsx tools/event-graph-viewer/tests/CausalTimelineToolbar.test.tsx
git commit -m "feat(viewer): add causal timeline toolbar"
```

---

### Task 3: Render the time-first Causal Timeline graph

**Files:**
- Create: `tools/event-graph-viewer/src/components/CausalTimelineGraph.tsx`
- Create: `tools/event-graph-viewer/tests/CausalTimelineGraph.test.tsx`
- Modify: `tools/event-graph-viewer/src/styles.css`
- Reuse: `tools/event-graph-viewer/src/lib/causalTimeline.ts`

**Interfaces:**
- Consumes: `StoryDagDocument`, `CausalTimelineProjection`, optional focused node IDs, selected node ID.
- Produces:
  - `CausalTimelineGraph({ document, projection, focusedNodeIds, selectedNodeId, onNodeSelect })`

- [ ] **Step 1: Write failing graph tests**

Assert: node labels use story titles rather than `[node_id title]`; time increases left-to-right; actor lane labels render; same-time events do not share one position; only path/focus-filtered nodes render; `18:31 Convergence` remains a single shared node; node click returns its ID.

- [ ] **Step 2: Run tests to verify RED**

Run: `cd tools/event-graph-viewer && npm test -- CausalTimelineGraph.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement timeline layout**

Map `minute` to x position. Map `laneId` to y position. Use Story DAG edges only when both endpoints are in the current projection/focus set. Render concise natural-language edge labels. Preserve pan/zoom but keep nodes non-draggable/non-connectable.

- [ ] **Step 4: Run targeted tests**

Run: `cd tools/event-graph-viewer && npm test -- CausalTimelineGraph.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/components/CausalTimelineGraph.tsx tools/event-graph-viewer/src/styles.css tools/event-graph-viewer/tests/CausalTimelineGraph.test.tsx
git commit -m "feat(viewer): render time-first causal timeline"
```

---

### Task 4: Convert Node Inspector to narrative-first disclosure

**Files:**
- Modify: `tools/event-graph-viewer/src/components/NodeDetailPanel.tsx`
- Modify: `tools/event-graph-viewer/tests/NodeDetailPanel.test.tsx`

**Interfaces:**
- Consumes: current `StoryDagNode`, narrative scenes, upstream titles, downstream titles, incoming/outgoing causal labels.
- Produces updated `NodeDetailPanel` with narrative sections and collapsed debug details.

- [ ] **Step 1: Replace inspector expectations with narrative-first tests**

Assert default visible content is: time/actors, `為什麼發生？`, `接下來影響`, and linked novel scene. Assert node ID, visibility, raw relationship/knowledge arrays, narrative refs, and raw causal labels are inside a collapsed `Debug Data` disclosure and not exposed as the primary heading.

- [ ] **Step 2: Run tests to verify RED**

Run: `cd tools/event-graph-viewer && npm test -- NodeDetailPanel.test.tsx`

Expected: FAIL against the current Before/After-heavy inspector.

- [ ] **Step 3: Implement the narrative-first inspector**

Use `detail.reason` plus upstream titles for `為什麼發生？`; use downstream titles and delayed effects for `接下來影響`. Preserve the complete existing data under `<details>` labelled `Debug Data` so no author information is lost.

- [ ] **Step 4: Run targeted tests**

Run: `cd tools/event-graph-viewer && npm test -- NodeDetailPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/components/NodeDetailPanel.tsx tools/event-graph-viewer/tests/NodeDetailPanel.test.tsx
git commit -m "feat(viewer): make node inspector narrative first"
```

---

### Task 5: Add Focus Mode interactions

**Files:**
- Create: `tools/event-graph-viewer/src/components/CausalFocusControls.tsx`
- Create: `tools/event-graph-viewer/tests/CausalFocusControls.test.tsx`
- Modify: `tools/event-graph-viewer/src/components/CausalTimelineGraph.tsx`
- Modify: `tools/event-graph-viewer/tests/CausalTimelineGraph.test.tsx`

**Interfaces:**
- Consumes: selected node ID and focus callbacks.
- Produces:
  - `CausalFocusControls({ selectedNodeId, onWhy, onEffects, onToConvergence, onCharacterOnly, onClear })`
  - Workbench focus modes mapping to `getFocusedNodeIds(...)`.

- [ ] **Step 1: Write failing focus interaction tests**

Cover `Why did this happen`, `What does this affect`, `Show full chain to 18:31`, `Show this character only`, and clear focus. Verify focus never adds nodes outside the selected worldline trace.

- [ ] **Step 2: Run tests to verify RED**

Run: `cd tools/event-graph-viewer && npm test -- CausalFocusControls.test.tsx CausalTimelineGraph.test.tsx`

Expected: FAIL because focus controls are missing.

- [ ] **Step 3: Implement focus controls and projection intersection**

`Why` = upstream two hops plus current node. `Effects` = downstream two hops plus current node. `To 18:31` = descendants on the selected trace until a node whose title/time identifies the 18:31 convergence; if absent, keep all reachable descendants. Character-only intersects with current trace and selected actor IDs.

- [ ] **Step 4: Run targeted tests**

Run: `cd tools/event-graph-viewer && npm test -- CausalFocusControls.test.tsx CausalTimelineGraph.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/components/CausalFocusControls.tsx tools/event-graph-viewer/src/components/CausalTimelineGraph.tsx tools/event-graph-viewer/tests/CausalFocusControls.test.tsx tools/event-graph-viewer/tests/CausalTimelineGraph.test.tsx
git commit -m "feat(viewer): add causal focus mode"
```

---

### Task 6: Add multi-worldline Compare mode

**Files:**
- Create: `tools/event-graph-viewer/src/components/WorldlineSetCompare.tsx`
- Create: `tools/event-graph-viewer/tests/WorldlineSetCompare.test.tsx`
- Reuse: `tools/event-graph-viewer/src/lib/causalTimeline.ts`

**Interfaces:**
- Consumes: `StoryDagDocument`, visible `StoryWorldlinePath[]`, selected path IDs.
- Produces:
  - `WorldlineSetCompare({ document, paths, selectedPathIds, onSelectedPathIdsChange, onClose })`

- [ ] **Step 1: Write failing compare tests**

Assert: users can select Loop 01/02/03 simultaneously; common nodes appear under `Invariant`; path-specific nodes appear under each worldline's `Variable`; duplicate selections collapse to one; one-path and zero-common-node cases render without error; author-only paths respect current author visibility.

- [ ] **Step 2: Run tests to verify RED**

Run: `cd tools/event-graph-viewer && npm test -- WorldlineSetCompare.test.tsx`

Expected: FAIL because compare mode does not exist.

- [ ] **Step 3: Implement compare mode**

Use path membership as the v0.1 invariant/variable definition. Display narrative titles, times, and actors. Do not claim route/knowledge/relationship semantic equality when current schema cannot prove it; show those details only through the linked nodes/Inspector.

- [ ] **Step 4: Run targeted tests**

Run: `cd tools/event-graph-viewer && npm test -- WorldlineSetCompare.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/components/WorldlineSetCompare.tsx tools/event-graph-viewer/tests/WorldlineSetCompare.test.tsx
git commit -m "feat(viewer): add multi-worldline compare mode"
```

---

### Task 7: Integrate the Workbench into the Event Graph tab

**Files:**
- Create: `tools/event-graph-viewer/src/components/CausalTimelineWorkbench.tsx`
- Create: `tools/event-graph-viewer/tests/CausalTimelineWorkbench.test.tsx`
- Modify: `tools/event-graph-viewer/src/App.tsx`
- Modify: `tools/event-graph-viewer/tests/App.test.tsx`
- Modify: `tools/event-graph-viewer/src/styles.css`

**Interfaces:**
- Consumes: merged `StoryDagDocument`, `StoryWorldlinePath[]`, narrative scenes.
- Produces:
  - `CausalTimelineWorkbench({ document, paths, narrativeScenes })`
  - Event Graph tab delegates all graph-specific UI state to the workbench.

- [ ] **Step 1: Write failing integration tests**

Assert the default Event Graph tab shows one named worldline trace, natural-language node labels, character lane/filter/search/compare controls, and no always-visible Scenario Simulator. Clicking a node opens the inspector; clearing selection removes it. Switching Loop 03/04/05/06/07/Final still surfaces representative nodes and linked novel scenes from the existing acceptance coverage.

- [ ] **Step 2: Run tests to verify RED**

Run: `cd tools/event-graph-viewer && npm test -- CausalTimelineWorkbench.test.tsx App.test.tsx`

Expected: FAIL against the current `EventGraphView + WorldlinePathSelector + always-on ScenarioSimulator` composition.

- [ ] **Step 3: Implement Workbench composition**

Move graph-only UI state (`selectedPathId`, selected node, actor filter, search query, focus state, compare mode) into `CausalTimelineWorkbench`. In `App.tsx`, render `ScenarioSimulator` only for simulator Timeline / legacy Worldline Diff views, not for Event Graph or Character Graph.

- [ ] **Step 4: Update existing story acceptance expectations**

Change tests that currently search for bracketed technical labels (`[Nxx title]`) to narrative title queries while retaining Loop 01–Final coverage and linked-scene assertions.

- [ ] **Step 5: Run targeted integration tests**

Run: `cd tools/event-graph-viewer && npm test -- CausalTimelineWorkbench.test.tsx App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/event-graph-viewer/src/components/CausalTimelineWorkbench.tsx tools/event-graph-viewer/src/App.tsx tools/event-graph-viewer/src/styles.css tools/event-graph-viewer/tests/CausalTimelineWorkbench.test.tsx tools/event-graph-viewer/tests/App.test.tsx
git commit -m "feat(viewer): integrate causal timeline workbench"
```

---

### Task 8: Full regression and production verification

**Files:**
- Modify only if verification exposes a regression in the files already owned by Tasks 1–7.

**Interfaces:**
- No new interfaces.

- [ ] **Step 1: Run the complete test suite**

Run: `cd tools/event-graph-viewer && npm test`

Expected: all tests PASS.

- [ ] **Step 2: Run TypeScript + production build**

Run: `cd tools/event-graph-viewer && npm run build`

Expected: `tsc --noEmit` and Vite build PASS.

- [ ] **Step 3: Check patch hygiene**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Manual author-flow smoke test**

Check:

```text
Loop 01 → choose a node → Why → Effects → clear
Loop 02 → filter 若晴 → search 車站
Loop 03 → verify 18:31 convergence remains readable
Compare → Loop 01 + Loop 02 + Loop 03
Node Inspector → narrative first → expand Debug Data
Timeline tab → Scenario Simulator still available
Character Graph → existing visibility modes unchanged
```

Expected: no full-DAG information wall on initial Event Graph view; no loss of access to existing author tooling.

- [ ] **Step 5: Commit verification-only fixes if any**

Only commit changes required by failed verification; otherwise no code commit is needed for this task.

---

# Self-review Result

- Spec coverage: Causal Timeline, time-first layout, Focus Mode, Timeline Lanes, narrative-first Inspector, collapsed Debug Data, multi-worldline Compare, Variable/Invariant summary, and existing-tool preservation all map to explicit tasks.
- Scope intentionally leaves Story DAG YAML/schema unchanged in v0.1. Rich semantic comparison of route/knowledge/relationship values is not inferred when canon does not provide a structured comparable snapshot.
- The legacy `EventGraphView` remains in the codebase for old Event Graph document projection/tests; the new Story DAG author experience is routed through `CausalTimelineWorkbench`.
- Review-focus edge cases are pinned to Tasks 1, 3, 5, and 6.
