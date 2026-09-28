# Player Narrative UI v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 Player Narrative 從整段文章閱讀改成具備逐字播放、rolling narrative、scene transition、活動 ETA projection 與 player-known character memory card 的 Visual Novel / Diegetic UI。

**Architecture:** 保留既有 `reconcilePlayerRuntime`、scene consumption、foreground freeze 與 choice/activity semantics。由 `PlayerNarrativeApp` 管理不持久化的 `PlaybackState`，以純 typewriter 與 presentation projection modules 將 runtime data 交給小型 UI components。

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, js-yaml, CSS animations。

**Spec:** `docs/superpowers/specs/2026-09-28-player-narrative-ui-v0.2-design.md`

## Global Constraints

- 播放 state 與故事 state 分離；逐字游標不寫入 player session。
- 每字速度目標為 30–45ms；`，、` pause 約 100ms；`。！？……` pause 約 180–250ms。
- 點擊、Space、Enter 在 `typing` 時完成當前 beat，在 `waiting` 時推進下一個 beat。
- 不顯示「繼續」文字按鈕；只顯示可讀取的閃爍游標／advance hint。
- Rolling narrative 最多保留三個已完成 beat。
- Activity ETA 預設為 `hidden`；component 不自行計算 story time 或 ETA。
- `PlayerSessionV2` 必須可遷移到 `PlayerSessionV3`，保留既有 `knownFactIds`。
- Player character projection 不得輸出 author-only background、hidden traits、secrets、schedule 或 narrative appearance ids。
- 缺少 portrait 時使用 monogram；缺少 insight document 時仍可顯示 player-known facts。
- 既有 artifact、choice、foreground freeze、activity completion 與 scene consumption semantics 不變。
- 完成前必須通過 `npm test` 與 `npm run build`。

## Review Focus

- Text containing punctuation, CJK characters, or an empty string must never stall the typewriter; pin with `typewriter` unit tests.
- A click or keypress during a choice/artifact interaction must not advance the narrative; pin with `playerNarrativeUi` component tests.
- A scene change during a transition must reset beat index and rolling history exactly once; pin with `SceneTransition` integration tests.
- A legacy v2 save with missing optional fields must migrate without losing actions, facts, travel, or freeze semantics; pin with `playerNarrativeStorage` migration tests.
- Character data with author-only fields, missing insights, or missing portraits must render only safe fallback content; pin with `characterMemory` projection and drawer tests.

---

### Task 1: Add a deterministic typewriter engine

**Files:**
- Create: `tools/event-graph-viewer/src/playerNarrative/typewriter.ts`
- Create: `tools/event-graph-viewer/tests/playerNarrativeTypewriter.test.ts`

**Interfaces:**
- Produces `DEFAULT_TYPEWRITER_TIMING`, `nextRevealDelay(text: string, index: number, timing?: TypewriterTiming): number`, and `isTypewriterComplete(text: string, revealedCharacters: number): boolean`.
- `TypewriterTiming` contains `characterMs`, `commaPauseMs`, and `terminalPauseMs`.
- `nextRevealDelay` receives the index of the next character to reveal and returns the character delay plus punctuation pause; out-of-range indexes return `0`.

- [ ] **Step 1: Write failing unit tests** for ordinary CJK reveal timing, comma pause, terminal punctuation pause, empty text, and completion at full length.
- [ ] **Step 2: Run the focused test** with `npm test -- --run tests/playerNarrativeTypewriter.test.ts`; verify the new module/tests fail because the exports do not exist.
- [ ] **Step 3: Implement the pure timing helpers** in `typewriter.ts`, using the exact timing ranges from the spec and treating `，、` separately from `。！？……`.
- [ ] **Step 4: Run the focused test again** and verify all typewriter tests pass.
- [ ] **Step 5: Commit** with `git add tools/event-graph-viewer/src/playerNarrative/typewriter.ts tools/event-graph-viewer/tests/playerNarrativeTypewriter.test.ts && git commit -m "feat: add narrative typewriter timing"`.

