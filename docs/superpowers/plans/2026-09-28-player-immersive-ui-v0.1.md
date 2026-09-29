# Player Immersive UI v0.2 Implementation Plan

## Purpose

Implement the Player-facing presentation defined in:

- `docs/core-gameplay-spec-v0.1.md` — canonical gameplay semantics
- `docs/superpowers/specs/2026-09-28-player-immersive-ui-design.md` — Player presentation projection

This plan supersedes the earlier fixed-Typewriter / generic-AmbientPrompt plan wherever it overlaps with current gameplay.

The most important migration rule is:

> **Reading, dialogue, Hover, Capture and Choice must not freeze World Time.**

---

# Architecture boundary

```text
Story / Runtime Truth
        ↓
Clock + Event Scheduler + World State
        ↓
Perception Projection
        ↓
Scene Presentation
        ↓
Player Attention Input
```

Presentation can change visibility and emphasis, but cannot change truth.

Do not fabricate:

- worldline identity
- event result
- ETA
- perceived information
- clue importance
- contradiction / causality
- NPC cross-loop memory

---

# Runtime audit before implementation

Before UI work, inspect current Player Runtime for assumptions that violate the new canonical rules.

Specifically search for:

```text
pause story time while reading
pause story time while decision open
complete/skip narrative by advancing simulation
knowledge auto-added when event fires
Evidence Card auto-grant
NPC memory residue across reset
```

If found, do not preserve them just because they already exist.

Document migration needed from old behavior to current Core Gameplay semantics.

---

# Task 1 — Presentation and perception model

Create / adapt:

```text
src/player/presentation/model.ts
src/player/presentation/deriveScene.ts
```

Model must represent separately:

```ts
MainAction
PeripheralCue
AttentionTarget
PerceivedMoment
DialoguePhrase
Choice
MemoryCaptureCandidate
```

Important distinctions:

```text
World Event ≠ Peripheral Cue ≠ Perceived Moment ≠ Memory
```

Tests:

- unperceived event does not appear as player knowledge
- partial perception stays partial
- one Main Action can coexist with many world events
- one Focus only
- projection does not pause runtime

---

# Task 2 — SceneFrame + SpatialTextLayer

Create / adapt:

```text
src/player/world/SceneFrame.tsx
src/player/world/SpatialTextLayer.tsx
```

Responsibilities:

- scene background / character position
- spatial text coordinates
- speaker movement / Blocking
- ambient text placement
- foreground / faded presentation

Do not implement a bottom fixed dialogue log as the default language.

Tests:

- text position follows source position
- multiple world sources can exist simultaneously
- only Focus target is foregrounded
- hidden / faded source still progresses in model state

---

# Task 3 — RhythmicText + TextEcho

Replace the old fixed-character `TypewriterText` concept.

Create:

```text
src/player/world/RhythmicText.tsx
src/player/world/TextEcho.tsx
```

Rhythmic input should be authored as Phrase / Beat / Pause, for example:

```ts
[
  { type: 'phrase', text: '你……' },
  { type: 'pause', durationMs: 700 },
  { type: 'phrase', text: '你怎麼會知道這件事？' }
]
```

Exact schema can change, but fixed `30ms / char` must not be the canonical story clock.

Tests:

- Phrase order
- authored Pause
- Text Echo appears after completion
- Echo fades without becoming Chat History
- Reduced Motion simplifies animation but does not change World Time
- no Fast-forward of NPC speech

---

# Task 4 — AttentionSurface

Create:

```text
src/player/world/AttentionSurface.tsx
```

Canonical input:

```text
Hover → Notice / Focus
Click → Attend
Attention Shift → Observe
Observation complete → Elastic Auto Return
Click another target while observing → Attention Redirect
leave / chase / switch action → True Interrupt
```

Tests:

1. only one Focus exists
2. Hover target becomes clearer
3. prior content fades
4. faded content continues
5. Click begins Attention Shift
6. shift is not zero-time
7. Observation auto-returns
8. Redirect does not replace Main Action
9. True Interrupt does
10. rapid scanning cannot freeze all events

---

# Task 5 — Dialogue as continuous gameplay

Create / adapt:

```text
src/player/scenes/DialogueScene.tsx
```

Dialogue Scene must combine:

```text
Spatial dialogue
+ Ambient events
+ Peripheral cues
+ AttentionSurface
+ TextEcho
+ Choice
+ Memory Input
+ Memory Capture
```

Do not require `Continue` after every line.

Ordinary protagonist replies may flow automatically.

Explicit Choice appears only for meaningful intent / risk / relationship / worldline decisions.

Tests:

- dialogue does not pause clock
- ambient event can expire during dialogue
- Focus change can make player miss a line
- returning Focus does not replay missed line
- Choice and Memory Input are separate

---

# Task 6 — Memory Capture

Create:

```text
src/player/world/MemoryCaptureTarget.tsx
```

Integrate with Text Echo, Visual and Sound moments.

Canonical behavior:

```text
Perception
  ↓
player Hold / capture input
  ↓
Capture becomes current Focus
  ↓
other perception fades but continues
  ↓
Memory persisted
```

No auto award based on importance.

Tests:

- Text / Visual / Sound / Composite types
- cannot Capture unperceived event
- Memory preserves original fidelity
- Capture consumes Attention
- Capture does not pause world
- arbitrary low-value perceived content can be captured
- captured Memory persists through Loop reset

---

# Task 7 — Memory Library + Investigation Wall compatibility

Existing Evidence Board functionality should migrate semantically toward:

