# M8 Story Integration and M9 Game Feel Player UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the latest scene-first Player UI, carry it through the authored Loop 01 → Final story bundle, and finish with verifiable Game Feel presentation without changing Core Gameplay semantics.

**Architecture:** Keep `PlayerApp` at `/player.html` as the only canonical player entry. Add pure player-safe presentation projections and focused scene-stage components under `src/player/presentation` and `src/player/ui`; the runtime continues to own time, perception, capture, persistence, and worldline consequences. Use DOM/CSS atmosphere and optional audio preferences so Game Feel remains disposable and does not add a rendering or simulation dependency.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, existing CSS scene system, YAML story manifests.

**Spec:** `docs/superpowers/specs/2026-09-30-m8-m9-player-ui-design.md`

## Global Constraints

- `docs/core-gameplay-spec-v0.1.md` is the canonical gameplay authority.
- `PlayerApp` at `/player.html` is the canonical player entry point.
- Author causal truth must never enter Player UI as automatic knowledge, clue importance, or causal inference.
- World Time never pauses for reading, attention, capture, transition, or Game Feel animation.
- Only actually perceived information can be captured; ordinary NPC state resets across loops.
- No new Three.js dependency, generic NPC residue, Dialogue Box, Action List, or notification-feed UI.
- Every production change follows a failing-test-first cycle and is committed before the next task.
- The repository’s actual primary branch is `main`; direct pushes are allowed by the user and no PR is created.

## Review Focus

- A loop document with no matching worldline history must not leak a scene into Player UI; test through `projectPlayerNarrativeRecords`.
- A missed presence opportunity must remain absent after the loop boundary; test that no presentation layer invents a Memory.
- Reduced motion must remove nonessential visual movement without hiding state or changing time; test rendered attributes and runtime values separately.
- Audio preference changes must not alter the runtime projection; test preference toggling without mocks of simulation behavior.
- Keyboard/touch-equivalent controls must reach the same semantic callback as pointer controls; test the accessible button path.

---

### Task 1: Player-safe presentation projection and loop integration contract

**Files:**
- Create: `tools/event-graph-viewer/src/player/presentation/types.ts`
- Create: `tools/event-graph-viewer/src/player/presentation/projectPlayerPresentation.ts`
- Create: `tools/event-graph-viewer/tests/player/playerPresentation.test.ts`
- Create: `tools/event-graph-viewer/tests/integration/m8StoryIntegration.test.ts`

**Interfaces:**
- Consumes: `PlayerSave`, current loop record projection, `PlayerStoryBundle`, `displayMinute`, and the existing `projectPlayerNarrativeRecords` result.
- Produces: `PlayerPresentationModel`, `projectPlayerPresentation(input)`, and `projectLoopIntegration(bundle, save, history, minute)`; output contains only player-visible scene/ambient/attention/capture/reset data.

- [ ] **Step 1: Write the failing tests**

  Add tests that prove:

  - all narrative documents from Loop 01 through Final load with unique scene IDs;
  - Loop 02/03/04/05/06/07/Final projections contain only scenes from their own authored document and matching history;
  - a missed opportunity produces no visible record and no captured memory candidate;
  - loop integration preserves captured memory IDs and wall state while declaring NPC reset;
  - the presentation model has no `storyDags`, hidden conditions, or author relationship fields.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run: `npm test -- tests/player/playerPresentation.test.ts tests/integration/m8StoryIntegration.test.ts`

  Expected: FAIL because the presentation types/projection and loop integration contract do not exist.

- [ ] **Step 3: Implement the minimal pure projections**

  Define the exact player-safe types and implement pure functions. Derive current loop identity, display time, attention phase, capture state, scene candidates, and reset phase from existing runtime values. Do not copy or expose author DAG/path data.

- [ ] **Step 4: Run the focused tests and verify GREEN**

  Run: `npm test -- tests/player/playerPresentation.test.ts tests/integration/m8StoryIntegration.test.ts`

  Expected: all focused tests pass.

- [ ] **Step 5: Run the full suite**

  Run: `npm test`

  Expected: the complete suite passes with no regressions.

