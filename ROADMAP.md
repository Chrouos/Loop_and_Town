# Loop_and_Town Development Roadmap

> Updated: 2026-09-29
>
> Purpose: this is the **developer-facing execution map**. It does not replace gameplay/story specs. When roadmap wording overlaps gameplay rules, `docs/core-gameplay-spec-v0.1.md` is the source of truth.

## 0. Project direction

Loop_and_Town is a real-world-linked idle visual novel / loop mystery game.

The implementation should preserve these canonical ideas:

```text
World keeps moving
    ↓
Opportunity / Dialogue / Ambient Event
    ↓
Attention
    ↓
Perception
    ↓
optional Memory Capture
    ↓
Memory Library
    ↓
Investigation Wall
    ↓
Player hypothesis / Memory Input
    ↓
Different Action / Event / Worldline
```

Author causal truth and Player knowledge are separate systems.

```text
Author Event Graph / Causal Timeline ≠ Player Investigation Wall
```

---

## 1. Current PR dependency map

```text
                    ┌──────────────────────────────┐
                    │ #20 Core Gameplay Spec v0.1 │
                    │ canonical gameplay contract │
                    └──────────────┬───────────────┘
                                   │
                   ┌───────────────┼────────────────┐
                   │               │                │
                   ▼               ▼                ▼
        #19 Player UI Spec   #16 Story / Canon   #21 Player Runtime
        presentation rules   DAG + relationships  migration
                                   │
                                   ▼
                         #18 Author Workbench
                         causal/debug tooling
```

### Merge recommendation

The required foundation order is:

```text
#20 → #19 → #16
```

After #16 is merged, Player Runtime and Author Tooling are independent tracks:

```text
Player track: #21 → Attention → Text → Memory → Investigation
Author track: #18 → Workbench refinement
```

If a single linear merge order is preferred:

```text
#20 → #19 → #16 → #21 → #18
```

Reason: stabilize gameplay rules first, then Player presentation contract, then canonical story data, then migrate the actual Player runtime. Author Workbench is useful but should not block Player gameplay implementation.

### Stacked PR rule

After a base PR is merged:

1. retarget/rebase dependent PRs onto latest `main`
2. resolve conflicts using the newest Core Gameplay rules
3. run fresh tests + build on the new HEAD
4. only then mark the dependent PR ready

Do not treat an older green workflow run as valid after its base changes.

---

## 2. Milestone M0 — Canonical design baseline

**Goal:** remove competing gameplay definitions before further runtime work.

### PR #20 — Core Gameplay Spec v0.1

Status: **Ready / merge first**

Defines:

- World Never Waits
- Single Main Action
- Single Focus
- Elastic Attention
- Perception Boundary
- Memory Capture
- Loop persistence rules
- Spatial Typography / Rhythmic Text / Text Echo
- Dialogue as continuous gameplay
- Attention Release
- finite information
- Investigation Wall semantics

**Done when:** merged to `main` and treated as gameplay source of truth.

### PR #19 — Player Immersive UI v0.2

Status: **Documentation-only, merge after #20**

Translates Core Gameplay into Player-facing presentation architecture.

**Done when:** rebased against merged #20, checked for contradictory older UI assumptions, then merged.

---

## 3. Milestone M1 — Story / world foundation

### PR #16 — Main Story / Canon / DAG / Relationship

Status: **Large draft; must rebase and reverify before merge**

Owns:

- Chapter 0 → Final story canon
- Character Bible
- Story DAG / Worldline data
- Relationship state
- Player narrative records
- loop-specific story data

Rules that must remain true:

```text
World Event ≠ Player Knowledge
NPC ordinary memory resets across loops
Captured protagonist Memory may persist
Zhixia cross-worldline memory is a story exception, not a generic NPC system
```

**Done when:**

- rebased onto latest `main`
- merge conflicts resolved with #20 taking precedence
- fresh full test/build green
- story acceptance tests still pass

---

## 4. Milestone M2 — Player runtime semantic migration

### PR #21 — Perception Boundary

Status: **Draft / active runtime migration**

Delivered slice:

```text
World Event
→ Opportunity
→ Attend
→ Perception
→ Player-visible content
```

Current runtime guarantees:

- presence event is not automatically Player Knowledge
- Opportunity windows are finite
- `perceivedSceneIds` is loop-local
- Attend does not pause or rewrite World Time
- missed Live Sync history does not leak presence information

Before merge:

- rebase onto merged #16/main
- rerun full tests + build
- confirm Story data projection still obeys Perception Boundary

---

## 5. Milestone M3 — Elastic Attention runtime

**Next active development slice.**

Target state machine:

```text
Main Action
   ↓
Peripheral Cue
   ↓
Hover / Notice
   ↓
Single Focus
   ↓
Click / Attend
   ↓
Attention Shift (real time)
   ↓
Observe
   ↓
Auto Return
```

Redirect:

```text
Observe A
   ↓
Attention Redirect
   ↓
Observe B
```

True interruption:

```text
Main Action
   ↓
True Interrupt
   ↓
New Main Action
```

Implementation requirements:

- one Primary Focus only
- Hover changes surface focus but does not freeze anything
- Attention Shift has actual elapsed time
- faded information continues progressing
- Observation can finish naturally and auto-return
- redirect is distinct from abandoning Main Action
- tests must prove events can be partially/missed while shifting focus

**Done when:** runtime state + PlayerApp integration + acceptance tests are green.

---

## 6. Milestone M4 — Immersive text runtime

Build only after Attention semantics are stable.

### Spatial Typography

- text position carries speaker / direction / distance
- dialogue does not behave like a chat history
- text follows character blocking

### Rhythmic Text

- Phrase / Beat / Pause based speech
- no fixed `30ms per character` typewriter as the canonical system
- speech duration consumes World Time

### Text Echo

- previous line leaves a faint temporary residue
- residue is not chat history
- echo duration represents perception / emotional weight, not clue importance

**Done when:** repeated dialogue, ambient text, and spatial dialogue all use the same presentation layer.

---

## 7. Milestone M5 — Memory Capture

Target chain:

```text
Perception
   ↓
Hold / Capture
   ↓
Captured Moment
   ↓
Persistent Memory
```

Supported Memory types:

- Text
- Visual
- Sound
- Composite Moment

Rules:

- only perceived information can be captured
- Capture does not pause World Time
- Capture itself occupies Focus
- Memory cannot become clearer than original perception
- no system ranking of importance

**Done when:** captured Memories persist across Loop reset while ordinary scene perception does not.

---

## 8. Milestone M6 — Memory Library + Investigation Wall

Replace old evidence semantics with the canonical distinction:

```text
Memory Library = what the protagonist remembers
Investigation Wall = what the player thinks is related
```

Required:

- infinite/freeform board
- drag Memory references onto board
- player-authored notes / links / groups
- no auto contradiction detector
- no auto causal edge
- no auto “important clue” state
- layout / links / notes persist across loops

Then add **Memory Input** for explicitly authored narrative nodes.

---

## 9. Milestone M7 — Real-time world productionization

Consolidate current anchored timeline implementation with final gameplay semantics.

Required:

- Loop 1 canonical 06:12 onboarding
- Loop 2+ Accelerated / Live Sync entry modes
- Live Sync uses player's real local clock
- offline catch-up
- no silent future-loop consumption
- dialogue / reading / attention / choices never create hidden time pause
- critical boundaries remain deterministic

Add tests for:

- returning after hours offline
- entering before / after a temporary Opportunity
- missing an event while focused elsewhere
- convergence while Player is occupied
- reset boundaries

---

## 10. Milestone M8 — Story integration across loops

Once Player mechanics are stable, migrate all story chapters through the real runtime instead of validating only Author DAG data.

Order:

```text
Loop 01 vertical slice
→ Loop 02
→ Loop 03 / 04
→ Loop 05 / 06
→ Loop 07
→ Final
```

Each Loop must validate:

- story causality
- Player Perception opportunities
- Capturable Moments
- missed information paths
- meaningful Choices
- Memory Input nodes
- NPC reset behavior
- Worldline consequence

---

## 11. Author tooling track

### PR #18 — Causal Timeline Workbench

This track is independent after #16 is merged.

Purpose:

- inspect causal truth
- compare Worldlines
- inspect downstream effects
- debug hidden conditions / convergence inputs

Boundary:

```text
Author truth may know the answer.
Player UI may not inherit that answer automatically.
```

**Done when:** rebased onto merged #16, tests/build are fresh green, and no Author-only causal data leaks into Player components.

---

## 12. Milestone M9 — Presentation / game-feel polish

Only after the semantic runtime is stable:

- scene-first Player UI
- pixel / animated environment treatment
- fade in / fade out
- spatial sound
- parallax / subtle motion
- waiting-state ambient life
- reduced-motion accessibility
- mobile / touch Attention mappings
- controller mapping if needed

Avoid polishing temporary Web UI that is scheduled to be replaced.

---

## 13. Merge gate

A PR can be merged only when all applicable checks are true:

```text
[ ] follows Core Gameplay source of truth
[ ] rebased / retargeted to current main
[ ] no unresolved overlap with newer design
[ ] fresh tests green on current HEAD
[ ] production build green on current HEAD
[ ] story/runtime acceptance tests green where applicable
[ ] Player-facing code does not leak Author truth
[ ] no generic NPC cross-loop memory residue
[ ] no automatic clue importance / causal inference
[ ] PR description reflects the actual final implementation
```

For stacked PRs, merge the base first, then refresh the child PR before merging it.

---

## 14. Immediate queue

Current recommended execution queue:

```text
1. Merge #20 — Core Gameplay
2. Rebase + merge #19 — Player UI contract
3. Rebase/fix/verify #16 — Story + Canon
4. Rebase #21 on latest main
5. Finish #21 runtime slices:
   5.1 Perception Boundary ✓
   5.2 Single Focus + Elastic Attention
   5.3 Spatial / Rhythmic Text
   5.4 Memory Capture
   5.5 Investigation semantic migration
6. Rebase + verify #18 — Author Workbench
7. Run Loop 01 end-to-end vertical slice
8. Expand real runtime through Loop 02 → Final
9. Game-feel / visual polish
```

The guiding development rule is:

> **Implement semantic gameplay correctness before presentation polish.**
