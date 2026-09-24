# Player Narrative UI v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable player-facing slice from Loop 01 Day 0 14:20 through 18:31, with novel-first presentation, real-time-linked Diegetic Idle Activity, ordinary choices with real consequences, missable observation windows, and simulator-resolved 18:31 outcomes.

**Architecture:** Author Viewer and Player Game remain separate. A new `src/playerNarrative/` runtime/UI consumes the existing Narrative Foundation + Story Simulation. Player save contains time-sync state, player actions, read/open state, player knowledge, location, inbox, and active activity, but never canonical victim/death outcomes. World time advances 1:1 only while the world is running; foreground Narrative/Decision reading freezes story time in memory, and that freeze is never persisted across reload/offline time.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest 2, Testing Library, js-yaml, existing Story Simulation/Narrative Foundation. No Three.js in v0.1.

**Spec:** `docs/superpowers/specs/2026-09-24-player-narrative-ui-v0.1-design.md`

## Global Constraints

- Scope: Loop 01 Day 0 14:20 → 18:31.
- Production: `1 real minute = 1 world minute` while world progression is running.
- Reading Narrative/Decision scenes never consumes Story Time.
- Foreground freeze is in-memory only; reload/offline reconciliation resumes from the last persisted running sync point.
- Fixed World Events such as 18:31 never slide because the player bought coffee or read slowly.
- Player-relative life scenes may slide later when earlier Activities consume time.
- The letter's existence is World Truth; the player's discovery time is player-relative.
- Every visible choice changes at least one player-observable dimension: time, location, prose, reaction, knowledge, later content, or later availability.
- Player UI never labels a choice as Flavor / Knowledge / Schedule / World Intervention.
- Hidden history never leaks directly into Player Narrative.
- Local observations can be permanently missed; messages persist; calls can become missed calls.
- Late travel is legal even when arrival occurs after 18:31.
- 18:31 victim/outcome is resolved by Story Simulation only.
- No stamina, energy, XP, progress bars, countdown UI, Three.js, full map pathfinding, or AI-generated canonical prose.
- Do not change `.github/workflows/**` unless a failing verification proves the current workflow cannot verify the new player surface.
- Never push intentional RED commits. Before every remote commit: targeted tests → full `npm test` → `npm run build`; then wait for fresh GitHub Actions GREEN before dependent work.

## Review Focus

1. Diverged branch integration must preserve current `main` player/build wiring and the validated Narrative Foundation/Simulator.
2. Foreground reading must freeze Story Time without allowing reload to freeze the world forever.
3. Player-relative scenes can move while fixed 18:31 remains fixed.
4. Offline observation persistence must distinguish local, message, call, artifact, and hidden events.
5. Ordinary choices must be testably non-no-op even when they do not affect 18:31.

## Command Convention

Unless a step says otherwise, run npm/test/build commands from:

```bash
cd tools/event-graph-viewer
```

---

### Task 1: Reconcile `main` with Narrative Foundation before feature work

**Files:**
- Merge: current `main`
- Merge: `docs/narrative-foundation-v0.1`
- Verify: `tools/event-graph-viewer/player.html`
- Verify: `tools/event-graph-viewer/vite.config.ts`
- Create test: `tools/event-graph-viewer/tests/integrationBaseline.test.ts`

**Interfaces:**
- Consumes: current `main` old Player prototype + known-green Narrative Foundation stack.
- Produces: `integration/player-narrative-ui-v0.1`, a tested integration base. No new Player Narrative functionality yet.

- [ ] **Step 1: Create the integration branch from fresh main**

