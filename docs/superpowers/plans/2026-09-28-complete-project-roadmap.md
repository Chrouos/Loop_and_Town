# Loop_and_Town Complete Project Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement pending plans task-by-task. This document is the PR-level index and status ledger; detailed implementation steps live in the linked plans.

**Goal:** 將目前已確認的遊戲核心、主線故事、Event Graph、Worldline、Relationship State、Final、玩家 Runtime 與 Real-time Anchored Timeline 收斂成一份可追蹤的總計畫。

**Architecture:** `docs/` 保存作者端 canon/spec/plan；`story/` 是 runtime story source of truth；`tools/event-graph-viewer/` 同時提供作者用 DAG Viewer 與玩家 runtime prototype。Story data 只知道 Simulation Time；runtime 才知道 Real Time；角色決策由角色狀態與目標驅動，而不是由玩家直接指定結局。

**Tech Stack:** TypeScript, React 18, Vite 5, Vitest, YAML, JSON Schema, @xyflow/react

## Status Legend

- ✅ Implemented + covered by current PR tests/build
- 🟨 Designed / planned, implementation pending
- 🔁 Existing foundation already on `main`, must remain compatible
- ⛔ Explicitly not part of current merge

---

## 1. Existing foundation plans

These plans predate the current story expansion and remain architectural dependencies.

| Area | Plan | Status |
|---|---|---|
| Event Graph Viewer | `docs/superpowers/plans/2026-09-23-event-graph-viewer.md` | 🔁 foundation present |
| Player first loop | `docs/superpowers/plans/2026-09-23-player-first-loop.md` | 🔁 foundation present |
| Story Simulation v0.2 | `docs/superpowers/plans/2026-09-23-story-simulation-v0.2.md` | 🔁 foundation present |
| Worldline Simulator v0.1 | `docs/superpowers/plans/2026-09-23-worldline-simulator-v0.1.md` | 🔁 foundation present |
| Narrative Foundation v0.1 | `docs/superpowers/plans/2026-09-24-narrative-foundation-v0.1.md` | 🔁 foundation present |
| Action Duration / script control | `docs/superpowers/plans/2026-09-27-action-duration-script-control.md` on `main` | 🔁 implemented on main |

Compatibility rule: this PR must not replace or regress these systems. The current merge-ref CI is the integration gate.

---

## 2. Canon and main narrative

### Specs / canon

- `docs/superpowers/specs/2026-09-27-main-story-character-bible-design.md`
- `docs/main-story.md`
- `docs/character-bible.md`
- `docs/relationship-map.md`
- `docs/story-canon-memory.md`
- `docs/story-canon-time.md`

### Chapter documents

- Chapter 1: `docs/first-loop-story.md`
- Chapter 2: `docs/chapter-02-living-survivor.md`
- Chapter 3: `docs/chapter-03-no-death-worldline.md`
- Chapter 4: `docs/chapter-04-five-years-ago.md`
- Chapter 5: `docs/chapter-05-the-one-who-remembers.md`
- Chapter 6: `docs/chapter-06-the-six-letters.md`
- Chapter 7: `docs/chapter-07-lin-zhixia.md`
- Final: `docs/final-1831.md`

### Status

✅ Chapter 0–Final story spine exists.

✅ Main cast has private goals, history, pressure, and non-player-dependent schedules.

✅ 18:31 is defined as causal convergence/correction, not a required death time.

✅ The seventh letter is an information interface sustained by stable memory, not a normal physical mail mystery.

✅ Ending resolution is about responsibility/consent, not choosing who must die.

---

## 3. Story DAG and Worldline Viewer

### Detailed design / plan

- Spec: `docs/superpowers/specs/2026-09-27-dag-story-viewer-design.md`
- Plan: `docs/superpowers/plans/2026-09-27-dag-story-viewer-implementation.md`

### Runtime data

- `story/events/day_01_story_dag.yaml`
- `story/events/loop_03_story_dag.yaml`
- `story/events/loop_04_story_dag.yaml`
- `story/events/loop_05_story_dag.yaml`
- `story/events/loop_06_story_dag.yaml`
- `story/events/loop_07_story_dag.yaml`
- `story/events/final_story_dag.yaml`
- matching files under `story/worldlines/*_paths.yaml`

