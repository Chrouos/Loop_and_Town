# Narrative Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an executable narrative foundation for Loop 01: character source-of-truth data, directional relationships, knowledge validation, protagonist diegetic activities, observable narrative projection, Prologue 14:20–16:10, and a Character Graph author view, without yet rebuilding the full Player UI.

**Architecture:** Extend the existing Story Simulation v0.2 instead of replacing it. `story/` remains canonical; narrative data is loaded beside simulation data, validated against stable IDs, and projected from World Truth into player-visible narrative beats only when observation conditions are satisfied. The Event Graph remains world-causality tooling; Character Graph becomes a separate author/debug projection.

**Tech Stack:** TypeScript 5.6, Vitest 2, React 18, Vite 5, js-yaml 4, @xyflow/react 12.

**Spec:** `docs/superpowers/specs/2026-09-24-narrative-foundation-v0.1-design.md`

## Global Constraints

- New Narrative Foundation rules override conflicting legacy `player-first-loop`, `first-loop-story.md`, and `story.ts` prototype assumptions.
- Protagonist returns to 灰潮鎮 to clean and sell the old family home; the impossible letter is discovered only after returning home.
- Player-facing prose is first-person and may include limited internal monologue, but must not solve the core mystery for the player.
- Event, Narrative Scene, Activity, and Artifact are distinct data concepts.
- Character identity/background/relationship/knowledge must not exist only in React components or prose.
- Relationship edges are directional.
- `observable` World Truth is not automatically Player Knowledge; observation conditions must also pass.
- Hidden world events must not interrupt protagonist activities.
- Offline world simulation continues; missed observable information is projected later according to its channel.
- Canonical activity duration is world minutes. Player runtime will later map 1 real minute = 1 world minute; real timestamps must not enter story YAML.
- Existing WL-00..WL-07 causal acceptance must remain green unless a deliberately reviewed narrative timing change requires corresponding simulator data/test updates.
- No full Player Narrative UI rewrite in this plan. This plan produces the data/runtime foundation and author tooling it will consume.
- No changes to `.github/workflows/event-graph-viewer.yml` are required.

## CI Safety Rules

1. Do not push test-only RED commits to a pull request. Run RED/GREEN in an isolated local worktree when possible; only push commits after targeted tests, full `npm test`, and `npm run build` pass.
2. Every pushed implementation commit must be followed by GitHub Actions verification before the next task that depends on it.
3. Never weaken or skip existing tests to obtain a green build.
4. Changes under `story/**` and `tools/event-graph-viewer/**` trigger the existing Event Graph Viewer workflow; treat that workflow as the release gate.
5. If GitHub Actions fails, stop the task, inspect the exact failing job/log, fix the root cause, and restore green before continuing.
6. Do not modify the workflow file during this feature unless a separate reviewed CI-only task is explicitly approved.

## Review Focus

1. **Unknown references:** a scene/relationship/character entry referencing an unknown character, fact, activity, artifact, event, or schedule must fail validation before rendering.
2. **Knowledge leaks:** a character must not speak a fact they do not know at the scene time; author validation must report the character ID, scene ID, and fact ID.
3. **Observation leaks:** observable history must still remain hidden when location/channel conditions are not met; offline missed events must project to the correct deferred form rather than reveal full World Truth.
4. **Activity interruption:** only an eligible observable interrupt may pause an activity; hidden events and unrelated observable events must leave the activity running.
5. **Legacy causal regression:** adding Prologue/narrative data must not change WL-00..WL-07 station/reporter outcomes or Day 1 loop-end ordering unless the task explicitly changes canonical event timing and updates acceptance tests in the same green commit.

---

## Locked File Structure

### Canonical story data
- Create `story/characters/protagonist.yaml`
- Create `story/characters/zhixia.yaml`
- Create `story/characters/yuan.yaml`
- Create `story/characters/wakaharu.yaml`
- Create `story/characters/doctor.yaml`
- Create `story/characters/reporter.yaml`
- Create `story/characters/detective.yaml`
- Create `story/relationships/loop_01.yaml`
- Create `story/knowledge/facts.yaml`
- Create `story/activities/protagonist.yaml`
- Create `story/schedules/protagonist.yaml`
- Create `story/narrative/loop_01_prologue.yaml`
- Create `story/artifacts/zhixia_letter.yaml`
- Modify `story/manifests/loop_01.yaml`