```text
Memory Library
Investigation Wall
```

Compatibility labels may remain temporarily if changing route names would cause unnecessary churn.

Required Investigation Wall semantics:

- reference Captured Memory
- free placement
- pan / zoom
- free line
- free note
- grouping
- no auto semantic edge type
- no contradiction badge
- no importance rank

Tests:

- deleting wall reference does not delete Memory
- links contain player-authored meaning only
- system does not auto-link memories

---

# Task 8 — Live World / Waiting Scene

Replace the conceptual `IdleProgressScene` as a progress page with a live world scene.

Possible component:

```text
src/player/scenes/LiveWorldScene.tsx
```

It can display runtime-known activity and ETA, but ETA is supplementary.

During waiting:

- World Time continues
- Ambient Narrative continues
- Opportunity Windows may open / close
- Attention still works
- player can True Interrupt if action rules allow

Tests:

- no fabricated ETA
- unknown remains unknown
- waiting is not loading state
- events still occur during waiting

---

# Task 9 — Attention Release for repeated dialogue

Do not implement traditional Fast-forward.

When dialogue is already known:

```text
known content → lower visual dominance
World Time → unchanged
Single Focus → unchanged
ambient authored set → unchanged
```

Tests:

- known line still consumes same world duration
- Attention Release does not auto-focus another cue
- no extra randomized clues generated by repeated visits

---

# Task 10 — Opening scene

Create / adapt:

```text
src/player/scenes/OpeningScene.tsx
```

Use direct scene affordances, not generic next-page controls.

Example:

```text
返鄉列車
雨
信封
林知夏　寄

→ interact with the letter itself
```

Opening must obey the same World Time and Attention rules once live gameplay begins.

---

# Task 11 — Reset cinematic

Keep Reset as ritual:

```text
Convergence
→ settling
→ 23:59
→ bell / fade
→ 00:00
→ next loop
```

Do not use copy implying Captured Memory is discarded.

After reset:

```text
Captured Memory persists
Investigation Wall persists
NPC relationship state resets
NPC normal memory resets
world state resets according to loop runtime
```

If `LIVE_SYNC / ACCELERATED` remains supported, show entry mode after cinematic boundary.

Tests:

- reset presentation does not duplicate next loop
- captured Memory survives
- normal NPC relationship state resets
- reset sequence cannot erase protagonist knowledge

---

# Task 12 — Minimal HUD + secondary tools

Keep Loop / Worldline / World Time low priority.

Secondary tools:

```text
Memory Library
Investigation Wall
Worldline History
Save / Settings
```

No:

- Attention meter
- clue counter
- quest checklist
- contradiction count
- Focus points

---

# Task 13 — Accessibility input mapping

Keyboard / controller must provide equivalents for:

```text
move Focus among currently perceivable targets
Attend
Capture
Choice
True Interrupt when applicable
open / close secondary tools
```

Accessibility must not flatten simultaneous world events into a single fully-readable list, because that would break Perception Boundary.

Reduced Motion cannot pause or fast-forward World Time.

---

# Task 14 — Acceptance scenarios

## A — Single Focus

```text
NPC speaks
+ door cue appears
+ window event occurs
→ Hover door
→ NPC / window fade
→ all events continue
```

## B — Too late

```text
cue appears
→ player Clicks late
→ Attention Shift takes time
→ only sees door closing
```

## C — Elastic Attention

```text
Main Action: dialogue
→ observe door
→ observation ends
→ automatically return to dialogue
```

## D — Redirect

```text
observe door
→ click nurse before observation ends
→ partial door perception only
→ Focus nurse
```

## E — Memory Capture cost

```text
Capture previous Text Echo
→ next line continues
→ player may miss it
```

## F — Loop knowledge

```text
Capture event in Loop 01
→ Reset
→ Memory exists in Loop 02
→ NPC does not remember Loop 01 relationship
```

## G — Repeated dialogue

```text
known dialogue
→ Attention Release
→ no world acceleration
→ player can focus finite concurrent event
```

---

# Verification gates

Run from `tools/event-graph-viewer`:

```bash
npm test -- tests/player
npm test
npm run build
git diff --check
```

Additionally verify through tests or runtime inspection:

```text
no foreground-reading clock freeze
no dialogue clock freeze
no capture clock freeze
no fixed typewriter timing changing simulation
no NPC memory residue persistence
no auto clue award
```

---

# Planned implementation order

```text
1. runtime invariant audit
2. perception / presentation model
3. SceneFrame + SpatialTextLayer
4. RhythmicText + TextEcho
5. AttentionSurface
6. Dialogue continuous gameplay
7. Memory Capture
8. Memory Library / Investigation Wall migration
9. Live waiting scene
10. Attention Release
11. Opening
12. Reset
13. HUD / secondary tools
14. accessibility
15. acceptance + regression
```

Do not implement old `TypewriterText` first and plan to fix it later; that would encode the wrong gameplay timing model into the foundation.

---

# Done definition

This implementation is complete only when:

```text
Scene-first presentation
+
World Never Waits preserved
+
Single Focus enforced
+
Attention Shift consumes real time
+
Elastic Attention works
+
Spatial / Rhythmic dialogue works
+
Text Echo works
+
Memory Capture works
+
Perception Boundary enforced
+
Waiting remains live gameplay
+
Attention Release replaces Fast-forward
+
Investigation remains player-authored
+
Loop persistence matches Core Gameplay v0.1
+
Accessibility preserves gameplay semantics
+
Tests + build green
```