- [ ] **Step 6: Commit and push the task**

  Commit: `feat: add player-safe loop presentation projection`

  Push the commit to `origin/main` only after fast-forwarding the task branch into the primary branch as described in the execution ledger.

### Task 2: Scene-first Player UI shell

**Files:**
- Create: `tools/event-graph-viewer/src/player/ui/PlayerSceneStage.tsx`
- Create: `tools/event-graph-viewer/src/player/ui/PlayerPresentationHud.tsx`
- Create: `tools/event-graph-viewer/src/player/ui/PlayerAmbientLayer.tsx`
- Create: `tools/event-graph-viewer/src/player/ui/playerSceneStage.css`
- Modify: `tools/event-graph-viewer/src/player/PlayerApp.tsx`
- Modify: `tools/event-graph-viewer/src/player/player.css`
- Test: `tools/event-graph-viewer/tests/player/playerPresentationUi.test.tsx`

**Interfaces:**
- Consumes: `PlayerPresentationModel` and semantic callbacks from Task 1.
- Produces: accessible `PlayerSceneStage` with quiet HUD, ambient layer, main scene slot, and `data-presentation-mode` for visual verification.

- [ ] **Step 1: Write the failing UI tests**

  Test that the stage renders location/time context, scene content, ambient cues, attention state, capture state, and reset state from the projection. Assert that Author-only fields are not rendered and that the scene stage exposes a stable accessible label.

- [ ] **Step 2: Run the focused UI tests and verify RED**

  Run: `npm test -- tests/player/playerPresentationUi.test.tsx`

  Expected: FAIL because the new stage components do not exist.

- [ ] **Step 3: Implement the shell and integrate it into `PlayerApp`**

  Move only presentation composition into `PlayerSceneStage`; keep `commit`, `attend`, `capture`, `chooseMode`, and loop state transitions in `PlayerApp`. Preserve document-like artifact/message surfaces where the Core Gameplay spec allows them. Add semantic buttons for all pointer-only actions.

- [ ] **Step 4: Run the focused UI tests and verify GREEN**

  Run: `npm test -- tests/player/playerPresentationUi.test.tsx`

  Expected: all focused UI tests pass.

- [ ] **Step 5: Run the full suite and build**

  Run: `npm test && npm run build`

  Expected: all tests pass and TypeScript/Vite production build exits 0.

- [ ] **Step 6: Commit and push the task**

  Commit: `feat: build scene-first player ui shell`

  Fast-forward `main`, push `origin/main`, and keep the working tree clean before starting Task 3.

### Task 3: Game Feel atmosphere, transitions, and waiting states

**Files:**
- Create: `tools/event-graph-viewer/src/player/ui/SceneAtmosphere.tsx`
- Create: `tools/event-graph-viewer/src/player/ui/LoopTransitionLayer.tsx`
- Create: `tools/event-graph-viewer/src/player/ui/PresentationPreferences.ts`
- Modify: `tools/event-graph-viewer/src/player/ui/PlayerSceneStage.tsx`
- Modify: `tools/event-graph-viewer/src/player/ui/playerSceneStage.css`
- Modify: `tools/event-graph-viewer/src/player/player.css`
- Test: `tools/event-graph-viewer/tests/player/gameFeelPresentation.test.tsx`

**Interfaces:**
- Consumes: Task 1’s presentation model and Task 2’s stage mode attributes.
- Produces: pixel-inspired DOM/CSS atmosphere, low-frequency motion, parallax variables, scene/reset fade states, ambient waiting state, and reduced-motion preference projection.

- [ ] **Step 1: Write the failing tests**

  Test that atmosphere classes/data attributes select normal, attention, capture, waiting, and reset modes; reduced motion removes nonessential animation flags; transition state does not change projected simulation time or memory IDs.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run: `npm test -- tests/player/gameFeelPresentation.test.tsx`

  Expected: FAIL because the atmosphere, transition, and preference modules do not exist.

- [ ] **Step 3: Implement presentation-only atmosphere and transitions**

  Use CSS custom properties and deterministic scene metadata for pixel-like layers, haze, grain, parallax, and fade. Never call runtime mutations from animation callbacks. In reduced-motion mode render the same semantic stage with static layers and immediate visual transitions.