### Runtime / loading
- Create `tools/event-graph-viewer/src/narrative/types.ts`
- Create `tools/event-graph-viewer/src/narrative/validation.ts`
- Create `tools/event-graph-viewer/src/narrative/knowledge.ts`
- Create `tools/event-graph-viewer/src/narrative/activity.ts`
- Create `tools/event-graph-viewer/src/narrative/observation.ts`
- Create `tools/event-graph-viewer/src/narrative/projection.ts`
- Create `tools/event-graph-viewer/src/narrative/characterGraph.ts`
- Modify `tools/event-graph-viewer/src/lib/loadSimulationStory.ts`
- Modify `tools/event-graph-viewer/scripts/sync-story.mjs`

### Author Viewer
- Create `tools/event-graph-viewer/src/components/CharacterGraphView.tsx`
- Modify `tools/event-graph-viewer/src/components/ViewTabs.tsx`
- Modify `tools/event-graph-viewer/src/App.tsx`
- Modify `tools/event-graph-viewer/src/types/story.ts`
- Modify `tools/event-graph-viewer/src/styles.css`

### Tests
- Create `tools/event-graph-viewer/tests/narrativeLoader.test.ts`
- Create `tools/event-graph-viewer/tests/characterBible.test.ts`
- Create `tools/event-graph-viewer/tests/knowledgeValidation.test.ts`
- Create `tools/event-graph-viewer/tests/activityRuntime.test.ts`
- Create `tools/event-graph-viewer/tests/observationProjection.test.ts`
- Create `tools/event-graph-viewer/tests/prologueNarrative.test.ts`
- Create `tools/event-graph-viewer/tests/characterGraph.test.ts`
- Modify `tools/event-graph-viewer/tests/App.test.tsx`
- Modify `tools/event-graph-viewer/tests/storySimulationAcceptance.test.ts`

---

### Task 1: Narrative types + manifest loading

**Files:**
- Create: `tools/event-graph-viewer/src/narrative/types.ts`
- Modify: `tools/event-graph-viewer/src/lib/loadSimulationStory.ts`
- Modify: `tools/event-graph-viewer/scripts/sync-story.mjs`
- Modify: `story/manifests/loop_01.yaml`
- Test: `tools/event-graph-viewer/tests/narrativeLoader.test.ts`

**Interfaces:**
- Produces `CharacterDefinition`, `RelationshipDefinition`, `KnowledgeFact`, `ActivityDefinition`, `NarrativeSceneDefinition`, `ArtifactDefinition`, `NarrativeFoundation`.
- Extends `StoryBundle` with `narrative: NarrativeFoundation`.
- Manifest gains `characters`, `relationships`, `knowledge`, `activities`, `narrative`, `artifacts` paths.

- [ ] **Step 1: Write failing loader tests**

```ts
import { expect, it } from 'vitest';
import { buildStoryBundleFromDocuments } from '../src/lib/loadSimulationStory';

it('loads narrative documents into the story bundle', () => {
  const bundle = buildStoryBundleFromDocuments(makeDocuments({
    characters: [{ id: 'protagonist', name: '主角' }],
    relationships: { relationships: [] },
    knowledge: { facts: [{ id: 'fact_zhixia_dead_five_years', summary: '林知夏五年前死亡' }] },
    activities: { activities: [] },
    narrative: { scenes: [] },
    artifacts: [],
  }));
  expect(bundle.narrative.characters[0].id).toBe('protagonist');
  expect(bundle.narrative.knowledgeFacts[0].id).toBe('fact_zhixia_dead_five_years');
});
```

Add a manifest fetch test asserting every new path is requested exactly once.

- [ ] **Step 2: Verify RED locally**

Run:

```bash
cd tools/event-graph-viewer
npm test -- narrativeLoader.test.ts
```

Expected: FAIL because narrative types and manifest fields do not exist.

- [ ] **Step 3: Implement minimal types and loader support**

Use these core types:

```ts
export type NarrativeVisibility = 'public' | 'author' | 'player-known';

export type CharacterDefinition = {
  id: string;
  name: string;
  age?: number;
  identity: { occupation?: string; hometown?: string };
  background: { summary: string; history: string[] };
  personality: { traits: string[]; habits: string[]; dislikes: string[] };
  speech: { tone: string; calls: Record<string, string> };
  knowledge: { initial: string[]; hidden: string[] };
  secrets: string[];
  scheduleRef?: string;
};

export type RelationshipDefinition = {
  from: string;
  to: string;
  type: string;
  visibility: NarrativeVisibility;
  summary: string;
};

export type KnowledgeFact = { id: string; summary: string };
```

