# Narrative Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an executable narrative foundation for Loop 01: canonical character data, directional relationships, knowledge validation, protagonist diegetic activities, observation-aware narrative projection, the 14:20–16:10 Prologue, and a Character Graph author view, without rebuilding the full Player UI yet.

**Architecture:** Extend Story Simulation v0.2. `story/` remains canonical; narrative data is loaded beside simulation data and validated against stable IDs. World Truth is projected into player-visible narrative beats only after visibility and observation rules pass. Event Graph remains world-causality tooling; Character Graph is a separate author/debug projection.

**Tech Stack:** TypeScript 5.6, Vitest 2, React 18, Vite 5, js-yaml 4, @xyflow/react 12.

**Spec:** `docs/superpowers/specs/2026-09-24-narrative-foundation-v0.1-design.md`

## Global Constraints

- Narrative Foundation rules override conflicting legacy `player-first-loop`, `first-loop-story.md`, and old `story.ts` prototype assumptions.
- The protagonist returns to 灰潮鎮 to clean and sell the old family home; the impossible letter is discovered only after returning home.
- Player-facing prose is first-person with limited internal monologue and must not solve the core mystery for the player.
- Event, Narrative Scene, Activity, and Artifact are separate concepts.
- Character identity/background/relationship/knowledge must not exist only in React components or prose.
- Relationships are directional.
- `observable` World Truth is not automatically Player Knowledge; observation conditions must also pass.
- Hidden world events do not interrupt protagonist activities.
- Offline world simulation continues; missed observable information is projected later according to its channel.
- Activity duration is authored in world minutes. Real timestamps never enter story YAML.
- Existing WL-00..WL-07 causal acceptance remains green unless a reviewed canonical timing change updates story data and tests in the same commit.
- No full Player Narrative UI rewrite in this plan.
- No `.github/workflows/event-graph-viewer.yml` changes in this feature.

## CI Safety Rules

1. Do not push test-only RED commits to GitHub PR branches.
2. Run RED/GREEN in an isolated local worktree; push only after targeted tests, full `npm test`, and `npm run build` pass.
3. After every pushed implementation commit, wait for the `Event Graph Viewer` workflow to succeed before starting a dependent task.
4. Never skip, delete, loosen, or mark an existing regression test as expected failure merely to restore green.
5. If Actions fails, stop implementation, inspect the exact failed step/log, fix the root cause, and restore green before continuing.
6. `story/**` and `tools/event-graph-viewer/**` are CI-triggering paths; docs-only planning commits remain isolated from production CI.

## Review Focus

1. **Unknown references:** unknown character/fact/activity/artifact/event/schedule references fail validation before rendering. Covered by Tasks 1, 3, and 6.
2. **Knowledge leaks:** a speaker cannot assert a fact they do not know. Covered by Task 3 and Task 11.
3. **Observation leaks:** observable World Truth is still hidden when location/channel conditions fail; offline phone information becomes deferred narrative rather than raw state. Covered by Task 5 and Task 11.
4. **Activity interruption:** only an eligible observed interrupt pauses an interruptible activity; hidden events do not. Covered by Tasks 4, 5, 7, and 11.
5. **Causal regression:** Prologue/narrative additions preserve WL-00..WL-07, 23:59 bells, and Day 1 00:00 loop end. Covered by Tasks 2, 6, 8, and 11.

---

## Locked File Structure

### Canonical story data
- Create `story/characters/{protagonist,zhixia,yuan,wakaharu,doctor,reporter,detective}.yaml`
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
- Create `tools/event-graph-viewer/tests/{narrativeLoader,characterBible,knowledgeValidation,activityRuntime,observationProjection,prologueNarrative,narrativeProjection,characterGraph,narrativeFoundationAcceptance}.test.ts`
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
- Produces `CharacterDefinition`, `RelationshipDefinition`, `KnowledgeFact`, `ActivityDefinition`, `ProtagonistScheduleDefinition`, `NarrativeSceneDefinition`, `ArtifactDefinition`, `NarrativeFoundation`.
- Extends `StoryBundle` with `narrative: NarrativeFoundation`.
- Manifest adds `characters`, `relationships`, `knowledge`, `activities`, `protagonist_schedule`, `narrative`, `artifacts`.

- [ ] **Step 1: Write the failing loader test with a complete local helper**