### Status

✅ DAG is causal rather than a generic tree/flowchart.

✅ Supports branches and reconvergence.

✅ Node inspector exposes Before / After / Reason / delayed effects / knowledge / relationship changes / narrative refs.

✅ Worldline path selector can highlight individual paths and author mode can expose all possibilities.

✅ Final contains three player-owned endings after NPC-owned decisions reconverge.

---

## 4. Main story runtime breakdown

Detailed plan:

- `docs/superpowers/plans/2026-09-27-main-story-runtime-breakdown.md`

Current implementation status:

✅ Story docs split.

✅ Character metadata expanded without changing canonical IDs.

✅ Relationship graph expanded.

✅ Schedule life lines added, including 若晴 resignation and independent NPC plans.

✅ Chapter 2 worldline implemented with explicit causal steps rather than direct victim swap.

✅ Later Loop 3–7 and Final have narrative + DAG + worldline path acceptance coverage.

---

## 5. Relationship State and Character Insight

### Runtime sources

- `story/relationships/relationship_state.yaml`
- `story/relationships/final_decisions.yaml`
- `story/knowledge/character_insights.yaml`

### Rules

Loop-local dimensions:

```text
Trust
Closeness
Respect
Pressure
```

Cross-loop retained knowledge:

```text
Character Insight
Protagonist memory
Discovered evidence / facts according to canon persistence rules
```

Explicitly forbidden as the core model:

```text
affection
romance_score
universal_favorability
```

### Status

✅ Relationship state model exists.

✅ Numeric threshold engine is covered independently from the Action Duration simulator changes.

✅ Final NPC decisions use each character's conditions and goals.

✅ NPC fallback decisions remain valid agency-preserving outcomes, not automatic bad endings.

✅ Player does not see raw relationship numbers in the intended player UX.

---

## 6. Final 18:31

### Flow

```text
17:42  full truth shared
  ↓
17:50  each NPC decides their own involvement
  ↓
18:03  seventh-letter handoff / preparation
  ↓
18:31  collective convergence
  ↓
player chooses only their own burden
  ├─ Ending A: 明天
  ├─ Ending B: 再一次
  └─ Ending C: 忘記我
```

### Status

✅ Final DAG implemented.

✅ Final narrative implemented.

✅ Final worldline paths implemented.

✅ Viewer can load all three endings.

✅ NPC decisions occur before the player's ending choice.

---

## 7. Real-time Anchored Timeline

### Design

- `docs/superpowers/specs/2026-09-28-real-time-anchored-timeline-design.md` on `main`

### Implementation plan

- `docs/superpowers/plans/2026-09-28-real-time-anchored-timeline-implementation.md`

### Status

🟨 Design complete; runtime implementation pending.

Target model:

```text
Real Time
   ↓
Worldline Anchor
   ↓
Time Scale
   ↓
Simulation Time
   ↓
Event Scheduler
   ↓
Narrative / NPC / Event Graph
```

Policy:

```text
Loop 1
→ forced onboarding
→ Simulation Time starts 06:12
→ accelerated; target balance default 6x

Loop 2+
→ configurable
→ may opt into stronger real-world anchored sync
→ authored event times remain unchanged
```

Key requirements:

- no player misses the opening because they started at 17:00 real time;
- online and offline use the same scheduler;
- reset is triggered by Simulation Time 00:00;
- reset creates a new anchor at 06:12;
- Worldline History records both simulation and real timestamps;
- scale changes re-anchor without jumping story time.

---

## 8. Canonical timing migration

### Current issue

The playable prototype still contains historical `14:20` opening-era data, while the canon now defines:

```text
06:12  reset / wake on return train
07:20–08:00 arrival
09:10  investigation available
18:31  convergence
23:59  bell
00:00  reset
```

### Status

🟨 Pending as a deliberate atomic migration.

Do not partially edit one narrative scene. Migration must update all affected:

- narrative scenes;
- schedules;
- DAG nodes;
- worldline paths;
- timing acceptance tests;
- docs that are normative for runtime time.

This migration is Task 8 of the Real-time Anchored Timeline implementation plan.

---

