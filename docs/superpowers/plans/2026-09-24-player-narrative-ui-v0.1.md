# Player Narrative UI v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable Loop 01 vertical slice from Day 0 14:20 through 18:31 where ordinary life choices consume real world-linked time, Ambient Prose reflects the protagonist's current activity, deadlines can be missed without countdown UI, and 18:31 outcomes are resolved only by Story Simulation.

**Architecture:** Keep Author Viewer and Player Game separate. Add a new `src/playerNarrative/` runtime/UI that consumes Narrative Foundation + Story Simulation. Player save stores time-sync state, choices/actions, read/open state, knowledge, location and active activity, but never canonical victim/death outcomes. The world clock is pause-aware: story time advances 1:1 only while the world is running; foreground Narrative/Decision scenes freeze story time for reading, and that freeze is never persisted across reload/offline time.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest 2, Testing Library, js-yaml, existing Story Simulation/Narrative Foundation. No Three.js dependency in v0.1.

**Spec:** `docs/superpowers/specs/2026-09-24-player-narrative-ui-v0.1-design.md`

## Global Constraints

- Scope is Loop 01 Day 0 14:20 → 18:31.
- Production mapping is `1 real minute = 1 world minute` while world progression is running.
- Reading Narrative/Decision scenes does not advance Story Time.
- Foreground freeze is in-memory only; reload/offline reconciliation resumes the world from the last persisted sync point.
- Fixed world events such as 18:31 remain fixed.
- Player-relative life scenes can shift later when earlier activities consume time.
- The letter exists in world truth independently of when the player discovers it.
- Ordinary visible choices must change at least one player-observable dimension: time, location, prose, character reaction, knowledge, later scene content, or later availability.
- Choice UI never reveals author-only impact category or future consequence.
- Hidden events never enter Player Narrative unless a later observable source legitimately communicates them.
- Local observations are missable; phone messages persist; calls can become missed calls.
- Late travel is allowed even if arrival occurs after 18:31.
- Player UI never hard-codes who dies at 18:31.
- No stamina, energy, XP, progress bars, countdown timer UI, Three.js, full pathfinding, or AI-generated canonical prose.
- Do not change `.github/workflows/**` unless a failing verification proves the current workflow cannot validate the new player surface.
- Never push intentional RED commits. Before every remote commit: targeted tests → full `npm test` → `npm run build`; then wait for fresh GitHub Actions GREEN before dependent work.

## Review Focus

1. **Branch integration drift:** `main` and the Narrative Foundation stack are diverged; integration must preserve current `main` build/player entry while retaining validated simulator/foundation behavior.
2. **Pause-aware clock correctness:** reading can take arbitrarily long without advancing story time, but closing/reloading while paused must not freeze the world forever.
3. **Relative scenes vs fixed events:** life choices can delay discovery and travel, while 18:31 stays fixed and may occur before the protagonist arrives.
4. **Observation persistence:** local sightings are permanently missable; phone messages persist; calls become missed calls; hidden events remain hidden.
5. **Ordinary choices are not fake:** every visible choice has a tested observable consequence even if it does not change the 18:31 outcome.

---

## Planned File Structure

```text
story/
  activities/protagonist.yaml
  choices/loop_01_player.yaml
  travel/loop_01.yaml
  narrative/loop_01_prologue.yaml
  narrative/loop_01_1610_1831.yaml
  knowledge/facts.yaml
  manifests/loop_01.yaml

tools/event-graph-viewer/
  player.html
  vite.config.ts
  scripts/sync-story.mjs
  src/lib/loadSimulationStory.ts
  src/narrative/types.ts
  src/narrative/activity.ts
  src/narrative/observation.ts
  src/narrative/projection.ts
  src/playerNarrative/
    main.tsx
    PlayerNarrativeApp.tsx
    playerNarrative.css
    model.ts
    clock.ts
    storage.ts
    ambient.ts
    choices.ts
    travel.ts
    inbox.ts
    queue.ts
    runtime.ts
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
    playerNarrativeStoryData.test.ts
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
- Merge: current `main`
- Merge: `docs/narrative-foundation-v0.1`
- Verify: `tools/event-graph-viewer/player.html`
- Verify: `tools/event-graph-viewer/vite.config.ts`
- Test: `tools/event-graph-viewer/tests/integrationBaseline.test.ts`

**Interfaces:**
- Consumes: current `main` old Player prototype plus known-green Narrative Foundation stack.
- Produces: `integration/player-narrative-ui-v0.1`, containing both histories with current workflow files unchanged.

- [ ] **Step 1: Create isolated integration branch**

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c integration/player-narrative-ui-v0.1
```

- [ ] **Step 2: Merge the Narrative Foundation stack**

```bash
git merge --no-ff origin/docs/narrative-foundation-v0.1
```

Resolve conflicts with these exact rules:

```text
story/** and src/narrative/**: Narrative Foundation semantics win.
player.html and Vite multi-page wiring: preserve current main until Task 9 repoints the player entry.
old src/player/**: keep temporarily; do not reuse its 18:00 hard-coded story semantics.
.github/workflows/**: preserve current main unchanged.
```

- [ ] **Step 3: Add baseline test**