```ts
import { expect, it } from 'vitest';
import { buildStoryBundleFromDocuments } from '../src/lib/loadSimulationStory';

function minimalDocuments() {
  return {
    loop: { id: 'loop', range: { start: '14:20', end: { day: 1, time: '00:00' } } },
    initialState: { clock: { day: 0, time: '14:20' }, flags: {} },
    schedules: [],
    actions: { actions: [] },
    events: [],
    worldlines: { worldlines: [] },
    characters: [{
      id: 'protagonist', name: '主角', identity: {},
      background: { summary: '回鄉整理老家準備出售', history: [] },
      personality: { traits: [], habits: [], dislikes: [] },
      speech: { tone: 'quiet', calls: {} }, knowledge: { initial: [], hidden: [] }, secrets: [],
    }],
    relationships: { relationships: [] },
    knowledge: { facts: [{ id: 'fact_zhixia_dead_five_years', summary: '林知夏五年前死亡' }] },
    activities: { activities: [] },
    protagonistSchedule: { character_id: 'protagonist', entries: [] },
    narrative: { scenes: [] },
    artifacts: [],
  };
}

it('loads narrative documents beside simulation data', () => {
  const bundle = buildStoryBundleFromDocuments(minimalDocuments());
  expect(bundle.narrative.characters.map(x => x.id)).toEqual(['protagonist']);
  expect(bundle.narrative.knowledgeFacts.map(x => x.id)).toEqual(['fact_zhixia_dead_five_years']);
  expect(bundle.narrative.protagonistSchedule.characterId).toBe('protagonist');
});
```

- [ ] **Step 2: Add a failing manifest-fetch test**

The manifest fixture is exactly:

```yaml
loop: loops/loop_01.yaml
world: world/loop_01_initial.yaml
schedules: []
actions: actions/loop_01_actions.yaml
events: []
worldlines: worldlines/loop_01_worldlines.yaml
characters:
  - characters/protagonist.yaml
relationships: relationships/loop_01.yaml
knowledge: knowledge/facts.yaml
activities: activities/protagonist.yaml
protagonist_schedule: schedules/protagonist.yaml
narrative: narrative/loop_01_prologue.yaml
artifacts:
  - artifacts/zhixia_letter.yaml
```

Assert each new path is fetched once.

- [ ] **Step 3: Verify RED locally**

```bash
cd tools/event-graph-viewer
npm test -- narrativeLoader.test.ts
```

Expected: FAIL because the new fields/types do not exist.

