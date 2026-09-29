# Loop_and_Town Complete Project Roadmap v0.2

## Precedence

Current canonical gameplay is defined by `Core Gameplay Spec v0.1`.

Where older plans, story docs, prototypes or runtime assumptions overlap with Core Gameplay and conflict, **the current Core Gameplay rules win**.

This roadmap therefore treats older implementation as migration input, not immutable compatibility behavior.

---

# 1. Product goal

建立一個真實世界連動的放置視覺小說：

```text
Real / World Time keeps moving
        ↓
Player has one Main Action
        ↓
World creates simultaneous Dialogue / Ambient / Opportunities
        ↓
Single Focus Attention
        ↓
Perception
        ↓
Player-selected Memory Capture
        ↓
Investigation Wall
        ↓
Choice / Memory Input / Action
        ↓
Worldline changes
        ↓
Loop Reset
        ↓
Only protagonist-side remembered information persists
```

---

# 2. Canonical gameplay invariants

Every remaining implementation plan must preserve:

1. World Never Waits
2. Single Main Action
3. Single Focus
4. Faded ≠ Paused
5. Attention Shift Takes Time
6. Perception Boundary
7. Memory Is Player-selected
8. No Auto Deduction
9. Finite Information
10. Loop Persistence Is Asymmetric

Older designs that freeze Story Time while reading or deciding are superseded.

---

# 3. Story canon

Primary story docs:

- `docs/main-story.md`
- `docs/character-bible.md`
- `docs/relationship-map.md`
- `docs/story-canon-memory.md`
- `docs/story-canon-time.md`
- Chapter 1–7 + Final docs

Current narrative principles:

- NPCs have private goals and schedules independent of the player
- saving someone is not a completion state
- 18:31 is a causal convergence / correction point, not simply a victim timer
- player intervention changes information, relationship and route before changing large outcomes
- final resolution concerns responsibility / consent, not selecting who must die
- normal NPCs do not accumulate cross-loop memory residue
- Zhixia may be a story-specific former memory-holder exception if required by canon

---

# 4. Event Graph / Author Viewer

Author Event Graph remains the source for causal truth:

```text
Canon Truth
→ World Event Node
→ Condition / Edge
→ Character decision
→ Schedule / Route change
→ Delayed consequence
→ Worldline Path
```

But it must now separately model the player knowledge boundary:

```text
World Event
→ Peripheral Cue
→ Attention
→ Perception
→ optional Memory Capture
```

Important separation:

```text
Author Viewer       = known causal truth
Investigation Wall  = player's own hypotheses
```

Author tools may show downstream effects and hidden causes.
Player Investigation must not inherit those automatic semantics.

---

# 5. Relationship State

Loop-local relationship dimensions:

```text
Trust
Closeness
Respect
Pressure
```

Optional local dimensions only where story needs them:

```text
availability
obligation
fear
exposure
promise_pressure
```

Reset rule:

```text
NPC relationship state → reset
NPC previous-loop memory → reset
NPC personality / values → stable
```

Forbidden as normal NPC state:

```text
memory_residue
previous_loop_memory
```

---

# 6. Character Insight

Character Insight is no longer a system-certified cross-loop clue layer.

It is either:

- author-facing consistency metadata, or
- protagonist recollection grounded in actual Perception / Captured Memory

It cannot automatically mean:

```text
this NPC is lying
this evidence proves X
this is the correct question
```

If it affects gameplay, route it through explicit story conditions such as accepted Memory Input or current-loop interaction.

---

# 7. Memory persistence

Cross-loop persistent gameplay records:

```text
Captured Memory
Memory metadata
Investigation Wall layout / links / notes
Worldline History according to player-visible policy
```

Not automatically persistent:

```text
NPC relationship state
NPC prior-loop memories
world state
uncaptured full event details
system-generated truth conclusions
```

Perception chain:

```text
World Event
→ Attention
→ Perception
→ player chooses Capture
→ Persistent Memory
```

---

# 8. Player-facing Cards — superseded rule

The older rule:

> Cards represent important evidence/events/worldline changes only.

is superseded.

Current rule:

> **Any actually perceived Moment may be Captured if the player chooses.**

This includes potentially irrelevant information such as:

```text
「最近真的好冷。」
```

The system must not decide importance at capture time.

Therefore do not automatically award:

- Event Card
- Truth Card
- Invariant Card
- Important Clue

just because the authored story considers an event significant.

---

# 9. Memory Library + Investigation Wall

Player investigation layer:

```text
Memory Library
= what I chose to remember

Investigation Wall
= what I think may be related
```

Memory Library can provide neutral search/filter:

- Loop
- time
- character / scene
- Memory type

Investigation Wall supports:

- free positioning
- zoom / pan
- Memory references
- arbitrary links
- notes
- grouping

No automatic:

- contradiction detection
- causal classification
- truth score
- clue importance

Existing `EvidenceBoard` naming may temporarily remain as a compatibility alias, but semantics should migrate to Investigation Wall.

---

# 10. Player dialogue / presentation

Target Player presentation:

```text
Spatial Typography
+ Rhythmic Text
+ Text Echo
+ Attention Gameplay
+ Ambient Events
+ Memory Capture
```

Not:

```text
fixed Dialogue Box
+ 30ms/character typewriter
+ Continue button after every line
```

Dialogue remains live gameplay.

World Time continues while characters speak.

Repeated dialogue uses Attention Release, not Fast-forward.

---

# 11. Attention model

Canonical interaction:

```text
Main Action
    ↓
Peripheral Cue
    ↓
Hover → Notice / Single Focus
    ↓
Click → Attend
    ↓
Attention Shift (takes time)
    ↓
Observe
    ↓
Elastic Auto Return
```