Create `tests/integrationBaseline.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

describe('player narrative integration baseline', () => {
  it('keeps player entry and loads Narrative Foundation', () => {
    expect(existsSync(resolve(process.cwd(), 'player.html'))).toBe(true);
    const story = loadRealStory();
    expect(story.narrative.characters.length).toBeGreaterThanOrEqual(7);
    expect(story.narrative.activities.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Verify full baseline**

```bash
npm run sync-story
npm test -- integrationBaseline.test.ts
npm test
npm run build
```

Expected: all commands exit 0 and Vite builds both viewer and player entries.

- [ ] **Step 5: Commit/push and wait for CI**

```bash
git add .
git commit -m "chore: reconcile player narrative integration baseline"
git push -u origin integration/player-narrative-ui-v0.1
```

Do not begin Task 2 until this exact head has fresh GitHub Actions GREEN.

---

### Task 2: Pause-aware Story Clock and PlayerSession v2

**Files:**
- Create: `src/playerNarrative/model.ts`
- Create: `src/playerNarrative/clock.ts`
- Create: `src/playerNarrative/storage.ts`
- Test: `tests/playerNarrativeClock.test.ts`
- Test: `tests/playerNarrativeStorage.test.ts`

**Interfaces:**
- Produces:
  - `PlayerSessionV2`
  - `syncRunningTime(session, nowMs)`
  - `freezeForeground(session, sceneId, nowMs)`
  - `resumeWorld(session, nowMs)`
  - `currentStoryMinute(session, nowMs)`
  - `readPlayerSession(storage, nowMs)` / `writePlayerSession(storage, session)`

- [ ] **Step 1: Write clock tests**

Create `tests/playerNarrativeClock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { currentStoryMinute, freezeForeground, resumeWorld, syncRunningTime } from '../src/playerNarrative/clock';

describe('pause-aware player clock', () => {
  it('advances 1 real minute per world minute while running', () => {
    const session = createInitialPlayerSession(1_000);
    expect(currentStoryMinute(session, 1_000)).toBe(860);
    expect(currentStoryMinute(session, 1_000 + 17 * 60_000)).toBe(877);
  });

  it('does not advance while a foreground scene is open', () => {
    const frozen = freezeForeground(createInitialPlayerSession(1_000), 'scene-a', 1_000 + 5 * 60_000);
    expect(currentStoryMinute(frozen, 1_000 + 25 * 60_000)).toBe(865);
  });

  it('resumes from the frozen minute instead of catching up reading time', () => {
    const frozen = freezeForeground(createInitialPlayerSession(1_000), 'scene-a', 1_000 + 5 * 60_000);
    const resumed = resumeWorld(frozen, 1_000 + 25 * 60_000);
    expect(currentStoryMinute(resumed, 1_000 + 30 * 60_000)).toBe(870);
  });

  it('syncs elapsed running time into persisted state', () => {
    const synced = syncRunningTime(createInitialPlayerSession(1_000), 1_000 + 8 * 60_000);
    expect(synced.storyMinuteAtLastSync).toBe(868);
    expect(synced.lastSyncedRealTimeMs).toBe(1_000 + 8 * 60_000);
  });
});
```

- [ ] **Step 2: Run RED locally**

```bash
npm test -- playerNarrativeClock.test.ts
```

Expected RED: `src/playerNarrative/model` / `clock` do not exist.

- [ ] **Step 3: Implement session model**

Create `src/playerNarrative/model.ts`:

```ts
import type { ActivityRun } from '../narrative/activity';

export type ForegroundFreeze = { sceneId: string; frozenMinute: number };

export type PlayerSessionV2 = {
  version: 2;
  storyMinuteAtLastSync: number;
  lastSyncedRealTimeMs: number;
  lastSeenRealTimeMs: number;
  currentLocation: string;
  activeActivity: ActivityRun | null;
  consumedSceneIds: string[];
  consumedAmbientBeatIds: string[];
  openedArtifactIds: string[];
  submittedActionIds: string[];
  knownFactIds: string[];
  inboxItemIds: string[];
  foregroundFreeze: ForegroundFreeze | null;
};

export function createInitialPlayerSession(nowMs: number): PlayerSessionV2 {
  return {
    version: 2,
    storyMinuteAtLastSync: 14 * 60 + 20,
    lastSyncedRealTimeMs: nowMs,
    lastSeenRealTimeMs: nowMs,
    currentLocation: 'ash_tide_station',
    activeActivity: null,
    consumedSceneIds: [],
    consumedAmbientBeatIds: [],
    openedArtifactIds: [],
    submittedActionIds: [],
    knownFactIds: ['fact_zhixia_dead_five_years'],
    inboxItemIds: [],
    foregroundFreeze: null,
  };
}
```

- [ ] **Step 4: Implement pause-aware clock**

Create `src/playerNarrative/clock.ts`:

```ts
import type { PlayerSessionV2 } from './model';

const REAL_MINUTE_MS = 60_000;

export function currentStoryMinute(session: PlayerSessionV2, nowMs: number): number {
  if (session.foregroundFreeze) return session.foregroundFreeze.frozenMinute;
  const elapsed = Math.max(0, nowMs - session.lastSyncedRealTimeMs);
  return session.storyMinuteAtLastSync + Math.floor(elapsed / REAL_MINUTE_MS);
}