Do not add optional catch-all fields such as `metadata: any`.

- [ ] **Step 4: Update story sync sources**

Add exactly:

```js
'characters', 'relationships', 'knowledge', 'activities', 'narrative', 'artifacts'
```

to `sources` in `sync-story.mjs`.

- [ ] **Step 5: Verify GREEN and baseline**

```bash
npm test -- narrativeLoader.test.ts manifestLoader.test.ts
npm test
npm run build
```

Expected: all PASS.

- [ ] **Step 6: Push only the GREEN commit and verify GitHub Actions succeeds before Task 2**

Commit message:

```text
feat: load narrative foundation data
```

---

### Task 2: Character Bible + relationship source of truth

**Files:**
- Create: seven files under `story/characters/`
- Create: `story/relationships/loop_01.yaml`
- Create: `story/knowledge/facts.yaml`
- Create: `tools/event-graph-viewer/tests/characterBible.test.ts`

**Interfaces:**
- Consumes `CharacterDefinition`, `RelationshipDefinition`, `KnowledgeFact` from Task 1.
- Produces seven stable character IDs: `protagonist`, `zhixia`, `yuan`, `wakaharu`, `doctor`, `reporter`, `detective`.

- [ ] **Step 1: Write real-data failing tests**

```ts
it('defines the seven approved core characters exactly once', () => {
  const story = loadRealStory();
  expect(story.narrative.characters.map(c => c.id).sort()).toEqual([
    'detective', 'doctor', 'protagonist', 'reporter', 'wakaharu', 'yuan', 'zhixia',
  ]);
});

it('locks the protagonist return-home premise', () => {
  const protagonist = byCharacter(loadRealStory(), 'protagonist');
  expect(protagonist.background.summary).toContain('整理');
  expect(protagonist.background.summary).toContain('出售');
  expect(protagonist.background.summary).not.toContain('因為收到信');
});
```

Add tests that every relationship endpoint references a defined character and every `knowledge.initial/hidden` fact references a defined fact.

- [ ] **Step 2: Verify RED**

```bash
npm test -- characterBible.test.ts
```

Expected: FAIL because canonical character/relationship/fact YAML files do not exist.

- [ ] **Step 3: Add canonical data**

Each character file must contain identity, background, personality, speech, knowledge, secrets, and schedule reference where applicable. Do not write mystery conclusions into protagonist knowledge.

Minimum initial relationship set:

```yaml
relationships:
  - from: protagonist
    to: yuan
    type: old_friend
    visibility: public
    summary: 高中同學，五年來偶爾聯絡
  - from: yuan
    to: protagonist
    type: concerned_friend
    visibility: author
    summary: 仍然在意主角，但不擅長談姊姊的死亡
  - from: wakaharu
    to: zhixia
    type: attachment
    visibility: public
    summary: 把知夏視為姊姊般的重要存在
  - from: zhixia
    to: wakaharu
    type: protective
    visibility: author
    summary: 試圖讓若晴遠離研究所事件
```

- [ ] **Step 4: Verify GREEN + Story Simulation regression**

