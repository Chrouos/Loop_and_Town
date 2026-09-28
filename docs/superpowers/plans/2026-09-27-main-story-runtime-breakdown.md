# Main Story Runtime Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已確認的主線 Story Bible 拆進現有 Character、Relationship、Schedule、Event Graph 資料結構，並以 Chapter 2 作為第一條新世界線。

**Architecture:** 保持 `docs/` 作為作者端 Story Bible，`story/` 作為 Runtime Source of Truth。先擴充不影響引擎的 Character/Relationship metadata，再以既有條件/effect 能力建立 Schedule 分歧，最後加入 Chapter 2 與後續主線 Event/Variant/Narrative。

**Tech Stack:** YAML story data, JSON Schema, Vite Event Graph Viewer

**Spec:** `docs/superpowers/specs/2026-09-27-main-story-character-bible-design.md`

**Status:** Completed in PR #16. Later chapters, Final, Relationship State, and DAG/worldline acceptance coverage expanded beyond the original minimum scope of this plan.

## Global Constraints

- 不新增第二套 Story schema
- 不讓 NPC 只為提供線索而移動
- 每個 Schedule 分歧必須能追溯到角色動機
- Chapter 2 必須保留 18:31 invariant，但改變死者
- 若晴存活後必須存在 20:30 辭職人生線

## Review Focus

- Character metadata 新欄位不可破壞既有 loader
- Relationship edge 保持既有語意與 visibility 模型
- Schedule / Event 條件必須使用可驗證 state path
- Chapter 2 與 Loop 01 不應互相覆蓋
- 新 Event / DAG / narrative refs 必須能被 Viewer / validator 載入

---

### Task 1: Story docs split

**Files:**
- `docs/main-story.md`
- `docs/character-bible.md`
- `docs/relationship-map.md`
- `docs/chapter-02-living-survivor.md`

- [x] 拆出主線章節
- [x] 拆出人物人生
- [x] 拆出關係與狀態語意
- [x] 拆出 Chapter 2 因果鏈

### Task 2: Character metadata

**Files:**
- `story/characters/protagonist.yaml`
- `story/characters/zhixia.yaml`
- `story/characters/yuan.yaml`
- `story/characters/wakaharu.yaml`
- `story/characters/doctor.yaml`
- `story/characters/reporter.yaml`
- `story/characters/detective.yaml`

- [x] 把私人目標、人生壓力、五年前行為補進角色資料
- [x] 不改 canonical character id 與既有 fact id
- [x] 角色保留自己的生活與未完成目標，不因玩家介入而降格為 clue dispenser

### Task 3: Relationship graph

**Files:**
- `story/relationships/loop_01.yaml`
- later additions under `story/relationships/`

- [x] 補知夏↔若晴、知夏↔庭安、庭安↔柏勳、柏勳↔志遠、若晴↔予安等關係
- [x] 每條關係保留 visibility / author knowledge 語意
- [x] 後續新增 `relationship_state.yaml` 與 `final_decisions.yaml`

### Task 4: Schedule life lines

**Files:**
- `story/schedules/wakaharu.yaml`
- `story/schedules/yuan.yaml`
- `story/schedules/reporter.yaml`
- `story/schedules/doctor.yaml`

- [x] 加入若晴 20:30 辭職人生線
- [x] 保留予安房仲／鐘錶店等私人生活後果
- [x] 保留庭安研究所／資料調查原始行程
- [x] 保持條件使用可驗證 state path / causal state

### Task 5: Chapter 2 worldline

**Files:**
- `story/events/day_01_story_dag.yaml`
- `story/worldlines/day_01_paths.yaml`
- `story/narrative/loop_02_player.yaml`
- supporting tests under `tools/event-graph-viewer/tests/`

- [x] 玩家能改變若晴 route，但不是直接按「救她」
- [x] 柏勳在若晴缺席時經過 call / keep documents / maintenance route 等自己的決策鏈
- [x] 18:31 death outcome 改為柏勳
- [x] 若晴 20:30 存活後仍繼續辭職與離鎮人生線
- [x] Worldline comparison 能看到死者改變與 18:31 invariant 保留
- [x] 不寫成「若晴被救 → 柏勳直接被交換死亡」

### Task 6: Verification

- [x] Event Graph / story acceptance tests
- [x] TypeScript compile / production build
- [x] Viewer 可載入新增 YAML / narrative refs
- [x] Chapter 1 baseline 不被 Chapter 2 資料污染
- [x] Loop 3–7 + Final 後續 regression coverage

## Verified integration baseline

Fresh verification is required after every later commit. The baseline recorded before the roadmap-only update was:

```text
Test Files: 72 passed
Tests:      289 passed
TypeScript: passed
Vite build: passed
Event Graph Viewer workflow: success
Pages build job: success
```

See `docs/superpowers/plans/2026-09-28-complete-project-roadmap.md` for the current PR-level status and remaining Real-time / productionization work.