export function syncRunningTime(session: PlayerSessionV2, nowMs: number): PlayerSessionV2 {
  const minute = currentStoryMinute(session, nowMs);
  return { ...session, storyMinuteAtLastSync: minute, lastSyncedRealTimeMs: nowMs };
}

export function freezeForeground(session: PlayerSessionV2, sceneId: string, nowMs: number): PlayerSessionV2 {
  const synced = syncRunningTime(session, nowMs);
  return { ...synced, foregroundFreeze: { sceneId, frozenMinute: synced.storyMinuteAtLastSync } };
}

export function resumeWorld(session: PlayerSessionV2, nowMs: number): PlayerSessionV2 {
  const minute = session.foregroundFreeze?.frozenMinute ?? currentStoryMinute(session, nowMs);
  return { ...session, storyMinuteAtLastSync: minute, lastSyncedRealTimeMs: nowMs, foregroundFreeze: null };
}
```

- [ ] **Step 5: Write persistence tests**

Create `tests/playerNarrativeStorage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { freezeForeground } from '../src/playerNarrative/clock';
import { readPlayerSession, writePlayerSession } from '../src/playerNarrative/storage';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe('player session persistence', () => {
  it('stores actions/read state but no canonical victim result', () => {
    const storage = new MemoryStorage();
    const session = createInitialPlayerSession(1_000);
    session.submittedActionIds.push('send_yuan_to_post_office');
    expect(writePlayerSession(storage, session)).toBe(true);
    const loaded = readPlayerSession(storage, 2_000);
    expect(loaded.submittedActionIds).toEqual(['send_yuan_to_post_office']);
    expect(JSON.stringify(loaded)).not.toMatch(/wakaharuDies|doctorDies|victim/);
  });

  it('does not persist foreground freeze', () => {
    const storage = new MemoryStorage();
    const frozen = freezeForeground(createInitialPlayerSession(1_000), 'scene-a', 2_000);
    writePlayerSession(storage, frozen);
    expect(readPlayerSession(storage, 10_000).foregroundFreeze).toBeNull();
  });
});
```

- [ ] **Step 6: Implement storage**

Create `src/playerNarrative/storage.ts`:

```ts
import { createInitialPlayerSession, type PlayerSessionV2 } from './model';

export const PLAYER_NARRATIVE_SAVE_KEY = 'ash-town-player-narrative-v2';

export function readPlayerSession(storage: Pick<Storage, 'getItem'>, nowMs: number): PlayerSessionV2 {
  try {
    const raw = storage.getItem(PLAYER_NARRATIVE_SAVE_KEY);
    if (!raw) return createInitialPlayerSession(nowMs);
    const parsed = JSON.parse(raw) as PlayerSessionV2;
    if (parsed.version !== 2) return createInitialPlayerSession(nowMs);
    return { ...parsed, foregroundFreeze: null, lastSeenRealTimeMs: nowMs };
  } catch {
    return createInitialPlayerSession(nowMs);
  }
}

