# Player Immersive UI v0.1 Implementation Plan

## Purpose

Implement the approved Player UI direction defined in:

- `docs/superpowers/specs/2026-09-28-player-immersive-ui-design.md`

The target is the current player surface at:

- `tools/event-graph-viewer/src/player/PlayerApp.tsx`

This plan changes the **presentation layer** only.

It does not redesign the simulation clock, reset rules, save format, causal runtime, Story YAML, or worldline truth.

---

# Architecture Boundary

Canonical dependency direction:

```text
Story / Runtime
      ↓
PlayerSave + LoopClock + Event State
      ↓
Presentation Projection
      ↓
Scene Components
      ↓
CSS / Motion / Atmosphere
```

The presentation layer may hide, stage, animate, or rephrase information already known to the player.

It must not invent:

- a worldline identifier the runtime cannot prove
- a countdown when completion time is unknown
- a result before the runtime resolves it
- character knowledge the player has not obtained
- a reset / next loop before the existing runtime authorizes it

---

# Existing Systems to Preserve

Do not rewrite these as part of this plan:

```text
tools/event-graph-viewer/src/player/clock.ts
tools/event-graph-viewer/src/player/runtime.ts
tools/event-graph-viewer/src/player/model.ts
tools/event-graph-viewer/src/player/knowledge.ts
tools/event-graph-viewer/src/player/eventScheduler.ts
tools/event-graph-viewer/src/player/storage.ts
tools/event-graph-viewer/src/player/narrativeRecords.ts
```

Existing tools also remain functional:

- 案卷
- 推理桌
- 世界線歷史
- 存檔匯入 / 匯出

`src/playerNarrative/` is an existing separate narrative surface.

This implementation must not silently merge the two runtimes or migrate persistence into `playerNarrative`.

Reusable visual ideas may be borrowed, but the authoritative target for this plan is `src/player/PlayerApp.tsx` and its current runtime.

---

# Branch / PR Strategy

PR #19 is documentation-only and must remain documentation-only.

Implementation should happen in a separate branch after this plan is accepted.

Recommended branch:

```text
feature/player-immersive-ui-v0.1
```

Recommended implementation PR:

```text
PR #19
Player Immersive UI design + plan
        ↓
feature/player-immersive-ui-v0.1
        ↓
Player Immersive UI implementation PR
```

If the implementation later requires an unmerged runtime branch, explicitly stack the implementation PR on that branch rather than copying runtime code into the UI PR.

---

# Verification Rules

Use TDD for each implementation task:

```text
RED
→ add the smallest failing test
→ confirm the expected failure

GREEN
→ add the smallest implementation
→ run the focused test

REGRESSION
→ run affected Player tests

COMMIT
→ commit one coherent behavior change
```

Project commands run from:

```text
tools/event-graph-viewer
```

Focused test pattern:

```bash
npm test -- tests/player/<test-file>
```

Player regression gate:

```bash
npm test -- tests/player
```

Final gates:

```bash
npm test
npm run build
git diff --check
```

---

# Task 1 — Add the Presentation Scene Model

## Goal

Create a deterministic boundary between runtime truth and visual scene rendering.

## Files

Create:

```text
tools/event-graph-viewer/src/player/presentation/model.ts
tools/event-graph-viewer/src/player/presentation/deriveScene.ts
tools/event-graph-viewer/tests/player/presentation.test.ts
```

## RED

Add tests proving the projection can represent these states without rendering React:

1. reset boundary → `reset`
2. unopened initial letter → `opening`
3. readable/current narrative content → a narrative/document presentation state
4. an authoritative in-progress activity → `idle`
5. missing worldline identifier stays absent
6. unknown ETA stays `unknown`; no numeric ETA is fabricated

The projection test must be pure and use explicit fixture input.

It must not require `localStorage`, DOM, timers, or `Date.now()`.

## Implementation

Define a discriminated union, for example:

```ts
export type PlayerScene =
  | OpeningSceneModel
  | DialogueSceneModel
  | DocumentSceneModel
  | IdleSceneModel
  | ResetSceneModel;
```

