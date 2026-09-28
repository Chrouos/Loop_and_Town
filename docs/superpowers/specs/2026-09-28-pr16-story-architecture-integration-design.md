# PR #16 Story / Architecture / Roadmap Integration Design

Date: 2026-09-28
Status: Design approved; awaiting written-spec review
Scope: Integrate the complete story foundation from PR #16 into the current anchored-timeline project

## 1. Intent and success criteria

The current project already contains a playable first-loop runtime and a Hybrid Real-time Anchored Timeline implementation. PR #16 adds the larger narrative foundation: the main story spine, character bible, causal Story DAGs, worldline paths, relationship state, NPC-owned final decisions, and a project-level roadmap.

This integration must make those two lines of work one coherent project:

```text
PR #16 story canon / DAG / relationships
                 ↓
        shared story loading boundary
                 ↓
current simulator + anchored player runtime
                 ↓
       author viewer / player surfaces
```

The integration is successful when:

1. PR #16's story and architecture documents are present and internally consistent with the current runtime.
2. Loop 1 through Loop 7 and Final can be loaded by the author viewer without hard-coded per-loop append code.
3. Existing anchored-timeline, action-duration, simulator, and first-loop tests remain green.
4. Story YAML continues to express Simulation Time only; Real Time remains a runtime concern.
5. Relationship state remains hidden from the player-facing UI while remaining inspectable in author/debug surfaces.
6. The canonical `06:12` timing migration is explicit, complete, and covered rather than being a partial opening-scene edit.

## 2. Source branches and integration assumptions

The GitHub page for PR #16 is not reachable from the current execution environment. The local remote-tracking branch `origin/story/main-story-character-bible`, ending at commit `491751e`, is the available PR #16 source and contains the complete project roadmap at:

```text
docs/superpowers/plans/2026-09-28-complete-project-roadmap.md
```

The target working branch is `feature/real-time-anchored-timeline`, ending at `f6f1a74`. The two histories diverged substantially after `ef5207e`; a wholesale merge would reintroduce obsolete timing documents and remove or conflict with current generated/runtime artifacts. Therefore this design uses selective integration, not a blind merge or mass cherry-pick.

Current project assets and behavior take precedence when the PR branch contains an older version of the same runtime boundary. PR #16 story/canon assets take precedence where the current project has no equivalent.

The following are explicitly preserved from the current project:

- `tools/event-graph-viewer/src/player/*` anchored timeline behavior and its v2 save model;
- deterministic simulator and action-duration semantics;
- current dependency lockfile and build workflow;
- existing public/build artifacts unless a fresh build intentionally regenerates them.

The following are imported or reconciled from PR #16:

- main story, chapter, character, relationship, memory, and final canon documents;
- Loop 1–7 and Final narrative/DAG/worldline source data;
- isolated relationship state and story DAG contracts;
- corresponding viewer and acceptance-test coverage;
- complete project roadmap, updated to reflect the integrated state.

## 3. Story model

### 3.1 Source-of-truth layers

The story system keeps four authoring layers distinct:

```text
story/characters, schedules, relationships, knowledge
        → authored world and actor state

story/narrative
        → player-facing scenes, choices, and narrative references

story/events/*_story_dag.yaml
        → causal nodes, reconvergence, knowledge, and relationship changes

story/worldlines/*_paths.yaml
        → named traversable paths through the causal graph
```

The simulator remains the source of runtime state transitions for event-graph simulations. The narrative reader consumes narrative definitions and eligibility rules. The player runtime continues to own wall-clock anchors, loop persistence, scheduler intents, and history timestamps.

### 3.2 Story progression

The main story is a causal DAG with branches and reconvergence, not a generic linear scene list. NPCs retain goals and make their own final decisions; the player can influence conditions and information but does not directly select an NPC's ending decision.

The final sequence remains:

```text
truth shared → NPC decisions → seventh-letter handoff → 18:31 convergence
             → player chooses their own burden
```

Raw relationship dimensions (`Trust`, `Closeness`, `Respect`, `Pressure`) are runtime/author data and are not exposed as player-facing numeric scores.

### 3.3 Timing canon

Author-facing `HH:mm` values remain Simulation Time. The integrated canonical day is:

```text
06:12  return train / reset entry
07:20–08:00  arrival window
09:10  investigation phase
18:31  convergence
23:59  bell
00:00  reset boundary
```

The migration must enumerate and update all affected narrative scenes, event/DAG nodes, schedules, worldline paths, timing tests, and normative documents. Historical design documents may retain their original examples only when clearly marked as historical; runtime source and current normative docs must not disagree.

## 4. Runtime architecture

### 4.1 Boundaries

| Boundary | Responsibility | Must not do |
|---|---|---|
| Story source | Define simulation-time content and authored causal rules | Read `Date.now()` or encode wall-clock timestamps |
| Story DAG loader | Parse/validate nodes, edges, path references, and narrative refs | Mutate player state |
| Simulator | Deterministically apply actions/events/effects and emit simulation history | Decide UI presentation or read wall clock |
| Relationship engine | Evaluate and adjust loop-local relationship state | Become a universal favorability/romance score |
| `WorldlineClock` / player clock | Convert injected real timestamps to Simulation Time | Execute event side effects |
| `EventScheduler` | Process crossed boundaries in deterministic order | Reimplement a separate offline story path |
| Player runtime | Reconcile active loop, persistence, history, knowledge, and reset | Let UI components calculate story time independently |
| Viewer UI | Inspect story, paths, timelines, and author diagnostics | Expose hidden relationship values in player mode |