export function writePlayerSession(storage: Pick<Storage, 'setItem'>, session: PlayerSessionV2): boolean {
  try {
    storage.setItem(PLAYER_NARRATIVE_SAVE_KEY, JSON.stringify({ ...session, foregroundFreeze: null }));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 7: Verify GREEN and commit**

```bash
npm test -- playerNarrativeClock.test.ts playerNarrativeStorage.test.ts
npm test
npm run build
git add src/playerNarrative tests/playerNarrativeClock.test.ts tests/playerNarrativeStorage.test.ts
git commit -m "feat: add pause-aware player story clock"
```

Push and wait for fresh CI GREEN.

---

### Task 3: Player narrative authored-data schema

**Files:**
- Modify: `story/activities/protagonist.yaml`
- Modify: `story/knowledge/facts.yaml`
- Create: `story/choices/loop_01_player.yaml`
- Create: `story/travel/loop_01.yaml`
- Modify: `story/manifests/loop_01.yaml`
- Modify: `src/narrative/types.ts`
- Modify: `src/lib/loadSimulationStory.ts`
- Modify: `scripts/sync-story.mjs`
- Modify: `tests/helpers/loadRealStory.ts`
- Test: `tests/playerNarrativeStoryData.test.ts`

**Interfaces:**
- Produces `AmbientBeatDefinition`, `PlayerChoiceDefinition`, `PlayerChoiceEffect`, `TravelEdgeDefinition`, `ObservationPersistence`, plus `StoryBundle.playerChoices` and `StoryBundle.travelEdges`.

- [ ] **Step 1: Write schema tests**

Create `tests/playerNarrativeStoryData.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

describe('player narrative authored data', () => {
  it('loads ordered ambient beats', () => {
    const reading = loadRealStory().narrative.activities.find((item) => item.id === 'rest_and_read');
    expect(reading?.ambient?.map((beat) => beat.atMinute)).toEqual([5, 11, 17]);
  });

  it('loads player choices without impact metadata', () => {
    const choice = loadRealStory().playerChoices.find((item) => item.id === 'arrival_coffee');
    expect(choice?.label).toBe('先去買杯咖啡');
    expect(choice).not.toHaveProperty('impactType');
  });

  it('loads authored travel duration', () => {
    expect(loadRealStory().travelEdges).toContainEqual({ from: 'old_house', to: 'old_station', minutes: 22 });
  });
});
```

- [ ] **Step 2: Extend TypeScript types**

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
  | { type: 'learn-fact'; factId: string };

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

Extend:

```ts
ActivityDefinition.ambient?: AmbientBeatDefinition[];
NarrativeObservationRule.persistence?: ObservationPersistence;
```

Extend `StoryBundle` with:

```ts
playerChoices: PlayerChoiceDefinition[];
travelEdges: TravelEdgeDefinition[];
```

- [ ] **Step 3: Author activity ambient beats and ordinary-life activities**

Add activities:

```yaml
  - id: buy_coffee
    duration_minutes: 8
    interruptible: true
    presentation:
      start: 我拖著行李拐進月台外那間新開的咖啡店。
      idle: 正在等咖啡……
      complete: 紙杯摸起來有點燙，我重新往老街走。
  - id: visit_convenience_store
    duration_minutes: 6
    interruptible: true
    presentation:
      start: 舊便利商店還在。我推門進去買瓶水。
      idle: 正在便利商店……
      complete: 我提著水走出店門。
```

Add `rest_and_read` ambient beats exactly at offsets 5/11/17 and context-aware `research_online` ambient prose requiring `fact_zhixia_letter_received`.

- [ ] **Step 4: Add knowledge facts used by ordinary choices**

Append to `story/knowledge/facts.yaml`:

```yaml
  - id: fact_cafe_resident_chatter
    summary: 在車站外咖啡店聽見居民談起灰潮鎮近年的變化
  - id: fact_shopkeeper_mistook_protagonist_for_zhixia
    summary: 便利商店老闆一度把主角錯認成林知夏
  - id: fact_zhixia_letter_received
    summary: 主角已發現並讀到林知夏署名、郵戳為昨天的信
```

- [ ] **Step 5: Author choices and travel**

Create `story/choices/loop_01_player.yaml`:

```yaml
choices:
  - id: arrival_coffee
    scene_id: scene_prologue_arrival
    label: 先去買杯咖啡
    effects:
      - type: start-activity
        activity_id: buy_coffee
  - id: arrival_convenience_store
    scene_id: scene_prologue_arrival
    label: 去便利商店買水
    effects:
      - type: start-activity
        activity_id: visit_convenience_store
  - id: arrival_home_direct
    scene_id: scene_prologue_arrival
    label: 直接回家
    effects:
      - type: travel
        to: old_house
  - id: letter_send_yuan_post_office
    scene_id: scene_after_letter
    label: 請予安幫忙去郵局問
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

Create `story/travel/loop_01.yaml`:

```yaml
travel:
  - { from: ash_tide_station, to: old_house, minutes: 20 }
  - { from: old_house, to: old_station, minutes: 22 }
  - { from: old_house, to: cafe, minutes: 12 }
  - { from: cafe, to: old_station, minutes: 14 }
  - { from: old_house, to: hospital, minutes: 18 }
  - { from: hospital, to: old_station, minutes: 13 }
```

- [ ] **Step 6: Wire manifest/sync/loader validation**

Add manifest keys:

```yaml
player_choices: ../choices/loop_01_player.yaml
travel: ../travel/loop_01.yaml
```

Normalize snake_case fields and reject:

```text
ambient offset < 0 or >= activity duration
unknown scene/action/activity/fact references
travel minutes <= 0
empty/unknown location endpoints
```

Update `loadRealStory.ts` to pass `playerChoices` and `travel` documents to `buildStoryBundleFromDocuments`.

- [ ] **Step 7: Verify GREEN and commit**

```bash
npm run sync-story
npm test -- playerNarrativeStoryData.test.ts narrativeLoader.test.ts
npm test
npm run build
git add story src/narrative src/lib/loadSimulationStory.ts scripts/sync-story.mjs tests/helpers/loadRealStory.ts tests/playerNarrativeStoryData.test.ts
git commit -m "feat: add player narrative authored data"
```

Push and wait for CI GREEN.

---

### Task 4: Ambient activity projection and choice application

**Files:**
- Create: `src/playerNarrative/ambient.ts`
- Create: `src/playerNarrative/choices.ts`
- Modify: `src/playerNarrative/model.ts`
- Test: `tests/ambientActivity.test.ts`
- Test: `tests/choiceDeadline.test.ts`

**Interfaces:**
- Produces:
  - `projectAmbientBeats(run, definition, knownFacts)`
  - `availableChoicesForScene(choices, sceneId, minute, knownFacts)`
  - `applyChoiceEffects(session, choice, story)`
  - `freezeForeground` from Task 2 is reused for decisions.

- [ ] **Step 1: Write ambient tests**

```ts
it('returns only due ambient beats in authored order', () => {
  expect(projectAmbientBeats(runAt12Minutes, readingDefinition, []).map((x) => x.id)).toEqual(['read_motorbike', 'read_tea_cooling']);
});

it('requires facts for state-aware prose', () => {
  expect(projectAmbientBeats(runAt19Minutes, readingDefinition, []).some((x) => x.id === 'after_letter')).toBe(false);
  expect(projectAmbientBeats(runAt19Minutes, readingDefinition, ['fact_zhixia_letter_received']).some((x) => x.id === 'after_letter')).toBe(true);
});
```

- [ ] **Step 2: Implement ambient projection**

```ts
export function projectAmbientBeats(run: ActivityRun, definition: ActivityDefinition, knownFactIds: Iterable<string>) {
  const known = new Set(knownFactIds);
  return (definition.ambient ?? [])
    .filter((beat) => beat.atMinute <= run.consumedMinutes)
    .filter((beat) => (beat.requiresFacts ?? []).every((id) => known.has(id)))
    .sort((a, b) => a.atMinute - b.atMinute);
}
```

Filter `session.consumedAmbientBeatIds` at the caller so React re-renders never repeat an already-consumed line.

- [ ] **Step 3: Write choice/deadline tests**

```ts
it('drops an unopened expired response choice', () => {
  expect(availableChoicesForScene(choices, 'wakaharu-message', 1088, []) .map((x) => x.id)).toEqual(['call']);
});

it('keeps frozen choice evaluation stable while the scene is open', () => {
  const frozen = freezeForeground(createInitialPlayerSession(0), 'wakaharu-message', 0);
  frozen.foregroundFreeze = { sceneId: 'wakaharu-message', frozenMinute: 1075 };
  expect(availableChoicesForScene(choices, 'wakaharu-message', frozen.foregroundFreeze.frozenMinute, []).map((x) => x.id)).toEqual(['reply-now', 'call']);
});
```

- [ ] **Step 4: Implement choice availability/application**

`availableChoicesForScene` filters by scene ID, `availableFrom`, `availableUntil`, and `requiresFacts`.

`applyChoiceEffects` must support exactly:

```text
start-activity -> startActivity(...) at current Story Time
submit-action  -> append canonical action ID once
travel         -> create a TravelPlan, stored as active travel activity
learn-fact     -> append fact ID once
```

Do not apply simulator outcome fields here.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm test -- ambientActivity.test.ts choiceDeadline.test.ts
npm test
npm run build
git add src/playerNarrative tests/ambientActivity.test.ts tests/choiceDeadline.test.ts
git commit -m "feat: add ambient prose and player choices"
```

Push and wait for CI GREEN.

---

### Task 5: Observation persistence, inbox, and travel runtime

**Files:**
- Modify: `src/narrative/observation.ts`
- Create: `src/playerNarrative/inbox.ts`
- Create: `src/playerNarrative/travel.ts`
- Test: `tests/observationPersistence.test.ts`
- Test: `tests/travelRuntime.test.ts`

**Interfaces:**
- Produces `InboxItem[]`, `reconcilePersistentObservations(...)`, `planTravel(...)`.

- [ ] **Step 1: Write persistence tests**

```ts
it('never backfills an offline local sighting', () => {
  expect(reconcilePersistentObservations([localEvent], rules, offlineContext)).toEqual([]);
});

it('persists a phone message', () => {
  expect(reconcilePersistentObservations([messageEvent], rules, offlineContext)[0].kind).toBe('message');
});

it('turns a phone call into a missed call', () => {
  expect(reconcilePersistentObservations([callEvent], rules, offlineContext)[0].kind).toBe('missed-call');
});

it('never persists hidden history', () => {
  expect(reconcilePersistentObservations([hiddenEvent], rules, offlineContext)).toEqual([]);
});
```

Use actual `WorldlineHistoryEntry` fixtures in the test file.

- [ ] **Step 2: Implement inbox semantics**

```ts
export type InboxItem = {
  id: string;
  sourceId: string;
  occurredMinute: number;
  kind: 'message' | 'missed-call' | 'artifact';
  opened: boolean;
};
```

Rules:

```text
ephemeral -> never offline-backfilled
message -> persisted message
missed-call -> persisted missed call
artifact -> persisted only after legitimate acquisition
hidden visibility -> always discarded
```

- [ ] **Step 3: Write travel tests**

```ts
it('allows a late 18:12 departure that arrives at 18:34', () => {
  expect(planTravel(edges, 'old_house', 'old_station', 1092)).toEqual({
    from: 'old_house', to: 'old_station', departMinute: 1092, arriveMinute: 1114, durationMinutes: 22,
  });
});
```

- [ ] **Step 4: Implement travel planning**

```ts
export type TravelPlan = { from: string; to: string; departMinute: number; arriveMinute: number; durationMinutes: number };

export function planTravel(edges: TravelEdgeDefinition[], from: string, to: string, departMinute: number): TravelPlan {
  const edge = edges.find((item) => item.from === from && item.to === to);
  if (!edge) throw new Error(`No authored travel route: ${from} -> ${to}`);
  return { from, to, departMinute, arriveMinute: departMinute + edge.minutes, durationMinutes: edge.minutes };
}
```

No check forbids arrival after 18:31.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm test -- observationPersistence.test.ts travelRuntime.test.ts observationProjection.test.ts
npm test
npm run build
git add src/narrative/observation.ts src/playerNarrative/inbox.ts src/playerNarrative/travel.ts tests/observationPersistence.test.ts tests/travelRuntime.test.ts
git commit -m "feat: add observation persistence and travel runtime"
```

Push and wait for CI GREEN.

---

### Task 6: Deterministic Narrative Queue

**Files:**
- Create: `src/playerNarrative/queue.ts`
- Modify: `src/narrative/projection.ts`
- Test: `tests/playerNarrativeQueue.test.ts`

**Interfaces:**
- Produces ordered `PlayerNarrativeQueueItem[]`.

- [ ] **Step 1: Write ordering tests**

```ts
it('orders interrupt, phone, completion, scene, ambient', () => {
  expect(orderNarrativeQueue(items).map((x) => x.id)).toEqual(['interrupt', 'phone', 'complete', 'scene', 'ambient']);
});

it('uses minute then insertion order inside one priority', () => {
  expect(orderNarrativeQueue(twoScenes).map((x) => x.id)).toEqual(['earlier', 'later']);
});
```

- [ ] **Step 2: Implement fixed priority ordering**

```ts
export type PlayerQueueKind = 'urgent-interrupt' | 'phone' | 'activity-complete' | 'scene' | 'ambient';
export type PlayerNarrativeQueueItem = { id: string; kind: PlayerQueueKind; minute: number; insertionOrder: number };

const PRIORITY: Record<PlayerQueueKind, number> = {
  'urgent-interrupt': 0,
  phone: 1,
  'activity-complete': 2,
  scene: 3,
  ambient: 4,
};

export function orderNarrativeQueue<T extends PlayerNarrativeQueueItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.minute - b.minute || a.insertionOrder - b.insertionOrder);
}
```

- [ ] **Step 3: Adapt narrative projection**

Add stable authored insertion order to projected scenes. Do not insert hidden world history into queue candidates.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npm test -- playerNarrativeQueue.test.ts narrativeProjection.test.ts
npm test
npm run build
git add src/playerNarrative/queue.ts src/narrative/projection.ts tests/playerNarrativeQueue.test.ts
git commit -m "feat: order player narrative queue"
```

