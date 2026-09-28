# DAG Story Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Day 01 story causality into a canonical DAG and make the Event Graph Viewer read it as `[Node] --effect--> [Node]`, with expandable node details and worldline paths.

**Architecture:** Keep story causality in story data as the source of truth, project it into a viewer-specific DAG model, and render it with the existing `@xyflow/react` viewer. Novel prose stays attached to nodes through narrative references instead of duplicating story text inside the graph. Worldlines are paths through the same DAG, not separate graphs.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest, Testing Library, `@xyflow/react`, YAML story data.

**Spec:** `docs/superpowers/specs/2026-09-27-dag-story-viewer-design.md`

## Global Constraints

- Story logic remains data-driven; the viewer must not become the source of truth.
- The main graph must read like `[N01 event] --effect--> [N02 event]` and support branch + convergence.
- Edge labels carry causal meaning such as `trust +1`, `reveal: station_plan`, `delay handoff`, `route change`.
- Node detail holds Before / After / Reason / Affected Characters / Delayed Effects / Knowledge / Relationship changes.
- Novel prose is referenced from the node and shown on demand; do not duplicate prose across graph data and narrative files.
- Worldline is a path through the DAG.
- Day 01 must contain enough small and medium causal nodes that 18:31 is the result of accumulated changes, not a single `go station / do not go station` switch.

## Review Focus

- A graph with two upstream branches converging on one node must render one convergence node, not duplicates.
- Missing optional node detail or narrative reference must not break rendering; the node still appears.
- An edge that references a missing node must be rejected by validation/tests rather than silently disappearing.
- Worldline highlighting must not reveal author-only branches in player mode.
- Selecting a node with multiple downstream effects must show all direct effects without recursively flooding the UI.

---

## File Structure

- `story/events/day_01_story_dag.yaml` — canonical Day 01 causal nodes and edges.
- `story/worldlines/day_01_paths.yaml` — named baseline/test worldline paths through the DAG.
- `story/schemas/story-dag.schema.json` — DAG shape validation.
- `tools/event-graph-viewer/src/types/story.ts` — DAG, node detail, edge, and path types.
- `tools/event-graph-viewer/src/lib/loadStory.ts` — parse/normalize DAG YAML.
- `tools/event-graph-viewer/src/lib/storyDag.ts` — validate references, build graph projection, select worldline path.
- `tools/event-graph-viewer/src/components/EventGraphView.tsx` — render causal DAG instead of role columns when DAG data is supplied.
- `tools/event-graph-viewer/src/components/NodeDetailPanel.tsx` — selected-node inspector with novel reference.
- `tools/event-graph-viewer/src/components/WorldlinePathSelector.tsx` — select/highlight Loop paths.
- `tools/event-graph-viewer/src/App.tsx` — wire DAG, selection, and path state into existing tabs.
- `tools/event-graph-viewer/src/styles.css` — graph node/edge/path/inspector styling.
- `tools/event-graph-viewer/tests/storyDag.test.ts` — parser, reference, convergence, path tests.
- `tools/event-graph-viewer/tests/EventGraphView.test.tsx` — viewer node/edge labels and selection.
- `tools/event-graph-viewer/tests/NodeDetailPanel.test.tsx` — detail rendering.
- `tools/event-graph-viewer/tests/WorldlinePathSelector.test.tsx` — path filtering/highlighting behavior.

---

### Task 1: Define canonical Day 01 DAG data shape

**Files:**
- Create: `story/schemas/story-dag.schema.json`
- Create: `story/events/day_01_story_dag.yaml`
- Create: `story/worldlines/day_01_paths.yaml`
- Modify: `tools/event-graph-viewer/src/types/story.ts`
- Test: `tools/event-graph-viewer/tests/storyDag.test.ts`

**Interfaces:**
- Produces `StoryDagDocument`, `StoryDagNode`, `StoryDagEdge`, `StoryDagNodeDetail`, `StoryWorldlinePath` types.
- Node IDs use stable author-facing IDs such as `N01_wakaharu_photography`, not generated array indexes.

- [ ] **Step 1: Write the failing shape test**

Create `storyDag.test.ts` assertions that a minimal document parses nodes, causal edge labels, detail blocks, and worldline node sequences.

- [ ] **Step 2: Run the focused test**

