# Chapter 2 Wakaharu Survives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有 `loop_01` 玩家 runtime 中，完成「若晴活下來、柏勳死亡」的第二條可玩世界線。

**Architecture:** 沿用現有 YAML story source of truth、deterministic simulator 與 player-narrative runtime。用一個可執行的 relationship state 影響若晴 route，讓 schedule 在 20:30 寫入她的人生狀態，再由 worldline event 與 narrative scene 投影給玩家；不新增 Chapter 2 manifest，也不重寫通用 relationship engine。

**Tech Stack:** TypeScript, React, Vitest, js-yaml, YAML story data。

**Spec:** `docs/superpowers/specs/2026-09-27-main-story-character-bible-design.md`，Chapter 2「活下來的人」與 Event Graph 對應原則。

## Global Constraints

- `story/` 是唯一劇情資料來源；`public/story/` 僅由 sync script 產生。
- 世界線必須由玩家介入、NPC schedule 與 event variant 的因果鏈產生，不以直接選擇結局取代模擬。
- 現有 `loop_01`、`WL-00` 至 `WL-07` 與第一輪 narrative 行為不得回歸。
- 18:31 仍是同一個 station event；新增內容只能透過其既有世界狀態與後續事件接續。
- 所有新行為先有能正確失敗的測試，再寫最小資料／程式實作。

## Review Focus

- `protect_wakaharu` 必須同時改變 route 與關係 state；它是讓若晴在 18:31 存活的必要介入，但與 `stop_doctor` 並用時結果應升級為 `no_death`，而不是 Chapter 2 專屬路線。
- 同一分鐘的 schedule 必須先於 event 執行，否則 20:30 的若晴人生事件會讀不到最新狀態。
- `stop_doctor` 或「兩人都保護」不能誤觸發「若晴存活、柏勳死亡」專屬事件。
- 玩家陪若晴回家後不在車站，仍必須透過 phone/message narrative 看見柏勳死亡，並在 20:30 看到若晴繼續自己的人生。
- 20:30 之後的 choice 必須能啟動真實 activity，activity 完成後要產生可投影的後續 narrative scene。

### Task 1: Make the Chapter 2 causal worldline executable

**Files:**
- Create: `story/events/loop_01_2030_wakaharu.yaml`
- Modify: `story/world/loop_01_initial.yaml`
- Modify: `story/actions/loop_01_actions.yaml`
- Modify: `story/schedules/wakaharu.yaml`
- Modify: `story/manifests/loop_01.yaml`
- Modify: `story/worldlines/loop_01_worldlines.yaml`
- Test: `tools/event-graph-viewer/tests/chapterTwoWorldlineAcceptance.test.ts`
- Test: `tools/event-graph-viewer/tests/firstLoopActions.test.ts`

**Interfaces:**
- Consumes: `simulateNamedWorldline(story, worldlineId)` and current `ScheduleDefinition` / `EventDefinition` YAML format.
- Produces: `WL-04` resolves to `doctor_dies`, leaves `characters.wakaharu.status === alive`, records `characters.wakaharu.life_status === resignation_submitted` at 20:30, and resolves `evt_2030_wakaharu_life` to `wakaharu_life_continues` only for the intended route.