Push and wait for CI GREEN.

---

### Task 7: Deterministic Player Runtime replay/reconciliation

**Files:**
- Create: `src/playerNarrative/runtime.ts`
- Modify: `src/playerNarrative/model.ts`
- Test: `tests/playerNarrativeRuntime.test.ts`

**Interfaces:**
- Consumes `StoryBundle`, `PlayerSessionV2`, current wall-clock time.
- Produces `reconcilePlayerRuntime(story, session, nowMs): PlayerRuntimeView`.

- [ ] **Step 1: Write runtime tests with real story data**

```ts
it('replays simulator state from submitted actions', () => {
  const story = loadRealStory();
  const session = createInitialPlayerSession(0);
  session.submittedActionIds = ['protect_wakaharu'];
  const view = reconcilePlayerRuntime(story, session, (1111 - 860) * 60_000);
  expect(view.worldHistory.some((entry) => entry.eventId === 'evt_1831_station')).toBe(true);
  expect(JSON.stringify(session)).not.toMatch(/doctorDies|wakaharuDies|victim/);
});

it('uses foreground frozen minute while reading', () => {
  const story = loadRealStory();
  const session = createInitialPlayerSession(0);
  session.storyMinuteAtLastSync = 1075;
  session.lastSyncedRealTimeMs = 0;
  session.foregroundFreeze = { sceneId: 'scene-message', frozenMinute: 1075 };
  expect(reconcilePlayerRuntime(story, session, 20 * 60_000).currentStoryMinute).toBe(1075);
});
```

