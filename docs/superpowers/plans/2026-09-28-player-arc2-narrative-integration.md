# Player Arc 2 Narrative Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing anchored player runtime to declarative Loop 2 narrative data, preserve player-safe cross-loop knowledge, and ship the first playable survivor narrative without exposing author truth.

**Architecture:** Add a player-only story loading boundary that returns simulation inputs plus sanitized narrative scenes/artifacts, then project Loop 2 scenes into the existing case-reader record flow. Extend save normalization with bounded Character Insight/evidence and loop-local scene consumption; keep the current clock, scheduler, simulator, and Loop 1 onboarding unchanged.

**Tech Stack:** TypeScript, React 18, Vitest, js-yaml, existing Vite player bundle and anchored timeline runtime.

**Spec:** `docs/superpowers/specs/2026-09-28-player-arc2-narrative-integration-design.md`

## Global Constraints

- The player must not receive DAG nodes, worldline paths, raw relationship state, final-decision thresholds, or author-only metadata.
- Loop 1 onboarding and current anchored-timeline behavior must remain unchanged.
- No second wall-clock or narrative progression engine may be added.
- `06:12` remains the canonical Loop entry; `18:31`, `23:59`, and `00:00` remain authored simulation boundaries.
- Legacy v1/v2 saves must normalize successfully when new player-safe fields are absent.
- Character Insight and canon-approved evidence persist across loops; actions, temporary state, relationship values, and scene consumption reset per loop.
- Raw Trust / Closeness / Respect / Pressure values and NPC outcome IDs must never be rendered in player UI.

## Review Focus

- Missing or duplicate narrative documents: loader tests must fail with the source path or duplicate scene ID before PlayerApp renders partial data.
- Legacy save shapes: normalizer tests must default new arrays without manufacturing memory, evidence, or NPC outcomes.
- Reset boundary: tests must prove meta knowledge survives while loop-local actions, `seenSceneIds`, pending state, and the fresh-loop relationship boundary reset. This slice does not add a numeric relationship field to the player save; the test names the boundary explicitly so a later relationship implementation has a defined insertion point.
- Authored-time and source-variant filtering: Loop 2 records must not appear before their simulation minute or for the wrong 18:31 outcome.
- Player-safety projection: UI tests must prove author DAG/relationship fields and raw numeric dimensions never reach visible player text.

---

### Task 1: Build the player-safe manifest story loader

**Files:**
- Create: `tools/event-graph-viewer/src/lib/loadPlayerStoryBundle.ts`
- Create: `tools/event-graph-viewer/src/types/playerStory.ts`
- Modify: `tools/event-graph-viewer/src/lib/loadSimulationStory.ts` only if a small shared manifest/path helper is required
- Test: `tools/event-graph-viewer/tests/playerStoryBundleLoader.test.ts`

**Interfaces:**
- Consumes: `StoryManifest`, `buildStoryBundleFromManifest`, `loadYaml`, `parseNarrativeDocument` from `src/lib/loadSimulationStory.ts`.
- Produces:
  - `type PlayerNarrativeDocument = { sourcePath: string; loopId: number | 'final'; scenes: NarrativeSceneDefinition[] }`.
  - `type PlayerStoryBundle = { simulation: Pick<StoryBundle, 'loop' | 'initialState' | 'schedules' | 'definition' | 'worldlines' | 'playerChoices' | 'travelEdges'>; narrativeDocuments: PlayerNarrativeDocument[]; artifacts: ArtifactDefinition[] }`.
  - `loadPlayerStoryBundle(manifestPath: string): Promise<PlayerStoryBundle>`.

- [ ] **Step 1: Write the failing loader tests**

  Add a real-fetch fixture test that asserts the manifest produces Loop 1 and Loop 2 documents, preserves scene order, loads artifacts, and does not fetch `story_dags` or `worldline_paths`. Add duplicate-scene and missing-file cases with exact source-path errors.

- [ ] **Step 2: Run the loader tests to verify RED**

  Run: `npm test -- tests/playerStoryBundleLoader.test.ts --maxWorkers=1 --minWorkers=1 --reporter=verbose`

  Expected: FAIL because `PlayerStoryBundle` and `loadPlayerStoryBundle` do not exist.

- [ ] **Step 3: Implement the minimal safe loader**

  Load the simulation through the existing manifest builder, load only `manifest.narrative` plus `manifest.narratives` and `manifest.artifacts`, derive `loopId` from `loop_XX_player.yaml` (with `final_player.yaml` mapped to `'final'`), reject duplicate scene IDs across documents, and return only the player-safe projection. Keep DAG/path files out of the player fetch path.

