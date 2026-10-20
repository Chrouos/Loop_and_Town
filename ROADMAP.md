# Loop_and_Town Development Roadmap

> Updated: 2026-10-20
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

## 1. PR history

The original M0–M6 PR stack has landed on `main`:

```text
#20 Core Gameplay            → merged (a4f5550)
#18 Author Workbench         → merged via #23 reconcile
#16 / #19 / #21              → reconciled and squashed into #24 (4f4d412)
#24 Canonical worldlines + playable Final + CI/CD
#25 Immersive Attention      → salvaged onto auto-flow player as #33
#26–#33 Player presentation  → narration pager, auto-flow, inline capture, immersive Attention
```

New work branches from latest `main`, follows the merge gate in §14, and lands as one PR per slice.

---

## 2. M0 — Canonical design baseline

### #20 Core Gameplay Spec

Status: **Merged**

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

Status: **Landed via #24**

Translates gameplay rules into Player presentation architecture.

---

## 3. M1 — Story / world foundation

### #16 Main Story / Canon / DAG / Relationship

Status: **Landed via #24** (Loop 01–07 + Final narrative, DAG and worldline data on `main`)

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

Status: **Implemented / verified**

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

Delivered:

- Perception-gated capture action
- Capture occupies Attention while World Time continues
- Persistent Memory stores the original perceived content only
- Duplicate capture is prevented per loop and source scene

---

## 9. M6 — Memory Library + Investigation Wall

Status: **Implemented / verified**

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

Delivered:

- Captured Memory Library with explicit player placement
- Freeform wall cards with persisted positions
- Manual links and player notes persist independently
- UI states explicitly avoid automatic contradiction, causality, or importance judgments

---

## 10. M7 — Real-time world productionization

Status: **Mostly implemented; remaining test gaps listed below**

Consolidate time architecture after World Never Waits migration.

Implemented in `src/player/clock.ts`, `runtime.ts`, `eventScheduler.ts`:

- Loop 1 starts at 06:12 in ACCELERATED mode (scale ×12; ~62 real minutes to 18:31)
- Loop 2+ chooses LIVE_SYNC (device local clock, unavailable before 06:12) or ACCELERATED from 06:12
- OFFLINE / BOOTSTRAP catch-up crosses 18:31 and 23:59, stops only at the 00:00 Reset lifecycle
- multi-day offline does not infer extra loops

Covered by `tests/player/anchoredTimelineAcceptance.test.ts`, `tests/player/eventScheduler.test.ts`, `tests/player/knowledge.test.ts`.

Not yet covered by an explicit acceptance test:

- miss an Opportunity while Attention is focused elsewhere
- Convergence while Capture / Attention is in progress (foreground)
- Bell while reading a paged narration / letter

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

Status: **Data wired; per-loop player validation not yet done**

All Loop 01–07 and Final player narratives load through `story/manifests/loop_01.yaml`, and each has a data-level acceptance test. The Final P0–P4 mechanics are playable (`docs/player-final-playable-spec.md`). What has not been done is an end-to-end playthrough of each Loop in `/player.html` against the checklist below.

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

Status: **Merged** (author viewer root `index.html`)

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

Status: **Partially implemented ahead of M8 validation**

Done:

- scene-first Player UI shell
- fade in / fade out, reset transition, ambient waiting states
- reduced motion path
- paged narration without scrolling (#27), cinematic auto-flow (#28–#30)
- inline clue capture from narrated words and capture feedback (#31–#32)
- inline / peripheral immersive Attention (#33)

Not started:

- pixel / animated environment treatment
- spatial sound
- parallax / subtle motion
- touch / controller mappings

Further polish waits until M8 Loop 01 validation passes.

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
Done: #20, #19, #16, #21, M5, M6, #18, Final P0–P4 slice, M9 presentation pass (#26–#33)

1. Loop 01 end-to-end validation in /player.html against the M8 checklist
   → regression check that #27–#33 presentation did not break
     Attention / Perception / Capture / Wall / Reset semantics
   → gap list: docs/superpowers/plans/2026-10-20-loop01-validation-gaps.md
   → G1 + G2 fixed; passive and active paths walked; next G8 + G9, G3, then G5 / G4
2. Close M7 test gaps (miss while focused, Convergence during Capture, Bell while reading)
3. Loop 02 validation, then Loop 03 → 07 in order, then reconnect to Final
4. Remaining game-feel polish (environment art, spatial sound, parallax, touch / controller)
```

Guiding rule:

> **Gameplay semantic correctness comes before presentation polish.**