```bash
npm test -- characterBible.test.ts storySimulationAcceptance.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push GREEN commit; wait for GitHub Actions success**

Commit message:

```text
feat: add canonical character bible
```

---

### Task 3: Knowledge validation

**Files:**
- Create: `tools/event-graph-viewer/src/narrative/knowledge.ts`
- Create: `tools/event-graph-viewer/src/narrative/validation.ts`
- Create: `tools/event-graph-viewer/tests/knowledgeValidation.test.ts`

**Interfaces:**
- Produces `characterKnowsFact(character, factId): boolean`.
- Produces `validateNarrativeFoundation(story): void`.
- Narrative scene lines that assert knowledge use stable `factId` references.

- [ ] **Step 1: Write failing tests**

```ts
it('rejects dialogue that exposes a fact the speaker does not know', () => {
  const story = makeNarrativeStory({
    speaker: 'yuan',
    factId: 'fact_research_institute_truth',
    yuanInitialFacts: ['fact_zhixia_dead_five_years'],
  });
  expect(() => validateNarrativeFoundation(story)).toThrow(
    'Scene scene_1: character yuan does not know fact fact_research_institute_truth',
  );
});
```

Also test duplicate fact IDs and unknown scene character IDs.

- [ ] **Step 2: Verify RED**

```bash
npm test -- knowledgeValidation.test.ts
```

- [ ] **Step 3: Implement exact validation**

`characterKnowsFact` must check only authored initial/hidden fact IDs in v0.1; do not infer knowledge from relationship prose.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- knowledgeValidation.test.ts characterBible.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push GREEN commit and verify CI**

Commit message:

```text
feat: validate character knowledge
```

---

### Task 4: Diegetic Idle Activity model

**Files:**
- Create: `story/activities/protagonist.yaml`
- Create: `story/schedules/protagonist.yaml`
- Create: `tools/event-graph-viewer/src/narrative/activity.ts`
- Create: `tools/event-graph-viewer/tests/activityRuntime.test.ts`

**Interfaces:**
- Produces `ActivityDefinition` with `id`, `durationMinutes`, `interruptible`, `presentation`.
- Produces `ActivityRun` and `advanceActivity(run, targetMinute, interruptions)`.
- Activity time uses absolute world minutes only.

- [ ] **Step 1: Write failing activity tests**

```ts
it('advances an activity in world minutes', () => {
  const run = startActivity('rest_and_read', 930, { durationMinutes: 20, interruptible: true });
  expect(advanceActivity(run, 949, []).status).toBe('running');
  expect(advanceActivity(run, 950, []).status).toBe('complete');
});

it('ignores hidden interrupts', () => {
  const run = startActivity('rest_and_read', 930, { durationMinutes: 20, interruptible: true });
  const next = advanceActivity(run, 940, [{ minute: 940, visibility: 'hidden', sceneId: 'hidden_scene' }]);
  expect(next.status).toBe('running');
});
```

Add a test that an eligible observable interrupt returns `status: 'interrupted'` and retains remaining minutes.

- [ ] **Step 2: Verify RED**

```bash
npm test -- activityRuntime.test.ts
```

- [ ] **Step 3: Implement minimal pure runtime**

```ts
export type ActivityRun = {
  activityId: string;
  startedAt: number;
  durationMinutes: number;
  consumedMinutes: number;
  status: 'running' | 'interrupted' | 'complete';
};
```

No `Date.now()` usage is allowed in this module.

- [ ] **Step 4: Add protagonist baseline activities**

Initial v0.1 activity IDs:

```text
walk_home
buy_groceries
clean_old_house
rest_and_read
sort_mail
prepare_dinner
research_online
wait_for_call
```

`story/schedules/protagonist.yaml` describes the no-mystery baseline, but must not be loaded as an NPC schedule by the existing simulator until Task 6 defines the projection boundary.

- [ ] **Step 5: Verify GREEN + baseline**

```bash
npm test -- activityRuntime.test.ts storySimulationAcceptance.test.ts
npm test
npm run build
```

- [ ] **Step 6: Push GREEN commit; verify CI**

Commit message:

```text
feat: add diegetic idle activities
```

---

### Task 5: Observation projection

**Files:**
- Create: `tools/event-graph-viewer/src/narrative/observation.ts`
- Create: `tools/event-graph-viewer/tests/observationProjection.test.ts`

**Interfaces:**
- Produces `ObservationChannel = 'present' | 'phone' | 'artifact' | 'deferred'`.
- Produces `ObservationContext` with protagonist location, online/offline state, available channels, and current minute.
- Produces `canObserve(entry, rule, context)` and `projectObservation(...)`.

- [ ] **Step 1: Write failing leak-prevention tests**

```ts
it('does not expose an observable station event when protagonist is elsewhere', () => {
  expect(canObserve(stationEntry, { channel: 'present', location: 'old_station' }, {
    protagonistLocation: 'old_house', online: true, channels: ['present'], minute: 1111,
  })).toBe(false);
});