- [ ] **Step 4: Run the focused loader tests**

  Run the command from Step 2; expected: all loader tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/event-graph-viewer/src/lib/loadPlayerStoryBundle.ts tools/event-graph-viewer/src/types/playerStory.ts tools/event-graph-viewer/tests/playerStoryBundleLoader.test.ts
  git commit -m "feat: add player-safe manifest story loader"
  ```

### Task 2: Extend player save normalization and loop reset boundaries

**Files:**
- Modify: `tools/event-graph-viewer/src/player/model.ts`
- Modify: `tools/event-graph-viewer/src/player/runtime.ts`
- Test: `tools/event-graph-viewer/tests/player/storage.test.ts`, `tools/event-graph-viewer/tests/player/runtime.test.ts`

**Interfaces:**
- Consumes: `PlayerSave`, `LoopSave`, `KnowledgeSave`, `emptyLoop`, `createNextLoop` from `src/player/model.ts` and `src/player/runtime.ts`.
- Produces:
  - `CharacterInsight = { id: string; characterId: string; sourceLoop: number; text: string }`.
  - `KnowledgeSave.characterInsights: CharacterInsight[]`.
  - `KnowledgeSave.discoveredEvidence: string[]`.
  - `LoopSave.seenSceneIds: string[]`.
  - `createNextLoop` preserving `characterInsights`/`discoveredEvidence` while resetting `seenSceneIds` and all loop-local fields.

- [ ] **Step 1: Write failing save/reset tests**

  Add tests for v2 saves missing the new arrays, malformed insight/evidence entries, and a completed reset that preserves one insight/evidence ID while clearing actions, revealed records, seen scenes, pending boundary, and the fresh-loop relationship boundary. Do not add a numeric relationship field in this slice.

- [ ] **Step 2: Run storage/runtime tests to verify RED**

  Run: `npm test -- tests/player/storage.test.ts tests/player/runtime.test.ts --maxWorkers=1 --minWorkers=1 --reporter=verbose`

  Expected: FAIL on missing normalized fields and reset expectations.

- [ ] **Step 3: Implement bounded normalization and reset behavior**

  Normalize at most 250 insights/evidence IDs, reject malformed objects and non-string IDs, default absent fields to empty arrays, and ensure `emptyLoop` initializes `seenSceneIds`. Keep imported legacy notes separate. `createNextLoop` must create a fresh clock/loop and retain only player-safe knowledge collections; its fresh `LoopSave` is the explicit relationship reset boundary until relationship state is modeled here.

- [ ] **Step 4: Run the focused storage/runtime tests**

  Run the command from Step 2; expected: all tests pass, including existing v1 migration assertions.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/event-graph-viewer/src/player/model.ts tools/event-graph-viewer/src/player/runtime.ts tools/event-graph-viewer/tests/player/storage.test.ts tools/event-graph-viewer/tests/player/runtime.test.ts
  git commit -m "feat: preserve player insight across loop reset"
  ```

### Task 3: Project Loop 2 narrative scenes into player records

**Files:**
- Create: `tools/event-graph-viewer/src/player/narrativeRecords.ts`
- Modify: `tools/event-graph-viewer/src/player/story.ts`
- Modify: `tools/event-graph-viewer/src/player/knowledge.ts`
- Test: `tools/event-graph-viewer/tests/playerNarrativeRecords.test.ts`, `tools/event-graph-viewer/tests/playerNarrativeStoryData.test.ts`

**Interfaces:**
- Consumes: `PlayerStoryBundle`, `NarrativeSceneDefinition`, `WorldlineHistoryEntry`, `PlayerSave`, `replayLoop`, and `clockMinuteAt`.
- Produces:
  - `type PlayerNarrativeRecord = VisibleRecord & { sceneId: string; loopId: number | 'final' }`.
  - `projectPlayerNarrativeRecords(bundle: PlayerStoryBundle, loopId: number, history: WorldlineHistoryEntry[], minute: number): PlayerNarrativeRecord[]`.
  - `visibleRecords(save: PlayerSave, loop: number, records?: PlayerNarrativeRecord[]): PlayerNarrativeRecord[]` while retaining existing static-record behavior for Loop 1 compatibility.
  - `reconcilePlayer(..., story?: PlayerStoryBundle)` reveals eligible scene records into `LoopSave.revealedIds` and does not expose scenes from another loop.

- [ ] **Step 1: Write failing projection/reconciliation tests**

  Assert Loop 2 projection produces records for reset awareness, Wakaharu's independent action, the Doctor route/death, bell, and reset in authored order; scenes before their authored minute are absent; wrong 18:31 variants do not reveal the Doctor record; and a scene marked seen is not returned again in the same loop.

- [ ] **Step 2: Run the projection tests to verify RED**

  Run: `npm test -- tests/playerNarrativeRecords.test.ts tests/playerNarrativeStoryData.test.ts --maxWorkers=1 --minWorkers=1 --reporter=verbose`

  Expected: FAIL because the scene-to-record projection and story-aware reconciliation do not exist.

- [ ] **Step 3: Implement the player projection**

  Convert only narration/monologue/dialogue text blocks into player body lines, derive excerpts without author metadata, use authored scene time as `revealMinute`, match `sourceEventId/sourceVariantId` against replay history, and apply Loop 2 document membership. Keep artifact blocks and relationship/DAG fields out of the returned record.