- [ ] **Step 1: Write the failing acceptance test**

  Add tests that load the real story and assert:

  - `WL-04` has station variant `doctor_dies`.
  - Its final state keeps Wakaharu alive and Doctor dead.
  - Its history contains `wakaharu_submit_resignation` as an applied schedule entry before `evt_2030_wakaharu_life`.
  - The 20:30 event variant is `wakaharu_life_continues` and writes the expected life flag/state.
  - `WL-05` and `WL-06` do not resolve the Chapter 2 event as `wakaharu_life_continues`.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- --run tools/event-graph-viewer/tests/chapterTwoWorldlineAcceptance.test.ts` from `tools/event-graph-viewer`.

  Expected: FAIL because the new event/state fields and the authored schedule are not present yet; no production implementation is written before this failure is observed.

- [ ] **Step 3: Implement the minimum story data chain**

  Add `relationships.protagonist_wakaharu.trust: 1`, Wakaharu's `life_status: preparing_portfolio`, and the corresponding action effect that raises trust to `2` when `protect_wakaharu` is applied. Add the 20:30 Wakaharu schedule entry guarded by alive/home/trust state, then add `evt_2030_wakaharu_life` with a conditional `wakaharu_life_continues` variant and a hidden fallback. Register the event in the manifest and label `WL-04` as the Chapter 2 rescue route without changing its action ids.

- [ ] **Step 4: Run the focused test and verify GREEN**

  Run: `npm test -- --run tools/event-graph-viewer/tests/chapterTwoWorldlineAcceptance.test.ts tools/event-graph-viewer/tests/firstLoopActions.test.ts`.

  Expected: PASS, including the updated exact action-effect assertion for the new relationship write.

- [ ] **Step 5: Run the simulator regression suite**

  Run: `npm test -- --run tools/event-graph-viewer/tests/storySimulationAcceptance.test.ts tools/event-graph-viewer/tests/narrativeFoundationAcceptance.test.ts tools/event-graph-viewer/tests/worldlineDefinitions.test.ts`.

  Expected: PASS for all existing worldline outcomes and the new Chapter 2 outcome.

- [ ] **Step 6: Commit the causal data slice**

  ```bash
  git add story/world/loop_01_initial.yaml story/actions/loop_01_actions.yaml story/schedules/wakaharu.yaml story/events/loop_01_2030_wakaharu.yaml story/manifests/loop_01.yaml story/worldlines/loop_01_worldlines.yaml tools/event-graph-viewer/tests/chapterTwoWorldlineAcceptance.test.ts tools/event-graph-viewer/tests/firstLoopActions.test.ts
  git commit -m "feat: make Wakaharu rescue worldline causal"
  ```

### Task 2: Make the surviving route playable in player narrative

**Files:**
- Modify: `story/activities/protagonist.yaml`
- Modify: `story/narrative/loop_01_player.yaml`
- Modify: `story/choices/loop_01_player_v0_1.yaml`
- Test: `tools/event-graph-viewer/tests/chapterTwoPlayerNarrativeAcceptance.test.ts`

**Interfaces:**
- Consumes: Task 1's `evt_1831_station/doctor_dies`, `evt_2030_wakaharu_life/wakaharu_life_continues`, `protect_wakaharu`, and the existing `reconcilePlayerRuntime` / `applyChoiceEffects` APIs.
- Produces: a player who selects `wakaharu_walk_home` can observe a phone-based Doctor death scene from home, reach the 20:30 Wakaharu life scene, choose `wakaharu_send_portfolio`, and receive a completion scene after the authored activity.

- [ ] **Step 1: Write the failing player-runtime acceptance test**

  Add tests that seed a real player session with `protect_wakaharu`, `currentLocation: old_house`, and the earlier scenes consumed. Assert:

  - At 18:31 the queue contains the new phone/message scene for `doctor_dies`, even though the player is not at `old_station`.
  - At 20:31 the queue contains the Wakaharu life scene only when the simulator state has the Chapter 2 worldline.
  - The scene exposes `wakaharu_send_portfolio`, and applying it starts the authored portfolio activity.
  - After the activity completes, the follow-up portfolio-sent scene is projected.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- --run tools/event-graph-viewer/tests/chapterTwoPlayerNarrativeAcceptance.test.ts` from `tools/event-graph-viewer`.

  Expected: FAIL because the phone scene, activity, choice, and follow-up scene do not exist yet.

- [ ] **Step 3: Implement the minimum player-facing data**

  Add the short `send_wakaharu_portfolio` activity. Add a home-observable 18:31 `doctor_dies` scene, a 20:30 `wakaharu_life_continues` scene, and a post-activity scene around 20:38. Add the choice that starts the activity. Keep copy diegetic and avoid debug labels such as `GOOD END`, `BAD END`, or `WORLDLINE CHANGED`.

- [ ] **Step 4: Run the focused test and verify GREEN**

  Run: `npm test -- --run tools/event-graph-viewer/tests/chapterTwoPlayerNarrativeAcceptance.test.ts tools/event-graph-viewer/tests/playerNarrative1831Acceptance.test.ts tools/event-graph-viewer/tests/playerNarrativeRuntime.test.ts`.

  Expected: PASS, including the existing late-travel and offline-observation behavior.

- [ ] **Step 5: Commit the playable narrative slice**

  ```bash
  git add story/activities/protagonist.yaml story/narrative/loop_01_player.yaml story/choices/loop_01_player_v0_1.yaml tools/event-graph-viewer/tests/chapterTwoPlayerNarrativeAcceptance.test.ts
  git commit -m "feat: continue Wakaharu life after rescue"
  ```

### Task 3: Full verification and handoff

**Files:**
- Test: all existing tests under `tools/event-graph-viewer/tests/`

- [ ] **Step 1: Run the complete test suite**

  Run: `npm test` from `tools/event-graph-viewer`.

  Expected: all tests pass with zero failures.

- [ ] **Step 2: Run the production build**

  Run: `npm run build` from `tools/event-graph-viewer`.

  Expected: TypeScript check, story sync, and Vite build exit successfully.

- [ ] **Step 3: Inspect the final diff and verify scope**

  Run: `git status --short` and `git diff HEAD~2..HEAD --stat`.

  Confirm only the Chapter 2 data, narrative, tests, and plan are included; do not copy generated `public/story`, `dist`, or `node_modules` into the commit.

- [ ] **Step 4: Commit any required plan or generated-file cleanup**

  If the final build creates ignored/generated files, leave them uncommitted. If a tracked file needs a source update, make it through a new TDD cycle and rerun the full suite.
