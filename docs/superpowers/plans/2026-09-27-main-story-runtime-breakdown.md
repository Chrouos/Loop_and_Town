# Main Story Runtime Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已確認的主線 Story Bible 拆進現有 Character、Relationship、Schedule、Event Graph 資料結構，並以 Chapter 2 作為第一條新世界線。

**Architecture:** 保持 `docs/` 作為作者端 Story Bible，`story/` 作為 Runtime Source of Truth。先擴充不影響引擎的 Character/Relationship metadata，再以既有 `when/effects` 語法建立 Schedule 分歧，最後才加入 Chapter 2 Event/Variant/Narrative。

**Tech Stack:** YAML story data, JSON Schema, Vite Event Graph Viewer

**Spec:** `docs/superpowers/specs/2026-09-27-main-story-character-bible-design.md`

## Global Constraints

- 不新增第二套 Story schema
- 不讓 NPC 只為提供線索而移動
- 每個 Schedule 分歧必須能追溯到角色動機
- Chapter 2 必須保留 18:31 invariant，但改變死者
- 若晴存活後必須存在 20:30 辭職人生線

## Review Focus

- Character metadata 新欄位不可破壞既有 loader
- Relationship edge 保持現有 `from/to/type/visibility/summary` 形狀
- Schedule 只使用既有 `when/effects/set` 能力
- Chapter 2 與 Loop 01 不應互相覆蓋
- 新 Event 必須能被 Viewer / validator 載入

---

### Task 1: Story docs split

**Files:**
- Create: `docs/main-story.md`
- Create: `docs/character-bible.md`
- Create: `docs/relationship-map.md`
- Create: `docs/chapter-02-living-survivor.md`

- [x] 拆出主線章節
- [x] 拆出人物人生
- [x] 拆出關係與狀態語意
- [x] 拆出 Chapter 2 因果鏈

### Task 2: Character metadata

**Files:**
- Modify: `story/characters/protagonist.yaml`
- Modify: `story/characters/zhixia.yaml`
- Modify: `story/characters/yuan.yaml`
- Modify: `story/characters/wakaharu.yaml`
- Modify: `story/characters/doctor.yaml`
- Modify: `story/characters/reporter.yaml`
- Modify: `story/characters/detective.yaml`

- [ ] 把私人目標、人生壓力、五年前行為補進既有欄位
- [ ] 不改 character id 與既有 fact id

### Task 3: Relationship graph

**Files:**
- Modify: `story/relationships/loop_01.yaml`

- [ ] 補知夏↔若晴、知夏↔庭安、庭安↔柏勳、柏勳↔志遠、若晴↔予安的雙向關係
- [ ] 每條關係標明 public / author visibility

### Task 4: Schedule life lines

**Files:**
- Modify: `story/schedules/wakaharu.yaml`
- Modify: `story/schedules/yuan.yaml`
- Modify: `story/schedules/reporter.yaml`
- Modify: `story/schedules/doctor.yaml`

- [ ] 加入若晴 20:30 辭職人生線
- [ ] 加入予安 20:00 房仲約
- [ ] 加入庭安 19:50 研究所原始行程
- [ ] 保持所有條件使用既有 state path

### Task 5: Chapter 2 worldline

**Files:**
- Create/Modify under `story/events/`, `story/worldlines/`, `story/narrative/`

- [ ] 玩家能改變若晴 route
- [ ] 柏勳在若晴缺席時改變 route
- [ ] 18:31 death variant 改為柏勳
- [ ] 若晴 20:30 存活事件仍發生
- [ ] Worldline Diff 能看到死者改變與 invariant 保留

### Task 6: Verification

- [ ] Run Event Graph tests
- [ ] Run build
- [ ] 確認 Viewer 可載入所有新 YAML
- [ ] 確認 Chapter 1 baseline 不被 Chapter 2 資料污染