From repo root:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c integration/player-narrative-ui-v0.1
```

- [ ] **Step 2: Merge the validated Narrative Foundation stack**

```bash
git merge --no-ff origin/docs/narrative-foundation-v0.1
```

Conflict rules:

```text
story/** and tools/event-graph-viewer/src/narrative/**:
  Narrative Foundation semantics win.

player.html / Vite multi-page wiring:
  keep current main wiring until Task 7 repoints the player entry.

old tools/event-graph-viewer/src/player/**:
  keep temporarily, but never copy its 18:00 hard-coded story semantics.

.github/workflows/**:
  keep current main unchanged.
```

- [ ] **Step 3: Add a baseline test**

Create `tools/event-graph-viewer/tests/integrationBaseline.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

describe('player narrative integration baseline', () => {
  it('keeps a player entry and loads Narrative Foundation', () => {
    expect(existsSync(resolve(process.cwd(), 'player.html'))).toBe(true);
    const story = loadRealStory();
    expect(story.narrative.characters.length).toBeGreaterThanOrEqual(7);
    expect(story.narrative.activities.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Verify the integration base**

```bash
npm run sync-story
npm test -- integrationBaseline.test.ts
npm test
npm run build
```

Expected: all commands exit 0; Vite builds viewer and player entries.

- [ ] **Step 5: Commit, push, and wait for CI**

From repo root:

```bash
git add .
git commit -m "chore: reconcile player narrative integration baseline"
git push -u origin integration/player-narrative-ui-v0.1
```

Do not start Task 2 until this exact head has GitHub Actions GREEN for sync-story, tests, and build.

---

### Task 2: Pause-aware Story Clock and PlayerSession v2

**Files:**
- Create: `tools/event-graph-viewer/src/playerNarrative/model.ts`
- Create: `tools/event-graph-viewer/src/playerNarrative/clock.ts`
- Create: `tools/event-graph-viewer/src/playerNarrative/storage.ts`
- Create test: `tools/event-graph-viewer/tests/playerNarrativeClock.test.ts`
- Create test: `tools/event-graph-viewer/tests/playerNarrativeStorage.test.ts`

**Interfaces:**
- Produces `PlayerSessionV2`, `currentStoryMinute`, `syncRunningTime`, `freezeForeground`, `resumeWorld`, `readPlayerSession`, `writePlayerSession`.

- [ ] **Step 1: Write the clock tests**

Create `tests/playerNarrativeClock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { currentStoryMinute, freezeForeground, resumeWorld, syncRunningTime } from '../src/playerNarrative/clock';

describe('pause-aware player clock', () => {
  it('advances 1 world minute per real minute while running', () => {
    const session = createInitialPlayerSession(1_000);
    expect(currentStoryMinute(session, 1_000)).toBe(860);
    expect(currentStoryMinute(session, 1_000 + 17 * 60_000)).toBe(877);
  });

  it('freezes while a foreground scene is open', () => {
    const session = createInitialPlayerSession(1_000);
    const frozen = freezeForeground(session, 'scene-a', 1_000 + 5 * 60_000);
    expect(currentStoryMinute(frozen, 1_000 + 25 * 60_000)).toBe(865);
  });

  it('resumes from the frozen minute without charging reading time', () => {
    const session = createInitialPlayerSession(1_000);
    const frozen = freezeForeground(session, 'scene-a', 1_000 + 5 * 60_000);
    const resumed = resumeWorld(frozen, 1_000 + 25 * 60_000);
    expect(currentStoryMinute(resumed, 1_000 + 30 * 60_000)).toBe(870);
  });

  it('syncs running time into persistent fields', () => {
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

Expected RED: missing `src/playerNarrative/model` / `clock`.

- [ ] **Step 3: Implement the session model**

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

- [ ] **Step 4: Implement the clock**

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
import { freezeForeground } from '../src/playerNarrative/clock';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { readPlayerSession, writePlayerSession } from '../src/playerNarrative/storage';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe('player narrative storage', () => {
  it('stores player actions but not canonical victim results', () => {
    const storage = new MemoryStorage();
    const session = createInitialPlayerSession(1_000);
    session.submittedActionIds.push('send_yuan_to_post_office');
    expect(writePlayerSession(storage, session)).toBe(true);
    const loaded = readPlayerSession(storage, 2_000);
    expect(loaded.submittedActionIds).toEqual(['send_yuan_to_post_office']);
    expect(JSON.stringify(loaded)).not.toMatch(/wakaharuDies|doctorDies|victim/);
  });

  it('never restores foreground freeze after reload', () => {
    const storage = new MemoryStorage();
    const frozen = freezeForeground(createInitialPlayerSession(1_000), 'scene-a', 2_000);
    writePlayerSession(storage, frozen);
    expect(readPlayerSession(storage, 10_000).foregroundFreeze).toBeNull();
  });
});
```

- [ ] **Step 6: Implement versioned storage**

Create `src/playerNarrative/storage.ts`:

```ts
import { createInitialPlayerSession, type PlayerSessionV2 } from './model';

export const SAVE_KEY = 'ash-town-player-narrative-v2';

export function readPlayerSession(storage: Pick<Storage, 'getItem'>, nowMs: number): PlayerSessionV2 {
  try {
    const raw = storage.getItem(SAVE_KEY);
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
    storage.setItem(SAVE_KEY, JSON.stringify({ ...session, foregroundFreeze: null }));
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
```

From repo root:

```bash
git add tools/event-graph-viewer/src/playerNarrative tools/event-graph-viewer/tests/playerNarrativeClock.test.ts tools/event-graph-viewer/tests/playerNarrativeStorage.test.ts
git commit -m "feat: add pause-aware player story clock"
git push
```

Wait for CI GREEN.

---

### Task 3: Add Player Narrative story schema and authored support data

**Files:**
- Modify: `story/activities/protagonist.yaml`
- Modify: `story/knowledge/facts.yaml`
- Create: `story/choices/loop_01_player.yaml`
- Create: `story/travel/loop_01.yaml`
- Modify: `story/manifests/loop_01.yaml`
- Modify: `tools/event-graph-viewer/src/narrative/types.ts`
- Modify: `tools/event-graph-viewer/src/lib/loadSimulationStory.ts`
- Modify: `tools/event-graph-viewer/scripts/sync-story.mjs`
- Modify: `tools/event-graph-viewer/tests/helpers/loadRealStory.ts`
- Create test: `tools/event-graph-viewer/tests/playerNarrativeStoryData.test.ts`

**Interfaces:**
- Produces `AmbientBeatDefinition`, `PlayerChoiceDefinition`, `PlayerChoiceEffect`, `TravelEdgeDefinition`, `ObservationPersistence`, `StoryBundle.playerChoices`, `StoryBundle.travelEdges`.

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

  it('loads player choices without author impact metadata', () => {
    const choice = loadRealStory().playerChoices.find((item) => item.id === 'arrival_coffee');
    expect(choice?.label).toBe('先去買杯咖啡');
    expect(choice).not.toHaveProperty('impactType');
  });

  it('loads old-house to station travel as 22 minutes', () => {
    expect(loadRealStory().travelEdges).toContainEqual({ from: 'old_house', to: 'old_station', minutes: 22 });
  });
});
```

- [ ] **Step 2: Extend story types**

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

Extend `StoryBundle`:

```ts
playerChoices: PlayerChoiceDefinition[];
travelEdges: TravelEdgeDefinition[];
```

- [ ] **Step 3: Author ordinary-life timed activities and Ambient Prose**

Append to `story/activities/protagonist.yaml`:

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

Add to `rest_and_read`:

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

- [ ] **Step 4: Add facts used by player-facing routes**

Append under `facts:` in `story/knowledge/facts.yaml`:

```yaml
  - id: fact_cafe_resident_chatter
    summary: 在車站外咖啡店聽見居民談起灰潮鎮近年的變化
  - id: fact_shopkeeper_mistook_protagonist_for_zhixia
    summary: 便利商店老闆一度把主角錯認成林知夏
  - id: fact_zhixia_letter_received
    summary: 主角已發現並讀到林知夏署名、郵戳為昨天的信
```

- [ ] **Step 5: Author initial choices and travel edges**

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

- [ ] **Step 6: Wire manifest, sync and loader**

Add to `story/manifests/loop_01.yaml`:

```yaml
player_choices: ../choices/loop_01_player.yaml
travel: ../travel/loop_01.yaml
```

Update loader normalization for snake_case fields. Validate only references with real Source of Truth:

```text
ambient at_minute is integer, >= 0, and < parent activity duration
choice start-activity references existing ActivityDefinition
choice submit-action references existing ActionDefinition
choice learn-fact / requires-facts references existing KnowledgeFact
choice scene_id references existing NarrativeSceneDefinition
travel from/to are non-empty strings and minutes is a positive integer
```

Do not invent a global location registry in v0.1.

Update `loadRealStory.ts` to parse/pass the two new manifest documents.

- [ ] **Step 7: Verify GREEN and commit**

```bash
npm run sync-story
npm test -- playerNarrativeStoryData.test.ts narrativeLoader.test.ts
npm test
npm run build
```

From repo root:

```bash
git add story tools/event-graph-viewer/src/narrative tools/event-graph-viewer/src/lib/loadSimulationStory.ts tools/event-graph-viewer/scripts/sync-story.mjs tools/event-graph-viewer/tests
git commit -m "feat: add player narrative authored data"
git push
```

Wait for CI GREEN.

---

### Task 4: Runtime primitives — Ambient, Choice, Travel, Inbox, Queue

**Files:**
- Create: `src/playerNarrative/ambient.ts`
- Create: `src/playerNarrative/choices.ts`
- Create: `src/playerNarrative/travel.ts`
- Create: `src/playerNarrative/inbox.ts`
- Create: `src/playerNarrative/queue.ts`
- Modify: `src/narrative/observation.ts`
- Create tests: `tests/ambientActivity.test.ts`, `tests/choiceDeadline.test.ts`, `tests/travelRuntime.test.ts`, `tests/observationPersistence.test.ts`, `tests/playerNarrativeQueue.test.ts`

**Interfaces:**
- Produces `projectAmbientBeats`, `availableChoicesForScene`, `planTravel`, `reconcilePersistentObservations`, `orderNarrativeQueue`.

- [ ] **Step 1: Write self-contained Ambient Prose tests**

Create `tests/ambientActivity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { projectAmbientBeats } from '../src/playerNarrative/ambient';
import type { ActivityDefinition } from '../src/narrative/types';
import type { ActivityRun } from '../src/narrative/activity';

const definition: ActivityDefinition = {
  id: 'read', durationMinutes: 20, interruptible: true,
  presentation: { start: 'start', idle: 'idle', complete: 'done' },
  ambient: [
    { id: 'a', atMinute: 5, text: 'A' },
    { id: 'b', atMinute: 11, text: 'B' },
    { id: 'c', atMinute: 17, text: 'C', requiresFacts: ['letter'] },
  ],
};

function run(consumedMinutes: number): ActivityRun {
  return {
    activityId: 'read', startedAt: 900, durationMinutes: 20,
    consumedMinutes, remainingMinutes: 20 - consumedMinutes,
    interruptible: true, status: consumedMinutes >= 20 ? 'complete' : 'running',
  };
}

describe('ambient prose', () => {
  it('returns only due beats in order', () => {
    expect(projectAmbientBeats(run(12), definition, []).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('applies fact requirements', () => {
    expect(projectAmbientBeats(run(18), definition, []).map((x) => x.id)).toEqual(['a', 'b']);
    expect(projectAmbientBeats(run(18), definition, ['letter']).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});
```

Implement:

```ts
export function projectAmbientBeats(run: ActivityRun, definition: ActivityDefinition, knownFactIds: Iterable<string>) {
  const known = new Set(knownFactIds);
  return (definition.ambient ?? [])
    .filter((beat) => beat.atMinute <= run.consumedMinutes)
    .filter((beat) => (beat.requiresFacts ?? []).every((id) => known.has(id)))
    .sort((a, b) => a.atMinute - b.atMinute);
}
```

The caller removes IDs already in `session.consumedAmbientBeatIds`.

- [ ] **Step 2: Write self-contained Choice deadline tests**

Create `tests/choiceDeadline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { availableChoicesForScene } from '../src/playerNarrative/choices';
import type { PlayerChoiceDefinition } from '../src/narrative/types';

const choices: PlayerChoiceDefinition[] = [
  { id: 'reply', sceneId: 'msg', label: '回她', availableUntil: 1080, effects: [] },
  { id: 'call', sceneId: 'msg', label: '打給她', effects: [] },
];

describe('choice deadlines', () => {
  it('removes an expired unopened response', () => {
    expect(availableChoicesForScene(choices, 'msg', 1075, []).map((x) => x.id)).toEqual(['reply', 'call']);
    expect(availableChoicesForScene(choices, 'msg', 1088, []).map((x) => x.id)).toEqual(['call']);
  });
});
```

Implement filtering by scene, `availableFrom`, `availableUntil`, and `requiresFacts`.

- [ ] **Step 3: Write self-contained travel test and implement `planTravel`**

Create `tests/travelRuntime.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planTravel } from '../src/playerNarrative/travel';

const edges = [{ from: 'old_house', to: 'old_station', minutes: 22 }];

describe('travel runtime', () => {
  it('allows arrival after 18:31', () => {
    expect(planTravel(edges, 'old_house', 'old_station', 1092)).toEqual({
      from: 'old_house', to: 'old_station', departMinute: 1092, arriveMinute: 1114, durationMinutes: 22,
    });
  });
});
```

Implement:

```ts
export function planTravel(edges: TravelEdgeDefinition[], from: string, to: string, departMinute: number) {
  const edge = edges.find((item) => item.from === from && item.to === to);
  if (!edge) throw new Error(`No authored travel route: ${from} -> ${to}`);
  return { from, to, departMinute, arriveMinute: departMinute + edge.minutes, durationMinutes: edge.minutes };
}
```

- [ ] **Step 4: Write explicit observation persistence tests**

Create `tests/observationPersistence.test.ts` with four complete `WorldlineHistoryEntry` fixtures:

```ts
const base = { minute: 1075, absoluteMinute: 1075, day: 0, time: '17:55', sequence: 1, title: 'x', effects: [] };
const localEvent = { ...base, eventId: 'local', visibility: 'observable' as const };
const messageEvent = { ...base, eventId: 'message', visibility: 'observable' as const };
const callEvent = { ...base, eventId: 'call', visibility: 'observable' as const };
const hiddenEvent = { ...base, eventId: 'hidden', visibility: 'hidden' as const };
```

Rules under test:

```text
local + persistence=ephemeral -> [] offline
message + persistence=message -> InboxItem kind=message
call + persistence=missed-call -> InboxItem kind=missed-call
hidden -> [] always
```

Implement:

```ts
export type InboxItem = {
  id: string;
  sourceId: string;
  occurredMinute: number;
  kind: 'message' | 'missed-call' | 'artifact';
  opened: boolean;
};
```

Move offline persistence decisions out of generic `projectObservation`; keep online `canObserve` behavior.

- [ ] **Step 5: Write self-contained queue test and implement priority**

Create `tests/playerNarrativeQueue.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { orderNarrativeQueue, type PlayerNarrativeQueueItem } from '../src/playerNarrative/queue';

const items: PlayerNarrativeQueueItem[] = [
  { id: 'ambient', kind: 'ambient', minute: 100, insertionOrder: 4 },
  { id: 'scene', kind: 'scene', minute: 100, insertionOrder: 3 },
  { id: 'complete', kind: 'activity-complete', minute: 100, insertionOrder: 2 },
  { id: 'phone', kind: 'phone', minute: 100, insertionOrder: 1 },
  { id: 'interrupt', kind: 'urgent-interrupt', minute: 100, insertionOrder: 0 },
];

describe('narrative queue', () => {
  it('uses explicit priority', () => {
    expect(orderNarrativeQueue(items).map((x) => x.id)).toEqual(['interrupt', 'phone', 'complete', 'scene', 'ambient']);
  });
});
```

Implement fixed priority:

```ts
urgent-interrupt=0
phone=1
activity-complete=2
scene=3
ambient=4
```

Tie-break by minute, then insertion order.

- [ ] **Step 6: Verify GREEN and commit**

```bash
npm test -- ambientActivity.test.ts choiceDeadline.test.ts travelRuntime.test.ts observationPersistence.test.ts playerNarrativeQueue.test.ts
npm test
npm run build
```

From repo root:

```bash
git add tools/event-graph-viewer/src tools/event-graph-viewer/tests
git commit -m "feat: add player narrative runtime primitives"
git push
```

Wait for CI GREEN.

---

### Task 5: Deterministic Player Runtime replay/reconciliation

**Files:**
- Create: `src/playerNarrative/runtime.ts`
- Modify: `src/playerNarrative/model.ts`
- Modify: `src/playerNarrative/choices.ts`
- Create test: `tests/playerNarrativeRuntime.test.ts`

**Interfaces:**
- Consumes `StoryBundle`, `PlayerSessionV2`, wall-clock `nowMs`.
- Produces `reconcilePlayerRuntime(story, session, nowMs): PlayerRuntimeView` and `applyChoiceEffects(...)`.

- [ ] **Step 1: Write runtime replay/freeze tests**

Create `tests/playerNarrativeRuntime.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { reconcilePlayerRuntime } from '../src/playerNarrative/runtime';

describe('player narrative runtime', () => {
  it('replays simulator history from submitted action IDs', () => {
    const story = loadRealStory();
    const session = createInitialPlayerSession(0);
    session.submittedActionIds = ['protect_wakaharu'];
    const view = reconcilePlayerRuntime(story, session, (1111 - 860) * 60_000);
    expect(view.worldHistory.some((entry) => entry.eventId === 'evt_1831_station')).toBe(true);
    expect(JSON.stringify(session)).not.toMatch(/doctorDies|wakaharuDies|victim/);
  });

  it('uses frozen story minute while a foreground scene is open', () => {
    const story = loadRealStory();
    const session = createInitialPlayerSession(0);
    session.storyMinuteAtLastSync = 1075;
    session.foregroundFreeze = { sceneId: 'msg', frozenMinute: 1075 };
    expect(reconcilePlayerRuntime(story, session, 30 * 60_000).currentStoryMinute).toBe(1075);
  });
});
```

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

- [ ] **Step 3: Implement `applyChoiceEffects`**

For each effect:

```text
start-activity:
  find ActivityDefinition; startActivity(activityId, currentStoryMinute, definition)

submit-action:
  append action ID once; never write outcome flags

travel:
  planTravel(currentLocation, destination, currentStoryMinute);
  store an interruptible travel ActivityRun whose completion updates currentLocation

learn-fact:
  append fact ID once
```

A choice does not instantly add arbitrary minutes. Time passes because the resulting Activity/travel runs while the world clock runs.

- [ ] **Step 4: Implement `reconcilePlayerRuntime` in this exact order**

```text
1. derive current Story Time from foreground freeze or pause-aware clock
2. call simulateStory({ story, actionIds: session.submittedActionIds, until: current Story Time })
3. advance active Activity/travel to current Story Time
4. update protagonist location only when travel completes
5. project online observations from actual location/channel
6. reconcile persistent inbox for offline elapsed interval
7. project eligible Narrative Scenes
8. project due Ambient Prose and Activity completion
9. remove consumed scene/ambient IDs
10. order queue deterministically
11. evaluate choices at frozen minute or current minute
12. return simulator state/history; do not mutate canonical outcome fields into save
```

- [ ] **Step 5: Add reload/offline regression test**

In the same test file:

```ts
it('advances after reload because foreground freeze is not persisted', () => {
  const story = loadRealStory();
  const session = createInitialPlayerSession(0);
  session.storyMinuteAtLastSync = 1075;
  session.lastSyncedRealTimeMs = 0;
  session.foregroundFreeze = null;
  expect(reconcilePlayerRuntime(story, session, 13 * 60_000).currentStoryMinute).toBe(1088);
});
```

- [ ] **Step 6: Verify GREEN and commit**

```bash
npm test -- playerNarrativeRuntime.test.ts storySimulationAcceptance.test.ts
npm test
npm run build
```

From repo root:

```bash
git add tools/event-graph-viewer/src/playerNarrative tools/event-graph-viewer/tests/playerNarrativeRuntime.test.ts
git commit -m "feat: reconcile player narrative runtime"
git push
```

Wait for CI GREEN.

---

### Task 6: Author the playable 14:20–18:31 Player Story

**Files:**
- Modify: `story/narrative/loop_01_prologue.yaml`
- Create: `story/narrative/loop_01_1610_1831.yaml`
- Modify: `story/choices/loop_01_player.yaml`
- Modify: `story/manifests/loop_01.yaml`
- Create test: `tests/playerNarrativeStoryAcceptance.test.ts`

**Interfaces:**
- Produces player-relative life flow, post-letter investigation, deadlines/observations, and player-safe 18:31 presentation.

- [ ] **Step 1: Write story acceptance tests**

Create `tests/playerNarrativeStoryAcceptance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

describe('player narrative story slice', () => {
  it('has at least three distinct ordinary arrival choices', () => {
    const story = loadRealStory();
    const choices = story.playerChoices.filter((choice) => choice.sceneId === 'scene_prologue_arrival');
    expect(choices.length).toBeGreaterThanOrEqual(3);
    expect(new Set(choices.map((choice) => JSON.stringify(choice.effects))).size).toBe(choices.length);
  });

  it('contains no player-facing debug/outcome labels', () => {
    const text = JSON.stringify(loadRealStory().narrative.scenes);
    expect(text).not.toMatch(/BAD END|GOOD END|WORLDLINE CHANGED|impactType|Knowledge \+/);
  });
});
```

- [ ] **Step 2: Convert Prologue from fixed presentation timing to player-relative life flow**

Requirements:

```text
coffee -> 8-minute Activity, then coffee route prose/fact
convenience store -> 6-minute Activity, then mistaken-identity prose/fact
direct home -> no detour; earlier home arrival
letter Artifact already exists in World Truth
scene_letter_discovery becomes eligible after the player reaches/handles the mail context, not because the clock equals exactly 16:00
```

- [ ] **Step 3: Author `loop_01_1610_1831.yaml`**

Include player-facing scenes for:

```text
post-letter reaction
Yuan/post-office choice
optional Wakaharu cafe conversation
research Activity
hospital/doctor route observation
17:55 Wakaharu phone message with response deadline
18:05 station local observation
18:10 Yuan schedule-dependent observation
18:18 Wakaharu knowledge-dependent line
18:20–18:31 final action/travel choices
18:31 result presentation variants
```

Use canonical action IDs only:

```text
send_yuan_to_post_office
show_letter_to_wakaharu
confront_reporter
protect_wakaharu
stop_doctor
```

- [ ] **Step 4: Make every visible choice observably non-no-op**

For each `PlayerChoiceDefinition`, verify at least one of:

```text
starts timed Activity
starts travel/location change
submits canonical simulator action
learns player fact
changes later scene availability/prose through a fact/action/location condition
```

No visible button may have `effects: []` in real story YAML.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm run sync-story
npm test -- playerNarrativeStoryAcceptance.test.ts knowledgeValidation.test.ts narrativeFoundationAcceptance.test.ts
npm test
npm run build
```

From repo root:

```bash
git add story tools/event-graph-viewer/tests/playerNarrativeStoryAcceptance.test.ts
git commit -m "feat: author first playable narrative slice"
git push
```

Wait for CI GREEN.

---

### Task 7: Novel-first Player UI + Artifact presentation

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
- Create test: `tests/playerNarrativeUi.test.tsx`

**Interfaces:**
- Consumes `PlayerRuntimeView` and player-safe projections.
- Produces one surface with Narrative / Activity / Artifact / Choice / Interrupt presentation.

- [ ] **Step 1: Write self-contained UI tests**

Create `tests/playerNarrativeUi.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NarrativeSurface } from '../src/playerNarrative/components/NarrativeSurface';
import { ActivitySurface } from '../src/playerNarrative/components/ActivitySurface';
import { ChoiceSurface } from '../src/playerNarrative/components/ChoiceSurface';

const coffee = { id: 'coffee', label: '先去買杯咖啡' };
const protect = { id: 'protect', label: '現在去找若晴' };

describe('player narrative UI', () => {
  it('renders prose without author/debug labels', () => {
    render(<NarrativeSurface blocks={[{ type: 'narration', text: '火車進站時，我差點沒認出月台。' }]} />);
    expect(screen.getByText('火車進站時，我差點沒認出月台。')).toBeInTheDocument();
    expect(screen.queryByText(/WORLDLINE|impactType|Knowledge \+|BAD END/i)).toBeNull();
  });

  it('renders Ambient Prose without progress UI', () => {
    render(<ActivitySurface timeLabel="15:41" title="正在看書" prose="茶已經沒有剛才那麼燙了。" />);
    expect(screen.getByText('茶已經沒有剛才那麼燙了。')).toBeInTheDocument();
    expect(screen.queryByText(/%|剩餘|EXP/i)).toBeNull();
  });

  it('styles ordinary and causal choices identically', () => {
    render(<ChoiceSurface choices={[coffee, protect]} onChoose={() => undefined} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toBe(buttons[1].className);
  });
});
```

- [ ] **Step 2: Implement Narrative/Dialogue surface**

Render narration, monologue and dialogue as paragraph beats. `繼續` advances presentation only. Keep the world frozen until the current scene is completed and `resumeWorld` is called.

- [ ] **Step 3: Implement Activity surface**

Exact props:

```ts
export type ActivitySurfaceProps = {
  timeLabel: string;
  title: string;
  prose?: string;
};
```

Render no countdown, percentage, remaining time, XP or progress bar.

- [ ] **Step 4: Implement Artifact surface**

For letter Artifact use DOM/CSS states:

```text
envelope front -> envelope back/postmark -> open -> letter sheet
```

Use CSS `perspective`, `transform`, `box-shadow`, and subtle parallax. No new graphics engine dependency.

Add a test in `playerNarrativeUi.test.tsx` that clicks `拆開信封`, sees full letter content, and never sees `Artifact ID`.

- [ ] **Step 5: Implement Choice, Interrupt, Character Drawer**

`ChoiceSurface` receives only `{ id, label }`. `InterruptSurface` receives player prose/presentation only, not event IDs or visibility. `CharacterDrawer` renders player-known Character projection only.

- [ ] **Step 6: Repoint the existing player entry**

`player.html` must load:

```html
<script type="module" src="/src/playerNarrative/main.tsx"></script>
```

Keep Vite inputs named `viewer` and `player`; do not add a third page.

- [ ] **Step 7: Verify GREEN and commit**

```bash
npm test -- playerNarrativeUi.test.tsx App.test.tsx
npm test
npm run build
```

From repo root:

```bash
git add tools/event-graph-viewer/player.html tools/event-graph-viewer/vite.config.ts tools/event-graph-viewer/src/playerNarrative tools/event-graph-viewer/tests/playerNarrativeUi.test.tsx
git commit -m "feat: add novel-first player narrative surface"
git push
```

Wait for CI GREEN.

---

### Task 8: End-to-end 18:31 acceptance, late travel, offline deadline, cleanup

**Files:**
- Create: `tests/playerNarrative1831Acceptance.test.ts`
- Modify only if a failing acceptance requires it: files owned by Tasks 2–7
- Remove only if proven unused: obsolete `src/player/**` prototype files

**Interfaces:**
- Produces final evidence that Player UI uses the same Story Simulator, deadlines/offline rules work, and hidden causality stays hidden.

- [ ] **Step 1: Add real-story 18:31 simulator acceptance**

Create `tests/playerNarrative1831Acceptance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { reconcilePlayerRuntime } from '../src/playerNarrative/runtime';

const elapsedTo1831Ms = (1111 - 860) * 60_000;

describe('player narrative 18:31 acceptance', () => {
  it('gets different simulator world states from different player actions', () => {
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

  it('does not queue hidden history source IDs', () => {
    const story = loadRealStory();
    const view = reconcilePlayerRuntime(story, createInitialPlayerSession(0), elapsedTo1831Ms);
    const hidden = new Set(
      view.worldHistory
        .filter((entry) => entry.visibility === 'hidden')
        .map((entry) => entry.eventId ?? entry.actionId ?? entry.scheduleEntryId ?? entry.sourceId),
    );
    expect(view.queue.every((item) => !hidden.has(item.id))).toBe(true);
  });
});
```

- [ ] **Step 2: Add late-travel acceptance in the same file**

Build a session at `old_house` with Story Time 18:12, apply `travel -> old_station`, reconcile through 18:34, and assert:

```text
TravelPlan departMinute = 1092
TravelPlan arriveMinute = 1114
worldHistory already contains evt_1831_station before arrival
18:31 present-channel station observation is absent because protagonist had not arrived
currentLocation becomes old_station only at/after 1114
```

- [ ] **Step 3: Add offline-deadline acceptance in the same file**

Create a session synchronized at 17:55 with no foreground freeze; reconcile at 18:08 and assert:

```text
currentStoryMinute = 1088
foregroundFreeze remains null
choice with availableUntil=1080 is absent
persistent phone message/missed-call item remains according to authored persistence
```

- [ ] **Step 4: Prove old prototype imports are dead before removing anything**

From repo root:

```bash
rg "src/player/|from './player|from '../player" tools/event-graph-viewer
```

Delete old `src/player/**` files only when they have zero runtime/test imports and no tested migration responsibility. Otherwise leave them for a separate cleanup task.

- [ ] **Step 5: Full final verification**

```bash
npm run sync-story
npm test
npm run build
```

From repo root:

```bash
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- .github/workflows
```

Expected:

```text
all tests pass
TypeScript/Vite build passes
viewer and player both build
no unintended workflow changes
no untracked files
```

- [ ] **Step 6: Commit, push, wait for exact-head CI**

```bash
git add .
git commit -m "test: verify player narrative vertical slice"
git push
```

Do not mark the implementation PR ready for human merge review until the exact final head has:

```text
Sync story data  PASS
Run tests        PASS
Build viewer     PASS
```

Do not merge to `main` automatically.

---

## Completion Checklist

- [ ] `main` + Narrative Foundation were deliberately reconciled before feature work.
- [ ] Player starts at 14:20 in novel-first UI.
- [ ] At least three ordinary opening choices have distinct observable effects.
- [ ] Reading scenes does not advance Story Time.
- [ ] Running world time advances 1:1.
- [ ] Reload/offline does not preserve foreground freeze.
- [ ] Player-relative life scenes can shift while 18:31 stays fixed.
- [ ] Ambient Prose is ordered, non-repeating, activity-specific and fact-aware where authored.
- [ ] Hidden events do not leak directly into Player Narrative.
- [ ] Local observation can be permanently missed.
- [ ] Messages persist and calls can become missed calls.
- [ ] Late travel is legal and can arrive after 18:31.
- [ ] Choice UI does not reveal importance/impact type.
- [ ] Letter is presented as an in-world Artifact, not metadata/evidence snippets.
- [ ] Player save contains no canonical victim/death field.
- [ ] Different submitted actions produce different 18:31 simulator states.
- [ ] Existing Author Viewer still builds and tests pass.
- [ ] Final exact head has fresh GitHub Actions GREEN evidence.