- [ ] **Step 4: Implement exact type boundary**

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
export type ProtagonistScheduleEntry = { id: string; at: StoryTimeInput; activityId: string };
export type ProtagonistScheduleDefinition = { characterId: 'protagonist'; entries: ProtagonistScheduleEntry[] };
```

Normalize `character_id` → `characterId` exactly as existing NPC schedule loading does, but keep the protagonist schedule inside `bundle.narrative`; do **not** append it to `definition.schedules`.

- [ ] **Step 5: Update `sync-story.mjs`**

Add exactly:

```js
'characters', 'relationships', 'knowledge', 'activities', 'narrative', 'artifacts'
```

`schedules` is already copied, so no workflow change is required.

- [ ] **Step 6: Verify GREEN + baseline**

```bash
npm test -- narrativeLoader.test.ts manifestLoader.test.ts
npm test
npm run build
```

- [ ] **Step 7: Push one GREEN commit, then wait for GitHub Actions success**

```text
feat: load narrative foundation data
```

---

### Task 2: Canonical Character Bible + relationships + facts

**Files:**
- Create: seven `story/characters/*.yaml` files
- Create: `story/relationships/loop_01.yaml`
- Create: `story/knowledge/facts.yaml`
- Test: `tools/event-graph-viewer/tests/characterBible.test.ts`

**Interfaces:**
- Stable IDs: `protagonist`, `zhixia`, `yuan`, `wakaharu`, `doctor`, `reporter`, `detective`.

- [ ] **Step 1: Write real-data failing tests**

```ts
import { expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

const byCharacter = (id: string) => {
  const character = loadRealStory().narrative.characters.find(item => item.id === id);
  if (!character) throw new Error(`Missing character ${id}`);
  return character;
};

it('defines the seven core characters exactly once', () => {
  expect(loadRealStory().narrative.characters.map(c => c.id).sort()).toEqual([
    'detective', 'doctor', 'protagonist', 'reporter', 'wakaharu', 'yuan', 'zhixia',
  ]);
});

it('locks the protagonist return-home premise', () => {
  const protagonist = byCharacter('protagonist');
  expect(protagonist.background.summary).toContain('整理');
  expect(protagonist.background.summary).toContain('出售');
  expect(protagonist.background.summary).not.toContain('收到信才回來');
});

it('uses only defined relationship endpoints and fact ids', () => {
  const story = loadRealStory();
  const characterIds = new Set(story.narrative.characters.map(c => c.id));
  const factIds = new Set(story.narrative.knowledgeFacts.map(f => f.id));
  for (const relation of story.narrative.relationships) {
    expect(characterIds.has(relation.from)).toBe(true);
    expect(characterIds.has(relation.to)).toBe(true);
  }
  for (const character of story.narrative.characters) {
    for (const fact of [...character.knowledge.initial, ...character.knowledge.hidden]) {
      expect(factIds.has(fact)).toBe(true);
    }
  }
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- characterBible.test.ts
```

- [ ] **Step 3: Create canonical data**

Every character file contains `identity`, `background`, `personality`, `speech`, `knowledge`, `secrets`, and `schedule_ref` when applicable.

Minimum directional relationships:

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

- [ ] **Step 4: Verify GREEN + simulation regression**

```bash
npm test -- characterBible.test.ts storySimulationAcceptance.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push GREEN commit and wait for CI**

```text
feat: add canonical character bible
```

---

### Task 3: Knowledge validation

**Files:**
- Create: `tools/event-graph-viewer/src/narrative/knowledge.ts`
- Create: `tools/event-graph-viewer/src/narrative/validation.ts`
- Test: `tools/event-graph-viewer/tests/knowledgeValidation.test.ts`

**Interfaces:**
- Produces `characterKnowsFact(character, factId): boolean`.
- Produces `validateNarrativeFoundation(story): void`.

- [ ] **Step 1: Write failing tests with a complete fixture**

```ts
import { expect, it } from 'vitest';
import { validateNarrativeFoundation } from '../src/narrative/validation';
import type { NarrativeFoundation } from '../src/narrative/types';

function fixture(): NarrativeFoundation {
  return {
    characters: [{
      id: 'yuan', name: '周予安', identity: {},
      background: { summary: '', history: [] },
      personality: { traits: [], habits: [], dislikes: [] },
      speech: { tone: 'casual', calls: {} },
      knowledge: { initial: ['fact_zhixia_dead_five_years'], hidden: [] }, secrets: [],
    }],
    relationships: [],
    knowledgeFacts: [
      { id: 'fact_zhixia_dead_five_years', summary: '林知夏五年前死亡' },
      { id: 'fact_research_institute_truth', summary: '研究所真相' },
    ],
    activities: [],
    protagonistSchedule: { characterId: 'protagonist', entries: [] },
    artifacts: [],
    scenes: [{
      id: 'scene_1', at: '14:40', kind: 'dialogue', participants: ['yuan'],
      blocks: [{ type: 'dialogue', speaker: 'yuan', text: '我知道研究所的事。', factId: 'fact_research_institute_truth' }],
      observation: { channel: 'present' },
    }],
  };
}

it('rejects dialogue that exposes a fact the speaker does not know', () => {
  expect(() => validateNarrativeFoundation(fixture())).toThrow(
    'Scene scene_1: character yuan does not know fact fact_research_institute_truth',
  );
});
```

Add concrete duplicate/unknown tests:

```ts
it('rejects duplicate fact ids', () => {
  const data = fixture();
  data.knowledgeFacts.push({ ...data.knowledgeFacts[0] });
  expect(() => validateNarrativeFoundation(data)).toThrow('Duplicate knowledge fact: fact_zhixia_dead_five_years');
});

it('rejects an unknown participant', () => {
  const data = fixture();
  data.scenes[0].participants = ['unknown'];
  expect(() => validateNarrativeFoundation(data)).toThrow('Scene scene_1: unknown character unknown');
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- knowledgeValidation.test.ts
```

- [ ] **Step 3: Implement exact validation**

`characterKnowsFact` checks authored `initial` + `hidden` fact IDs only. Do not infer facts from prose or relationships.

- [ ] **Step 4: Verify GREEN + full suite/build**

```bash
npm test -- knowledgeValidation.test.ts characterBible.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push GREEN commit; wait for CI**

```text
feat: validate character knowledge
```

---

### Task 4: Diegetic Idle Activity model + protagonist baseline schedule

**Files:**
- Create: `story/activities/protagonist.yaml`
- Create: `story/schedules/protagonist.yaml`
- Create: `tools/event-graph-viewer/src/narrative/activity.ts`
- Test: `tools/event-graph-viewer/tests/activityRuntime.test.ts`

**Interfaces:**
- Produces `startActivity(activityId, startedAt, definition): ActivityRun`.
- Produces `advanceActivity(run, targetMinute, interruptions): ActivityRun`.
- `ActivityRun.status`: `running | interrupted | complete`.

- [ ] **Step 1: Write failing runtime tests**

```ts
import { expect, it } from 'vitest';
import { advanceActivity, startActivity } from '../src/narrative/activity';

const reading = { id: 'rest_and_read', durationMinutes: 20, interruptible: true,
  presentation: { start: '我泡了杯茶。', idle: '正在看書……', complete: '我把書闔上。' } };

it('advances by canonical world minutes', () => {
  const run = startActivity('rest_and_read', 930, reading);
  expect(advanceActivity(run, 949, []).status).toBe('running');
  expect(advanceActivity(run, 950, []).status).toBe('complete');
});

it('does not interrupt for hidden world activity', () => {
  const run = startActivity('rest_and_read', 930, reading);
  const next = advanceActivity(run, 940, [{ minute: 940, visibility: 'hidden', observable: false, sceneId: 'hidden_scene' }]);
  expect(next.status).toBe('running');
});

it('interrupts and retains remaining minutes for an eligible observed event', () => {
  const run = startActivity('rest_and_read', 930, reading);
  const next = advanceActivity(run, 940, [{ minute: 940, visibility: 'observable', observable: true, sceneId: 'phone_call' }]);
  expect(next.status).toBe('interrupted');
  expect(next.consumedMinutes).toBe(10);
  expect(next.remainingMinutes).toBe(10);
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- activityRuntime.test.ts
```

- [ ] **Step 3: Implement the pure runtime**

```ts
export type ActivityRun = {
  activityId: string;
  startedAt: number;
  durationMinutes: number;
  consumedMinutes: number;
  remainingMinutes: number;
  status: 'running' | 'interrupted' | 'complete';
};
```

No `Date.now()`, localStorage, DOM, or React usage in this module.

- [ ] **Step 4: Create activity and protagonist baseline schedule data**

Activity IDs:

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

Baseline schedule must include at minimum:

```yaml
character_id: protagonist
entries:
  - { id: protagonist_arrive, at: "14:20", activity_id: walk_home }
  - { id: protagonist_groceries, at: "14:30", activity_id: buy_groceries }
  - { id: protagonist_clean_house, at: "15:00", activity_id: clean_old_house }
  - { id: protagonist_read, at: "15:30", activity_id: rest_and_read }
  - { id: protagonist_sort_mail, at: "15:50", activity_id: sort_mail }
  - { id: protagonist_prepare_dinner, at: "17:20", activity_id: prepare_dinner }
```

- [ ] **Step 5: Verify GREEN + Story Simulation unchanged**

```bash
npm test -- activityRuntime.test.ts storySimulationAcceptance.test.ts
npm test
npm run build
```

- [ ] **Step 6: Push GREEN commit; wait for CI**

```text
feat: add diegetic idle activities
```

---

### Task 5: Observation projection

**Files:**
- Create: `tools/event-graph-viewer/src/narrative/observation.ts`
- Test: `tools/event-graph-viewer/tests/observationProjection.test.ts`

**Interfaces:**
- `ObservationChannel = 'present' | 'phone' | 'artifact' | 'deferred'`.
- `ObservationContext = { protagonistLocation, online, channels, minute }`.
- Produces `canObserve(entry, rule, context)` and `projectObservation(entry, rule, context)`.

- [ ] **Step 1: Write failing leak-prevention tests with explicit fixtures**

```ts
const stationEntry = {
  sequence: 1, day: 0, time: '18:31', absoluteMinute: 1111, minute: 1111,
  kind: 'event' as const, visibility: 'observable' as const,
  eventId: 'evt_1831_station', variantId: 'wakaharu_dies', title: '18:31 車站事件',
};

it('does not expose a present-only event when protagonist is elsewhere', () => {
  expect(canObserve(stationEntry, { channel: 'present', location: 'old_station' }, {
    protagonistLocation: 'old_house', online: true, channels: ['present'], minute: 1111,
  })).toBe(false);
});

it('projects an offline phone event as deferred narrative without raw changes', () => {
  const result = projectObservation(stationEntry, { channel: 'phone', offlineMode: 'deferred' }, {
    protagonistLocation: 'old_house', online: false, channels: ['phone'], minute: 1120,
  });
  expect(result).toEqual(expect.objectContaining({ channel: 'deferred', sourceId: 'evt_1831_station' }));
  expect('changes' in (result ?? {})).toBe(false);
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- observationProjection.test.ts
```

- [ ] **Step 3: Implement declarative rule evaluation**

No event-ID-specific branching is allowed in `observation.ts`.

- [ ] **Step 4: Verify GREEN + visibility regressions**

```bash
npm test -- observationProjection.test.ts visibilityProjection.test.ts storyWorldlineDiff.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push GREEN commit; wait for CI**

```text
feat: project observable narrative information
```

---

### Task 6: Narrative Scene + Artifact data and validation

**Files:**
- Extend: `tools/event-graph-viewer/src/narrative/types.ts`
- Extend: `tools/event-graph-viewer/src/narrative/validation.ts`
- Create: `story/artifacts/zhixia_letter.yaml`
- Create: `story/narrative/loop_01_prologue.yaml`
- Test: `tools/event-graph-viewer/tests/prologueNarrative.test.ts`

**Interfaces:**
- `NarrativeSceneDefinition = { id, at, kind, participants, blocks, observation, startsActivity?, artifactId? }`.
- `ArtifactDefinition = { id, kind, author, formedAt, content, presentation }`.

- [ ] **Step 1: Write failing structure tests**

```ts
import { expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

const sceneIndex = (id: string) => {
  const index = loadRealStory().narrative.scenes.findIndex(scene => scene.id === id);
  if (index < 0) throw new Error(`Missing scene ${id}`);
  return index;
};

it('places ordinary life before the impossible letter', () => {
  const scenes = loadRealStory().narrative.scenes;
  expect(scenes.find(s => s.id === 'prologue_arrival')?.at).toEqual({ day: 0, time: '14:20' });
  expect(scenes.find(s => s.id === 'prologue_yuan_reunion')?.at).toEqual({ day: 0, time: '14:40' });
  expect(scenes.find(s => s.id === 'prologue_letter_discovery')?.at).toEqual({ day: 0, time: '16:00' });
  expect(sceneIndex('prologue_letter_discovery')).toBeGreaterThan(sceneIndex('prologue_rest_and_read'));
});

it('does not leak mystery vocabulary before the letter', () => {
  const text = loadRealStory().narrative.scenes
    .filter(scene => sceneIndex(scene.id) < sceneIndex('prologue_letter_discovery'))
    .flatMap(scene => scene.blocks.map(block => block.text ?? ''))
    .join('\n');
  expect(text).not.toMatch(/18:31|輪迴|研究所真相/);
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- prologueNarrative.test.ts
```

- [ ] **Step 3: Author exact Prologue scene order**

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

Ordinary-life scenes may contain details with no mystery payoff. First Yuan appearance establishes his relationship before shorthand `予安` is used.

- [ ] **Step 4: Author the letter artifact**

```yaml
id: zhixia_letter
kind: letter
author: zhixia
formed_at: { day: 0, time: "16:00" }
content:
  - 回來一趟。
  - 這一次，先別來找我。
  - 如果午夜的鐘聲響起，就代表又失敗了。
presentation:
  object: envelope_and_letter
```

No excerpt list, preselected important sentences, or `+` action exists in artifact data.

- [ ] **Step 5: Add unknown-reference validation tests**

```ts
it('rejects an unknown artifact reference', () => {
  const story = loadRealStory();
  const copy = structuredClone(story.narrative);
  copy.scenes[0].artifactId = 'missing_artifact';
  expect(() => validateNarrativeFoundation(copy)).toThrow(/unknown artifact missing_artifact/);
});
```

Repeat the same pattern for `startsActivity` and unknown participant IDs.

- [ ] **Step 6: Verify GREEN + causal acceptance**

```bash
npm test -- prologueNarrative.test.ts knowledgeValidation.test.ts storySimulationAcceptance.test.ts
npm test
npm run build
```

- [ ] **Step 7: Push GREEN commit; wait for CI**

```text
feat: author Loop 01 narrative prologue
```

---

### Task 7: Deterministic Narrative Projection

**Files:**
- Create: `tools/event-graph-viewer/src/narrative/projection.ts`
- Test: `tools/event-graph-viewer/tests/narrativeProjection.test.ts`

**Interfaces:**
- Produces `NarrativeBeat`.
- Produces `projectNarrative(input): NarrativeBeat[]`.
- Same-minute order: authored scheduled scene → eligible observed interrupt → activity continuation/resume; authored ties remain stable.

- [ ] **Step 1: Write failing deterministic tests using a local fixture builder**

```ts
function projectionInput() {
  return {
    story: loadRealStory(),
    fullHistory: [],
    context: { protagonistLocation: 'old_house', online: true, channels: ['present', 'phone'], minute: 950 },
    activeActivity: startActivity('rest_and_read', 930, activityById(loadRealStory(), 'rest_and_read')),
    consumedSceneIds: new Set<string>(),
  };
}

it('is deterministic for identical input', () => {
  const first = projectNarrative(projectionInput());
  const second = projectNarrative(projectionInput());
  expect(first).toEqual(second);
});

it('does not enqueue hidden reporter movement', () => {
  const input = projectionInput();
  input.fullHistory = [{
    sequence: 1, day: 0, time: '19:50', absoluteMinute: 1190, minute: 1190,
    kind: 'schedule', visibility: 'hidden', title: 'reporter_enter_old_lab',
    scheduleEntryId: 'reporter_enter_old_lab', scheduleStatus: 'applied', characterId: 'reporter',
  }];
  const beats = projectNarrative(input);
  expect(beats.some(beat => beat.sourceId === 'reporter_enter_old_lab')).toBe(false);
});
```

`activityById` is defined in the test as:

```ts
const activityById = (story: StoryBundle, id: string) => {
  const activity = story.narrative.activities.find(item => item.id === id);
  if (!activity) throw new Error(`Missing activity ${id}`);
  return activity;
};
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- narrativeProjection.test.ts
```

- [ ] **Step 3: Implement pure projection**

No React state, DOM, localStorage, or real timestamp access.

- [ ] **Step 4: Add explicit interruption/resume test**

At minute 940, an observed phone beat interrupts `rest_and_read`; after consuming the scene, resume keeps `remainingMinutes === 10`.

- [ ] **Step 5: Verify GREEN**

```bash
npm test -- narrativeProjection.test.ts activityRuntime.test.ts observationProjection.test.ts
npm test
npm run build
```

- [ ] **Step 6: Push GREEN commit; wait for CI**

```text
feat: project deterministic narrative beats
```

---

### Task 8: Reconcile Prologue with canonical Event Graph

**Files:**
- Modify only if required: `story/events/loop_01_1420.yaml`, `story/events/loop_01_1500.yaml`, `story/events/loop_01_1610.yaml`
- Modify: `tools/event-graph-viewer/tests/storySimulationAcceptance.test.ts`

**Interfaces:**
- Ordinary life remains Narrative/Activity data, not Event Graph data.

- [ ] **Step 1: Add exact causal regression map**

```ts
const stationVariants: Record<string, string> = {
  'WL-00': 'wakaharu_dies',
  'WL-01': 'wakaharu_dies',
  'WL-02': 'wakaharu_dies',
  'WL-03': 'wakaharu_dies',
  'WL-04': 'doctor_dies',
  'WL-05': 'wakaharu_dies',
  'WL-06': 'no_death',
  'WL-07': 'doctor_dies',
};

it.each(Object.keys(stationVariants))('%s preserves the approved station outcome', id => {
  const result = simulateNamedWorldline(loadRealStory(), id);
  expect(result.fullHistory.find(e => e.eventId === 'evt_1831_station')?.variantId).toBe(stationVariants[id]);
  expect(result.fullHistory.find(e => e.eventId === 'evt_2359_midnight_bells')?.absoluteMinute).toBe(1439);
  expect(result.fullHistory.find(e => e.eventId === 'evt_0000_loop_end')?.absoluteMinute).toBe(1440);
});
```

- [ ] **Step 2: Verify this regression is GREEN before editing event YAML**

```bash
npm test -- storySimulationAcceptance.test.ts
```

- [ ] **Step 3: Compare existing 14:20/15:00/16:10 event semantics against the new Prologue**

If `evt_1500_sister_room` claims an investigation that no longer occurs, reframe its title/variant to a neutral old-house arrival event. Keep IDs if possible so downstream references remain stable. If an ID changes, update every manifest/test reference in the same commit.

- [ ] **Step 4: Verify all real-story regressions**

```bash
npm test -- storySimulationAcceptance.test.ts prologueNarrative.test.ts worldlineDefinitions.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push only if a production change was required; wait for CI**

```text
refactor: align Loop 01 events with narrative foundation
```

Do not create an empty commit if the existing events are already compatible.

---

### Task 9: Character Graph projection

**Files:**
- Create: `tools/event-graph-viewer/src/narrative/characterGraph.ts`
- Modify: `tools/event-graph-viewer/src/types/story.ts`
- Test: `tools/event-graph-viewer/tests/characterGraph.test.ts`

**Interfaces:**
- Produces `CharacterGraphMode = 'public' | 'author' | 'player-known'`.
- Produces `CharacterGraphProjection` and `projectCharacterGraph(story, mode, playerKnownFactIds?)`.

- [ ] **Step 1: Write failing graph tests**

```ts
it('keeps opposite directional relationships as separate edges', () => {
  const graph = projectCharacterGraph(loadRealStory(), 'author');
  expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'protagonist', target: 'yuan', type: 'old_friend' }));
  expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'yuan', target: 'protagonist', type: 'concerned_friend' }));
});

it('hides author-only relationships in public mode', () => {
  const graph = projectCharacterGraph(loadRealStory(), 'public');
  expect(graph.edges.some(edge => edge.visibility === 'author')).toBe(false);
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- characterGraph.test.ts
```

- [ ] **Step 3: Implement projection without React dependencies**

Selected-character detail includes background, visible directional relationships, visible knowledge IDs, secrets only in author mode, schedule reference, and narrative appearance IDs.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- characterGraph.test.ts
npm test
npm run build
```

- [ ] **Step 5: Push GREEN commit; wait for CI**

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
- `ViewName = 'graph' | 'characters' | 'timeline' | 'diff'`.
- Character Graph consumes `CharacterGraphProjection` only and never mutates YAML.

- [ ] **Step 1: Write failing Viewer test**

```tsx
it('opens Character Graph and shows the protagonist–Yuan relationship', async () => {
  stubRealStoryFetch();
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Character Graph' }));
  expect(await screen.findByText('周予安')).toBeTruthy();
  expect(screen.getByText(/高中同學/)).toBeTruthy();
});
```

- [ ] **Step 2: Write failing visibility-mode test**

```tsx
it('reveals author-only relationships only in Author Truth mode', async () => {
  stubRealStoryFetch();
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Character Graph' }));
  fireEvent.click(screen.getByRole('button', { name: 'Public' }));
  expect(screen.queryByText(/不擅長談姊姊的死亡/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Author Truth' }));
  expect(await screen.findByText(/不擅長談姊姊的死亡/)).toBeTruthy();
});
```

- [ ] **Step 3: Verify RED**

```bash
npm test -- App.test.tsx characterGraph.test.ts
```

- [ ] **Step 4: Implement the minimal author UI**

Use existing `@xyflow/react`; keep Event Graph code path intact. Character Graph has its own nodes/edges and selected-character detail panel.

- [ ] **Step 5: Verify GREEN + build**

```bash
npm test -- App.test.tsx characterGraph.test.ts
npm test
npm run build
```

- [ ] **Step 6: Push GREEN commit; wait for GitHub Actions**

```text
feat: add Character Graph author view
```

---

### Task 11: Full Narrative Foundation acceptance gate

**Files:**
- Create: `tools/event-graph-viewer/tests/narrativeFoundationAcceptance.test.ts`

**Interfaces:** No new production interfaces.

- [ ] **Step 1: Add concrete real-data acceptance tests**

```ts
import { expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';
import { projectCharacterGraph } from '../src/narrative/characterGraph';
import { projectNarrative } from '../src/narrative/projection';
import { simulateNamedWorldline } from '../src/simulator/storySimulation';

it('keeps ordinary life before the mystery starts', () => {
  const story = loadRealStory();
  const letter = story.narrative.scenes.findIndex(scene => scene.id === 'prologue_letter_discovery');
  const before = story.narrative.scenes.slice(0, letter).flatMap(scene => scene.blocks.map(block => block.text ?? '')).join('\n');
  expect(before).toMatch(/灰潮鎮|老家|予安|整理/);
  expect(before).not.toMatch(/18:31|輪迴|研究所真相/);
});

it('introduces Yuan as a known person before shorthand narrative uses his given name', () => {
  const scene = loadRealStory().narrative.scenes.find(item => item.id === 'prologue_yuan_reunion');
  const text = scene?.blocks.map(block => block.text ?? '').join('\n') ?? '';
  expect(text).toMatch(/周予安/);
  expect(text).toMatch(/高中|同學|聯絡/);
});

it('never exposes author-only relations in public projection', () => {
  const graph = projectCharacterGraph(loadRealStory(), 'public');
  expect(graph.edges.some(edge => edge.visibility === 'author')).toBe(false);
});

it.each(['WL-00','WL-01','WL-02','WL-03','WL-04','WL-05','WL-06','WL-07'])('%s still reaches the invariant bells and loop end', id => {
  const result = simulateNamedWorldline(loadRealStory(), id);
  expect(result.fullHistory.find(e => e.eventId === 'evt_2359_midnight_bells')?.absoluteMinute).toBe(1439);
  expect(result.fullHistory.find(e => e.eventId === 'evt_0000_loop_end')?.absoluteMinute).toBe(1440);
});

it('produces deterministic narrative projection', () => {
  const story = loadRealStory();
  const input = {
    story,
    fullHistory: simulateNamedWorldline(story, 'WL-00').fullHistory,
    context: { protagonistLocation: 'old_house', online: true, channels: ['present', 'phone'], minute: 960 },
    activeActivity: null,
    consumedSceneIds: new Set<string>(),
  };
  expect(projectNarrative(input)).toEqual(projectNarrative(input));
});
```

- [ ] **Step 2: Add an explicit hidden-interruption regression**

Use `rest_and_read` from Task 4 and a hidden `reporter_enter_old_lab` history row; assert projected beats contain no interrupt sourced from that row and the activity remains `running` until its authored completion minute.

- [ ] **Step 3: Run the complete local verification gate**

```bash
cd tools/event-graph-viewer
npm run sync-story
npm test
npm run build
```

Expected: all pass with no new skipped/disabled regression tests.

- [ ] **Step 4: Inspect changed files**

Expected: no `player.html`, no `src/player/**`, no Evidence Board migration, no legacy `VisibleRecord`, and no workflow-file change in this implementation.

- [ ] **Step 5: Push final GREEN acceptance commit**

```text
test: lock Narrative Foundation v0.1 acceptance
```

- [ ] **Step 6: Verify authoritative GitHub Actions**

`verify-viewer` must finish with:

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
feature/story-simulation-v0.2      known-green simulation base
        ↓
docs/narrative-foundation-v0.1     approved spec + plan
        ↓
feature/narrative-foundation-v0.1  implementation
```

Implementation PR targets `docs/narrative-foundation-v0.1` while stacked development is in progress. Do not merge or retarget to `main` during implementation.

## Final Review Gate

Narrative Foundation v0.1 is complete only when:

```text
Character Bible is canonical
+ Relationship Graph is directional
+ Knowledge references validate
+ protagonist activities consume world time
+ hidden events cannot leak or interrupt
+ observation projection handles present / phone / offline-deferred channels
+ Prologue 14:20–16:10 reads as ordinary life → unease → impossible letter
+ Story Simulation WL-00..WL-07 remains deterministic
+ Character Graph renders Public / Author Truth / Player Known
+ full tests and Vite build pass locally
+ latest GitHub Actions verify-viewer run is green
```

Only after this gate should a separate Player Narrative UI vertical-slice design begin.