## 9. Narrative loading / manifest cleanup

### Current issue

The viewer currently accumulated multiple loop narrative sources incrementally. This worked for proving Arc 2–Final, but production authoring should not require hard-coded per-loop appends.

### Planned shape

🟨 Generalize manifest/loading to support multiple narrative documents declaratively, e.g. backward-compatible:

```yaml
narrative: story/narrative/loop_01_player.yaml
narratives:
  - story/narrative/loop_01_player.yaml
  - story/narrative/loop_02_player.yaml
  - story/narrative/loop_03_player.yaml
```

Required validation:

- duplicate scene IDs fail fast;
- every DAG `narrative_ref` resolves;
- missing files fail with source path;
- legacy single `narrative` remains valid during migration.

This cleanup should be implemented before content expands materially beyond the current main arc.

---

## 10. Player loop persistence and reset model

🟨 Productionization pending together with anchored timeline.

Persistence layers must be separated:

```text
Meta State (cross-loop)
├─ protagonist memory
├─ Character Insight
├─ discovered evidence allowed by canon
└─ worldline history summaries

Loop State (reset)
├─ NPC schedule mutations
├─ Trust / Closeness / Respect / Pressure
├─ temporary flags
├─ current activities
└─ local route/event state
```

The reset operation must be atomic so a reload can never observe half old-loop / half new-loop state.

---

## 11. Player-facing interaction principles

These are constraints across every remaining implementation plan.

- Do not make every sentence a collectible card.
- Cards represent important evidence/events/worldline changes only.
- The evidence board is spatial / freely arranged and linkable rather than a card wall.
- NPCs are not clue dispensers; they have schedules and private goals before the player intervenes.
- A small choice should affect information first, character state second, and only major causal changes should alter a worldline.
- Saving someone is not a success state by itself; the saved character continues their own life.
- The player can influence people but cannot directly command Final participation.
- Worldline correction is causal, not moral punishment for saving someone.

---

## 12. Delivery sequence after this PR

### Phase A — merge current story architecture

✅ Merge PR #16 once review is accepted.

Contains:

- complete story bible;
- Chapter 2–Final narrative arc;
- DAG/worldline data;
- Relationship State / Character Insight;
- Final NPC decision model;
- Viewer integration and acceptance tests;
- this master roadmap.

### Phase B — anchored timeline runtime

🟨 Execute `2026-09-28-real-time-anchored-timeline-implementation.md` task-by-task with TDD.

### Phase C — declarative multi-loop narrative loading

🟨 Remove hard-coded loop append logic and enforce narrative-ref integrity globally.

### Phase D — canonical 06:12 timing migration

🟨 Execute atomically after the clock abstraction exists.

### Phase E — production player experience

🟨 Connect loop persistence, offline resume summary, evidence board progression, and actual playable Arc 2+ transitions.

### Phase F — content / balance pass

🟨 Tune time scale, action durations, investigation windows, clue density, relationship thresholds, and offline cap values without changing canon architecture.

---

## 13. Verification baseline for PR #16

Latest verified merge-ref before this roadmap update:

```text
Test Files: 72 passed
Tests:      289 passed
TypeScript: passed
Vite build: passed
Event Graph Viewer workflow: success
Pages build job: success
PR deploy job: skipped by PR workflow design
```

Any new commit to PR #16 invalidates this baseline until CI runs again. Final completion claims must use the latest HEAD's fresh workflow results.

---

## 14. PR Definition of Done

PR #16 is ready to leave Draft when all of these are true:

- [ ] Story canon and runtime data agree on all non-time-migration semantics.
- [ ] Loop 1–7 + Final acceptance tests pass on the latest merge-ref.
- [ ] Relationship / Final decision acceptance tests pass.
- [ ] DAG Viewer loads all current loop and Final paths.
- [ ] `npm test` passes with zero failures.
- [ ] `npm run build` passes.
- [ ] GitHub reports the PR mergeable against current `main`.
- [ ] Remaining Real-time / 06:12 migration work is explicitly marked as follow-up rather than silently implied complete.
- [ ] PR description links this roadmap and accurately distinguishes implemented work from planned work.

The PR should remain Draft until the user explicitly chooses to mark it Ready for Review.