Common data should include only presentation-safe values:

```ts
export type SceneBase = {
  loop: number;
  time: string;
  worldline?: string;
  background?: SceneBackground;
};
```

`deriveScene()` receives a normalized input object produced by `PlayerApp`.

It must not import storage functions or mutate `PlayerSave`.

Do not force all current records into dialogue.

Document-like evidence and letters may remain a documentary reading presentation until story metadata proves a live character conversation.

## GREEN

Run:

```bash
npm test -- tests/player/presentation.test.ts
```

Then:

```bash
npm test -- tests/player/PlayerApp.test.tsx
```

Existing Player behavior must remain green because the new projection is not wired in yet.

## Commit

```text
feat(player-ui): add presentation scene projection
```

---

# Task 2 — Build Shared Scene Primitives

## Goal

Create the low-level presentation components used by every scene.

## Files

Create:

```text
tools/event-graph-viewer/src/player/ui/SceneFrame.tsx
tools/event-graph-viewer/src/player/ui/WorldlineHud.tsx
tools/event-graph-viewer/src/player/ui/AmbientPrompt.tsx
tools/event-graph-viewer/tests/player/scenePrimitives.test.tsx
```

Modify:

```text
tools/event-graph-viewer/src/player/player.css
```

## RED

Test:

- `WorldlineHud` renders Loop and Simulation Time
- worldline line is omitted when the value is absent
- `AmbientPrompt` uses a semantic interactive element when actionable
- prompt can be activated by keyboard through native button semantics
- decorative texture layers are hidden from accessibility APIs
- scene content remains readable without a background asset

Do not test exact pixel values in Vitest.

Test semantic classes / attributes and visible content only.

## Implementation

### `SceneFrame`

Responsibilities:

```text
background
→ atmospheric overlay
→ vignette
→ optional grain / mist
→ scene content
```

Do not add animation libraries.

Use CSS transitions / keyframes only in v0.1.

The component must support a no-image fallback so story development is not blocked by final art assets.

### `WorldlineHud`

Default hierarchy:

```text
LOOP 02                         14:22
WORLDLINE 02-B
```

Do not derive worldline labels inside the component.

### `AmbientPrompt`

Visual language:

```text
將記憶交還給世界
        ◇
```

The visible text may be minimal, but the hit area should be comfortably interactive.

## CSS

Start introducing explicit Player presentation sections:

```text
00 Tokens
10 Scene
20 Atmosphere
30 HUD
40 Narrative
50 Interaction
```

Keep existing drawer/document styles temporarily.

Do not refactor unrelated CSS in this task.

## GREEN

```bash
npm test -- tests/player/scenePrimitives.test.tsx
npm test -- tests/player/PlayerApp.test.tsx
```

## Commit

```text
feat(player-ui): add immersive scene primitives
```

---

# Task 3 — Add the Typewriter Narrative Primitive

## Goal

Make important narrative text feel performed rather than statically inserted.

## Files

Create:

```text
tools/event-graph-viewer/src/player/ui/TypewriterText.tsx
tools/event-graph-viewer/tests/player/typewriterText.test.tsx
```

Modify:

```text
tools/event-graph-viewer/src/player/player.css
```

## RED

Use fake timers to test:

- text begins partially revealed when motion is enabled
- advancing timers reveals the full string
- punctuation introduces additional delay relative to normal characters
- `onComplete` fires once
- completed text can show a cursor
- reduced-motion mode renders the complete text immediately

Do not couple the primitive to story state.

## Implementation

Suggested API:

```ts
type TypewriterTextProps = {
  text: string;
  speed?: number;
  punctuationDelay?: number;
  cursor?: boolean;
  reducedMotion?: boolean;
  onComplete?: () => void;
};
```

Default direction:

```text
normal character       20–40ms
short punctuation      +60–120ms
sentence punctuation   +120–240ms
cursor blink           ~700ms
```

Exact tuning is visual polish, not a gameplay rule.

Do not persist typewriter progress to PlayerSave.