- [ ] **Step 4: Run the focused tests and verify GREEN**

  Run: `npm test -- tests/player/gameFeelPresentation.test.tsx`

  Expected: all focused Game Feel tests pass.

- [ ] **Step 5: Run the full suite and build**

  Run: `npm test && npm run build`

  Expected: complete suite and production build pass.

- [ ] **Step 6: Commit and push the task**

  Commit: `feat: add player atmosphere and game feel transitions`

  Fast-forward `main`, push `origin/main`, and keep the working tree clean.

### Task 4: Audio preference and device input parity

**Files:**
- Create: `tools/event-graph-viewer/src/player/ui/audioPreferences.ts`
- Create: `tools/event-graph-viewer/src/player/ui/InputParity.tsx`
- Modify: `tools/event-graph-viewer/src/player/ui/PlayerSceneStage.tsx`
- Modify: `tools/event-graph-viewer/src/player/player.css`
- Test: `tools/event-graph-viewer/tests/player/inputParity.test.tsx`
- Test: `tools/event-graph-viewer/tests/player/audioPreferences.test.ts`

**Interfaces:**
- Consumes: Task 1 semantic callbacks and Task 3 presentation preferences.
- Produces: optional user-controlled audio cue preference and equivalent keyboard/touch/controller-accessible actions for Advance, Attend, Capture, Release, and mode selection.

- [ ] **Step 1: Write the failing tests**

  Test that audio preference changes only presentation preference state, and that keyboard/controller keys activate the same labelled buttons as pointer interaction. Include reduced-motion behavior and focus restoration.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run: `npm test -- tests/player/inputParity.test.tsx tests/player/audioPreferences.test.ts`

  Expected: FAIL because the preference/input helpers do not exist.

- [ ] **Step 3: Implement the minimal preference and input layer**

  Persist only presentation preferences. Do not create a production audio asset pipeline yet; expose optional cue metadata and a muted-safe preference path. Use semantic buttons and key handlers rather than duplicating runtime actions.

- [ ] **Step 4: Run the focused tests and verify GREEN**

  Run: `npm test -- tests/player/inputParity.test.tsx tests/player/audioPreferences.test.ts`

  Expected: all focused tests pass.

- [ ] **Step 5: Run the full suite and build**

  Run: `npm test && npm run build`

  Expected: complete suite and production build pass.

- [ ] **Step 6: Commit and push the task**

  Commit: `feat: align player input and presentation preferences`

  Fast-forward `main`, push `origin/main`, and keep the working tree clean.

### Task 5: Browser verification and final branch unification

**Files:**
- Modify: `ROADMAP.md` (status ledger only, if the implementation status is now accurate)
- Modify: `docs/superpowers/specs/2026-09-30-m8-m9-player-ui-design.md` (verification notes only, if needed)
- Test: existing full suite and production build

**Interfaces:**
- Consumes: all completed M8/M9 tasks.
- Produces: one final `main` version with verified `/player.html` UI and no open PR.

- [ ] **Step 1: Run the complete verification set**

  Run: `npm test`, `npm run build`, `git diff --check`.

  Expected: 0 test failures, build exit 0, and no whitespace errors.

- [ ] **Step 2: Start/reload the local player page and verify visually**

  Verify `/player.html` at entry, active scene, ambient/waiting, attention, capture, and reset states. Verify a reduced-motion browser preference path if available.

- [ ] **Step 3: Record only evidence-backed roadmap status**

  Update status notes without changing gameplay rules or claiming unverified story completion.

- [ ] **Step 4: Commit and push the final status**

  Commit: `docs: record M8 and M9 player ui verification`

  Push the final commit directly to `origin/main`.

- [ ] **Step 5: Confirm the single final version**

  Verify:

  - local branch is `main`;
  - `HEAD` equals `origin/main`;
  - GitHub Open PR count is 0;
  - working tree is clean;
  - no feature branch or PR is required for handoff.

## Execution ledger

Implementation will maintain `.superpowers/sdd/2026-09-30-m8-m9-player-ui-implementation/progress.md`. Because the user explicitly requested one final mainline result, every completed task is fast-forwarded and pushed to `origin/main` before the next task begins. If the branch is named `master` in another environment, substitute that branch only after verifying the repository’s actual default branch.
