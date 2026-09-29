# Loop_and_Town Development Roadmap

> Updated: 2026-09-29
>
> Developer execution map. Gameplay semantics always defer to `docs/core-gameplay-spec-v0.1.md`.

## 0. Project direction

```text
World continuously moves
        ↓
Opportunity / Dialogue / Ambient
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

```text
Author causal truth ≠ Player Investigation Wall
```

---

## 1. PR dependency map

```text
                    #20 Core Gameplay
                   /        |         \
                  /         |          \
        #19 Player UI   #16 Story     #21 Player Runtime
                            |
                            v
                     #18 Author Workbench
```

Recommended linear merge order:

```text
#20 → #19 → #16 → #21 → #18
```

After each base merge:

1. rebase / retarget child PR
2. resolve overlap using latest Core Gameplay
3. run fresh full tests + build
4. only then mark ready

---

## 2. M0 — Canonical design baseline

### #20 Core Gameplay Spec

Status: **Ready / merge first**

Owns:

- World Never Waits
- Single Main Action
- Single Focus
- Elastic Attention
- Perception Boundary
- Memory Capture
- Asymmetric Loop Persistence
- Spatial Typography / Rhythmic Text / Text Echo
- Dialogue as continuous gameplay
- Investigation Wall

Also owns documentation precedence through `docs/README.md`.

### #19 Player Immersive UI Spec

Status: **Documentation contract / merge after #20**

Translates gameplay rules into Player presentation architecture.

---

## 3. M1 — Story / world foundation

### #16 Main Story / Canon / DAG / Relationship

Status: **Draft; active reconciliation**

Owns:

- Chapter 0 → Final
- Character Bible
- Story DAG / Worldline data
- Relationship state
- Story Canon memory / time
- Event Graph author contract

Must preserve:

```text
World Event ≠ Player Knowledge
Normal NPC prior-loop memory resets
Captured Memory may persist
Zhixia memory is a story-specific exception
Author causal truth never auto-becomes Player deduction
```

Merge gate:

- rebase latest main
- no regression of newer Canon docs
- fresh tests/build green

---

## 4. M2 — Perception Boundary runtime

### #21 Slice 1

Status: **Implemented / verified in Draft PR**

```text
World Event
→ Opportunity
→ Attend
→ Perception
```

Delivered:

- loop-local `perceivedSceneIds`
- finite Opportunity windows
- presence event does not auto-become Player Knowledge
- missed Live Sync history stays hidden

---

## 5. M3 — Single Focus + Elastic Attention

### #21 Slice 2

Status: **Implemented / verified**

```text
Primary Focus
→ Click / Attend
→ Attention Shift
→ Observation
→ Perception
→ Auto Return
```

Delivered prototype values:

- Shift: `650ms`
- generic Observation fallback: `900ms`
- authored Spatial/Rhythmic scenes may extend Observation to their real presentation duration

Rules protected by tests:

- Click ≠ instant perception
- only one active focus
- Redirect replaces prior target
- Observation must complete before Perception
- World Time does not pause

---

## 6. M3.5 — World Never Waits boundary migration

Status: **Implemented / verified in #21**

Legacy behavior removed:

```text
18:31 / 23:59 critical boundary
→ offline catch-up stops
→ waits for foreground resume
```

Current runtime contract:

```text
18:31 Convergence → happens while offline
23:59 Bell        → happens while offline
00:00 Reset       → Loop lifecycle boundary
```

Delivered:

- OFFLINE / BOOTSTRAP crosses 18:31
- OFFLINE / BOOTSTRAP crosses 23:59
- Attention / Dialogue / Reading do not freeze these boundaries
- Author Worldline History may contain missed events without exposing them as Player Knowledge
- legacy `convergence` / `bell` pending states migrate forward
- `pendingCriticalBoundary` is now narrowed to the 00:00 Reset lifecycle transaction

### 00:00 special case

00:00 remains an explicit Loop lifecycle boundary because creating the next Loop is a separate transaction.

This does not imply any earlier Story Event may wait for foreground.

---

## 7. M4 — Immersive Text Runtime

Status: **Implemented / verified vertical slice in #21**

### Spatial Typography

Delivered:

- screen acts as stage
- spatial anchors represent speaker / direction
- protagonist defaults lower-left
- other dialogue defaults right
- narration defaults center
- author can override anchor in Narrative data

### Rhythmic Text

Delivered:

- semantic Phrase / Beat / Pause model
- whole beats reveal at once
- no fixed per-character typewriter as canonical model
- rhythm occupies real elapsed time
- authored script duration participates in Attention Observation duration

### Text Echo

Delivered:

- prior phrase becomes a faint temporary echo
- Echo expires instead of building a chat history
- Echo duration is presentation rhythm, never clue importance

Current presentation chain:

```text
Original context
→ Attend
→ Attention Shift
→ Spatial Observation begins
→ Phrase / Beat / Pause
→ previous Phrase becomes Text Echo
→ Observation completes
→ Perception recorded
→ Elastic Auto Return to original context
```

First vertical slice: `18:31 station-blackout`.

Artifacts / phone messages remain document-like for now; M4 intentionally does not force every surface into spatial floating text.

Verification baseline at #21 HEAD `9908f708d4f0f8c3be57d57131058653fce6cd94`:

```text
83 / 83 test files passed
360 / 360 tests passed
TypeScript PASS
Vite build PASS
Event Graph Viewer SUCCESS
Deploy SUCCESS
```

M4 does not create persistent Memory.

---

## 8. M5 — Memory Capture

Status: **Next runtime milestone**

```text
Perception
→ Hold / Capture
→ Captured Moment
→ Persistent Memory
```

Memory types:

- Text
- Visual
- Sound
- Composite Moment

Rules:

- only perceived information can be captured
- Capture occupies Focus
- Capture does not pause World Time
- Memory cannot become clearer than original perception
- no automatic importance ranking

---

## 9. M6 — Memory Library + Investigation Wall

```text
Memory Library = what protagonist remembers
Investigation Wall = what player thinks is related
```

Required:

- freeform / infinite board
- drag Memory references
- player notes / links / groups
- no auto contradiction
- no auto causal edge
- no auto important clue state
- layout / links / notes persist
- scripted Memory Input where authored

---

## 10. M7 — Real-time world productionization

Consolidate time architecture after World Never Waits migration.

Required:

- Loop 1 canonical 06:12
- Loop 2+ Accelerated / Live Sync entry model
- Live Sync uses player device local clock
- deterministic offline catch-up
- temporary Opportunities can be missed
- no hidden foreground clock pause
- 18:31 / 23:59 continue while Player absent
- explicit 00:00 lifecycle contract

Tests:

- return after hours offline
- enter before / after an Opportunity
- miss event while focused elsewhere
- Convergence while occupied / offline
- Bell while reading
- Reset boundary behavior

---

## 11. M8 — Story integration across loops

```text
Loop 01 vertical slice
→ Loop 02
→ Loop 03 / 04
→ Loop 05 / 06
→ Loop 07
→ Final
```

Each Loop validates:

- Story causality
- Perception opportunities
- Capturable Moments
- missed paths
- Meaningful Choice
- Memory Input
- NPC reset
- Worldline consequence

---

## 12. Author tooling track

### #18 Causal Timeline Workbench

Purpose:

- inspect causal truth
- compare Worldlines
- inspect downstream effects
- debug hidden conditions / convergence

Boundary:

```text
Author tool may know the answer.
Player UI may not inherit it automatically.
```

---

## 13. M9 — Game-feel polish

Only after semantic runtime is stable:

- scene-first Player UI
- pixel / animated environment treatment
- fade in / fade out
- spatial sound
- parallax / subtle motion
- ambient waiting states
- reduced motion
- touch / controller mappings

---

## 14. Merge gate

```text
[ ] follows Core Gameplay
[ ] rebased to latest main
[ ] docs do not regress newer Canon
[ ] fresh tests green
[ ] production build green
[ ] Player code does not leak Author truth
[ ] no generic NPC cross-loop memory residue
[ ] no automatic clue importance / causal inference
[ ] World Never Waits still holds
[ ] PR description matches implementation
```

---

## 15. Immediate queue

```text
1. Merge #20 — Core Gameplay + documentation precedence
2. Rebase + merge #19 — Player presentation contract
3. Rebase/fix/verify #16 — Story / Canon / Event Graph
4. Rebase #21 on latest main
5. Re-run #21 verification after rebase
6. M5 — Memory Capture
7. M6 — Investigation semantic migration
8. Rebase + verify #18 — Author Workbench
9. Loop 01 end-to-end vertical slice
10. Loop 02 → Final runtime integration
11. Game-feel polish
```

Guiding rule:

> **Gameplay semantic correctness comes before presentation polish.**