Reloading may replay the presentation of the currently visible scene.

## GREEN

```bash
npm test -- tests/player/typewriterText.test.tsx
```

## Commit

```text
feat(player-ui): add typewriter narrative text
```

---

# Task 4 — Build ResetTransitionScene as an Isolated Cinematic

## Goal

Turn reset from an immediate mode-selection screen into an explicit narrative ritual.

## Files

Create:

```text
tools/event-graph-viewer/src/player/scenes/resetTransition.ts
tools/event-graph-viewer/src/player/scenes/ResetTransitionScene.tsx
tools/event-graph-viewer/tests/player/resetTransitionScene.test.tsx
```

Modify:

```text
tools/event-graph-viewer/src/player/player.css
```

## RED

Test the semantic phase order:

```text
settling
→ message
→ handoff
→ fade
→ midnight
→ complete
```

Required assertions:

- primary message appears before mode controls exist
- `世界接手了這一輪。` can be shown through `TypewriterText`
- handoff prompt does not itself mutate runtime
- `00:00` is shown only after handoff / fade progression
- completion callback fires once
- reduced motion shortens or removes visual delay while preserving semantic ordering

Use fake timers for deterministic tests.

## Implementation

Keep visual phase state local to this scene.

The scene may own presentation timers, but it must not import:

```text
createNextLoop
continuePendingBoundary
writeSave
```

It exposes only a callback such as:

```ts
onPresentationComplete(): void
```

Runtime transition remains the responsibility of `PlayerApp`.

Recommended initial copy:

```text
世界接手了這一輪。

將記憶交還給世界
```

At `midnight`, show:

```text
00:00
```

Do not invent `06:12` as the next screen inside this component unless the chosen runtime mode actually starts there.

## GREEN

```bash
npm test -- tests/player/resetTransitionScene.test.tsx
```

## Commit

```text
feat(player-ui): add reset transition cinematic
```

---

# Task 5 — Integrate the Reset Cinematic into PlayerApp

## Goal

Replace the current immediate reset mode menu with:

```text
runtime reset pending
→ ResetTransitionScene
→ presentation complete
→ existing mode choice
→ existing runtime transition
```

## Files

Modify:

```text
tools/event-graph-viewer/src/player/PlayerApp.tsx
tools/event-graph-viewer/src/player/player.css
tools/event-graph-viewer/tests/player/PlayerApp.test.tsx
```

Optionally add:

```text
tools/event-graph-viewer/tests/player/resetIntegration.test.tsx
```

if the existing `PlayerApp.test.tsx` becomes too large.

## RED

Add integration coverage for:

1. `pendingCriticalBoundary === 'reset'` initially shows the cinematic message
2. `LIVE_SYNC` / `ACCELERATED` choices are not immediately visible
3. after presentation completion the mode choices appear
4. choosing a mode still calls the existing runtime path
5. next loop is created only once
6. reloading while reset is still pending does not advance the runtime automatically

The test must preserve current Live Sync availability rules.

## Implementation

Add local presentation state, for example:

```text
resetPresentationComplete = false
```

When the current runtime is no longer reset-pending, clear that local state.

After cinematic completion render the existing mode-selection behavior, visually restyled but semantically unchanged.

Keep the current runtime sequence:

```text
continuePendingBoundary(...)
→ createNextLoop(...)
→ commit(...)
→ refresh(...)
```

Do not move this sequence into `ResetTransitionScene`.

Prevent accidental double activation while a mode action is being committed.

## GREEN

```bash
npm test -- tests/player/PlayerApp.test.tsx
npm test -- tests/player/anchoredTimelineAcceptance.test.ts
npm test -- tests/player/runtime.test.ts
```

## Commit

```text
feat(player-ui): integrate cinematic reset flow
```

---

# Task 6 — Migrate Live Dialogue / Narrative Presentation

## Goal

Introduce scene-based character dialogue without incorrectly converting evidence documents into conversations.

## Files

Create:

```text
tools/event-graph-viewer/src/player/scenes/DialogueScene.tsx
tools/event-graph-viewer/tests/player/dialogueScene.test.tsx
```