If Focus changes during Observe:

```text
Attention Redirect
```

Only abandoning the Main Action is:

```text
True Interrupt
```

Rapid Hover scanning never pauses other events.

---

# 12. Waiting / idle gameplay

Waiting is not `Loading...` and not a countdown page.

During waiting:

- World Time continues
- Scene continues
- Ambient events continue
- Opportunity Windows may appear / expire
- Attention remains active
- player may Interrupt if the Action permits

ETA is shown only when genuinely knowable.

---

# 13. Real-time Anchored Timeline

Target model remains:

```text
Real Time
   ↓
Worldline Anchor
   ↓
Time Scale / Entry Mode
   ↓
Simulation / World Time
   ↓
Event Scheduler
```

Requirements:

- offline and online use the same event truth
- player joining at a different real-world hour must not corrupt authored story order
- loop entry strategy may differ between first loop / later loops
- time-scale changes must not create event jumps
- Worldline History can store real + world timestamps where useful

New integration requirement:

> Player reading / dialogue / Memory Capture must not create a hidden pause layer on top of this clock.

---

# 14. Reset

Reset must be atomic at runtime and ritualized in presentation.

```text
Convergence
→ settling
→ 23:59
→ 00:00
→ next loop
```

Reset must preserve protagonist-side memory semantics.

Do not use copy implying the protagonist gives away / loses Captured Memories unless future canon explicitly changes that mechanic.

---

# 15. Player Immersive UI

PR #19's current design should be treated as the Player presentation companion to Core Gameplay.

Implementation order:

```text
runtime invariant audit
→ Perception model
→ Spatial Text
→ Rhythmic Text / Text Echo
→ Attention Surface
→ Dialogue
→ Memory Capture
→ Investigation tools
→ Live Waiting
→ Reset
```

Old `TypewriterText`-first implementation order is superseded.

---

# 16. Story chapter migration rule

When chapter docs contain phrases such as:

```text
玩家得到 Event Card
Truth Card 更新
Invariant Card 解鎖
```

migrate them to:

```text
World Event occurs
→ protagonist may perceive it
→ player may Capture it
→ old and new Loop Memories coexist
→ player may compare them on Investigation Wall
```

New Worldline data does not overwrite old Captured Memory.

---

# 17. Chapter 2 / 3 migration

Chapter 2 now demonstrates:

```text
save 若晴
→ 柏勳 route changes
→ 柏勳 dies at 18:31
```

but the player is not automatically handed an `18:31 invariant` conclusion.

Chapter 3 now demonstrates:

```text
known characters survive 18:31
→ 23:59 bell still rings
→ 00:00 reset still happens
```

Old Event Cards from previous loops remain independent Memories rather than being overwritten by the new worldline.

---

# 18. Zhixia exception boundary

Story may establish:

```text
Zhixia = previous special memory holder
Seventh Letter = handoff mechanism
Protagonist = current memory holder
```

This is a story-specific mechanism.

Do not generalize it into:

```text
any NPC near anomaly
→ residue points
→ eventually remembers loops
```

---

# 19. Runtime / data migration priorities

After current design PRs are coherent, implementation work should prioritize:

### P0 — remove conflicting runtime assumptions

- foreground read pause
- decision pause if it freezes World Time
- generic NPC residue persistence
- auto clue / evidence grants that bypass Memory Capture

### P1 — Attention + Perception foundation

- Single Focus
- Peripheral Cue
- Attention Shift
- Elastic Attention
- Perception Boundary

### P2 — Memory gameplay

- Capture
- Library
- Wall
- Memory Input

### P3 — presentation

- Spatial Dialogue
- Rhythmic Text
- Text Echo
- live Waiting

### P4 — full story integration

- Chapter 1–Final runtime
- Real-time anchor
- offline reconciliation
- Worldline history

---

# 20. Verification baseline

Every implementation PR touching Player gameplay should test at minimum:

```text
World Time does not pause for reading
World Time does not pause for dialogue
World Time does not pause for Memory Capture
only one Attention Focus exists
faded events continue
missed events remain missed
unperceived events cannot become Memory
Captured Memory persists across Reset
NPC relationship / normal memory resets
repeated dialogue does not Fast-forward world
Investigation Wall does not auto-deduce
```

Then run repository gates:

```bash
npm test
npm run build
git diff --check
```

---

# 21. PR relationship

Current design hierarchy:

```text
Core Gameplay v0.1 (PR #20)
        ↓ canonical gameplay semantics
Player Immersive UI (PR #19)
        ↓ presentation / implementation contract
Main Story + DAG (PR #16)
        ↓ story content and author causality
Causal Timeline Workbench (PR #18)
        ↓ author/debug visualization
```

PR number does not indicate authority; current canonical design does.

---

# 22. Definition of Done

Project architecture is coherent when:

- [ ] no active spec claims normal NPC cross-loop residue
- [ ] no active Player spec freezes World Time during reading
- [ ] no active Player spec uses fixed typewriter speed as story clock
- [ ] no chapter automatically awards important clue cards
- [ ] Perception Boundary exists between Event Graph and Player Knowledge
- [ ] Memory Capture is the persistent player record path
- [ ] Investigation Wall stays player-authored
- [ ] Relationship State resets normally
- [ ] Author causal tools remain separate from Player deduction tools
- [ ] current Player UI design implements Single Focus / Elastic Attention
- [ ] tests enforce the canonical invariants

This roadmap is the project-level migration index. Older plans remain useful for implementation history, but they cannot override the current Core Gameplay rules.