### Task 2: Replace block-count narrative playback with beat playback

**Files:**
- Modify: `tools/event-graph-viewer/src/playerNarrative/PlayerNarrativeApp.tsx`
- Modify: `tools/event-graph-viewer/src/playerNarrative/components/NarrativeSurface.tsx`
- Modify: `tools/event-graph-viewer/src/playerNarrative/playerNarrative.css`
- Modify: `tools/event-graph-viewer/tests/playerNarrativeUi.test.tsx`
- Create: `tools/event-graph-viewer/tests/playerNarrativePlayback.test.tsx`

**Interfaces:**
- `PlaybackState` is `{ sceneId: string; beatIndex: number; phase: 'typing' | 'waiting'; revealedCharacters: number }` and remains local React state.
- `NarrativeSurface` consumes `{ block: NarrativeBlock; speakerNames?: Record<string, string>; phase: PlaybackPhase; revealedCharacters: number; onAdvance: () => void }` and renders only the active beat plus the rolling history supplied by the parent.
- `NarrativeSurface` exposes a visually quiet advance hint with an accessible label; it does not render a button labelled `繼續`.

- [ ] **Step 1: Write failing component tests** for initial typing, a click completing the current beat, a second click advancing the beat, Space/Enter handling, and a three-beat rolling window.
- [ ] **Step 2: Run the focused UI tests** with `npm test -- --run tests/playerNarrativeUi.test.tsx tests/playerNarrativePlayback.test.tsx`; verify the tests fail against the current `visibleCount`/continue-button behavior.
- [ ] **Step 3: Implement local playback state in `PlayerNarrativeApp`**. Reset the state when `scene.id` changes, derive the current readable beat, and call existing `finishScene` only after the final beat is complete and no artifact/choice is waiting.
- [ ] **Step 4: Implement the typewriter effect in `NarrativeSurface`** with timer cleanup on block or scene change, `prefers-reduced-motion` support, and a full-text accessible node that does not expose only the partially revealed substring.
- [ ] **Step 5: Route click, Space, and Enter through the narrative surface** while stopping propagation from artifact, choice, and character controls; remove the old `visibleCount` and `繼續` button path.
- [ ] **Step 6: Add rolling CSS states** for active, previous, and previous-2 beats, with the specified opacity targets and a blinking cursor/advance hint.
- [ ] **Step 7: Run the focused tests** and verify all playback and existing artifact/choice UI tests pass.
- [ ] **Step 8: Commit** with `git add tools/event-graph-viewer/src/playerNarrative/PlayerNarrativeApp.tsx tools/event-graph-viewer/src/playerNarrative/components/NarrativeSurface.tsx tools/event-graph-viewer/src/playerNarrative/playerNarrative.css tools/event-graph-viewer/tests/playerNarrativeUi.test.tsx tools/event-graph-viewer/tests/playerNarrativePlayback.test.tsx && git commit -m "feat: add visual novel narrative playback"`.

### Task 3: Add scene transition state and presentation

**Files:**
- Create: `tools/event-graph-viewer/src/playerNarrative/components/SceneTransition.tsx`
- Modify: `tools/event-graph-viewer/src/playerNarrative/PlayerNarrativeApp.tsx`
- Modify: `tools/event-graph-viewer/src/playerNarrative/playerNarrative.css`
- Create: `tools/event-graph-viewer/tests/playerNarrativeTransition.test.tsx`

**Interfaces:**
- `SceneTransition` consumes `{ sceneKey: string; variant: 'scene' | 'black'; children: ReactNode }` and owns only visual phase (`entering`, `visible`, `exiting`).
- A normal scene transition uses 250ms fade-out and 400ms fade-in; `scene.kind === 'transition'` uses a black overlay held for approximately 500ms.