Modify:

```text
tools/event-graph-viewer/src/player/presentation/model.ts
tools/event-graph-viewer/src/player/presentation/deriveScene.ts
tools/event-graph-viewer/src/player/PlayerApp.tsx
tools/event-graph-viewer/src/player/player.css
tools/event-graph-viewer/tests/player/presentation.test.ts
tools/event-graph-viewer/tests/player/PlayerApp.test.tsx
```

## RED

Test:

- speaker + dialogue content are rendered as a scene
- narrative text uses typewriter presentation
- advancing is available only after the scene permits it
- decisions use semantic `<button>` elements but do not look like rectangular web CTAs
- existing action handlers still receive the same `ActionId`
- document / evidence records remain document-like when their metadata does not prove live dialogue

## Implementation

Suggested component boundary:

```tsx
<DialogueScene
  speaker={...}
  text={...}
  choices={...}
  onAdvance={...}
  onChoose={...}
/>
```

Do not pass the entire `PlayerSave` into the component.

Project only what it needs.

Decision copy should read as player intention, for example:

```text
「今晚，我陪你留下來。」

「予安，幫我去醫院。」
```

The action ID remains the canonical machine value underneath.

## GREEN

```bash
npm test -- tests/player/dialogueScene.test.tsx
npm test -- tests/player/presentation.test.ts
npm test -- tests/player/PlayerApp.test.tsx
```

## Commit

```text
feat(player-ui): add immersive dialogue scenes
```

---

# Task 7 — Add IdleProgressScene Using Authoritative Waiting Data

## Goal

Make waiting visible as gameplay without creating a second timing system.

## Files

Create:

```text
tools/event-graph-viewer/src/player/scenes/IdleProgressScene.tsx
tools/event-graph-viewer/tests/player/idleProgressScene.test.tsx
```

Modify as needed:

```text
tools/event-graph-viewer/src/player/presentation/model.ts
tools/event-graph-viewer/src/player/presentation/deriveScene.ts
tools/event-graph-viewer/src/player/PlayerApp.tsx
tools/event-graph-viewer/src/player/player.css
tools/event-graph-viewer/tests/player/presentation.test.ts
```

## Mandatory pre-implementation check

Before writing the adapter, identify which existing runtime source is authoritative for the waiting state being surfaced.

Potential existing sources include:

- Player event scheduler
- action-duration/activity state already projected elsewhere
- narrative runtime activity state

Do not add a second countdown clock to PlayerSave merely for UI display.

If the current runtime cannot prove an ETA, project `unknown`.

## RED

Test all ETA forms:

### Exact

```text
預計完成時間：14:27
```

### Approximate

```text
大約還需要 5 分鐘
```

### Unknown

```text
庭安還沒有回來。
...... ▌
```

Assertions:

- unknown ETA never contains a fabricated number
- `canIntervene=false` does not expose an action control
- actor/activity copy is visible when known
- the scene does not mutate scheduler state

## Implementation

Suggested model:

```ts
type IdleSceneModel = SceneBase & {
  kind: 'idle';
  actor?: string;
  activity: string;
  canIntervene: boolean;
  eta:
    | { kind: 'exact'; expectedAt: string }
    | { kind: 'approximate'; minutes: number }
    | { kind: 'unknown' };
};
```

The scene should remain meaningful even when only `activity` is available.

## GREEN

```bash
npm test -- tests/player/idleProgressScene.test.tsx
npm test -- tests/player/eventScheduler.test.ts
npm test -- tests/player/anchoredTimelineAcceptance.test.ts
```

## Commit

```text
feat(player-ui): present waiting as an idle scene
```

---

# Task 8 — Migrate Opening and Demote Secondary Navigation

## Goal

Make the first impression feel like entering a game scene while preserving access to all current tools.

## Files

Create:

```text
tools/event-graph-viewer/src/player/scenes/OpeningScene.tsx
tools/event-graph-viewer/tests/player/openingScene.test.tsx
```

