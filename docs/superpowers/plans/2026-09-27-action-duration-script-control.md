# Action Duration 與完整玩家腳本控制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓所有 YAML 定義的玩家 action（包含無效果 action）以開始時間與持續時間參與 deterministic simulation，並在 UI 時間線中可讀、可比較。

**Architecture:** 擴充既有 `ActionDefinition` 與 `WorldlineHistoryEntry`，由 simulator 在 action 開始時套用 effects、記錄 action，再把 cursor 推進到 action 結束；期間 event queue 持續執行。Projection 將 duration/history 傳到 UI，ScenarioSimulator 只依資料渲染所有 action，不為個別 action 寫特例。

**Tech Stack:** TypeScript, React 18, Vite, Vitest, Testing Library, YAML via js-yaml.

**Spec:** `docs/superpowers/specs/2026-09-27-action-duration-script-control-design.md`

## Global Constraints

- `duration_minutes` 是非負整數，缺省值為 `0`。
- `effects` 可以是空陣列；空陣列不代表 action 不存在，只代表它沒有直接 state mutation。
- action 在 `at` 開始，立即套用 effects；simulation cursor 推進到 `start + duration_minutes`。
- action 進行期間 `[start, end)`，排定事件照正常時間執行；世界不會暫停。
- `simulate()` 依呼叫端提供的 action 順序執行，不偷偷重排玩家意圖；每個 action 前先處理嚴格早於它的 queue 事件。
- 同一分鐘的 action 依輸入順序執行，且先於同分鐘 event。
- duration 為 `0` 的 action 可共享同一開始分鐘。
- 所有 action 的結束時間必須不晚於同一模擬日的 `23:59`。
- 本次不建立自由輸入 YAML 的瀏覽器內編輯器，也不引入完整 NPC schedule scheduler。
- 本計畫的 Node 命令一律從 repository root 以 `npm --prefix tools/event-graph-viewer ...` 執行。

## Review Focus

- 空 `effects` action 必須留下 history，而不是被 projection 或 UI 過濾掉；由 Task 1 與 Task 3 測試。
- action duration 期間到期的 event 必須執行且 `[start, end)`／同分鐘順序 deterministic；由 Task 1 測試。
- duration 造成的下一 action 過早衝突必須報錯並能在 UI 看見；由 Task 1 與 Task 4 測試。
- 舊 YAML 沒有 `duration_minutes` 時必須維持既有結果；由 Task 1 與 Task 2 測試。
- 同一時間的多個零 duration action 必須仍能建立目前的 no-death 分支；由 Task 1 與 Task 4 測試。
- 同一時間的多筆 action、跨過前一個 event 的後續 action、以及 player action 進入 Diff 都必須保留；由 Task 1、Task 3 與 Task 4 測試。

### Task 1: Extend simulator action duration and history

**Files:**
- Modify: `tools/event-graph-viewer/src/simulator/types.ts`
- Modify: `tools/event-graph-viewer/src/simulator/simulator.ts`
- Modify: `tools/event-graph-viewer/src/simulator/validation.ts`
- Test: `tools/event-graph-viewer/tests/simulator.test.ts`

**Interfaces:**
- Consumes: existing `ActionDefinition`, `Simulation`, `simulate`, event queue, and `parseTime`/`formatTime`.
- Produces: `ActionDefinition.duration_minutes?: number`; `WorldlineHistoryEntry.durationMinutes?: number`; `WorldlineHistoryEntry.endTime?: string`; duration-aware `applyAction` and `simulate` behavior.

- [ ] **Step 1: Write failing simulator tests**

  Add focused tests named:

  - `records an empty-effect action with start and end time`
  - `advances the cursor after an action duration`
  - `runs events that become due during an action`
  - `runs a later action after an earlier scheduled event`
  - `keeps end-time events after same-minute actions`
  - `rejects an action that starts before the occupied cursor`
  - `allows multiple zero-duration actions at the same minute`
  - `defaults missing duration to zero`
  - `rejects invalid durations and malformed effects`
  - `repeats the same action sequence deterministically`

  Use `make_coffee` at `18:20` with `duration_minutes: 5` and `effects: []`; assert `player-action` has `time: '18:20'`, `endTime: '18:25'`, `durationMinutes: 5`, and empty `changes`. Add an event at `18:22` to assert it appears after the action and before a later action. Assert the conflict error includes action id and both requested/current times.

- [ ] **Step 2: Run the simulator tests and verify the new tests fail for the missing duration behavior**

  Run: `npm --prefix tools/event-graph-viewer test -- --run tests/simulator.test.ts`

  Expected: existing tests pass, new duration/history tests fail because `duration_minutes`, `endTime`, and duration cursor advancement are not implemented.