- [ ] **Step 1: Write failing transition tests** that render two scene keys, assert the old content exits before the new content enters, and assert the transition variant changes to black for `kind: 'transition'`.
- [ ] **Step 2: Run the focused transition test** with `npm test -- --run tests/playerNarrativeTransition.test.tsx`; verify it fails because no transition component exists.
- [ ] **Step 3: Implement `SceneTransition`** with timer cleanup and a stable key boundary so each scene change resets the visual phase once.
- [ ] **Step 4: Wrap the scene portion of `PlayerNarrativeApp`** with `SceneTransition`, selecting the black variant only for transition scenes and leaving artifact/choice semantics unchanged.
- [ ] **Step 5: Add CSS transition classes** for the 250ms fade-out, 400ms fade-in, and black hold state; honor `prefers-reduced-motion`.
- [ ] **Step 6: Run the focused transition and playback tests** and verify scene changes reset playback state without duplicate consumption.
- [ ] **Step 7: Commit** with `git add tools/event-graph-viewer/src/playerNarrative/components/SceneTransition.tsx tools/event-graph-viewer/src/playerNarrative/PlayerNarrativeApp.tsx tools/event-graph-viewer/src/playerNarrative/playerNarrative.css tools/event-graph-viewer/tests/playerNarrativeTransition.test.tsx && git commit -m "feat: add narrative scene transitions"`.

### Task 4: Project Activity presentation and ETA policy

**Files:**
- Modify: `tools/event-graph-viewer/src/narrative/types.ts`
- Modify: `tools/event-graph-viewer/src/lib/loadSimulationStory.ts`
- Create: `tools/event-graph-viewer/src/playerNarrative/activityPresentation.ts`
- Modify: `tools/event-graph-viewer/src/playerNarrative/runtime.ts`
- Modify: `tools/event-graph-viewer/src/playerNarrative/PlayerNarrativeApp.tsx`
- Modify: `tools/event-graph-viewer/src/playerNarrative/components/ActivitySurface.tsx`
- Modify: `tools/event-graph-viewer/src/playerNarrative/playerNarrative.css`
- Create: `tools/event-graph-viewer/tests/activityPresentation.test.ts`
- Modify: `tools/event-graph-viewer/tests/playerNarrativeUi.test.tsx`

**Interfaces:**
- `ActivityPresentation.eta?: 'exact' | 'approximate' | 'hidden'` normalizes missing YAML values to `hidden`.
- `ActivityClockProjection` exposes `formatStoryMinute(minute: number): string` and `estimatedCompletionMinute(run: ActivityRun): number`.
- `projectActivityPresentation(run: ActivityRun, definition: ActivityDefinition, clock: ActivityClockProjection): ActivityPresentationView` returns `{ title, prose?, remainingLabel?, etaLabel?, etaMode }`.
- `PlayerRuntimeView` gains `activityPresentation: ActivityPresentationView | null`; `ActivitySurface` renders that view and does not receive a raw `Date.now()` or perform time arithmetic.

- [ ] **Step 1: Write failing projection tests** for exact, approximate, hidden, completed, and missing-policy activities, asserting exact labels and that the component-facing result contains no raw clock arithmetic responsibility.
- [ ] **Step 2: Run the focused test** with `npm test -- --run tests/activityPresentation.test.ts`; verify it fails because the projection module and `eta` type do not exist.
- [ ] **Step 3: Add the `eta` type and YAML normalization** in `narrative/types.ts` and `loadSimulationStory.ts`, defaulting to `hidden`.
- [ ] **Step 4: Implement `projectActivityPresentation`** using the injected clock projection, activity status, ambient prose, and the exact/approximate/hidden labels from the spec.
- [ ] **Step 5: Add the projection to `reconcilePlayerRuntime`** and adapt `PlayerNarrativeApp`/`ActivitySurface` to consume the projected view.
- [ ] **Step 6: Update activity CSS** for remaining label, ETA label, waiting cursor, and diegetic centered layout without percentage/progress UI.
- [ ] **Step 7: Run projection, UI, and existing activity tests** and verify all pass.
- [ ] **Step 8: Commit** with `git add tools/event-graph-viewer/src/narrative/types.ts tools/event-graph-viewer/src/lib/loadSimulationStory.ts tools/event-graph-viewer/src/playerNarrative/activityPresentation.ts tools/event-graph-viewer/src/playerNarrative/runtime.ts tools/event-graph-viewer/src/playerNarrative/PlayerNarrativeApp.tsx tools/event-graph-viewer/src/playerNarrative/components/ActivitySurface.tsx tools/event-graph-viewer/src/playerNarrative/playerNarrative.css tools/event-graph-viewer/tests/activityPresentation.test.ts tools/event-graph-viewer/tests/playerNarrativeUi.test.tsx && git commit -m "feat: project diegetic activity presentation"`.

