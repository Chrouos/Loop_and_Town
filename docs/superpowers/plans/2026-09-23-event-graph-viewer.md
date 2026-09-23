# Event Graph Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `tools/event-graph-viewer/`，直接讀取專案內 Event Graph YAML 與 Worldline log，提供 Event Graph、Timeline、Worldline Diff 三個可互相切換的視圖。

**Architecture:** Viewer 採 Vite + React + TypeScript。劇情 YAML 仍是 Source of Truth；Viewer 在開發/建置前透過同步腳本把 `story/` 中需要的 YAML / JSON 複製到 `public/story/`，前端只讀取產物，不直接修改劇情資料。解析與正規化邏輯集中在 `src/lib/`，三個 View 只消費統一的 normalized model。

**Tech Stack:** Vite, React, TypeScript, @xyflow/react, js-yaml, Vitest, Testing Library

**Spec:** `docs/event-graph-spec.md`

## Global Constraints

- 劇情邏輯的 Source of Truth 只能是 `story/**/*.yaml`。
- JSON Schema 位於 `story/schemas/event-graph.schema.json`。
- Viewer 不把畫布座標寫回劇情 YAML；座標屬於獨立 layout 資料。
- 第一版至少支援 Event Graph、Timeline、Worldline Diff。
- Delayed Effect 必須被視為一級資料並能在 Graph / Timeline 顯示。
- 同一 Event 的不同 Variant 必須可辨識，不能展平成互不相關的獨立事件。
- Viewer 第一版為 read-only；編輯 YAML 留到後續版本。

## Review Focus

1. YAML 缺少 optional 欄位時，Viewer 仍應顯示 Event，不得整頁崩潰。
2. Variant 含 `delayed_effects` 時，要能顯示延遲分鐘或絕對執行時間。
3. 同一 Event 多個 Variant 不可在 Graph 中失去 parent Event 關係。
4. Timeline 必須以 `HH:mm` 正確排序，不能用字串插入順序。
5. Worldline Diff 對缺少某事件的一側，要顯示「未發生」，而不是直接忽略。

---

## File Structure

```text
tools/event-graph-viewer/
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ index.html
├─ scripts/
│  └─ sync-story.mjs
├─ public/
│  └─ story/                 # build/dev 時由 sync-story 產生
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ styles.css
│  ├─ types/
│  │  └─ story.ts
│  ├─ lib/
│  │  ├─ loadStory.ts
│  │  ├─ eventGraph.ts
│  │  ├─ timeline.ts
│  │  └─ worldlineDiff.ts
│  ├─ components/
│  │  ├─ ViewTabs.tsx
│  │  ├─ EventGraphView.tsx
│  │  ├─ EventNode.tsx
│  │  ├─ TimelineView.tsx
│  │  └─ WorldlineDiffView.tsx
│  └─ fixtures/
│     └─ worldlines.json
└─ tests/
   ├─ eventGraph.test.ts
   ├─ timeline.test.ts
   ├─ worldlineDiff.test.ts
   └─ App.test.tsx
```

---

### Task 1: Scaffold viewer and story sync

**Files:**
- Create: `tools/event-graph-viewer/package.json`
- Create: `tools/event-graph-viewer/tsconfig.json`
- Create: `tools/event-graph-viewer/vite.config.ts`
- Create: `tools/event-graph-viewer/index.html`
- Create: `tools/event-graph-viewer/scripts/sync-story.mjs`
- Create: `tools/event-graph-viewer/src/main.tsx`
- Create: `tools/event-graph-viewer/src/App.tsx`
- Create: `tools/event-graph-viewer/src/styles.css`

**Interfaces:**
- Consumes: repository root `story/`
- Produces: `public/story/events/*.yaml`, `public/story/schemas/*.json`

- [ ] **Step 1: Add a failing sync test/verification script**

Create a Node assertion in `scripts/sync-story.mjs` that exits non-zero when `../../../story/events` or `../../../story/schemas` is missing.

- [ ] **Step 2: Run sync before implementation**

Run:

```bash
cd tools/event-graph-viewer
node scripts/sync-story.mjs
```

Expected: FAIL because copy logic/public output is not implemented yet.

- [ ] **Step 3: Implement sync script**

The script must:

```text
resolve repo root
→ remove public/story if present
→ copy story/events to public/story/events
→ copy story/schemas to public/story/schemas
→ print copied file count
```

Package scripts:

```json
{
  "scripts": {
    "sync-story": "node scripts/sync-story.mjs",
    "dev": "npm run sync-story && vite",
    "build": "npm run sync-story && tsc -b && vite build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: Verify sync output**

Run `npm run sync-story` and confirm:

```text
public/story/events/day_01_1831.yaml
public/story/schemas/event-graph.schema.json
```

exist.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer
git commit -m "feat(viewer): scaffold event graph viewer"
```