Run: `cd tools/event-graph-viewer && npm test -- storyDag.test.ts`

Expected: FAIL because DAG types/parser do not exist.

- [ ] **Step 3: Add DAG types to `src/types/story.ts`**

Required interfaces:

```ts
export type StoryDagNodeDetail = {
  before: string[];
  after: string[];
  reason?: string;
  affectedCharacters: string[];
  delayedEffects: string[];
  knowledgeChanges: string[];
  relationshipChanges: string[];
  narrativeRefs: string[];
};

export type StoryDagNode = {
  id: string;
  title: string;
  time?: string;
  actorIds: string[];
  visibility: 'public' | 'author' | 'player-known';
  detail: StoryDagNodeDetail;
};

export type StoryDagEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  visibility: 'public' | 'author' | 'player-known';
};

export type StoryDagDocument = {
  id: string;
  title: string;
  nodes: StoryDagNode[];
  edges: StoryDagEdge[];
};

export type StoryWorldlinePath = {
  id: string;
  label: string;
  nodeIds: string[];
  edgeIds: string[];
};
```

- [ ] **Step 4: Write the schema and Day 01 starter DAG**

The first canonical chain must include at least:

```text
N01 與若晴聊攝影
→ trust +1
N02 若晴放下戒心
→ reveal: station_plan
N03 玩家知道車站行程
├─ stop wakaharu → N04 若晴沒有去車站 → no recipient → N05 柏勳自行帶資料
└─ tell reporter → N06 庭安改變行程 → arrive station → N07 庭安遇見柏勳 → delay handoff → N08 柏勳延後離開
N04/N05/N08 → N20 18:31 Convergence
```

Also add independent Day 01 chains for:
- 予安是否被帶去 18:31 異常區 → later memory residue seed.
- 予安是否錯過 20:00 房仲約.
- 柏勳是否提早被問到知夏/若晴 → handoff route changes.
- 庭安是否看到第七封信 → route/information changes.

Do not encode Chapter 4+ truth as player-visible detail.

- [ ] **Step 5: Add named paths**

At minimum:
- `loop_01_baseline`
- `loop_02_wakaharu_saved_doctor_dies`
- `loop_03_no_death`

- [ ] **Step 6: Run tests**

Run: `cd tools/event-graph-viewer && npm test -- storyDag.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add story/schemas/story-dag.schema.json story/events/day_01_story_dag.yaml story/worldlines/day_01_paths.yaml tools/event-graph-viewer/src/types/story.ts tools/event-graph-viewer/tests/storyDag.test.ts
git commit -m "story: define canonical day 01 causal DAG"
```

---

### Task 2: Parse and validate DAG references

**Files:**
- Modify: `tools/event-graph-viewer/src/lib/loadStory.ts`
- Create: `tools/event-graph-viewer/src/lib/storyDag.ts`
- Test: `tools/event-graph-viewer/tests/storyDag.test.ts`

**Interfaces:**
- Produces `parseStoryDagText(text: string): StoryDagDocument`.
- Produces `validateStoryDag(doc: StoryDagDocument): string[]`.
- Produces `buildStoryDagProjection(doc, mode): GraphProjection`.

- [ ] **Step 1: Add failing parser/reference tests**

Assert:
- YAML normalizes omitted detail arrays to `[]`.
- missing optional `reason` is allowed.
- edge with unknown source/target returns validation error.
- two branches may share the same target convergence node.

- [ ] **Step 2: Run focused tests**