it('projects an offline phone message as deferred rather than full world truth', () => {
  const result = projectObservation(reporterMissingEntry, { channel: 'phone', offlineMode: 'deferred' }, offlineContext);
  expect(result?.channel).toBe('deferred');
  expect(result?.worldTruthChanges).toBeUndefined();
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- observationProjection.test.ts
```

- [ ] **Step 3: Implement rule-based projection**

Rules must be declarative. Do not branch on specific event IDs inside `observation.ts`.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- observationProjection.test.ts visibilityProjection.test.ts storyWorldlineDiff.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push GREEN commit; verify CI**

Commit message:

```text
feat: project observable narrative information
```

---

### Task 6: Narrative Scene + Artifact schemas

**Files:**
- Extend: `tools/event-graph-viewer/src/narrative/types.ts`
- Extend: `tools/event-graph-viewer/src/narrative/validation.ts`
- Create: `story/artifacts/zhixia_letter.yaml`
- Create: `story/narrative/loop_01_prologue.yaml`
- Create: `tools/event-graph-viewer/tests/prologueNarrative.test.ts`

**Interfaces:**
- `NarrativeSceneDefinition` contains `id`, `at`, `kind`, `participants`, `blocks`, `observation`, optional `startsActivity`, optional `artifactId`.
- `ArtifactDefinition` contains `id`, `kind`, `author`, `formedAt`, `content`, and presentation metadata.

- [ ] **Step 1: Write failing Prologue structure tests**

```ts
it('starts as ordinary life before the impossible letter', () => {
  const story = loadRealStory();
  const scenes = story.narrative.scenes;
  expect(scenes.find(s => s.id === 'prologue_arrival')?.at).toEqual({ day: 0, time: '14:20' });
  expect(scenes.find(s => s.id === 'prologue_yuan_reunion')?.at).toEqual({ day: 0, time: '14:40' });
  expect(scenes.find(s => s.id === 'prologue_letter_discovery')?.at).toEqual({ day: 0, time: '16:00' });
  expect(indexOfScene(scenes, 'prologue_letter_discovery')).toBeGreaterThan(indexOfScene(scenes, 'prologue_rest_and_read'));
});
```

Add assertions that pre-letter scenes do not mention `18:31`, `輪迴`, `研究所真相`, or automatically create Evidence Cards.

- [ ] **Step 2: Verify RED**

```bash
npm test -- prologueNarrative.test.ts
```

- [ ] **Step 3: Author the Prologue source**

Required scene order:

```text
14:20 prologue_arrival
14:25 prologue_station_exit
14:30 prologue_groceries
14:40 prologue_yuan_reunion
15:00 prologue_old_house
15:30 prologue_rest_and_read
15:50 prologue_sort_mail
16:00 prologue_letter_discovery
16:02 prologue_letter_opened
16:10 main_story_handoff
```

The ordinary-life scenes may contain details with no mystery payoff. First Yuan appearance must establish who he is before using only `予安`.

- [ ] **Step 4: Author the letter Artifact**

The artifact content may include:

```text
回來一趟。
這一次，先別來找我。
如果午夜的鐘聲響起，就代表又失敗了。
```

Do not create preselected evidence excerpts or `+` controls in data.

- [ ] **Step 5: Validate knowledge / references**

`validateNarrativeFoundation` must reject unknown `participants`, `artifactId`, `startsActivity`, and fact references.

- [ ] **Step 6: Verify GREEN + existing story acceptance**

```bash
npm test -- prologueNarrative.test.ts knowledgeValidation.test.ts storySimulationAcceptance.test.ts
npm test
npm run build
```

- [ ] **Step 7: Push GREEN commit; verify CI**

Commit message:

```text
feat: author Loop 01 narrative prologue
```

---

### Task 7: Narrative projection state machine

**Files:**
- Create: `tools/event-graph-viewer/src/narrative/projection.ts`
- Extend: `tools/event-graph-viewer/tests/prologueNarrative.test.ts`
- Create: `tools/event-graph-viewer/tests/narrativeProjection.test.ts`

**Interfaces:**
- Produces `NarrativeBeat`.
- Produces `projectNarrative({ story, fullHistory, context, activeActivity, consumedSceneIds })`.
- Deterministic ordering: scheduled narrative scene → eligible observed interrupt at the same minute → resumed/continued activity; ties preserve authored scene order.

- [ ] **Step 1: Write failing deterministic projection tests**

```ts
it('returns the same narrative queue for the same world state and context', () => {
  const first = projectNarrative(input);
  const second = projectNarrative(input);
  expect(first).toEqual(second);
});

it('does not enqueue hidden world movement as a scene', () => {
  const beats = projectNarrative(inputWithReporterHiddenMovement);
  expect(beats.some(b => b.sourceId === 'reporter_enter_old_lab')).toBe(false);
});
```

Add an activity interruption/resume test.

- [ ] **Step 2: Verify RED**

```bash
npm test -- narrativeProjection.test.ts
```

- [ ] **Step 3: Implement pure projection**

Do not store React state, localStorage, timestamps, or DOM concerns in this module.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- narrativeProjection.test.ts activityRuntime.test.ts observationProjection.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push GREEN commit; verify CI**

Commit message:

```text
feat: project deterministic narrative beats
```

---

### Task 8: Reconcile Prologue with canonical Event Graph without changing causal outcomes

**Files:**
- Modify only if required: `story/events/loop_01_1420.yaml`, `story/events/loop_01_1500.yaml`, `story/events/loop_01_1610.yaml`
- Modify: `tools/event-graph-viewer/tests/storySimulationAcceptance.test.ts`
- Extend: `tools/event-graph-viewer/tests/prologueNarrative.test.ts`

**Interfaces:**
- Event Graph remains World Truth only.
- Ordinary-life Prologue beats remain narrative/activity data, not Events.

- [ ] **Step 1: Add regression assertions before editing event YAML**

```ts
it.each(['WL-00','WL-01','WL-02','WL-03','WL-04','WL-05','WL-06','WL-07'])('%s preserves approved post-prologue causal outcomes', (id) => {
  const result = simulateNamedWorldline(loadRealStory(), id);
  expect(result.fullHistory.find(e => e.eventId === 'evt_1831_station')?.variantId).toBe(expectedStationVariant(id));
  expect(result.fullHistory.find(e => e.eventId === 'evt_2359_midnight_bells')).toBeTruthy();
  expect(result.fullHistory.find(e => e.eventId === 'evt_0000_loop_end')?.absoluteMinute).toBe(1440);
});
```

- [ ] **Step 2: Verify the tests are GREEN before any timing change**

This task is migration-first: there may be no necessary Event YAML change. If no conflict remains after Task 6, keep Event IDs/times unchanged.

- [ ] **Step 3: If a canonical event conflicts with Narrative Foundation, change the smallest possible World Truth definition**

Example: if `evt_1500_sister_room` incorrectly claims an investigation happened, rename/reframe its title/variant to a neutral old-house arrival event while preserving IDs only if external references require them. If an ID must change, update every manifest/test reference in the same commit.

- [ ] **Step 4: Run all real-story acceptance**

```bash
npm test -- storySimulationAcceptance.test.ts prologueNarrative.test.ts worldlineDefinitions.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push only if green; verify CI before Task 9**

Commit message if changes are needed:

```text
refactor: align Loop 01 events with narrative foundation
```

If no production change is necessary, do not create an empty commit.

---

### Task 9: Character Graph projection

**Files:**
- Create: `tools/event-graph-viewer/src/narrative/characterGraph.ts`
- Extend: `tools/event-graph-viewer/src/types/story.ts`
- Create: `tools/event-graph-viewer/tests/characterGraph.test.ts`

**Interfaces:**
- Produces `CharacterGraphMode = 'public' | 'author' | 'player-known'`.
- Produces `CharacterGraphProjection` with nodes, directed edges, and selected-character detail data.
- Produces `projectCharacterGraph(story, mode, playerKnownFactIds?)`.

- [ ] **Step 1: Write failing graph tests**

```ts
it('keeps directional relationships separate', () => {
  const graph = projectCharacterGraph(loadRealStory(), 'author');
  expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'protagonist', target: 'yuan', type: 'old_friend' }));
  expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'yuan', target: 'protagonist', type: 'concerned_friend' }));
});

it('hides author-only relationships in public mode', () => {
  const graph = projectCharacterGraph(loadRealStory(), 'public');
  expect(graph.edges.some(edge => edge.summary.includes('研究所'))).toBe(false);
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- characterGraph.test.ts
```

- [ ] **Step 3: Implement projection with no React dependency**

Character detail projection includes background, visible relationships, knowledge IDs, secrets only in author mode, schedule reference, and narrative appearance IDs.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- characterGraph.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push GREEN commit; verify CI**

Commit message:

```text
feat: project character relationship graph
```

---

### Task 10: Character Graph Viewer integration

**Files:**
- Create: `tools/event-graph-viewer/src/components/CharacterGraphView.tsx`
- Modify: `tools/event-graph-viewer/src/components/ViewTabs.tsx`
- Modify: `tools/event-graph-viewer/src/App.tsx`
- Modify: `tools/event-graph-viewer/src/styles.css`
- Modify: `tools/event-graph-viewer/tests/App.test.tsx`

**Interfaces:**
- Adds `ViewName = 'graph' | 'characters' | 'timeline' | 'diff'`.
- Character Graph consumes `CharacterGraphProjection`; it never mutates YAML.

- [ ] **Step 1: Write failing viewer tests**

```tsx
it('opens Character Graph and shows the protagonist–Yuan relationship', async () => {
  stubRealStoryFetch();
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Character Graph' }));
  expect(await screen.findByText('周予安')).toBeTruthy();
  expect(screen.getByText(/高中同學/)).toBeTruthy();
});
```

Add a mode-toggle test proving author-only relationships are hidden in Public mode and visible in Author Truth mode.

- [ ] **Step 2: Verify RED**

```bash
npm test -- App.test.tsx characterGraph.test.ts
```

- [ ] **Step 3: Implement minimal author UI**

Use existing `@xyflow/react`. Keep Event Graph untouched. Character Graph must have separate node/edge rendering and a side/detail panel for selected character.

- [ ] **Step 4: Verify GREEN + build**

```bash
npm test -- App.test.tsx characterGraph.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push GREEN commit; verify GitHub Actions**

Commit message:

```text
feat: add Character Graph author view
```

---

### Task 11: Full Narrative Foundation acceptance gate

**Files:**
- Create: `tools/event-graph-viewer/tests/narrativeFoundationAcceptance.test.ts`
- Modify docs only if test evidence reveals a spec contradiction.

**Interfaces:**
- No new production interfaces.
- This task locks the cross-subsystem behavior before a Player Narrative UI spec begins.

- [ ] **Step 1: Add end-to-end real-data acceptance tests**

Must assert all of the following:

```ts
it('keeps ordinary life before mystery escalation', ...);
it('introduces Yuan with relationship context before shorthand references', ...);
it('starts and completes rest_and_read through world minutes', ...);
it('does not interrupt that activity for hidden reporter movement', ...);
it('discovers the impossible letter only after returning home', ...);
it('never exposes author-only relationships in public/player-known character projections', ...);
it('rejects a scene if its speaker lacks the referenced fact', ...);
it('keeps WL-00 through WL-07 approved station/reporter outcomes', ...);
it('keeps 23:59 bells before Day 1 00:00 loop end', ...);
it('produces deterministic narrative projection for identical input', ...);
```

- [ ] **Step 2: Run the complete local verification gate**

```bash
cd tools/event-graph-viewer
npm run sync-story
npm test
npm run build
```

Expected: PASS with zero skipped/disabled regression tests introduced by this plan.

- [ ] **Step 3: Inspect changed files for accidental legacy/player UI migration**

Expected: no `player.html`, `src/player/**`, Evidence Board, old `VisibleRecord`, or workflow changes are introduced by Narrative Foundation v0.1.

- [ ] **Step 4: Push the final GREEN acceptance commit**

Commit message:

```text
test: lock Narrative Foundation v0.1 acceptance
```

- [ ] **Step 5: Verify authoritative GitHub Actions**

The `verify-viewer` job must complete successfully with:

```text
Install dependencies: PASS
Sync story data: PASS
Run tests: PASS
Build viewer: PASS
```

Do not mark the implementation PR ready for review until this run is green.

---

## Implementation Branch Strategy

After this plan is approved:

```text
feature/story-simulation-v0.2   (known-green base)
        ↓
docs/narrative-foundation-v0.1  (approved spec + plan)
        ↓
feature/narrative-foundation-v0.1
```

The implementation PR should target `docs/narrative-foundation-v0.1` while the stack is under development. Do not merge or retarget to `main` during implementation.

## Final Review Gate

Narrative Foundation v0.1 is complete only when:

```text
Character Bible is canonical
+ Relationship Graph is directional
+ Knowledge references validate
+ protagonist activities consume world time
+ hidden events cannot leak/interrupt
+ observation projection handles present/phone/offline channels
+ Prologue 14:20–16:10 reads as ordinary life → unease → impossible letter
+ Story Simulation WL-00..WL-07 remains deterministic
+ Character Graph renders Public / Author Truth / Player Known views
+ full tests and Vite build are green locally
+ latest GitHub Actions verify-viewer run is green
```

Only after this gate should a separate Player Narrative UI vertical-slice design begin.