---

### Task 2: Define normalized Event Graph model and YAML loader

**Files:**
- Create: `tools/event-graph-viewer/src/types/story.ts`
- Create: `tools/event-graph-viewer/src/lib/loadStory.ts`
- Create: `tools/event-graph-viewer/tests/eventGraph.test.ts`

**Interfaces:**
- Produces:

```ts
export type EventGraphDocument = {
  id: string;
  title: string;
  time: string;
  location?: string;
  variants: EventVariant[];
};

export type EventVariant = {
  id: string;
  priority: number;
  conditions: string[];
  effects: StoryEffect[];
  delayedEffects: DelayedEffect[];
};

export async function loadEventGraph(path: string): Promise<EventGraphDocument>;
```

- [ ] **Step 1: Write failing loader tests**

Tests must cover:

```ts
expect(doc.id).toBe("evt_1831_station");
expect(doc.variants.map(v => v.id)).toEqual([
  "wakaharu_dies",
  "doctor_dies",
  "no_death"
]);
expect(doc.variants[0].delayedEffects[0].delayMinutes).toBe(163);
```

Also add a fixture with missing optional `location` / `delayed_effects` and assert loader returns empty arrays instead of throwing.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- eventGraph.test.ts
```

Expected: FAIL because loader/types do not exist.

- [ ] **Step 3: Implement loader and normalization**

Use `js-yaml` to parse YAML, normalize `when.all` into human-readable condition strings, normalize absent delayed effects to `[]`, and default missing priority to `0`.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src tools/event-graph-viewer/tests
git commit -m "feat(viewer): load and normalize event graph yaml"
```

---

### Task 3: Build Event Graph projection

**Files:**
- Create: `tools/event-graph-viewer/src/lib/eventGraph.ts`
- Create: `tools/event-graph-viewer/src/components/EventNode.tsx`
- Create: `tools/event-graph-viewer/src/components/EventGraphView.tsx`
- Modify: `tools/event-graph-viewer/tests/eventGraph.test.ts`

**Interfaces:**
- Consumes: `EventGraphDocument`
- Produces:

```ts
export type GraphProjection = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export function buildEventGraph(doc: EventGraphDocument): GraphProjection;
```

- [ ] **Step 1: Write failing projection tests**

For `evt_1831_station`, assert:

```text
1 parent event node
3 variant nodes
1 delayed-effect node
3 parent→variant edges
1 variant→delayed edge
```

And assert all variants preserve their parent Event ID.

- [ ] **Step 2: Run test and verify failure**

Expected: FAIL because `buildEventGraph` does not exist.

- [ ] **Step 3: Implement projection**

Node roles:

```text
event    = parent event
variant  = possible resolved outcome
delayed  = scheduled delayed consequence
```

Edges:

```text
event -> variant
variant -> delayed
```

Delayed edge label is either `+163m` or `@21:14`.

- [ ] **Step 4: Render with @xyflow/react**

`EventGraphView` must render:

- parent Event title/time/location
- Variant ID + priority
- condition summary
- delayed consequence nodes
- fit-view control

No editing in v0.1.

- [ ] **Step 5: Run tests/build**

```bash
npm test -- eventGraph.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/event-graph-viewer
git commit -m "feat(viewer): add event graph visualization"
```

---

### Task 4: Build Timeline model and view

**Files:**
- Create: `tools/event-graph-viewer/src/lib/timeline.ts`
- Create: `tools/event-graph-viewer/src/components/TimelineView.tsx`
- Create: `tools/event-graph-viewer/tests/timeline.test.ts`
- Create: `tools/event-graph-viewer/src/fixtures/worldlines.json`

**Interfaces:**

```ts
export type WorldlineEntry = {
  time: string;
  eventId: string;
  variantId?: string;
  title: string;
  source: "event" | "delayed" | "player";
};

export function sortTimeline(entries: WorldlineEntry[]): WorldlineEntry[];
```

- [ ] **Step 1: Write failing timeline tests**

Input deliberately unordered:

```text
21:14 reporter missing
17:40 doctor leaves
18:31 station event
18:05 meeting
```

Expected ordered result:

```text
17:40, 18:05, 18:31, 21:14
```

Also test equal times preserve stable input order.

- [ ] **Step 2: Run failing tests**

Expected: FAIL.

- [ ] **Step 3: Implement timeline sorting**

Convert `HH:mm` to minute-of-day integer before comparing.

- [ ] **Step 4: Implement TimelineView**

UI must show:

```text
17:40 ─ 18:05 ─ 18:31 ─ 21:14
```

Each item shows title, event/variant and whether it came from a delayed consequence.

