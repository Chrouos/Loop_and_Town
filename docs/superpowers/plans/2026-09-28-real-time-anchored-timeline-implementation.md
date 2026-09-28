# Real-time Anchored Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 實作 Hybrid Real-time Anchored Timeline，讓玩家無論現實幾點開始，都能從灰潮鎮固定的故事時間進入；第一輪可加速，第二輪起可選擇與現實時間建立更強同步，同時支援離線推進、00:00 Reset 與可重播 Worldline History。

**Architecture:** 保留現有 Story / Schedule / Event Graph 的 `HH:mm` 為 Simulation Time；新增唯一的 `WorldlineClock` 作為 Real Time ↔ Simulation Time 橋樑。Player runtime、offline resume、reset 與 history 都只透過該 clock 取得模擬時間，不允許 story data 或 UI 元件自行讀取牆上時間決定事件。

**Tech Stack:** TypeScript, React 18, Vite 5, Vitest, existing story simulator / player runtime / localStorage persistence

**Spec:** `docs/superpowers/specs/2026-09-28-real-time-anchored-timeline-design.md`

## Global Constraints

- Real Time 與 Graytide Town Simulation Time 必須是不同 clock domain。
- Story YAML / NPC schedules 保持 Simulation Time，不寫 real timestamp。
- 第一輪固定從 Simulation Time `06:12` 開始，不因玩家現實時間錯過序章。
- `18:31`、`23:59`、`00:00` 都以 Simulation Time 判定。
- `scale > 0`；切換 scale 時必須重新 anchor，不能讓 Simulation Time 跳動。
- offline progression 必須走同一套 scheduler，禁止第二套簡化離線劇情。
- reset 後保留 protagonist meta-memory / Character Insight，清除 loop-local mutable state。
- Worldline History 必須同時記 Simulation Time 與 Real timestamp。
- Production code 不直接使用 `Date.now()` 決定 story progression；時間來源必須可注入測試。
- Canon timing migration 必須一次性完整處理，不可只把單一 scene 從 `14:20` 改成 `06:12`。

## Review Focus

- 現實時間倒退、系統休眠或裝置時鐘調整時，不得讓 Simulation Time 反向。
- scale change 必須 continuity-safe；切換前後同一瞬間的 simulation minute 相同。
- 離線跨過多個 event / delayed effect / 18:31 時，處理順序必須 deterministic。
- 離線直接跨過 `00:00` 時，只能 reset 一次並正確建立新 worldline anchor。
- Loop 2+ 的 real-time sync 開關不可改寫 Loop 1 onboarding，也不可讓玩家跳過必要資訊。

---

### Task 1: Define the clock domain model

**Files:**
- Modify: `tools/event-graph-viewer/src/player/model.ts`
- Create: `tools/event-graph-viewer/src/player/worldlineClock.ts`
- Test: `tools/event-graph-viewer/tests/player/worldlineClock.test.ts`

**Interfaces:**
- Consumes: real timestamp in milliseconds supplied by the runtime.
- Produces: `WorldlineClockState`, `WorldlineClock`, `createWorldlineClock(state, nowProvider)`.

- [ ] **Step 1: Write failing tests for anchor conversion**

Pin these cases:

```text
realStartedAt = 17:00
simulationStartedAt = 06:12
scale = 6
real +10m => simulation +60m => 07:12
```

Also assert that `scale <= 0` is rejected.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/player/worldlineClock.test.ts`

- [ ] **Step 3: Implement the minimal clock model**

Required public shape:

```ts
type WorldlineClockState = {
  realStartedAtMs: number;
  simulationStartedAtMinute: number;
  scale: number;
  offlineProgression: boolean;
};