### Task 5: Add player-safe character insights and session migration

**Files:**
- Modify: `tools/event-graph-viewer/src/narrative/types.ts`
- Modify: `tools/event-graph-viewer/src/lib/loadSimulationStory.ts`
- Modify: `tools/event-graph-viewer/src/narrative/characterGraph.ts`
- Create: `tools/event-graph-viewer/src/narrative/characterMemory.ts`
- Modify: `tools/event-graph-viewer/src/playerNarrative/model.ts`
- Modify: `tools/event-graph-viewer/src/playerNarrative/storage.ts`
- Modify: `tools/event-graph-viewer/src/playerNarrative/choices.ts`
- Modify: `tools/event-graph-viewer/src/playerNarrative/runtime.ts`
- Modify: `tools/event-graph-viewer/tests/playerNarrativeStorage.test.ts`
- Create: `tools/event-graph-viewer/tests/characterMemory.test.ts`
- Create: `tools/event-graph-viewer/tests/playerNarrativeModel.test.ts`

**Interfaces:**
- `CharacterInsightDefinition` stores `id`, `characterId`, `title`, `presentation`, `retainedBy`, optional `sourceLoop`, and optional acquisition metadata; authored source fields remain internal to the loader.
- `CharacterQuestionDefinition` stores `id`, `characterId`, `text`, optional `requiresFacts`, and optional resolution metadata.
- `NarrativeFoundation` gains `characterInsights` and `characterQuestions`; the manifest gains an optional character-insights document path.
- `projectCharacterMemory(story: NarrativeFoundation, knownFactIds: Iterable<string>, knownInsightIds: Iterable<string>): PlayerCharacterMemory[]` returns only player-safe identity, facts, insights, and unresolved questions.
- `PlayerSessionV3` adds `knownInsightIds: string[]`; `readPlayerSession` accepts v2 and v3 saves, migrating v2 to v3 while preserving all existing arrays and clock fields.
- `learn-insight` is added as a `PlayerChoiceEffect`; `applyChoiceEffects` appends unique insight ids without changing existing effect behavior.

- [ ] **Step 1: Write failing loader, projection, and migration tests** for the existing `story/knowledge/character_insights.yaml`, author-only field filtering, missing optional sections, v2-to-v3 migration, and unique insight acquisition.
- [ ] **Step 2: Run the focused data tests** with `npm test -- --run tests/characterMemory.test.ts tests/playerNarrativeModel.test.ts tests/playerNarrativeStorage.test.ts`; verify they fail because the new data contract and migration do not exist.
- [ ] **Step 3: Add insight/question types and manifest normalization**. Parse snake_case source keys, validate character/fact references, and make the document optional without breaking existing manifests.
- [ ] **Step 4: Implement `projectCharacterMemory`** so player-known output excludes authored background, hidden traits, secrets, schedule refs, and narrative appearance ids; hide empty memory sections.
- [ ] **Step 5: Introduce `PlayerSessionV3` and migration**. Keep the v2 storage key as a fallback read path, write only the v3 shape, and initialize absent `knownInsightIds` to `[]`.
- [ ] **Step 6: Add the `learn-insight` choice effect** and ensure `applyChoiceEffects` copies/mutates arrays immutably and de-duplicates ids.
- [ ] **Step 7: Run focused data and existing runtime/storage tests** and verify facts, action ids, travel, foreground freeze, and activity semantics are unchanged.
- [ ] **Step 8: Commit** with `git add tools/event-graph-viewer/src/narrative/types.ts tools/event-graph-viewer/src/lib/loadSimulationStory.ts tools/event-graph-viewer/src/narrative/characterGraph.ts tools/event-graph-viewer/src/narrative/characterMemory.ts tools/event-graph-viewer/src/playerNarrative/model.ts tools/event-graph-viewer/src/playerNarrative/storage.ts tools/event-graph-viewer/src/playerNarrative/choices.ts tools/event-graph-viewer/src/playerNarrative/runtime.ts tools/event-graph-viewer/tests/playerNarrativeStorage.test.ts tools/event-graph-viewer/tests/characterMemory.test.ts tools/event-graph-viewer/tests/playerNarrativeModel.test.ts && git commit -m "feat: project player character memory"`.