- [ ] **Step 5: Test/build**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/event-graph-viewer
git commit -m "feat(viewer): add worldline timeline view"
```

---

### Task 5: Build Worldline Diff

**Files:**
- Create: `tools/event-graph-viewer/src/lib/worldlineDiff.ts`
- Create: `tools/event-graph-viewer/src/components/WorldlineDiffView.tsx`
- Create: `tools/event-graph-viewer/tests/worldlineDiff.test.ts`

**Interfaces:**

```ts
export type DiffRow = {
  key: string;
  time: string;
  left?: WorldlineEntry;
  right?: WorldlineEntry;
  status: "same" | "changed" | "left-only" | "right-only";
};

export function diffWorldlines(
  left: WorldlineEntry[],
  right: WorldlineEntry[]
): DiffRow[];
```

- [ ] **Step 1: Write failing diff tests**

Test these cases:

```text
same event + same variant => same
same event + different variant => changed
event only on left => left-only
event only on right => right-only
```

For a missing event on one side, UI text must resolve to `未發生`.

- [ ] **Step 2: Run tests and verify failure**

Expected: FAIL.

- [ ] **Step 3: Implement diff algorithm**

Match primarily by `eventId`; use `time + eventId` as row key. A variant change is `changed`, not two independent rows.

- [ ] **Step 4: Implement split comparison UI**

Render:

```text
Loop 04              Loop 05
18:31 若晴死亡    →   18:31 醫生死亡
21:14 未發生      →   21:14 記者失蹤
```

Changed rows must be visually distinguishable without relying on color alone; include `變更` text/icon marker.

- [ ] **Step 5: Test/build**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/event-graph-viewer
git commit -m "feat(viewer): compare worldline histories"
```

---

### Task 6: Connect the three views into the viewer shell

**Files:**
- Create: `tools/event-graph-viewer/src/components/ViewTabs.tsx`
- Modify: `tools/event-graph-viewer/src/App.tsx`
- Modify: `tools/event-graph-viewer/src/styles.css`
- Create: `tools/event-graph-viewer/tests/App.test.tsx`

**Interfaces:**
- Consumes: event graph document + two fixture worldlines
- Produces: user-switchable Graph / Timeline / Diff experience

- [ ] **Step 1: Write failing UI test**

Assert the app renders these controls:

```text
Event Graph
Timeline
Worldline Diff
```

Click each tab and assert corresponding heading/content appears.

- [ ] **Step 2: Run test and verify failure**

Expected: FAIL.

- [ ] **Step 3: Implement app shell**

Default to `Event Graph`.

Header should show:

```text
灰潮鎮 Event Graph Viewer
Loaded: evt_1831_station / 18:31 車站事件
```

- [ ] **Step 4: Add readable empty/error states**

If YAML fetch or parse fails, show:

```text
無法載入 Event Graph
<actual error message>
```

Do not render a blank canvas.

- [ ] **Step 5: Run full verification**

```bash
npm test
npm run build
```

Expected: all tests pass and Vite build succeeds.

- [ ] **Step 6: Commit**

```bash
git add tools/event-graph-viewer
git commit -m "feat(viewer): integrate graph timeline and diff views"
```

---

### Task 7: Document usage and repository entrypoint

**Files:**
- Create: `tools/event-graph-viewer/README.md`
- Modify: `README.md`

**Interfaces:** None.

- [ ] **Step 1: Document local usage**

Exact commands:

```bash
cd tools/event-graph-viewer
npm install
npm run dev
npm test
npm run build
```

Explain `npm run sync-story` and state clearly that `public/story/` is generated from root `story/`.

- [ ] **Step 2: Add architecture note**

Document:

```text
story/*.yaml = Source of Truth
sync-story   = frontend-readable copy
src/lib      = normalized model
views        = Graph / Timeline / Diff
```

- [ ] **Step 3: Update root README**

Add `tools/event-graph-viewer/` under project structure and link to `docs/event-graph-spec.md`.

- [ ] **Step 4: Final verification**

Run:

```bash
npm test
npm run build
```

Then confirm generated `dist/` is not required to be committed.

- [ ] **Step 5: Commit**

```bash
git add README.md tools/event-graph-viewer/README.md
git commit -m "docs: document event graph viewer workflow"
```

---

## Definition of Done

```text
story/events/day_01_1831.yaml
            ↓
        sync-story
            ↓
      load + normalize
            ↓
┌───────────┼──────────────┐
↓           ↓              ↓
Graph     Timeline     Worldline Diff
```

完成時必須滿足：

- Viewer 不硬編碼 `18:31` 節點內容。
- 修改 YAML 後重新啟動 Viewer 可以看到變更。
- Graph 保留 Event → Variant → Delayed Effect 關係。
- Timeline 依時間排序。
- Diff 能明確顯示同一 Event 的 Variant 改變與「未發生」。
- 所有 unit/UI tests 通過。
- `npm run build` 成功。