Add a reload/offline test: persist the same session with freeze stripped, reconcile later, and assert Story Time advances.

- [ ] **Step 2: Define runtime view**

```ts
export type PlayerRuntimeView = {
  currentStoryMinute: number;
  currentLocation: string;
  worldState: WorldState;
  worldHistory: WorldlineHistoryEntry[];
  queue: PlayerNarrativeQueueItem[];
  activeActivity: ActivityRun | null;
  availableChoices: PlayerChoiceDefinition[];
  inbox: InboxItem[];
};
```

- [ ] **Step 3: Implement reconciliation in this order**

```text
1. resolve current minute from foreground freeze or pause-aware wall clock
2. call simulateStory({ story, actionIds: submittedActionIds, until: story minute })
3. advance active activity/travel against story minute
4. update location only when travel completes
5. project online observations from protagonist context
6. reconcile persistent inbox for elapsed offline interval
7. project eligible scenes
8. project due ambient beats and activity completion
9. order queue deterministically
10. evaluate choices at frozen minute or current minute
11. return simulator state/history, never player-authored outcome flags
```

Do not implement any `if action X then victim Y` shortcut.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npm test -- playerNarrativeRuntime.test.ts storySimulationAcceptance.test.ts
npm test
npm run build
git add src/playerNarrative/runtime.ts src/playerNarrative/model.ts tests/playerNarrativeRuntime.test.ts
git commit -m "feat: reconcile player narrative runtime"
```

Push and wait for CI GREEN.

---

### Task 8: Player-facing 14:20–18:31 story content

**Files:**
- Modify: `story/narrative/loop_01_prologue.yaml`
- Create: `story/narrative/loop_01_1610_1831.yaml`
- Modify: `story/choices/loop_01_player.yaml`
- Modify: `story/manifests/loop_01.yaml`
- Test: `tests/playerNarrativeStoryAcceptance.test.ts`

**Interfaces:**
- Produces player-facing scenes and choices from ordinary return-home life through the 18:31 result.

- [ ] **Step 1: Write story acceptance tests**

```ts
it('has at least three distinct ordinary arrival choices', () => {
  const story = loadRealStory();
  const arrival = story.playerChoices.filter((choice) => choice.sceneId === 'scene_prologue_arrival');
  expect(arrival.length).toBeGreaterThanOrEqual(3);
  expect(new Set(arrival.map((choice) => JSON.stringify(choice.effects))).size).toBe(arrival.length);
});