Run: `cd tools/event-graph-viewer && npm test -- storyDag.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement parser + validation**

Keep `buildEventGraph()` for legacy event documents; add the DAG path beside it rather than replacing unrelated simulator logic.

- [ ] **Step 4: Implement graph projection**

Map `StoryDagNode` into existing `GraphNode` representation or extend `GraphProjection` minimally so edge labels survive unchanged.

Player mode must filter `author` nodes/edges.

- [ ] **Step 5: Run tests**

Run: `cd tools/event-graph-viewer && npm test -- storyDag.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/event-graph-viewer/src/lib/loadStory.ts tools/event-graph-viewer/src/lib/storyDag.ts tools/event-graph-viewer/tests/storyDag.test.ts
git commit -m "feat: parse and validate story DAG"
```

---

### Task 3: Render the reader-style causal DAG

**Files:**
- Modify: `tools/event-graph-viewer/src/components/EventGraphView.tsx`
- Modify: `tools/event-graph-viewer/src/styles.css`
- Create: `tools/event-graph-viewer/tests/EventGraphView.test.tsx`

**Interfaces:**
- `EventGraphView` accepts a `StoryDagDocument`/projection and optional selected path.
- Emits `onNodeSelect(nodeId: string)`.

- [ ] **Step 1: Add failing component test**

Render a test DAG and assert visible text includes:
- `[N01 與若晴聊攝影]`
- `trust +1`
- `reveal: station_plan`
- one `N20 18:31 Convergence` node shared by multiple incoming edges.

- [ ] **Step 2: Run test**

Run: `cd tools/event-graph-viewer && npm test -- EventGraphView.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Replace role-column layout for DAG mode**

Use `@xyflow/react` with stable layout by causal depth/time. Preserve existing event-document mode for current simulator/debug views.

Node visible label format:

```text
[N01 與若晴聊攝影]
```

Edge visible label format:

```text
trust +1
reveal: station_plan
delay handoff
```

- [ ] **Step 4: Add path styling hooks**

Selected-worldline nodes/edges get `is-active-path`; unrelated reachable branches stay visible but subdued in author mode.

- [ ] **Step 5: Run test + existing graph tests**

Run: `cd tools/event-graph-viewer && npm test -- EventGraphView.test.tsx eventGraph.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/event-graph-viewer/src/components/EventGraphView.tsx tools/event-graph-viewer/src/styles.css tools/event-graph-viewer/tests/EventGraphView.test.tsx
git commit -m "feat: render causal DAG story reader"
```

---

### Task 4: Add node inspector and novel scene references

**Files:**
- Create: `tools/event-graph-viewer/src/components/NodeDetailPanel.tsx`
- Modify: `tools/event-graph-viewer/src/App.tsx`
- Test: `tools/event-graph-viewer/tests/NodeDetailPanel.test.tsx`

**Interfaces:**
- `NodeDetailPanel({ node, narrativeScenes })`.
- Uses existing narrative data by scene ID/reference; does not copy story prose into graph YAML.

- [ ] **Step 1: Add failing detail-panel test**

Assert selected node shows:
- 時間 / 角色
- Before
- After
- Reason
- Affected Characters
- Delayed Effects
- Knowledge Changes
- Relationship Changes
- linked novel scene heading/text when reference resolves.

Also assert a node with no narrative reference still renders safely.

- [ ] **Step 2: Run test**

Run: `cd tools/event-graph-viewer && npm test -- NodeDetailPanel.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement inspector**

Selecting a graph node updates a right-side inspector. Keep direct downstream effects visible as linked node titles; do not recursively expand descendants by default.

- [ ] **Step 4: Wire narrative references**

Reuse existing narrative loader/data structures already used by the player; resolve only the referenced scene IDs.

- [ ] **Step 5: Run test**

Run: `cd tools/event-graph-viewer && npm test -- NodeDetailPanel.test.tsx App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/event-graph-viewer/src/components/NodeDetailPanel.tsx tools/event-graph-viewer/src/App.tsx tools/event-graph-viewer/tests/NodeDetailPanel.test.tsx
git commit -m "feat: inspect story DAG nodes with novel scenes"
```

---

### Task 5: Add Worldline Path selector and highlighting

**Files:**
- Create: `tools/event-graph-viewer/src/components/WorldlinePathSelector.tsx`
- Modify: `tools/event-graph-viewer/src/App.tsx`
- Modify: `tools/event-graph-viewer/src/components/EventGraphView.tsx`
- Test: `tools/event-graph-viewer/tests/WorldlinePathSelector.test.tsx`

**Interfaces:**
- `WorldlinePathSelector({ paths, selectedId, onChange })`.
- EventGraph gets `activeNodeIds` and `activeEdgeIds` derived from selected path.

- [ ] **Step 1: Add failing path tests**

Assert switching from `loop_01_baseline` to `loop_02_wakaharu_saved_doctor_dies` changes the active path and keeps the shared convergence node active in both.

Assert player mode cannot select an author-only path.

- [ ] **Step 2: Run test**

Run: `cd tools/event-graph-viewer && npm test -- WorldlinePathSelector.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement selector + path projection**