- [ ] **Step 4: Run focused projection and existing narrative tests**

  Run the command from Step 2 plus `npm test -- tests/narrativeEligibility.test.ts tests/playerNarrativeRuntime.test.ts --maxWorkers=1 --minWorkers=1 --reporter=verbose`; expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/event-graph-viewer/src/player/narrativeRecords.ts tools/event-graph-viewer/src/player/story.ts tools/event-graph-viewer/src/player/knowledge.ts tools/event-graph-viewer/tests/playerNarrativeRecords.test.ts tools/event-graph-viewer/tests/playerNarrativeStoryData.test.ts
  git commit -m "feat: project Loop 2 narrative scenes for players"
  ```

### Task 4: Integrate the Loop 2 records into PlayerApp

**Files:**
- Modify: `tools/event-graph-viewer/src/player/PlayerApp.tsx`
- Modify: `tools/event-graph-viewer/src/player/knowledge.ts`
- Modify: `tools/event-graph-viewer/tests/player/PlayerApp.test.tsx`
- Test: `tools/event-graph-viewer/tests/player/PlayerApp.test.tsx`

**Interfaces:**
- Consumes: `loadPlayerStoryBundle`, `PlayerStoryBundle`, `PlayerNarrativeRecord[]`, `reconcilePlayer`, and `PlayerSave` fields from Tasks 1–3.
- Produces: player-visible Loop 2 case reading and reset behavior through the existing `PlayerApp` drawer/reading scene, with no new clock or route.

- [ ] **Step 1: Write failing PlayerApp tests**

  Add tests that boot a normalized save at Loop 2, load the real manifest fixture, and assert the reset-awareness scene and Wakaharu/Doctor text appear in the case reader. Add assertions that Wakaharu is described as independently alive, no `trust`/`closeness`/`respect`/`pressure` number appears, no author/DAG labels appear, and Loop 1 envelope onboarding still passes.

- [ ] **Step 2: Run PlayerApp tests to verify RED**

  Run: `npm test -- tests/player/PlayerApp.test.tsx --maxWorkers=1 --minWorkers=1 --reporter=verbose`

  Expected: FAIL because PlayerApp still calls `loadSimulationStory` and only renders `STORY_RECORDS`.

- [ ] **Step 3: Wire the safe story bundle into PlayerApp**

  Change the `loadStory` prop and internal story type to `PlayerStoryBundle`, use the player-safe loader by default, pass projected records into reconciliation/visibility, and keep the current Loop 1 static records as a compatibility fallback only until the scene projection has a Loop 1 record. Render scene body/excerpts through the existing case reader and key all opened records by loop.

- [ ] **Step 4: Run PlayerApp and player regression tests**

  Run the command from Step 2 plus the existing player suite; expected: Loop 1 onboarding, anchored entry behavior, storage/import, visibility, and Loop 2 tests all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/event-graph-viewer/src/player/PlayerApp.tsx tools/event-graph-viewer/src/player/knowledge.ts tools/event-graph-viewer/tests/player/PlayerApp.test.tsx
  git commit -m "feat: surface Loop 2 narrative in player case reader"
  ```

### Task 5: Full compatibility verification and handoff

**Files:**
- Modify: `README.md`, `tools/event-graph-viewer/README.md` only if player loading instructions are stale
- Create: none
- Test: full `tools/event-graph-viewer` suite and production build

**Interfaces:**
- Consumes: all player-safe loader, save, projection, and PlayerApp interfaces from Tasks 1–4.
- Produces: verified native player Arc 2 slice with documented boundaries and no generated-artifact drift.

- [ ] **Step 1: Run the full test suite**

  Run: `npm test -- --maxWorkers=1 --minWorkers=1 --reporter=dot`

  Expected: zero failures, including all existing anchored timeline and Loop 1 tests plus new Loop 2 tests.

- [ ] **Step 2: Run the production build**

  Run: `npm run build`

  Expected: TypeScript and Vite build pass; synced `public/story`/`dist` changes are limited to intentional player story assets.

- [ ] **Step 3: Run repository hygiene checks**

  Run: `git diff --check` and `rg -n 'Date\\.now\\(|new Date\\(|performance\\.now\\(' story`.

  Expected: no diff whitespace errors and no wall-clock API in production story YAML.

- [ ] **Step 4: Review the complete branch**

  Confirm Loop 1 behavior, Loop 2 story visibility, save migration, reset preservation, and player-safe projection against the spec. Record any remaining Loop 3–7/Final player-surface work as roadmap follow-up rather than expanding this slice.

- [ ] **Step 5: Commit documentation/generated output if needed**

  ```bash
  git add README.md tools/event-graph-viewer/README.md tools/event-graph-viewer/public tools/event-graph-viewer/dist
  git commit -m "chore: verify player Arc 2 narrative integration"
  ```