type WorldlineClock = {
  nowMinute(): number;
  reanchor(nextScale: number): WorldlineClockState;
};
```

Use monotonic clamping at the persisted/runtime boundary so a backwards wall clock cannot move story time backwards.

- [ ] **Step 4: Run focused test and confirm GREEN**

- [ ] **Step 5: Commit**

```bash
git add tools/event-graph-viewer/src/player/model.ts tools/event-graph-viewer/src/player/worldlineClock.ts tools/event-graph-viewer/tests/player/worldlineClock.test.ts
git commit -m "feat: add anchored worldline clock"
```

### Task 2: Persist anchor state and restore continuity

**Files:**
- Modify: `tools/event-graph-viewer/src/player/storage.ts`
- Modify: `tools/event-graph-viewer/src/player/runtime.ts`
- Test: `tools/event-graph-viewer/tests/player/storage.test.ts`
- Test: `tools/event-graph-viewer/tests/player/runtime.test.ts`

**Interfaces:**
- Consumes: `WorldlineClockState` from Task 1.
- Produces: saved player state that can resume with the same anchor and last accepted real timestamp.

- [ ] Write RED tests proving a reload does not restart Simulation Time at the loop start.
- [ ] Add persisted `clockAnchor`, `lastAcceptedRealMs`, and clock schema version/migration default.
- [ ] Preserve backward compatibility for old saves that do not contain anchor fields.
- [ ] Run storage/runtime tests GREEN.
- [ ] Commit with `feat: persist worldline clock anchor`.

### Task 3: Drive player progression from WorldlineClock

**Files:**
- Modify: `tools/event-graph-viewer/src/player/clock.ts`
- Modify: `tools/event-graph-viewer/src/player/runtime.ts`
- Modify: `tools/event-graph-viewer/src/player/PlayerApp.tsx`
- Test: `tools/event-graph-viewer/tests/player/clock.test.ts`
- Test: `tools/event-graph-viewer/tests/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: `WorldlineClock.nowMinute()`.
- Produces: authoritative current Simulation Time for narrative eligibility and scheduler execution.

- [ ] Write RED tests where player opens the game at `17:00` real time but HUD/story begins at `06:12` Simulation Time.
- [ ] Replace direct elapsed-time math in player progression with the clock abstraction.
- [ ] Keep Narrative Time formatting separate from scheduler state.
- [ ] Verify foreground narrative freeze does not freeze the world clock unless explicitly authored.
- [ ] Run focused UI/runtime tests GREEN.
- [ ] Commit with `feat: drive player runtime from worldline clock`.

### Task 4: Offline progression through the existing scheduler

**Files:**
- Create: `tools/event-graph-viewer/src/player/offlineProgression.ts`
- Modify: `tools/event-graph-viewer/src/player/runtime.ts`
- Test: `tools/event-graph-viewer/tests/player/offlineProgression.test.ts`

**Interfaces:**
- Consumes: saved clock anchor, last accepted real timestamp, current simulation/world state.
- Produces: target Simulation Time plus ordered processed history and a player-facing resume summary model.

- [ ] RED: leave before one event, resume after three events, assert chronological deterministic processing.
- [ ] RED: delayed effects crossed offline use the same queue ordering as online progression.
- [ ] Add configurable `offlineCapMinutes` at runtime config level; do not hard-code balance value into story YAML.
- [ ] Generate resume summary from Worldline History instead of ad-hoc text.
- [ ] Run focused tests GREEN.
- [ ] Commit with `feat: advance worldline while offline`.

### Task 5: Implement reset boundary and new-loop anchor

**Files:**
- Create: `tools/event-graph-viewer/src/player/reset.ts`
- Modify: `tools/event-graph-viewer/src/player/runtime.ts`
- Modify: `tools/event-graph-viewer/src/player/storage.ts`
- Test: `tools/event-graph-viewer/tests/player/reset.test.ts`

**Interfaces:**
- Consumes: runtime state when Simulation Time crosses `00:00`.
- Produces: closed worldline history, cleared loop-local state, preserved meta-memory, and a new anchor at Simulation Time `06:12`.

- [ ] RED: `23:59 -> 00:00` closes current worldline and re-enters at `06:12`.
- [ ] RED: Character Insight / protagonist meta-memory survives while Trust / Closeness / Respect / Pressure reset.
- [ ] RED: an offline jump crossing midnight cannot duplicate reset.
- [ ] Implement one reset transaction so persistence cannot observe a half-reset state.
- [ ] Run tests GREEN.
- [ ] Commit with `feat: reset anchored worldline at simulation midnight`.

### Task 6: Record dual-clock Worldline History

**Files:**
- Modify: `tools/event-graph-viewer/src/simulator/types.ts`
- Modify: `tools/event-graph-viewer/src/simulator/simulator.ts`
- Modify: `tools/event-graph-viewer/src/lib/worldlineDiff.ts`
- Modify: `tools/event-graph-viewer/src/components/TimelineView.tsx`
- Test: `tools/event-graph-viewer/tests/worldlineDiff.test.ts`
- Test: `tools/event-graph-viewer/tests/simulator.test.ts`

**Interfaces:**
- Consumes: runtime-supplied real timestamp metadata when a significant state transition is committed.
- Produces: history entries with existing simulation fields plus optional `realTimestamp`.

