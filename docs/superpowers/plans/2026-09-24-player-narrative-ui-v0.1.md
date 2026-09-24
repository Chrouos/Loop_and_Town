# Player Narrative UI v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first player-facing playable vertical slice from Loop 01 Day 0 14:20 through 18:31, using the approved Narrative Foundation and Story Simulation so ordinary life choices consume time, ambient prose reflects the protagonist's current activity, deadlines can be missed, and 18:31 outcomes are resolved only by the simulator.

**Architecture:** Keep Author Viewer and Player Game separate. Add a new `src/playerNarrative/` surface that consumes Narrative Foundation + Story Simulation through a deterministic runtime. The runtime stores player actions/reading state but replays World Truth from initial state + submitted actions + elapsed Story Time. Reuse the existing Vite multi-page entry and persistence/clock ideas only after reconciling current `main` with the Narrative Foundation stack.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest 2, Testing Library, js-yaml, existing Story Simulation/Narrative Foundation runtime. No Three.js dependency in v0.1.

**Spec:** `docs/superpowers/specs/2026-09-24-player-narrative-ui-v0.1-design.md`

## Global Constraints

- Player vertical slice is Loop 01 Day 0 14:20 → 18:31 only.
- Production semantics default to `1 real minute = 1 world minute`; story YAML never stores real timestamps.
- Scene reading never advances canonical Story Time.
- Activity, travel, waiting, explicit timed actions, and elapsed real time while the world is running can advance Story Time.
- Fixed world events such as 18:31 remain fixed; player-relative scenes shift when earlier activities consume time.
- Decision freeze exists only while the decision scene is actively open in the foreground session; it is never persisted across reload/offline time.
- Ordinary choices must have at least one observable effect: time, location, prose, reaction, player knowledge, later scene content, or later availability.
- Player UI never reveals author-only impact categories, hidden truth, causal graph edges, or future outcomes.
- Save data stores player actions/read state, not canonical death outcomes.
- 18:31 outcome must come from the existing Story Simulator, never from Player UI conditionals.
- No stamina, energy, XP, progress bars, countdown timer UI, Three.js, full map pathfinding, or AI-generated canonical prose.
- Do not modify `.github/workflows/**` unless a failing verification proves the existing workflow cannot validate the new player surface.
- Never push intentional RED commits to the GitHub PR branch. Each remote commit must be a GREEN candidate after targeted tests, full `npm test`, and `npm run build`.
- After every dependent integration batch, wait for a fresh GitHub Actions GREEN run before stacking the next batch.

## Review Focus

1. **Branch integration drift:** current `main` and the Narrative Foundation stack are diverged; integration must preserve current main player entry/build behavior while adding the validated simulator/foundation without silently dropping either side.
2. **Foreground freeze vs offline time:** a decision opened at 17:55 may be read slowly in the current session, but a reload at 18:08 must re-project the 18:08 options rather than resurrect the 17:55 choice set.
3. **Relative life timing vs fixed world timing:** buying coffee can move protagonist-relative scenes later while 18:31 remains fixed and can occur before late travel completes.
4. **Observation persistence:** local sightings are missable forever; phone messages persist; calls become missed calls; hidden events never leak into player narrative.
5. **Ordinary choice legitimacy:** every visible choice must change at least one player-observable dimension even when it has no causal effect on the 18:31 worldline result.

---

## Planned File Structure

```text
story/
  activities/protagonist.yaml                # add ambient beats + context variants
  choices/loop_01_player.yaml                # player-visible choices and availability
  travel/loop_01.yaml                        # authored location-to-location durations
  narrative/loop_01_prologue.yaml            # existing 14:20–16:10 scenes, converted to relative flow where needed
  narrative/loop_01_1610_1831.yaml           # player-facing scenes after the letter
  manifests/loop_01.yaml                     # reference new choice/travel/narrative data

tools/event-graph-viewer/
  player.html                                 # retained entry page, repointed to new narrative player entry
  vite.config.ts                              # preserve viewer + player multi-page build
  src/narrative/
    types.ts                                  # extend story types for ambient/choice/travel/persistence
    activity.ts                               # ambient beat projection
    observation.ts                            # persistence-aware projection
    projection.ts                             # deterministic narrative queue inputs
  src/lib/loadSimulationStory.ts              # load/validate choice + travel + additional scenes
  src/playerNarrative/
    main.tsx                                  # player entry
    PlayerNarrativeApp.tsx                    # top-level player surface
    playerNarrative.css                       # quiet novel-first presentation
    model.ts                                  # PlayerSession and runtime-facing types
    clock.ts                                  # injectable real/fake clock mapping
    storage.ts                                # versioned localStorage save
    runtime.ts                                # deterministic replay/reconcile orchestration
    queue.ts                                  # player narrative queue ordering
    choices.ts                                # availability/deadline evaluation
    travel.ts                                 # authored travel feasibility runtime
    inbox.ts                                  # phone persistence/missed-call handling
    components/
      NarrativeSurface.tsx
      ActivitySurface.tsx
      ArtifactSurface.tsx
      ChoiceSurface.tsx
      InterruptSurface.tsx
      CharacterDrawer.tsx
  tests/
    integrationBaseline.test.ts
    playerNarrativeClock.test.ts
    playerNarrativeStorage.test.ts
    ambientActivity.test.ts
    observationPersistence.test.ts
    choiceDeadline.test.ts
    travelRuntime.test.ts
    playerNarrativeQueue.test.ts
    playerNarrativeRuntime.test.ts
    playerNarrativeUi.test.tsx
    playerNarrativeStoryAcceptance.test.ts
    playerNarrative1831Acceptance.test.ts
```

---

### Task 1: Deliberate integration baseline

**Files:**
- Merge/reconcile: current `main`
- Merge/reconcile: `docs/narrative-foundation-v0.1`
- Verify: `tools/event-graph-viewer/vite.config.ts`
- Verify: `tools/event-graph-viewer/player.html`
- Verify: `tools/event-graph-viewer/src/player/**`
- Test: `tools/event-graph-viewer/tests/integrationBaseline.test.ts`

**Interfaces:**
- Consumes: current `main` old Player prototype and the known-green Narrative Foundation stack.
- Produces: an integration branch containing both current `main` history and Narrative Foundation, with viewer/player build entries intact and no implementation of the new player narrative behavior yet.