it('contains no author-facing outcome labels in player prose', () => {
  const text = JSON.stringify(loadRealStory().narrative.scenes);
  expect(text).not.toMatch(/BAD END|GOOD END|WORLDLINE CHANGED|impactType|Knowledge \+/);
});
```

- [ ] **Step 2: Make Prologue player-relative where appropriate**

Use activity completion/current player state for coffee/store/home/cleaning/reading/mail discovery. Do not make `scene_letter_discovery` require exact 16:00. The letter's `ArtifactDefinition.formedAt` remains world truth; discovery is a player-relative narrative scene.

- [ ] **Step 3: Author ordinary-choice consequences**

Add post-activity prose/facts so:

```text
coffee route -> 8 minutes + resident chatter prose/fact
convenience store -> 6 minutes + shopkeeper mistaken-identity prose/fact
direct home -> earlier old-house arrival and a different first home beat
```

Each visible choice must have at least one tested observable difference.

- [ ] **Step 4: Author 16:10–18:31 scenes**

Create scenes for:

```text
post-letter reaction
Yuan/post-office choice
optional Wakaharu cafe scene
research activity
hospital/doctor observation route
17:55 Wakaharu message with deadline
18:05 station local observation
18:10 Yuan schedule-dependent observation
18:18 Wakaharu knowledge-dependent line
18:20–18:31 final action/travel choices
18:31 result presentation variants
```

Use existing canonical action IDs: `send_yuan_to_post_office`, `show_letter_to_wakaharu`, `confront_reporter`, `protect_wakaharu`, `stop_doctor`.

- [ ] **Step 5: Verify knowledge and story consistency**

```bash
npm run sync-story
npm test -- playerNarrativeStoryAcceptance.test.ts knowledgeValidation.test.ts narrativeFoundationAcceptance.test.ts
npm test
npm run build
```

- [ ] **Step 6: Commit/push**

```bash
git add story tests/playerNarrativeStoryAcceptance.test.ts
git commit -m "feat: author first playable narrative slice"
```

Wait for fresh CI GREEN.

---

### Task 9: Novel-first Player UI and Artifact presentation

**Files:**
- Create: `src/playerNarrative/main.tsx`
- Create: `src/playerNarrative/PlayerNarrativeApp.tsx`
- Create: `src/playerNarrative/playerNarrative.css`
- Create: `src/playerNarrative/components/NarrativeSurface.tsx`
- Create: `src/playerNarrative/components/ActivitySurface.tsx`
- Create: `src/playerNarrative/components/ArtifactSurface.tsx`
- Create: `src/playerNarrative/components/ChoiceSurface.tsx`
- Create: `src/playerNarrative/components/InterruptSurface.tsx`
- Create: `src/playerNarrative/components/CharacterDrawer.tsx`
- Modify: `player.html`
- Modify: `vite.config.ts`
- Test: `tests/playerNarrativeUi.test.tsx`

**Interfaces:**
- Consumes `PlayerRuntimeView` and player-safe narrative/artifact/character projections.
- Produces one player surface with Narrative / Activity / Artifact / Choice / Interrupt states.

- [ ] **Step 1: Write UI tests**

```tsx
it('renders prose without debug labels', () => {
  render(<NarrativeSurface blocks={[{ type: 'narration', text: '火車進站時，我差點沒認出月台。' }]} />);
  expect(screen.getByText('火車進站時，我差點沒認出月台。')).toBeInTheDocument();
  expect(screen.queryByText(/WORLDLINE|impactType|Knowledge \+|BAD END/i)).toBeNull();
});

it('renders ambient activity without progress UI', () => {
  render(<ActivitySurface timeLabel="15:41" title="正在看書" prose="茶已經沒有剛才那麼燙了。" />);
  expect(screen.getByText('茶已經沒有剛才那麼燙了。')).toBeInTheDocument();
  expect(screen.queryByText(/%|剩餘|EXP/i)).toBeNull();
});