- [ ] RED: same Simulation Time from two loops can have different real timestamps without affecting comparison semantics.
- [ ] Add optional real timestamp metadata without breaking deterministic simulator tests that omit it.
- [ ] Viewer author mode can show both clocks; player mode defaults to story time.
- [ ] Run simulator/diff tests GREEN.
- [ ] Commit with `feat: record real timestamps in worldline history`.

### Task 7: Add per-loop time policy and Loop 2+ real-time sync mode

**Files:**
- Modify: `story/loops/loop_01.yaml`
- Create/Modify: loop policy data under `story/loops/`
- Modify: `tools/event-graph-viewer/src/player/story.ts`
- Modify: `tools/event-graph-viewer/src/player/runtime.ts`
- Test: `tools/event-graph-viewer/tests/player/worldlines.test.tsx`

**Interfaces:**
- Consumes: loop-level time policy.
- Produces: accelerated Loop 1 and configurable Loop 2+ anchored mode.

Canonical policy:

```text
Loop 1: forced onboarding anchor, starts 06:12, accelerated (balance default 6x)
Loop 2+: player setting may select anchored-sync or accelerated mode
```

- [ ] RED: Loop 1 cannot be switched into a late-day entry point.
- [ ] RED: Loop 2+ may opt into stronger real-world synchronization without changing authored event times.
- [ ] Implement policy loader with explicit defaults.
- [ ] Persist player preference separately from story state.
- [ ] Run tests GREEN.
- [ ] Commit with `feat: configure time policy per loop`.

### Task 8: Canonical timing migration to the 06:12 opening

**Files:**
- Modify: affected `story/narrative/*.yaml`
- Modify: affected `story/events/*.yaml`
- Modify: affected `story/schedules/*.yaml`
- Modify: affected `story/worldlines/*.yaml`
- Modify: chapter/story docs whose timestamps are normative
- Test: add/modify timing acceptance tests under `tools/event-graph-viewer/tests/`

**Interfaces:**
- Consumes: canonical opening schedule from the spec.
- Produces: one internally consistent story day from `06:12` to `00:00`.

- [ ] Build a migration table before edits: old time → new time → affected files/nodes.
- [ ] RED: acceptance test asserts train reset `06:12`, arrival window `07:20-08:00`, investigation from `09:10`, convergence `18:31`, bell `23:59`.
- [ ] Migrate all affected Chapter 0/Loop 1 references in one commit; do not partially migrate `14:20` while leaving dependent schedules behind.
- [ ] Re-run all story DAG / narrative / schedule acceptance tests.
- [ ] Commit with `story: align canonical loop day to 06:12 anchor`.

### Task 9: Resume UX and debugging surfaces

**Files:**
- Modify: `tools/event-graph-viewer/src/player/PlayerApp.tsx`
- Modify: `tools/event-graph-viewer/src/player/player.css`
- Modify: `tools/event-graph-viewer/src/App.tsx` or author-only viewer surfaces as appropriate
- Test: UI tests under `tools/event-graph-viewer/tests/player/`

**Interfaces:**
- Consumes: offline summary and dual-clock history.
- Produces: minimal resume summary and author/debug clock inspection.

- [ ] Player returning after offline progression sees only meaningful changes, not raw event spam.
- [ ] Author mode shows real anchor, scale, simulation now, and last processed event.
- [ ] No relationship numeric values are surfaced to the player UI.
- [ ] Run focused tests GREEN.
- [ ] Commit with `feat: show anchored timeline resume state`.

### Task 10: Full verification

**Files:** none unless verification exposes a defect.

- [ ] Run `npm test` in `tools/event-graph-viewer`.
- [ ] Run `npm run build` in `tools/event-graph-viewer`.
- [ ] Verify no story YAML reads real timestamps.
- [ ] Verify PR mergeability against current `main`.
- [ ] Verify Pages build job; PR deploy may remain skipped by workflow design.
- [ ] Record final test counts and known balance-only values in the PR description.

## Definition of Done

The feature is complete only when:

```text
player starts at any real-world time
→ first loop still enters at 06:12 story time
→ simulation advances from the anchor
→ online/offline use the same scheduler
→ 18:31 / 23:59 / 00:00 remain simulation invariants
→ reset creates a new 06:12 anchor
→ meta-memory survives while loop-local relationships reset
→ Loop 2+ may use the configured real-time-linked mode
→ Worldline History can explain what happened in both clocks
```