- [ ] **Step 1: Create an isolated integration branch/worktree**

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c integration/player-narrative-ui-v0.1
```

- [ ] **Step 2: Merge the Narrative Foundation branch deliberately**

```bash
git merge --no-ff origin/docs/narrative-foundation-v0.1
```

Resolve conflicts with these rules:

```text
story/** and src/narrative/**: Narrative Foundation wins where semantics conflict.
current main player.html / multi-page build wiring: preserve until Task 10 repoints it.
old src/player/**: preserve temporarily; do not copy its hard-coded 18:00 semantics into new runtime.
.github/workflows/**: preserve current main unchanged.
```

- [ ] **Step 3: Add a baseline test that proves both surfaces still exist**

Create `tools/event-graph-viewer/tests/integrationBaseline.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

describe('player narrative integration baseline', () => {
  it('keeps current player entry while loading narrative foundation', () => {
    expect(existsSync(resolve(process.cwd(), 'player.html'))).toBe(true);
    const story = loadRealStory();
    expect(story.narrative.characters.length).toBeGreaterThanOrEqual(7);
    expect(story.narrative.scenes.some((scene) => scene.id.includes('prologue'))).toBe(true);
  });
});
```

- [ ] **Step 4: Run integration baseline verification**

Run from `tools/event-graph-viewer`:

```bash
npm run sync-story
npm test -- integrationBaseline.test.ts
npm test
npm run build
```

Expected: all commands exit 0; Vite produces both viewer and player entries.

- [ ] **Step 5: Commit the integration baseline**

```bash
git add .
git commit -m "chore: reconcile player narrative integration baseline"
```

- [ ] **Step 6: Push and wait for CI**

```bash
git push -u origin integration/player-narrative-ui-v0.1
```

Do not start Task 2 until GitHub Actions shows `Sync story data`, `Run tests`, and `Build viewer` all PASS for this exact head.

---

### Task 2: Player session, clock, and versioned persistence

**Files:**
- Create: `tools/event-graph-viewer/src/playerNarrative/model.ts`
- Create: `tools/event-graph-viewer/src/playerNarrative/clock.ts`
- Create: `tools/event-graph-viewer/src/playerNarrative/storage.ts`
- Test: `tools/event-graph-viewer/tests/playerNarrativeClock.test.ts`
- Test: `tools/event-graph-viewer/tests/playerNarrativeStorage.test.ts`

**Interfaces:**
- Consumes: `toAbsoluteMinute(StoryTimeInput)` from `src/simulator/time.ts`.
- Produces:
  - `PlayerSessionV2`
  - `StoryClock` with `nowMs(): number`
  - `storyMinuteAt(anchorMs: number, nowMs: number): number`
  - `createInitialPlayerSession(nowMs: number): PlayerSessionV2`
  - `readPlayerSession(storage, nowMs): PlayerSessionV2`
  - `writePlayerSession(storage, session): boolean`

- [ ] **Step 1: Write clock tests**

Create `tests/playerNarrativeClock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LOOP_START_MINUTE, storyMinuteAt } from '../src/playerNarrative/clock';

describe('player narrative clock', () => {
  it('maps production time 1 real minute to 1 world minute from 14:20', () => {
    const anchor = Date.UTC(2026, 8, 24, 6, 20);
    expect(LOOP_START_MINUTE).toBe(14 * 60 + 20);
    expect(storyMinuteAt(anchor, anchor)).toBe(860);
    expect(storyMinuteAt(anchor, anchor + 17 * 60_000)).toBe(877);
  });

  it('never moves backward when wall clock is before anchor', () => {
    expect(storyMinuteAt(10_000, 5_000)).toBe(860);
  });
});
```

- [ ] **Step 2: Run clock test and verify RED locally**

```bash
npm test -- playerNarrativeClock.test.ts
```

Expected local RED: module `src/playerNarrative/clock` does not exist.

- [ ] **Step 3: Implement injectable clock mapping**

Create `src/playerNarrative/clock.ts`:

```ts
export const REAL_MINUTE_MS = 60_000;
export const LOOP_START_MINUTE = 14 * 60 + 20;

export type StoryClock = { nowMs(): number };

export const RealClock: StoryClock = { nowMs: () => Date.now() };

export function storyMinuteAt(anchorMs: number, nowMs: number): number {
  const elapsed = Math.max(0, nowMs - anchorMs);
  return LOOP_START_MINUTE + Math.floor(elapsed / REAL_MINUTE_MS);
}

export function createFakeClock(initialMs: number) {
  let current = initialMs;
  return {
    nowMs: () => current,
    advanceMinutes(minutes: number) {
      current += minutes * REAL_MINUTE_MS;
    },
    setMs(value: number) {
      current = value;
    },
  };
}
```

- [ ] **Step 4: Write persistence tests**

Create `tests/playerNarrativeStorage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { readPlayerSession, writePlayerSession } from '../src/playerNarrative/storage';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe('player narrative storage', () => {
  it('stores player actions/read state without canonical death outcomes', () => {
    const storage = new MemoryStorage();
    const session = createInitialPlayerSession(1_000);
    session.submittedActionIds.push('send_yuan_to_post_office');
    session.consumedSceneIds.push('scene_letter_opened');
    expect(writePlayerSession(storage, session)).toBe(true);
    const loaded = readPlayerSession(storage, 2_000);
    expect(loaded.submittedActionIds).toEqual(['send_yuan_to_post_office']);
    expect(JSON.stringify(loaded)).not.toContain('wakaharuDies');
    expect(JSON.stringify(loaded)).not.toContain('doctorDies');
  });

  it('does not persist foreground decision freeze', () => {
    const storage = new MemoryStorage();
    const session = createInitialPlayerSession(1_000);
    session.foregroundDecision = { sceneId: 'scene_message', frozenMinute: 1075 };
    writePlayerSession(storage, session);
    expect(readPlayerSession(storage, 2_000).foregroundDecision).toBeNull();
  });
});
```

- [ ] **Step 5: Implement the session model**

Create `src/playerNarrative/model.ts`:

```ts
import type { ActivityRun } from '../narrative/activity';

export type ForegroundDecision = { sceneId: string; frozenMinute: number };

export type PlayerSessionV2 = {
  version: 2;
  realTimeAnchorMs: number;
  lastSeenRealTimeMs: number;
  currentLocation: string;
  activeActivity: ActivityRun | null;
  consumedSceneIds: string[];
  openedArtifactIds: string[];
  submittedActionIds: string[];
  knownFactIds: string[];
  inboxItemIds: string[];
  foregroundDecision: ForegroundDecision | null;
};

export function createInitialPlayerSession(nowMs: number): PlayerSessionV2 {
  return {
    version: 2,
    realTimeAnchorMs: nowMs,
    lastSeenRealTimeMs: nowMs,
    currentLocation: 'ash_tide_station',
    activeActivity: null,
    consumedSceneIds: [],
    openedArtifactIds: [],
    submittedActionIds: [],
    knownFactIds: ['fact_zhixia_dead_five_years'],
    inboxItemIds: [],
    foregroundDecision: null,
  };
}
```

- [ ] **Step 6: Implement versioned storage**

Create `src/playerNarrative/storage.ts`:

```ts
import { createInitialPlayerSession, type PlayerSessionV2 } from './model';

export const PLAYER_NARRATIVE_SAVE_KEY = 'ash-town-player-narrative-v2';

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

export function readPlayerSession(storage: ReadStorage, nowMs: number): PlayerSessionV2 {
  try {
    const raw = storage.getItem(PLAYER_NARRATIVE_SAVE_KEY);
    if (!raw) return createInitialPlayerSession(nowMs);
    const parsed = JSON.parse(raw) as PlayerSessionV2;
    if (parsed.version !== 2) return createInitialPlayerSession(nowMs);
    return { ...parsed, foregroundDecision: null };
  } catch {
    return createInitialPlayerSession(nowMs);
  }
}

export function writePlayerSession(storage: WriteStorage, session: PlayerSessionV2): boolean {
  try {
    const persisted = { ...session, foregroundDecision: null };
    storage.setItem(PLAYER_NARRATIVE_SAVE_KEY, JSON.stringify(persisted));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 7: Run GREEN verification and commit**

```bash
npm test -- playerNarrativeClock.test.ts playerNarrativeStorage.test.ts
npm test
npm run build
git add tools/event-graph-viewer/src/playerNarrative tools/event-graph-viewer/tests/playerNarrativeClock.test.ts tools/event-graph-viewer/tests/playerNarrativeStorage.test.ts
git commit -m "feat: add player narrative session clock and storage"
```

Push, then wait for fresh GitHub Actions GREEN before Task 3.

---

### Task 3: Extend authored data for ambient beats, choices, travel, and persistence

**Files:**
- Modify: `story/activities/protagonist.yaml`
- Create: `story/choices/loop_01_player.yaml`
- Create: `story/travel/loop_01.yaml`
- Modify: `story/manifests/loop_01.yaml`
- Modify: `tools/event-graph-viewer/src/narrative/types.ts`
- Modify: `tools/event-graph-viewer/src/lib/loadSimulationStory.ts`
- Modify: `tools/event-graph-viewer/scripts/sync-story.mjs`
- Test: `tools/event-graph-viewer/tests/playerNarrativeStoryData.test.ts`

**Interfaces:**
- Consumes: existing `NarrativeFoundation` loader.
- Produces:
  - `AmbientBeatDefinition`
  - `PlayerChoiceDefinition`
  - `TravelEdgeDefinition`
  - `ObservationPersistence = 'ephemeral' | 'message' | 'missed-call' | 'artifact'`
  - loaded `playerChoices` and `travelEdges` in real story data.

- [ ] **Step 1: Write story-data schema tests**

Create `tests/playerNarrativeStoryData.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

describe('player narrative authored data', () => {
  it('loads ambient beats with ordered offsets', () => {
    const story = loadRealStory();
    const reading = story.narrative.activities.find((item) => item.id === 'rest_and_read');
    expect(reading?.ambient?.map((beat) => beat.atMinute)).toEqual([5, 11, 17]);
  });

  it('loads player choices without exposing author impact classification', () => {
    const story = loadRealStory();
    const choice = story.playerChoices.find((item) => item.id === 'arrival_coffee');
    expect(choice?.label).toBe('先去買杯咖啡');
    expect(choice).not.toHaveProperty('impactType');
  });

  it('loads authored travel durations', () => {
    const story = loadRealStory();
    expect(story.travelEdges.some((edge) => edge.from === 'old_house' && edge.to === 'old_station' && edge.minutes === 22)).toBe(true);
  });
});
```

- [ ] **Step 2: Extend TypeScript story types**

Add to `src/narrative/types.ts`:

```ts
export type AmbientBeatDefinition = {
  id: string;
  atMinute: number;
  text: string;
  requiresFacts?: string[];
};

export type ObservationPersistence = 'ephemeral' | 'message' | 'missed-call' | 'artifact';

export type PlayerChoiceEffect =
  | { type: 'start-activity'; activityId: string }
  | { type: 'submit-action'; actionId: string }
  | { type: 'travel'; to: string }
  | { type: 'learn-fact'; factId: string }
  | { type: 'consume-time'; minutes: number };

export type PlayerChoiceDefinition = {
  id: string;
  sceneId: string;
  label: string;
  availableFrom?: number;
  availableUntil?: number;
  requiresFacts?: string[];
  effects: PlayerChoiceEffect[];
};

export type TravelEdgeDefinition = { from: string; to: string; minutes: number };
```

Extend `ActivityDefinition` with:

```ts
ambient?: AmbientBeatDefinition[];
```

Extend `NarrativeObservationRule` with:

```ts
persistence?: ObservationPersistence;
```

Extend the real-story loaded result in `loadSimulationStory.ts` with:

```ts
playerChoices: PlayerChoiceDefinition[];
travelEdges: TravelEdgeDefinition[];
```

- [ ] **Step 3: Author ambient beats**

Extend `story/activities/protagonist.yaml` for `rest_and_read`:

```yaml
    ambient:
      - id: read_motorbike
        at_minute: 5
        text: 樓下有人騎機車經過。聲音沿著巷子慢慢遠了。
      - id: read_tea_cooling
        at_minute: 11
        text: 茶已經沒有剛才那麼燙了。
      - id: read_same_paragraph
        at_minute: 17
        text: 我讀了三頁，才發現同一段看了兩次。
```

Add state-aware beats to `research_online`:

```yaml
    ambient:
      - id: research_old_news
        at_minute: 8
        text: 搜尋結果幾乎都是五年前的新聞。
      - id: research_postmark_memory
        at_minute: 18
        text: 我又想起那個郵戳。
        requires_facts:
          - fact_zhixia_letter_received
```

- [ ] **Step 4: Author first player choices**

Create `story/choices/loop_01_player.yaml`:

```yaml
choices:
  - id: arrival_coffee
    scene_id: scene_prologue_arrival
    label: 先去買杯咖啡
    effects:
      - type: consume-time
        minutes: 8
      - type: learn-fact
        fact_id: fact_cafe_resident_chatter
  - id: arrival_convenience_store
    scene_id: scene_prologue_arrival
    label: 去便利商店買水
    effects:
      - type: consume-time
        minutes: 6
      - type: learn-fact
        fact_id: fact_shopkeeper_mistook_protagonist_for_zhixia
  - id: arrival_home_direct
    scene_id: scene_prologue_arrival
    label: 直接回家
    effects:
      - type: travel
        to: old_house
  - id: letter_ask_yuan
    scene_id: scene_after_letter
    label: 問予安
    effects:
      - type: submit-action
        action_id: send_yuan_to_post_office
  - id: wakaharu_show_letter
    scene_id: scene_wakaharu_cafe
    label: 把信給她看
    effects:
      - type: submit-action
        action_id: show_letter_to_wakaharu
  - id: late_go_station
    scene_id: scene_1818_decision
    label: 直接去車站
    effects:
      - type: travel
        to: old_station
```

- [ ] **Step 5: Author travel graph**

Create `story/travel/loop_01.yaml`:

```yaml
travel:
  - from: ash_tide_station
    to: old_house
    minutes: 20
  - from: old_house
    to: old_station
    minutes: 22
  - from: old_house
    to: cafe
    minutes: 12
  - from: cafe
    to: old_station
    minutes: 14
  - from: old_house
    to: hospital
    minutes: 18
  - from: hospital
    to: old_station
    minutes: 13
```

- [ ] **Step 6: Wire manifest + sync + loader validation**

Add manifest keys:

```yaml
player_choices: ../choices/loop_01_player.yaml
travel: ../travel/loop_01.yaml
```

Update sync/load code to normalize snake_case YAML fields to the TypeScript types and reject:

```text
ambient beat offsets < 0
ambient beat offsets >= activity duration
choice references to unknown scene/action/activity/fact
travel minutes <= 0
travel edge with unknown/empty locations
```

- [ ] **Step 7: Run GREEN verification and commit**

```bash
npm run sync-story
npm test -- playerNarrativeStoryData.test.ts narrativeLoader.test.ts
npm test
npm run build
git add story tools/event-graph-viewer/src/narrative tools/event-graph-viewer/src/lib/loadSimulationStory.ts tools/event-graph-viewer/scripts/sync-story.mjs tools/event-graph-viewer/tests/playerNarrativeStoryData.test.ts
git commit -m "feat: add player narrative authored data"
```

Push and wait for fresh CI GREEN.

---

### Task 4: Ambient activity projection

**Files:**
- Modify: `tools/event-graph-viewer/src/narrative/activity.ts`
- Create: `tools/event-graph-viewer/src/playerNarrative/ambient.ts`
- Test: `tools/event-graph-viewer/tests/ambientActivity.test.ts`

**Interfaces:**
- Consumes: `ActivityRun`, `ActivityDefinition.ambient`, current known fact IDs.
- Produces: `projectAmbientBeats(run, definition, knownFactIds): AmbientBeatView[]`.

- [ ] **Step 1: Write ambient ordering/non-repeat tests**

Create `tests/ambientActivity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { projectAmbientBeats } from '../src/playerNarrative/ambient';

const definition = {
  id: 'rest_and_read', durationMinutes: 20, interruptible: true,
  presentation: { start: 'start', idle: 'idle', complete: 'done' },
  ambient: [
    { id: 'a', atMinute: 5, text: 'A' },
    { id: 'b', atMinute: 11, text: 'B' },
    { id: 'c', atMinute: 17, text: 'C', requiresFacts: ['letter'] },
  ],
};

const run = {
  activityId: 'rest_and_read', startedAt: 900, durationMinutes: 20,
  consumedMinutes: 12, remainingMinutes: 8, interruptible: true, status: 'running' as const,
};

describe('ambient activity prose', () => {
  it('returns due beats in authored order without future beats', () => {
    expect(projectAmbientBeats(run, definition, []).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('applies context-aware fact requirements', () => {
    const progressed = { ...run, consumedMinutes: 18, remainingMinutes: 2 };
    expect(projectAmbientBeats(progressed, definition, []).map((item) => item.id)).toEqual(['a', 'b']);
    expect(projectAmbientBeats(progressed, definition, ['letter']).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Implement ambient projection**

Create `src/playerNarrative/ambient.ts`:

```ts
import type { ActivityRun } from '../narrative/activity';
import type { ActivityDefinition } from '../narrative/types';

export type AmbientBeatView = { id: string; text: string; atMinute: number };

export function projectAmbientBeats(
  run: ActivityRun,
  definition: ActivityDefinition,
  knownFactIds: Iterable<string>,
): AmbientBeatView[] {
  const known = new Set(knownFactIds);
  return (definition.ambient ?? [])
    .filter((beat) => beat.atMinute <= run.consumedMinutes)
    .filter((beat) => (beat.requiresFacts ?? []).every((factId) => known.has(factId)))
    .sort((a, b) => a.atMinute - b.atMinute)
    .map(({ id, text, atMinute }) => ({ id, text, atMinute }));
}
```

- [ ] **Step 3: Add consumed ambient IDs to session**

Extend `PlayerSessionV2`:

```ts
consumedAmbientBeatIds: string[];
```

Initialize as `[]`, persist it, and add a helper that filters already-consumed beats before rendering. This guarantees one activity run does not spam repeated lines on every React render.

- [ ] **Step 4: Run GREEN verification and commit**

```bash
npm test -- ambientActivity.test.ts playerNarrativeStorage.test.ts
npm test
npm run build
git add tools/event-graph-viewer/src/narrative/activity.ts tools/event-graph-viewer/src/playerNarrative tools/event-graph-viewer/tests/ambientActivity.test.ts
git commit -m "feat: project diegetic ambient prose"
```

Push and wait for CI GREEN.

---

### Task 5: Observation persistence and offline inbox

**Files:**
- Modify: `tools/event-graph-viewer/src/narrative/observation.ts`
- Create: `tools/event-graph-viewer/src/playerNarrative/inbox.ts`
- Test: `tools/event-graph-viewer/tests/observationPersistence.test.ts`

**Interfaces:**
- Consumes: `WorldlineHistoryEntry`, `NarrativeObservationRule.persistence`, offline/current observation context.
- Produces:
  - `InboxItem`
  - `reconcilePersistentObservations(...)`
  - no player knowledge for missed local observations.

- [ ] **Step 1: Write persistence behavior tests**

Create `tests/observationPersistence.test.ts` with these assertions:

```ts
it('does not recover an offline local sighting', () => {
  expect(reconcilePersistentObservations([localEvent], rules, offlineContext)).toEqual([]);
});

it('persists an offline phone message', () => {
  expect(reconcilePersistentObservations([messageEvent], rules, offlineContext)[0]).toMatchObject({
    kind: 'message', sourceId: 'evt_wakaharu_message',
  });
});

it('turns an offline phone call into a missed call', () => {
  expect(reconcilePersistentObservations([callEvent], rules, offlineContext)[0]).toMatchObject({
    kind: 'missed-call', sourceId: 'evt_yuan_call',
  });
});

it('never persists hidden history', () => {
  expect(reconcilePersistentObservations([hiddenEvent], rules, offlineContext)).toEqual([]);
});
```

Define the four fixtures in the same test using real `WorldlineHistoryEntry` objects; do not mock internal implementation functions.

- [ ] **Step 2: Implement inbox projection**

Create `src/playerNarrative/inbox.ts`:

```ts
export type InboxItem = {
  id: string;
  sourceId: string;
  occurredMinute: number;
  kind: 'message' | 'missed-call' | 'artifact';
  opened: boolean;
};
```

Implement `reconcilePersistentObservations` so:

```text
persistence=ephemeral -> never backfilled offline
persistence=message -> InboxItem kind=message
persistence=missed-call -> InboxItem kind=missed-call
persistence=artifact -> retained only after acquisition event is observable
visibility=hidden -> always discarded
```

- [ ] **Step 3: Update observation projection**

Keep online `canObserve` behavior for present/phone/artifact channels, but move offline persistence decisions out of generic `projectObservation` into `reconcilePersistentObservations`. This prevents `deferred` from becoming a catch-all channel that leaks local events.

- [ ] **Step 4: Run GREEN verification and commit**

```bash
npm test -- observationPersistence.test.ts observationProjection.test.ts
npm test
npm run build
git add tools/event-graph-viewer/src/narrative/observation.ts tools/event-graph-viewer/src/playerNarrative/inbox.ts tools/event-graph-viewer/tests/observationPersistence.test.ts
git commit -m "feat: reconcile persistent player observations"
```

Push and wait for CI GREEN.

---

### Task 6: Choice deadlines and foreground decision freeze

**Files:**
- Create: `tools/event-graph-viewer/src/playerNarrative/choices.ts`
- Modify: `tools/event-graph-viewer/src/playerNarrative/model.ts`
- Test: `tools/event-graph-viewer/tests/choiceDeadline.test.ts`

**Interfaces:**
- Consumes: `PlayerChoiceDefinition[]`, current story minute, facts, current foreground decision.
- Produces:
  - `availableChoicesForScene(...)`
  - `openDecision(session, sceneId, minute)`
  - `closeDecision(session)`
  - reload never restores frozen decision state.

- [ ] **Step 1: Write deadline tests**

Create `tests/choiceDeadline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { availableChoicesForScene, openDecision } from '../src/playerNarrative/choices';
import { createInitialPlayerSession } from '../src/playerNarrative/model';

const choices = [
  { id: 'reply-now', sceneId: 'wakaharu-message', label: '回她', availableUntil: 1080, effects: [] },
  { id: 'call', sceneId: 'wakaharu-message', label: '打給她', effects: [] },
];

describe('choice deadlines', () => {
  it('changes availability when an unopened scene is checked later', () => {
    expect(availableChoicesForScene(choices, 'wakaharu-message', 1075, []).map((c) => c.id)).toEqual(['reply-now', 'call']);
    expect(availableChoicesForScene(choices, 'wakaharu-message', 1088, []).map((c) => c.id)).toEqual(['call']);
  });

  it('freezes choice evaluation only after opening in the foreground', () => {
    const session = openDecision(createInitialPlayerSession(0), 'wakaharu-message', 1075);
    const frozenMinute = session.foregroundDecision?.frozenMinute ?? -1;
    expect(availableChoicesForScene(choices, 'wakaharu-message', frozenMinute, []).map((c) => c.id)).toEqual(['reply-now', 'call']);
  });
});
```

- [ ] **Step 2: Implement choice availability**

Create `src/playerNarrative/choices.ts`:

```ts
import type { PlayerChoiceDefinition } from '../narrative/types';
import type { PlayerSessionV2 } from './model';

export function availableChoicesForScene(
  choices: PlayerChoiceDefinition[],
  sceneId: string,
  minute: number,
  knownFactIds: Iterable<string>,
): PlayerChoiceDefinition[] {
  const known = new Set(knownFactIds);
  return choices.filter((choice) => choice.sceneId === sceneId)
    .filter((choice) => choice.availableFrom === undefined || minute >= choice.availableFrom)
    .filter((choice) => choice.availableUntil === undefined || minute <= choice.availableUntil)
    .filter((choice) => (choice.requiresFacts ?? []).every((factId) => known.has(factId)));
}

export function openDecision(session: PlayerSessionV2, sceneId: string, minute: number): PlayerSessionV2 {
  return { ...session, foregroundDecision: { sceneId, frozenMinute: minute } };
}

export function closeDecision(session: PlayerSessionV2): PlayerSessionV2 {
  return { ...session, foregroundDecision: null };
}
```

- [ ] **Step 3: Add reload regression test**

Extend `playerNarrativeStorage.test.ts` so a session with a frozen 17:55 decision written at 17:55 and read at 18:08 returns `foregroundDecision === null`; the runtime must then evaluate options using 18:08 current Story Time.

- [ ] **Step 4: Run GREEN verification and commit**

```bash
npm test -- choiceDeadline.test.ts playerNarrativeStorage.test.ts
npm test
npm run build
git add tools/event-graph-viewer/src/playerNarrative tools/event-graph-viewer/tests/choiceDeadline.test.ts tools/event-graph-viewer/tests/playerNarrativeStorage.test.ts
git commit -m "feat: add narrative choice deadlines"
```

Push and wait for CI GREEN.

---

### Task 7: Travel feasibility runtime

**Files:**
- Create: `tools/event-graph-viewer/src/playerNarrative/travel.ts`
- Test: `tools/event-graph-viewer/tests/travelRuntime.test.ts`

**Interfaces:**
- Consumes: `TravelEdgeDefinition[]`, current location, destination, current story minute.
- Produces:
  - `findTravelDuration(edges, from, to): number`
  - `planTravel(edges, from, to, departMinute): TravelPlan`
  - late arrival is legal.

- [ ] **Step 1: Write travel tests**

Create `tests/travelRuntime.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planTravel } from '../src/playerNarrative/travel';

const edges = [{ from: 'old_house', to: 'old_station', minutes: 22 }];

describe('travel runtime', () => {
  it('allows travel whose arrival is after 18:31', () => {
    expect(planTravel(edges, 'old_house', 'old_station', 18 * 60 + 12)).toEqual({
      from: 'old_house', to: 'old_station', departMinute: 1092, arriveMinute: 1114, durationMinutes: 22,
    });
  });

  it('rejects only routes that do not exist, not routes that are late', () => {
    expect(() => planTravel(edges, 'cafe', 'hospital', 1000)).toThrow('No authored travel route');
  });
});
```

- [ ] **Step 2: Implement travel planning**

Create `src/playerNarrative/travel.ts`:

```ts
import type { TravelEdgeDefinition } from '../narrative/types';

export type TravelPlan = {
  from: string;
  to: string;
  departMinute: number;
  arriveMinute: number;
  durationMinutes: number;
};

export function findTravelDuration(edges: TravelEdgeDefinition[], from: string, to: string): number {
  const edge = edges.find((item) => item.from === from && item.to === to);
  if (!edge) throw new Error(`No authored travel route: ${from} -> ${to}`);
  return edge.minutes;
}

export function planTravel(edges: TravelEdgeDefinition[], from: string, to: string, departMinute: number): TravelPlan {
  const durationMinutes = findTravelDuration(edges, from, to);
  return { from, to, departMinute, arriveMinute: departMinute + durationMinutes, durationMinutes };
}
```

- [ ] **Step 3: Run GREEN verification and commit**

```bash
npm test -- travelRuntime.test.ts
npm test
npm run build
git add tools/event-graph-viewer/src/playerNarrative/travel.ts tools/event-graph-viewer/tests/travelRuntime.test.ts
git commit -m "feat: add authored travel runtime"
```

Push and wait for CI GREEN.

---

### Task 8: Deterministic player narrative queue

**Files:**
- Create: `tools/event-graph-viewer/src/playerNarrative/queue.ts`
- Modify: `tools/event-graph-viewer/src/narrative/projection.ts`
- Test: `tools/event-graph-viewer/tests/playerNarrativeQueue.test.ts`

**Interfaces:**
- Consumes: projected scenes, inbox items, activity completion/ambient beats, current activity.
- Produces: `PlayerNarrativeQueueItem[]` sorted by explicit priority, minute, insertion order.

- [ ] **Step 1: Write queue-order tests**

Create `tests/playerNarrativeQueue.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { orderNarrativeQueue } from '../src/playerNarrative/queue';

describe('player narrative queue', () => {
  it('orders urgent interrupt before phone, completion, requested scene, ambient', () => {
    const items = [
      { id: 'ambient', kind: 'ambient', minute: 100, insertionOrder: 4 },
      { id: 'scene', kind: 'scene', minute: 100, insertionOrder: 3 },
      { id: 'complete', kind: 'activity-complete', minute: 100, insertionOrder: 2 },
      { id: 'phone', kind: 'phone', minute: 100, insertionOrder: 1 },
      { id: 'interrupt', kind: 'urgent-interrupt', minute: 100, insertionOrder: 0 },
    ] as const;
    expect(orderNarrativeQueue(items).map((item) => item.id)).toEqual(['interrupt', 'phone', 'complete', 'scene', 'ambient']);
  });

  it('uses minute then insertion order inside one priority', () => {
    const items = [
      { id: 'b', kind: 'scene', minute: 101, insertionOrder: 0 },
      { id: 'a', kind: 'scene', minute: 100, insertionOrder: 5 },
    ] as const;
    expect(orderNarrativeQueue(items).map((item) => item.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Implement queue ordering**

Create `src/playerNarrative/queue.ts` with a fixed priority table:

```ts
export type PlayerQueueKind = 'urgent-interrupt' | 'phone' | 'activity-complete' | 'scene' | 'ambient';
export type PlayerNarrativeQueueItem = {
  id: string;
  kind: PlayerQueueKind;
  minute: number;
  insertionOrder: number;
};

const PRIORITY: Record<PlayerQueueKind, number> = {
  'urgent-interrupt': 0,
  phone: 1,
  'activity-complete': 2,
  scene: 3,
  ambient: 4,
};

export function orderNarrativeQueue<T extends PlayerNarrativeQueueItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    PRIORITY[a.kind] - PRIORITY[b.kind]
    || a.minute - b.minute
    || a.insertionOrder - b.insertionOrder,
  );
}
```

- [ ] **Step 3: Adapt narrative projection to emit enough metadata**

Extend `NarrativeBeat` with stable insertion order and map scene/activity projection into queue candidates without adding UI-specific rendering data to story YAML.

- [ ] **Step 4: Run GREEN verification and commit**

```bash
npm test -- playerNarrativeQueue.test.ts narrativeProjection.test.ts
npm test
npm run build
git add tools/event-graph-viewer/src/playerNarrative/queue.ts tools/event-graph-viewer/src/narrative/projection.ts tools/event-graph-viewer/tests/playerNarrativeQueue.test.ts
git commit -m "feat: order player narrative queue"
```

Push and wait for CI GREEN.

---

### Task 9: Player runtime replay and reconciliation

**Files:**
- Create: `tools/event-graph-viewer/src/playerNarrative/runtime.ts`
- Modify: `tools/event-graph-viewer/src/playerNarrative/model.ts`
- Test: `tools/event-graph-viewer/tests/playerNarrativeRuntime.test.ts`

**Interfaces:**
- Consumes: real story loader result, `PlayerSessionV2`, current wall-clock time, simulator worldline replay, observation projection, ambient projection, queue ordering.
- Produces:
  - `reconcilePlayerRuntime(story, session, nowMs): PlayerRuntimeView`
  - no canonical outcome fields in save.

- [ ] **Step 1: Write runtime replay tests**

Create `tests/playerNarrativeRuntime.test.ts` with real story data:

```ts
it('replays world truth from submitted actions instead of save outcome fields', () => {
  const story = loadRealStory();
  const session = createInitialPlayerSession(0);
  session.submittedActionIds = ['protect_wakaharu'];
  const view = reconcilePlayerRuntime(story, session, (18 * 60 + 31 - 860) * 60_000);
  expect(view.worldHistory.some((entry) => entry.eventId === 'evt_1831_station')).toBe(true);
  expect(JSON.stringify(session)).not.toContain('doctorDies');
});

it('does not advance story time while foreground decision is open', () => {
  const story = loadRealStory();
  const session = openDecision(createInitialPlayerSession(0), 'wakaharu-message', 1075);
  const view = reconcilePlayerRuntime(story, session, 20 * 60_000);
  expect(view.currentStoryMinute).toBe(1075);
});
```

Add a reload counterpart proving that the same persisted session without a foreground freeze reconciles to the later wall-clock minute.

- [ ] **Step 2: Define runtime view**

In `runtime.ts`:

```ts
export type PlayerRuntimeView = {
  currentStoryMinute: number;
  currentLocation: string;
  worldHistory: WorldlineHistoryEntry[];
  queue: PlayerNarrativeQueueItem[];
  activeActivity: ActivityRun | null;
  availableChoices: PlayerChoiceDefinition[];
  inbox: InboxItem[];
};
```

- [ ] **Step 3: Implement deterministic replay**

Implementation order inside `reconcilePlayerRuntime`:

```text
1. resolve current minute from foreground freeze OR wall clock
2. instantiate Story Simulation from canonical initial state
3. submit session.submittedActionIds in authored order
4. run simulator to current minute
5. reconcile activity progress
6. project observations using current location/channel
7. reconcile persistent inbox since lastSeenRealTimeMs
8. project eligible narrative scenes
9. project ambient/activity completion beats
10. order queue deterministically
11. evaluate choices at frozen minute or current minute
12. return view without mutating canonical save outcome fields
```

Do not add `if (protectWakaharu) doctorDies` or any equivalent Player-side outcome shortcut.

- [ ] **Step 4: Run GREEN verification and commit**

```bash
npm test -- playerNarrativeRuntime.test.ts storySimulationAcceptance.test.ts
npm test
npm run build
git add tools/event-graph-viewer/src/playerNarrative/runtime.ts tools/event-graph-viewer/src/playerNarrative/model.ts tools/event-graph-viewer/tests/playerNarrativeRuntime.test.ts
git commit -m "feat: reconcile player narrative runtime"
```

Push and wait for CI GREEN.

---

### Task 10: Player narrative UI surfaces and artifact presentation

**Files:**
- Create: `tools/event-graph-viewer/src/playerNarrative/main.tsx`
- Create: `tools/event-graph-viewer/src/playerNarrative/PlayerNarrativeApp.tsx`
- Create: `tools/event-graph-viewer/src/playerNarrative/playerNarrative.css`
- Create: `tools/event-graph-viewer/src/playerNarrative/components/NarrativeSurface.tsx`
- Create: `tools/event-graph-viewer/src/playerNarrative/components/ActivitySurface.tsx`
- Create: `tools/event-graph-viewer/src/playerNarrative/components/ArtifactSurface.tsx`
- Create: `tools/event-graph-viewer/src/playerNarrative/components/ChoiceSurface.tsx`
- Create: `tools/event-graph-viewer/src/playerNarrative/components/InterruptSurface.tsx`
- Create: `tools/event-graph-viewer/src/playerNarrative/components/CharacterDrawer.tsx`
- Modify: `tools/event-graph-viewer/player.html`
- Modify: `tools/event-graph-viewer/vite.config.ts`
- Test: `tools/event-graph-viewer/tests/playerNarrativeUi.test.tsx`

**Interfaces:**
- Consumes: `PlayerRuntimeView`, loaded narrative blocks/artifacts/character projection.
- Produces: one player surface with Narrative / Activity / Artifact / Choice / Interrupt states.

- [ ] **Step 1: Write UI behavior tests**

Create `tests/playerNarrativeUi.test.tsx` asserting:

```tsx
it('renders novel prose without author/debug labels', () => {
  render(<NarrativeSurface blocks={[{ type: 'narration', text: '火車進站時，我差點沒認出月台。' }]} />);
  expect(screen.getByText('火車進站時，我差點沒認出月台。')).toBeInTheDocument();
  expect(screen.queryByText(/WORLDLINE|impactType|Knowledge \+|BAD END/i)).toBeNull();
});

it('renders activity ambient prose without progress percentage', () => {
  render(<ActivitySurface timeLabel="15:41" title="正在看書" prose="茶已經沒有剛才那麼燙了。" />);
  expect(screen.getByText('茶已經沒有剛才那麼燙了。')).toBeInTheDocument();
  expect(screen.queryByText(/%|剩餘|EXP/i)).toBeNull();
});

it('renders all choice labels with the same semantic style', () => {
  render(<ChoiceSurface choices={[coffeeChoice, criticalChoice]} onChoose={() => {}} />);
  const buttons = screen.getAllByRole('button');
  expect(buttons[0].className).toBe(buttons[1].className);
});
```

Add an artifact test that clicks `拆開信封` and then sees the full letter content without metadata fields such as `Artifact ID`.

- [ ] **Step 2: Implement paragraph/beat narrative rendering**

`NarrativeSurface` renders narration, monologue, and dialogue blocks as semantic paragraphs. It exposes one restrained `繼續` control when another block remains; clicking it changes presentation state only and never calls the clock/runtime advance path.

- [ ] **Step 3: Implement activity surface**

`ActivitySurface` accepts:

```ts
{ timeLabel: string; title: string; prose?: string }
```

and renders no percentage, XP, countdown, remaining duration, or progress bar.

- [ ] **Step 4: Implement artifact surface**

For `kind: letter`, use DOM/CSS states:

```text
envelope front -> envelope back/postmark -> open -> letter sheet
```

Use CSS `transform`, `perspective`, `box-shadow`, and subtle pointer-based parallax only. Do not add a 3D dependency.

- [ ] **Step 5: Implement choice and interrupt surfaces**

`ChoiceSurface` must use one button style for every choice and receive only player-facing fields (`id`, `label`). `InterruptSurface` may visually interrupt Activity but must not reveal the underlying event ID or author visibility.

- [ ] **Step 6: Implement player app shell**

`PlayerNarrativeApp` displays:

```text
center: active Narrative/Activity/Artifact/Interrupt surface
upper-right: current story time
lower-left: character drawer trigger
lower-right: notes/more trigger placeholder only if functional; otherwise omit it
```

No permanent case-progress/worldline/evidence counters.

- [ ] **Step 7: Repoint existing player entry**

Change `player.html` to load:

```html
<script type="module" src="/src/playerNarrative/main.tsx"></script>
```

Keep Vite rollup input names `viewer` and `player`; do not introduce a third entry.

- [ ] **Step 8: Run GREEN verification and commit**

```bash
npm test -- playerNarrativeUi.test.tsx App.test.tsx
npm test
npm run build
git add tools/event-graph-viewer/player.html tools/event-graph-viewer/vite.config.ts tools/event-graph-viewer/src/playerNarrative tools/event-graph-viewer/tests/playerNarrativeUi.test.tsx
git commit -m "feat: add novel-first player narrative surface"
```

Push and wait for CI GREEN.

---

### Task 11: Author the playable 14:20–18:31 story path

**Files:**
- Modify: `story/narrative/loop_01_prologue.yaml`
- Create: `story/narrative/loop_01_1610_1831.yaml`
- Modify: `story/choices/loop_01_player.yaml`
- Modify: `story/manifests/loop_01.yaml`
- Modify as required by validated canon: `story/events/loop_01_1810.yaml`, `story/events/loop_01_1818.yaml`
- Test: `tools/event-graph-viewer/tests/playerNarrativeStoryAcceptance.test.ts`

**Interfaces:**
- Consumes: choice/travel/activity runtime from Tasks 3–10.
- Produces: enough authored player-facing content to play from 14:20 through the 18:31 result without dashboard/debug UI.

- [ ] **Step 1: Write story acceptance tests first**

Create `tests/playerNarrativeStoryAcceptance.test.ts` using real YAML and assert:

```ts
it('offers at least three ordinary arrival choices with observable differences', () => {
  const story = loadRealStory();
  const arrival = story.playerChoices.filter((choice) => choice.sceneId === 'scene_prologue_arrival');
  expect(arrival.length).toBeGreaterThanOrEqual(3);
  expect(new Set(arrival.map((choice) => JSON.stringify(choice.effects))).size).toBe(arrival.length);
});

it('keeps the letter world existence separate from discovery flow', () => {
  const story = loadRealStory();
  const letter = story.narrative.artifacts.find((artifact) => artifact.id === 'zhixia_letter');
  const discovery = story.narrative.scenes.find((scene) => scene.id === 'scene_letter_discovery');
  expect(letter).toBeDefined();
  expect(discovery).toBeDefined();
  expect(discovery?.startsActivity).toBeUndefined();
});

it('contains player-facing beats through 18:31 without author labels', () => {
  const story = loadRealStory();
  const text = JSON.stringify(story.narrative.scenes);
  expect(text).toContain('18:31');
  expect(text).not.toMatch(/BAD END|GOOD END|WORLDLINE CHANGED|impactType/);
});
```

- [ ] **Step 2: Convert Prologue fixed assumptions to relative flow**

Keep fixed World Truth events fixed, but make player-relative scene progression depend on activity completion/current player state. Do not force `scene_letter_discovery` to appear at exactly 16:00 if earlier choices consumed extra time.

- [ ] **Step 3: Author post-letter scenes**

Create `story/narrative/loop_01_1610_1831.yaml` covering:

```text
post-letter reaction
Yuan contact / postal choice
optional cafe visit / Wakaharu conversation
online research activity
hospital route observation
17:55 Wakaharu phone message with response deadline
18:05 station local observation
18:10 Yuan schedule-dependent observation
18:18 Wakaharu knowledge-dependent line
18:20–18:31 final travel/action choices
18:31 result presentation variants
```

Use only facts available to the protagonist at each scene; knowledge validation must remain green.

- [ ] **Step 4: Ensure ordinary choices always matter visibly**

For every player-visible choice in `loop_01_player.yaml`, add a testable effect in one of these categories:

```text
consume-time
travel/location
learn-fact
later prose variant
NPC response variant
later choice availability
submitted simulator action
```

Do not add no-op buttons.

- [ ] **Step 5: Run GREEN verification and commit**

```bash
npm run sync-story
npm test -- playerNarrativeStoryAcceptance.test.ts knowledgeValidation.test.ts narrativeFoundationAcceptance.test.ts
npm test
npm run build
git add story tools/event-graph-viewer/tests/playerNarrativeStoryAcceptance.test.ts
git commit -m "feat: author first playable narrative slice"
```

Push and wait for CI GREEN.

---

### Task 12: 18:31 end-to-end worldline acceptance and cleanup

**Files:**
- Create: `tools/event-graph-viewer/tests/playerNarrative1831Acceptance.test.ts`
- Modify only if required by failures: files owned by Tasks 2–11
- Remove only after replacement is proven: obsolete old `tools/event-graph-viewer/src/player/**` files no longer imported by `player.html` or tests

**Interfaces:**
- Consumes: complete Player Narrative runtime/UI/story vertical slice.
- Produces: fresh evidence that at least multiple player action histories produce different 18:31 results through the same simulator while player UI never stores or predicts those outcomes itself.

- [ ] **Step 1: Add end-to-end 18:31 acceptance tests**

Create `tests/playerNarrative1831Acceptance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { reconcilePlayerRuntime } from '../src/playerNarrative/runtime';

const minute1831Ms = (18 * 60 + 31 - (14 * 60 + 20)) * 60_000;

describe('player narrative 18:31 acceptance', () => {
  it('produces different simulator-resolved station outcomes from different submitted actions', () => {
    const story = loadRealStory();
    const baseline = createInitialPlayerSession(0);
    const rescue = createInitialPlayerSession(0);
    rescue.submittedActionIds = ['protect_wakaharu'];

    const a = reconcilePlayerRuntime(story, baseline, minute1831Ms);
    const b = reconcilePlayerRuntime(story, rescue, minute1831Ms);
    const outcomeA = a.worldHistory.filter((entry) => entry.eventId === 'evt_1831_station').map((entry) => entry.title);
    const outcomeB = b.worldHistory.filter((entry) => entry.eventId === 'evt_1831_station').map((entry) => entry.title);
    expect(outcomeA).not.toEqual(outcomeB);
  });

  it('does not expose hidden history through the player queue', () => {
    const story = loadRealStory();
    const view = reconcilePlayerRuntime(story, createInitialPlayerSession(0), minute1831Ms);
    const hiddenSourceIds = new Set(view.worldHistory.filter((entry) => entry.visibility === 'hidden').map((entry) => entry.eventId ?? entry.sourceId));
    expect(view.queue.every((item) => !hiddenSourceIds.has(item.id))).toBe(true);
  });
});
```

If exact station event IDs differ from current canonical YAML, use the canonical ID from `story/events/loop_01_1831.yaml` consistently in the test and runtime; do not add a second alias.

- [ ] **Step 2: Add acceptance for late arrival**

Add a scenario where the player leaves `old_house` at 18:12 for `old_station`, assert the simulator resolves 18:31 before the authored 18:34 arrival, and assert the player can receive aftermath prose after arrival instead of being blocked from travelling.

- [ ] **Step 3: Add acceptance for offline deadline**

Persist a session after the 17:55 message is available but unopened, reconcile at 18:08, and assert the expired immediate reply choice is absent while persistent message/missed-call state remains available according to its policy.

- [ ] **Step 4: Remove dead prototype imports only after player v2 is proven**

Use:

```bash
rg "src/player|from './player|from '../player" tools/event-graph-viewer
```

Delete old prototype files only if they have no remaining imports and no required migration behavior. Keep any reusable legacy migration code only if a test proves it is still needed. Do not delete files merely for cosmetic cleanup.

- [ ] **Step 5: Run the full final verification**

```bash
npm run sync-story
npm test
npm run build
```

Expected: all tests pass, TypeScript emits no errors, Vite builds both viewer and player entries.

- [ ] **Step 6: Whole-branch diff review**

```bash
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- .github/workflows
git status --short
```

Expected:

```text
no unintended workflow changes
no untracked files
new player surface consumes Narrative Foundation
Author Viewer files still build and existing Author Viewer tests remain green
```

- [ ] **Step 7: Commit cleanup/acceptance**

```bash
git add .
git commit -m "test: verify player narrative vertical slice"
```

- [ ] **Step 8: Push and require fresh final CI**

```bash
git push
```

Do not mark the implementation PR ready for merge until the exact final head has a GitHub Actions run where:

```text
Sync story data  PASS
Run tests        PASS
Build viewer     PASS
```

Do not merge to `main` automatically. Present the final integration PR and CI evidence for human review.

---

## Completion Checklist

Before claiming Player Narrative UI v0.1 complete, verify all of the following against the final branch:

- [ ] Current `main` and Narrative Foundation were deliberately reconciled; no stale stacked branch was blindly merged.
- [ ] Player starts at 14:20 in novel-first UI, not a case dashboard.
- [ ] At least three ordinary opening choices have distinct observable effects.
- [ ] Player-relative scene timing shifts when ordinary activities consume time.
- [ ] Fixed 18:31 World Event remains fixed.
- [ ] Activity time advances World Time; reading prose does not.
- [ ] Ambient prose is ordered, non-repeating, activity-specific, and can be fact-aware.
- [ ] Hidden events never become Player Narrative merely because time passed.
- [ ] Local observations can be missed permanently.
- [ ] Phone messages persist; calls can become missed calls.
- [ ] Decision freeze is foreground-only and disappears on reload/offline reconciliation.
- [ ] Late travel remains legal and can arrive after 18:31.
- [ ] Choice UI never exposes importance/impact classification.
- [ ] Letter is presented as an in-world Artifact, not an evidence metadata panel.
- [ ] Player save contains actions/read state but no canonical victim/death result flags.
- [ ] Different submitted actions produce different 18:31 outcomes through Story Simulation.
- [ ] Existing Author Viewer still builds and tests pass.
- [ ] Final exact head has fresh GitHub Actions GREEN evidence.