it('uses identical visual class for ordinary and causal choices', () => {
  render(<ChoiceSurface choices={[coffeeChoice, protectChoice]} onChoose={() => {}} />);
  const buttons = screen.getAllByRole('button');
  expect(buttons[0].className).toBe(buttons[1].className);
});
```

Add an Artifact test: `拆開信封` reveals full letter content and never renders `Artifact ID` or author metadata.

- [ ] **Step 2: Implement Narrative/Dialogue surface**

Render narration/monologue/dialogue in paragraph beats. `繼續` changes only presentation state; it must not call `resumeWorld` until the current scene is explicitly completed.

- [ ] **Step 3: Implement Activity surface**

Props:

```ts
{ timeLabel: string; title: string; prose?: string }
```

No countdown, percentage, XP, remaining time, or progress bar.

- [ ] **Step 4: Implement Artifact surface**

For letters use DOM/CSS states:

```text
envelope front -> envelope back/postmark -> open -> letter sheet
```

Use CSS perspective/transform/shadow/subtle parallax only.

- [ ] **Step 5: Implement Choice/Interrupt/Character surfaces**

Choice components receive only `{ id, label }` player-facing data. Character drawer uses player-known projection only. Interrupt UI never displays event IDs or visibility flags.

- [ ] **Step 6: Implement app shell and repoint player entry**

Player shell:

```text
center: current narrative/activity/artifact/interrupt
upper-right: story time
lower-left: character drawer trigger
```

Change `player.html` to:

```html
<script type="module" src="/src/playerNarrative/main.tsx"></script>
```

Keep Vite build inputs named `viewer` and `player`.

- [ ] **Step 7: Verify GREEN and commit**

```bash
npm test -- playerNarrativeUi.test.tsx App.test.tsx
npm test
npm run build
git add player.html vite.config.ts src/playerNarrative tests/playerNarrativeUi.test.tsx
git commit -m "feat: add novel-first player narrative surface"
```

Push and wait for CI GREEN.

---

### Task 10: 18:31 End-to-End acceptance, late travel, offline deadline, cleanup

**Files:**
- Create: `tests/playerNarrative1831Acceptance.test.ts`
- Modify only if a failing acceptance requires it: files owned by Tasks 2–9
- Remove only if proven unreferenced: obsolete `src/player/**` prototype files

**Interfaces:**
- Produces final proof that Player Narrative UI uses the same Story Simulator for different 18:31 outcomes and never exposes hidden causality.

- [ ] **Step 1: Add simulator-outcome acceptance**

Create `tests/playerNarrative1831Acceptance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { reconcilePlayerRuntime } from '../src/playerNarrative/runtime';

const elapsedTo1831Ms = (1111 - 860) * 60_000;

describe('18:31 player narrative acceptance', () => {
  it('gets different world states from the same simulator under different submitted actions', () => {
    const story = loadRealStory();
    const baseline = createInitialPlayerSession(0);
    const rescue = createInitialPlayerSession(0);
    rescue.submittedActionIds = ['protect_wakaharu'];

    const a = reconcilePlayerRuntime(story, baseline, elapsedTo1831Ms);
    const b = reconcilePlayerRuntime(story, rescue, elapsedTo1831Ms);

    expect(a.worldState.characters.wakaharu.status).toBe('dead');
    expect(b.worldState.characters.wakaharu.status).not.toBe('dead');
    expect(a.worldState).not.toEqual(b.worldState);
  });

  it('never queues hidden source IDs', () => {
    const story = loadRealStory();
    const view = reconcilePlayerRuntime(story, createInitialPlayerSession(0), elapsedTo1831Ms);
    const hiddenIds = new Set(view.worldHistory.filter((entry) => entry.visibility === 'hidden').map((entry) => entry.eventId ?? entry.sourceId));
    expect(view.queue.every((item) => !hiddenIds.has(item.id))).toBe(true);
  });
});
```

- [ ] **Step 2: Add late-travel acceptance**

Create a session at old house at 18:12, choose travel to old station, and assert:

```text
travel depart = 18:12
18:31 event exists in world history
travel arrival = 18:34
player was not locally present for 18:31 station observation
arrival is allowed and aftermath can be projected after 18:34
```

- [ ] **Step 3: Add offline-deadline acceptance**

Persist a session after the 17:55 message is available but unopened; reload/reconcile at 18:08 and assert:

```text
foregroundFreeze == null
immediate reply choice absent
persistent phone message/missed-call item remains according to authored policy
world time advanced while away
```

- [ ] **Step 4: Verify old prototype is no longer imported**

```bash
rg "src/player/|from './player|from '../player" .
```

Delete old prototype files only if they have zero remaining runtime/test imports and no required migration behavior. Do not delete them simply for cleanliness.

- [ ] **Step 5: Full final verification**

```bash
npm run sync-story
npm test
npm run build
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- .github/workflows
```

Expected:

```text
all tests pass
TypeScript/build passes
viewer + player both build
no unintended workflow changes
no untracked files
```

- [ ] **Step 6: Commit final acceptance/cleanup**

```bash
git add .
git commit -m "test: verify player narrative vertical slice"
git push
```

- [ ] **Step 7: Require fresh final GitHub Actions evidence**

Do not mark implementation ready for human merge review until the exact final head shows:

```text
Sync story data  PASS
Run tests        PASS
Build viewer     PASS
```

Do not merge to `main` automatically.

---

## Completion Checklist

- [ ] Current `main` and Narrative Foundation were deliberately reconciled.
- [ ] Player starts at 14:20 in novel-first UI.
- [ ] At least three ordinary opening choices have distinct observable effects.
- [ ] Reading scenes does not advance Story Time.
- [ ] World time advances 1:1 while running.
- [ ] Reload/offline time does not preserve foreground freeze.
- [ ] Player-relative life scenes can shift while 18:31 stays fixed.
- [ ] Activity Ambient Prose is ordered, non-repeating, activity-specific, and fact-aware where authored.
- [ ] Hidden events do not leak into Player Narrative.
- [ ] Local observations can be missed permanently.
- [ ] Phone messages persist and calls can become missed calls.
- [ ] Late travel is allowed and can arrive after 18:31.
- [ ] Choice UI does not reveal importance/impact class.
- [ ] Letter is an in-world Artifact, not an evidence metadata panel.
- [ ] Player save contains no canonical death/victim outcome field.
- [ ] Different submitted actions produce different 18:31 simulator states.
- [ ] Author Viewer still builds and existing tests remain green.
- [ ] Final exact head has fresh GitHub Actions GREEN evidence.