### Task 6: Rebuild CharacterDrawer and complete integration verification

**Files:**
- Modify: `tools/event-graph-viewer/src/playerNarrative/PlayerNarrativeApp.tsx`
- Modify: `tools/event-graph-viewer/src/playerNarrative/components/CharacterDrawer.tsx`
- Modify: `tools/event-graph-viewer/src/playerNarrative/playerNarrative.css`
- Modify: `tools/event-graph-viewer/tests/playerNarrativeUi.test.tsx`
- Create: `tools/event-graph-viewer/tests/characterDrawer.test.tsx`

**Interfaces:**
- `CharacterDrawer` consumes the player-safe memory projection plus `open`/`onClose`; it does not call `projectCharacterGraph` directly for player content.
- Each card renders identity, optional portrait/monogram, player-known facts, retained cross-loop insights, and unresolved questions only when non-empty.

- [ ] **Step 1: Write failing drawer tests** for identity rendering, fact/insight/question sections, empty-section hiding, monogram fallback, author-field non-leakage, close behavior, and keyboard focus behavior.
- [ ] **Step 2: Run the focused drawer test** with `npm test -- --run tests/characterDrawer.test.tsx`; verify it fails against the current article/list implementation.
- [ ] **Step 3: Implement the player-safe `CharacterDrawer`** using the projection from Task 5, preserving the existing drawer open/close contract and excluding the protagonist.
- [ ] **Step 4: Update `PlayerNarrativeApp`** to pass `knownInsightIds` and the projected memory data, and ensure drawer interactions stop narrative advance events.
- [ ] **Step 5: Add dossier/card CSS** for portrait or monogram, memory/questions headings, spacing, and mobile drawer behavior while preserving the existing dark diegetic visual language.
- [ ] **Step 6: Run all player narrative tests** with `npm test -- --run tests/playerNarrativeUi.test.tsx tests/characterDrawer.test.tsx tests/playerNarrativePlayback.test.tsx tests/playerNarrativeTransition.test.tsx` and verify they pass.
- [ ] **Step 7: Run the full suite and build** with `npm test` and `npm run build`; expected result is zero test failures and a successful TypeScript/Vite build.
- [ ] **Step 8: Commit** with `git add tools/event-graph-viewer/src/playerNarrative/PlayerNarrativeApp.tsx tools/event-graph-viewer/src/playerNarrative/components/CharacterDrawer.tsx tools/event-graph-viewer/src/playerNarrative/playerNarrative.css tools/event-graph-viewer/tests/playerNarrativeUi.test.tsx tools/event-graph-viewer/tests/characterDrawer.test.tsx && git commit -m "feat: complete player narrative UI v0.2"`.

## Self-review

- Spec coverage: typewriter and rolling playback are covered by Tasks 1–2; transitions by Task 3; activity policy by Task 4; player-safe character memory and migration by Task 5; card UI, accessibility, and full verification by Task 6.
- Type consistency: `PlayerSessionV3`, `knownInsightIds`, `ActivityPresentationView`, `ActivityClockProjection`, and `projectCharacterMemory` are defined before their consumers.
- Review focus: all five failure modes have explicit tests in Tasks 2, 3, 5, and 6.
- Scope: no sound, portraits pipeline, reset cinematic, clock-core rewrite, or cross-device playback persistence is included.
- No unresolved placeholders or unowned requirements remain.