Show path labels as human-readable Loop names and provide an `All possibilities` author option.

- [ ] **Step 4: Run tests**

Run: `cd tools/event-graph-viewer && npm test -- WorldlinePathSelector.test.tsx EventGraphView.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/components/WorldlinePathSelector.tsx tools/event-graph-viewer/src/App.tsx tools/event-graph-viewer/src/components/EventGraphView.tsx tools/event-graph-viewer/tests/WorldlinePathSelector.test.tsx
git commit -m "feat: highlight worldline paths in story DAG"
```

---

### Task 6: Expand Day 01 causality so the graph is story-complete

**Files:**
- Modify: `story/events/day_01_story_dag.yaml`
- Modify: `story/worldlines/day_01_paths.yaml`
- Modify as needed: `story/narrative/loop_01_player.yaml`
- Modify as needed: `story/narrative/loop_01_prologue.yaml`
- Test: `tools/event-graph-viewer/tests/firstLoopEvents.test.ts`
- Test: `tools/event-graph-viewer/tests/storyDag.test.ts`

**Interfaces:**
- Every major Day 01 node links to either an existing novel scene or a newly written scene.
- Every important branch has an explicit causal edge label.

- [ ] **Step 1: Add story completeness assertions**

Pin these chains:

```text
若晴攝影 → trust → station_plan → multiple player actions
庭安收到資訊 → route change → encounter/handoff timing changes
柏勳資訊狀態 → handoff recipient/route changes
予安是否協助玩家 → misses realtor / station exposure → later residue seed
18:31 inputs → one shared convergence node
post-18:31 choices → 20:00/20:30/21:14 delayed life consequences
```

- [ ] **Step 2: Run focused tests**

Run: `cd tools/event-graph-viewer && npm test -- firstLoopEvents.test.ts storyDag.test.ts`

Expected: FAIL until all required chains exist.

- [ ] **Step 3: Fill Day 01 DAG nodes/edges**

Prefer many understandable causal nodes over binary ending switches. A player action should normally first alter information/trust/route, then another character action, then downstream consequences.

- [ ] **Step 4: Fill missing novel scenes**

Write only scenes needed to make the causal chain readable in-game. Preserve later-arc secrets: Day 01 must not explain the true nature of 18:31, memory residue, or Zhixia's prior loops.

- [ ] **Step 5: Run tests**

Run: `cd tools/event-graph-viewer && npm test -- firstLoopEvents.test.ts storyDag.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add story/events/day_01_story_dag.yaml story/worldlines/day_01_paths.yaml story/narrative/loop_01_player.yaml story/narrative/loop_01_prologue.yaml tools/event-graph-viewer/tests/firstLoopEvents.test.ts tools/event-graph-viewer/tests/storyDag.test.ts
git commit -m "story: expand day 01 causal worldlines"
```

---

### Task 7: Full verification and viewer documentation

**Files:**
- Modify: `tools/event-graph-viewer/README.md`
- Modify: `docs/event-graph-spec.md`

**Interfaces:**
- Documentation explains Story DAG vs legacy Event Variant graph and the rule `Worldline = path through DAG`.

- [ ] **Step 1: Run full test suite**

Run: `cd tools/event-graph-viewer && npm test`

Expected: all tests PASS.

- [ ] **Step 2: Run production build**

Run: `cd tools/event-graph-viewer && npm run build`

Expected: sync-story completes, TypeScript passes, Vite build succeeds.

- [ ] **Step 3: Update docs**

Include the canonical reader example:

```text
[N01 與若晴聊攝影]
        │ trust +1
        ▼
[N02 若晴放下戒心]
        │ reveal: station_plan
        ▼
[N03 玩家知道車站行程]
        ├── tell reporter → ...
        └── stop wakaharu → ...
                         ↓
              [N20 18:31 Convergence]
```

- [ ] **Step 4: Commit**

```bash
git add tools/event-graph-viewer/README.md docs/event-graph-spec.md
git commit -m "docs: document DAG story reader workflow"
```

- [ ] **Step 5: Verify branch diff**

Confirm the branch contains no unrelated runtime redesign and that story prose changes map to DAG narrative references.