Modify:

```text
tools/event-graph-viewer/src/player/PlayerApp.tsx
tools/event-graph-viewer/src/player/player.css
tools/event-graph-viewer/tests/player/PlayerApp.test.tsx
```

Potential style-only changes:

```text
tools/event-graph-viewer/src/player/EvidenceBoard.tsx
tools/event-graph-viewer/src/player/WorldlineNotebook.tsx
```

Only touch those files if required for accessible integration.

Do not change their internal gameplay logic.

## RED

Opening tests:

- first-loop opening remains tied to the canonical opening state
- the letter remains an explicit interactive object
- opening does not become a generic `Continue` page

Navigation tests:

- 案卷 remains reachable
- 推理桌 remains reachable
- 世界線 remains reachable
- 存檔 remains reachable
- Escape closes drawers
- focus returns to the opener after closing a drawer

## Implementation

Replace the dominant website-style header with a minimal HUD plus a secondary tool affordance.

Target hierarchy:

```text
Scene
├─ minimal WorldlineHud
├─ current narrative interaction
└─ corner / secondary tools
   ├─ 案卷
   ├─ 推理桌
   ├─ 世界線
   └─ 存檔
```

Keep tool labels explicit enough for accessibility and first-time discovery.

Do not hide core tools behind hover-only interaction.

## GREEN

```bash
npm test -- tests/player/openingScene.test.tsx
npm test -- tests/player/PlayerApp.test.tsx
npm test -- tests/player/board.test.tsx
npm test -- tests/player/worldlines.test.tsx
```

## Commit

```text
feat(player-ui): migrate opening and secondary tools
```

---

# Task 9 — Add Immersive UI Acceptance Coverage

## Goal

Test the complete presentation flow rather than only isolated components.

## Files

Create:

```text
tools/event-graph-viewer/tests/player/immersiveUiAcceptance.test.tsx
```

Modify only if a regression is found:

```text
tools/event-graph-viewer/src/player/**
```

## RED

Write acceptance scenarios for:

### Scenario A — Opening

```text
enter first loop
→ see scene-based opening
→ interact with letter
→ reach readable narrative
```

### Scenario B — Choice

```text
read relevant message
→ choose one existing action
→ action is recorded by existing runtime
→ scene reflects reply / consequence
```

### Scenario C — Waiting

```text
runtime exposes in-progress activity
→ idle scene appears
→ known ETA is shown only when authoritative
```

### Scenario D — Reset

```text
reset boundary
→ cinematic first
→ 00:00
→ mode choice second
→ choose next-loop mode
→ one next loop is created
```

### Scenario E — Reload During Reset

```text
reset boundary
→ reload
→ cinematic may replay
→ runtime still pending
→ no automatic duplicate loop
```

### Scenario F — Reduced Motion

```text
prefers reduced motion
→ complete information appears without long animation
→ no gameplay content is skipped
```

### Scenario G — Keyboard

```text
Tab / Enter / Space
→ narrative interactions usable
→ secondary tools usable
→ drawer close / focus restore remains correct
```

## GREEN

```bash
npm test -- tests/player/immersiveUiAcceptance.test.tsx
npm test -- tests/player
```

## Commit

```text
test(player-ui): add immersive UI acceptance coverage
```

---

# Task 10 — Final Regression, Build, and Visual Review

## Goal

Verify presentation changes did not alter story truth or runtime behavior.

## Automated verification

Run from `tools/event-graph-viewer`:

```bash
npm test -- tests/player
npm test
npm run build
git diff --check
```

Expected:

- all Player tests pass
- all repository tests pass
- TypeScript passes through build script
- Vite production build passes
- no whitespace errors

## Runtime invariant review

Confirm the implementation does not change the semantics of:

```text
clock.ts
runtime.ts
model.ts
knowledge.ts
eventScheduler.ts
storage.ts
```

If any of these require code changes, stop and determine whether the work has expanded beyond a presentation-only PR.

Do not quietly broaden scope.

## Manual visual review

Review at least:

```text
Opening
Dialogue / reading
Decision
Idle / waiting
Reset cinematic
Mode choice after reset
Secondary drawer
```

Check a desktop game-oriented viewport first, then a narrower viewport for basic usability.

Visual acceptance questions:

1. Does the main stage read as a scene rather than a webpage?
2. Does the HUD stay secondary to the narrative?
3. Are rectangular web CTA patterns removed from primary gameplay interaction?
4. Does the Reset sequence feel continuous rather than like route navigation?
5. Does waiting communicate that the world is still progressing?
6. Is text still readable over every fallback/background state?
7. Does reduced-motion mode remain fully usable?

## Final implementation PR policy

- Keep implementation PR Draft until visual review passes.
- Do not auto-merge.
- Do not mark Ready for Review without explicit human approval.
- Do not include unrelated Story DAG / Viewer refactors.

## Commit

Only create a final cleanup commit if changes are actually needed:

```text
chore(player-ui): finish immersive UI verification
```

Avoid empty verification commits.

---

# Planned File Map

Expected new files:

```text
tools/event-graph-viewer/src/player/presentation/model.ts
tools/event-graph-viewer/src/player/presentation/deriveScene.ts

tools/event-graph-viewer/src/player/ui/SceneFrame.tsx
tools/event-graph-viewer/src/player/ui/WorldlineHud.tsx
tools/event-graph-viewer/src/player/ui/TypewriterText.tsx
tools/event-graph-viewer/src/player/ui/AmbientPrompt.tsx

tools/event-graph-viewer/src/player/scenes/OpeningScene.tsx
tools/event-graph-viewer/src/player/scenes/DialogueScene.tsx
tools/event-graph-viewer/src/player/scenes/IdleProgressScene.tsx
tools/event-graph-viewer/src/player/scenes/ResetTransitionScene.tsx
tools/event-graph-viewer/src/player/scenes/resetTransition.ts

tools/event-graph-viewer/tests/player/presentation.test.ts
tools/event-graph-viewer/tests/player/scenePrimitives.test.tsx
tools/event-graph-viewer/tests/player/typewriterText.test.tsx
tools/event-graph-viewer/tests/player/resetTransitionScene.test.tsx
tools/event-graph-viewer/tests/player/dialogueScene.test.tsx
tools/event-graph-viewer/tests/player/idleProgressScene.test.tsx
tools/event-graph-viewer/tests/player/openingScene.test.tsx
tools/event-graph-viewer/tests/player/immersiveUiAcceptance.test.tsx
```

Expected main modified files:

```text
tools/event-graph-viewer/src/player/PlayerApp.tsx
tools/event-graph-viewer/src/player/player.css
tools/event-graph-viewer/tests/player/PlayerApp.test.tsx
```

Runtime files should remain unchanged unless an implementation blocker proves that the design boundary is incomplete.

---

# Execution Order

```text
1. Presentation model
        ↓
2. Scene primitives
        ↓
3. Typewriter text
        ↓
4. Reset cinematic component
        ↓
5. Reset integration
        ↓
6. Dialogue migration
        ↓
7. Idle / waiting migration
        ↓
8. Opening + secondary navigation
        ↓
9. Acceptance tests
        ↓
10. Full regression + visual review
```

The first visible milestone is Task 5.

At that point the current `世界接手了這一輪` screen should already demonstrate the intended visual language before the rest of the Player surface is migrated.

---

# Done Definition

Player Immersive UI v0.1 is complete only when:

```text
Scene-first layout exists
+
Reset cinematic is integrated
+
Dialogue can use narrative presentation
+
Waiting has exact / approximate / unknown states
+
Opening is scene-driven
+
Secondary tools remain accessible
+
Runtime truth is unchanged
+
Reduced motion works
+
Keyboard interaction works
+
Player tests pass
+
Full tests pass
+
Production build passes
+
Human visual review approves the direction
```

This plan intentionally treats final illustration assets, audio design, Three.js effects, and large-scale art production as later work.

The v0.1 goal is to establish the **game presentation architecture and interaction language** first.