- [ ] **Step 3: Implement the duration contract**

  Add `duration_minutes?: number` to `ActionDefinition` and `durationMinutes?: number`/`endTime?: string` to `WorldlineHistoryEntry`. In `validation.ts`, validate missing duration as `0`, reject non-integer/negative/overflowing durations, reject missing or non-array effects, and keep existing effect validation. In `simulator.ts`, interleave action execution with queue processing: before an action, process queue items strictly earlier than its start; apply its effects at start; record the action; process items strictly earlier than its end; leave end-time queue items pending for same-minute actions. Preserve zero-duration same-minute behavior, later actions after prior events, and deterministic caller order.

- [ ] **Step 4: Run simulator tests and verify they pass**

  Run: `npm --prefix tools/event-graph-viewer test -- --run tests/simulator.test.ts`

  Expected: all simulator tests pass, including the new duration, empty-effect, event-during-action, conflict, and zero-duration cases.

- [ ] **Step 5: Run typecheck before moving to story data**

  Run: `npm --prefix tools/event-graph-viewer exec tsc -- --noEmit`

  Expected: exit 0.

### Task 2: Add canonical no-op action and data validation coverage

**Files:**
- Modify: `story/actions/day_01_actions.yaml`
- Modify: `tools/event-graph-viewer/tests/storyScenario.test.ts`
- Modify: `tools/event-graph-viewer/tests/simulator.test.ts`

**Interfaces:**
- Consumes: Task 1's duration-aware `ActionDefinition` and simulator.
- Produces: canonical `make_coffee` action available to the loader and UI without React-specific registration.

- [ ] **Step 1: Add a failing canonical-story assertion**

  Extend the story scenario fixture/assertions to load `make_coffee`, simulate it, and assert the history includes a player action labeled `泡咖啡` with `18:20`–`18:25` and no state changes.

- [ ] **Step 2: Run the story scenario test and verify it fails**

  Run: `npm --prefix tools/event-graph-viewer test -- --run tests/storyScenario.test.ts`

  Expected: FAIL because the canonical action YAML does not yet contain `make_coffee`.

- [ ] **Step 3: Add `make_coffee` to the canonical action YAML**

  Add:

  ```yaml
  - id: make_coffee
    at: "18:20"
    duration_minutes: 5
    label: 泡咖啡
    effects: []
  ```

  Keep the existing `protect_wakaharu` and `stop_doctor` actions unchanged so their zero-duration same-minute behavior remains valid.

- [ ] **Step 4: Run story and full simulator tests**

  Run: `npm --prefix tools/event-graph-viewer test -- --run tests/storyScenario.test.ts tests/simulator.test.ts`

  Expected: PASS with the canonical action included and the existing worldline matrix unchanged.

### Task 3: Carry action intervals through projection and readable timelines

**Files:**
- Modify: `tools/event-graph-viewer/src/types/story.ts`
- Modify: `tools/event-graph-viewer/src/simulator/projection.ts`
- Modify: `tools/event-graph-viewer/src/components/TimelineView.tsx`
- Modify: `tools/event-graph-viewer/src/components/WorldlineDiffView.tsx`
- Test: `tools/event-graph-viewer/tests/projection.test.ts`
- Test: `tools/event-graph-viewer/tests/App.test.tsx`

**Interfaces:**
- Consumes: Task 1's history duration fields.
- Produces: `WorldlineEntry.durationMinutes?: number` and `WorldlineEntry.endTime?: string`; projection preserves these fields for `player` entries; timeline labels zero-duration actions as a point and non-zero actions as an interval; worldline diff receives full timeline entries including player actions.

- [ ] **Step 1: Write failing projection/UI assertions**

  Extend projection tests to assert `projectTimelineEntries` preserves `durationMinutes` and `endTime` for a player action, including an empty-effect action. Add a diff projection/UI assertion that player actions are passed through rather than filtered to event-only history. Extend `App.test.tsx` to assert the canonical UI contains `泡咖啡`, `18:20–18:25`, and the action remains visible after simulation. Include several same-time actions and assert none are overwritten.

- [ ] **Step 2: Run targeted tests and verify the new assertions fail**

  Run: `npm --prefix tools/event-graph-viewer test -- --run tests/projection.test.ts tests/App.test.tsx`

  Expected: FAIL because the projection and timeline currently drop duration metadata and the current UI does not render the canonical action interval.

- [ ] **Step 3: Implement projection and display changes**

  Extend `WorldlineEntry` and `projectTimelineEntries` to carry duration/end fields. Add a full-history projection or pass `projectTimelineEntries` directly into Worldline Diff so player actions are included. Update `TimelineView` to group entries by time without collapsing same-time arrays, format `start–end` for duration actions, show `立即` for zero duration, and keep empty-effect actions visible with low-emphasis detail. Update Diff labels to use the interval when the entry is a player action.