### 4.2 Declarative story loading

The viewer will use a manifest-driven loading boundary. It must support both forms during migration:

```yaml
narrative: story/narrative/loop_01_player.yaml
narratives:
  - story/narrative/loop_01_player.yaml
  - story/narrative/loop_02_player.yaml
```

The loader will resolve narrative, DAG, and worldline documents from manifest entries or an explicit story index. It will fail fast with source paths for missing files, duplicate scene/node IDs, unresolved `narrative_ref` values, and invalid path references. The old single `narrative` field remains valid until all manifests migrate.

### 4.3 Player/runtime integration

The existing anchored-timeline player stays the integration host for real-time behavior. Story expansion must not fork a second clock or reset implementation. The runtime will receive story content through typed loader outputs and will continue to:

- keep Loop 1 onboarding at Simulation Time `06:12`;
- use the same scheduler for foreground and offline progression;
- record simulation and real timestamps in history;
- preserve protagonist meta-memory/Character Insight across reset;
- clear loop-local actions, temporary flags, schedules, and relationship state on reset;
- allow Loop 2+ time-mode choices only at loop creation.

The first implementation slice may keep the current player evidence-board surface focused on Loop 1 while the author viewer loads the full arc. Expanding the player narrative surface to all arcs is a separate planned task, not a reason to weaken the loading boundary.

## 5. Data flow and error handling

### Author viewer

```text
manifest/index
  → fetch YAML documents
  → parse typed story/DAG/path models
  → validate IDs and cross-references
  → build one story bundle
  → render graph, timeline, worldline diff, and character views
```

Loading errors are surfaced with the failing source path and validation reason. Partial story bundles are not rendered as if complete.

### Player runtime

```text
persisted save + injected now
  → normalize/migrate save
  → calculate active-loop Simulation Time
  → advance scheduler to target
  → append dual-clock history
  → filter records by acquisition/visibility/time
  → atomically persist updated state
```

Backward wall-clock movement clamps progression at the last accepted real/simulation point. Malformed or unknown save fields are discarded by normalization; missing required loop state falls back to a deterministic Loop 1 save without synthesizing historical loops.

### Reset transaction

Crossing Simulation Time `00:00` closes the current history exactly once, preserves meta-state, clears loop-local state, and creates the next loop anchored at `06:12`. Persistence must commit the resulting state as one observable update so reload cannot see a half-reset state.

## 6. Integration sequence

The implementation plan will use these independently testable phases:

1. Import and reconcile PR #16 story/canon/DAG/relationship assets.
2. Isolate and verify DAG/relationship contracts against current simulator types.
3. Replace hard-coded multi-loop viewer loading with manifest-driven loading.
4. Complete canonical timing migration to `06:12` across source, docs, and tests.
5. Connect full story bundle outputs to author viewer and keep player runtime compatibility.
6. Reconcile roadmap/status documents and document remaining productionization work.
7. Run full tests, type-check, production build, and cross-reference validation.

Generated `dist/` output is not treated as the source of truth. It is regenerated only by the build step and retained or ignored according to the current repository policy.

## 7. Testing strategy

Tests are organized by boundary:

- story/DAG parser tests for schema shape, duplicate IDs, missing refs, and path validity;
- narrative loader tests for legacy single-file and manifest multi-file loading;
- relationship engine tests for numeric comparisons, adjustments, fallback decisions, and reset isolation;
- simulator tests proving action-duration and event ordering remain unchanged;
- player clock/scheduler/storage tests for anchor continuity, offline progression, backward clocks, reset, and migration;
- acceptance tests for Loop 1–7 and Final narrative/DAG/worldline coverage;
- UI tests proving author diagnostics can inspect paths while player UI does not expose hidden relationship numbers;
- final full-suite and build verification.

The highest-risk regression cases are:

1. a real-time resume crossing `18:31`, `23:59`, or `00:00`;
2. duplicate scene IDs when multiple narrative documents are merged;
3. a DAG reference pointing to a scene from a document not listed in the manifest;
4. relationship state accidentally surviving a reset or leaking into player UI;
5. old v1 saves being converted into fabricated loops or losing protagonist knowledge;
6. canonical timing migration changing an event timestamp without updating its schedule/path/test consumers.

## 8. Out of scope for this integration

- server-authoritative time or anti-tamper guarantees;
- cross-device save synchronization;
- a full authoring/editor UI for creating DAG YAML;
- redesigning the player UI for every later chapter;
- replacing the deterministic simulator with a new engine;
- unrelated visual polish or generated asset redesign.

## 9. Acceptance checklist

- [ ] PR #16 story/canon assets are present without overwriting current runtime ownership.
- [ ] Viewer loads the complete story bundle declaratively.
- [ ] Duplicate/missing cross-references fail with actionable errors.
- [ ] Existing first-loop and anchored-timeline behavior remains covered.
- [ ] Canonical timing is consistent from `06:12` through `00:00`.
- [ ] Relationship state is isolated, reset correctly, and hidden from player mode.
- [ ] Meta-memory and Character Insight survive loop reset.
- [ ] Full test suite, type-check, and production build pass.
- [ ] Roadmap status distinguishes implemented work from pending productionization.