- [ ] **Step 4: Run targeted tests and verify they pass**

  Run: `npm --prefix tools/event-graph-viewer test -- --run tests/projection.test.ts tests/App.test.tsx`

  Expected: PASS, with `泡咖啡` visible as `18:20–18:25` and event outcomes still readable.

### Task 4: Make the scenario editor data-driven and surface timing conflicts

**Files:**
- Modify: `tools/event-graph-viewer/src/components/ScenarioSimulator.tsx`
- Modify: `tools/event-graph-viewer/src/App.tsx`
- Modify: `tools/event-graph-viewer/src/styles.css`
- Modify: `tools/event-graph-viewer/tests/scenarioSimulator.test.tsx`
- Modify: `tools/event-graph-viewer/tests/App.test.tsx`

**Interfaces:**
- Consumes: Task 1's duration-aware actions, Task 2's canonical `make_coffee`, and Task 3's projected intervals.
- Produces: action cards rendered entirely from `ActionDefinition[]`; a visible per-worldline simulation error when a selected sequence conflicts; sorted selected action IDs passed to `simulate` without action-specific branches.

- [ ] **Step 1: Write failing editor tests**

  Add tests that render an action with `duration_minutes: 5` and `effects: []`, then assert the card shows `花費 5 分鐘` and `沒有立即世界狀態變化`. Add an App test that selects a duration action plus an earlier next action and asserts the conflict is shown as user-readable text while the editor remains available. Add a reverse-selection test proving the stable `(at, source order)` sequence is used, and a retry assertion proving errors clear after a valid selection.

- [ ] **Step 2: Run scenario/App tests and verify the new assertions fail**

  Run: `npm --prefix tools/event-graph-viewer test -- --run tests/scenarioSimulator.test.tsx tests/App.test.tsx`

  Expected: FAIL because action cards do not yet show duration/no-op copy and App currently lets a simulator exception escape instead of rendering a conflict message.

- [ ] **Step 3: Implement data-driven action cards and safe simulation results**

  Render duration and effect summaries generically from each action. In `App.tsx`, build each worldline's selected action sequence from the loaded definitions in stable `(at, source order)` order, run the selected worldlines and every causal-branch simulation through a small result/error union wrapper, and pass errors to the relevant view without crashing the editor. Preserve the unaffected worldline and draft selections; clear errors after a valid retry. Do not add checks for `make_coffee`, `protect_wakaharu`, or `stop_doctor` by id.

- [ ] **Step 4: Run scenario/App tests and verify they pass**

  Run: `npm --prefix tools/event-graph-viewer test -- --run tests/scenarioSimulator.test.tsx tests/App.test.tsx`

  Expected: PASS; all YAML actions render, duration conflicts are visible, and the existing two-worldline recalculation behavior remains intact.

### Task 5: Integrate event graph, responsive styling, and regression coverage

**Files:**
- Modify: `tools/event-graph-viewer/src/components/EventGraphView.tsx`
- Modify: `tools/event-graph-viewer/src/components/StoryOrder.tsx`
- Modify: `tools/event-graph-viewer/src/styles.css`
- Modify: `tools/event-graph-viewer/tests/App.test.tsx`

**Interfaces:**
- Consumes: Task 3's interval-aware timeline entries and Task 4's generic action data.
- Produces: causal view that retains no-op actions and duration intervals without implying they mutate state; responsive action/timeline layout.

- [ ] **Step 1: Write failing causal-view assertions**

  Extend App tests to switch to the Event Graph tab and assert `泡咖啡`, `18:20–18:25`, and the downstream event are present, while the action is shown as a time-flow node rather than connected by a mutation-causing arrow.

- [ ] **Step 2: Run the targeted test and verify it fails**

  Run: `npm --prefix tools/event-graph-viewer test -- --run tests/App.test.tsx`

  Expected: FAIL because the causal branch view currently assumes a point action and does not display generic action intervals/no-op semantics.

- [ ] **Step 3: Update causal rendering and responsive styles**

  Render action branches from supplied action/history data, use interval labels for duration actions, and use a neutral “無立即狀態變化／時間流逝” relation for empty effects instead of the existing mutation-looking downward arrow. Keep mobile layout stacked and preserve the existing Chinese information hierarchy.

- [ ] **Step 4: Run the full verification suite**

  Run: `npm --prefix tools/event-graph-viewer test && npm --prefix tools/event-graph-viewer run build && git diff --check`

  Expected: all tests pass, Vite production build exits 0, and `git diff --check` produces no output.

- [ ] **Step 5: Commit the implementation**

  ```bash
  git add story/actions/day_01_actions.yaml \
    tools/event-graph-viewer/src \
    tools/event-graph-viewer/tests
  git commit -m "feat: model player action duration in story simulation"
  ```

  If the managed workspace still prevents writing `.git/index`, leave the working tree changes intact and report the exact limitation instead of changing unrelated files.
