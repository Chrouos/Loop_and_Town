# Player Narrative UI v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first player-facing 14:20→18:31 vertical slice as a novel-first, real-time-linked experience that consumes Narrative Foundation + Story Simulation, supports diegetic idle activity, authored ambient prose, ordinary-but-consequential choices, deadlines, travel, artifacts, offline reconciliation, and simulator-resolved 18:31 outcomes.

**Architecture:** First create a deliberate integration baseline that combines current `main` with the Narrative Foundation stack without losing the old player entrypoint/build wiring. Then replace the old player runtime with a pure Player Runtime layer that stores player actions/knowledge/activity state, deterministically replays World Truth through `simulateStory()`, projects only observable narrative, and renders the result through a new Novel / Activity / Artifact / Choice / Interrupt surface. Fixed World Events stay absolute; player-relative scenes advance from completed activities and choices.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest 2, js-yaml, existing Story Simulation / Narrative Foundation runtime. No new runtime dependency is required for v0.1.

**Spec:** `docs/superpowers/specs/2026-09-24-player-narrative-ui-v0.1-design.md`

## Global Constraints

- Production time mapping remains `1 real minute = 1 world minute`.
- Story YAML stores Story Time / world minutes only; real timestamps stay in Player Runtime.
- `Narrative Scene`, `Activity`, `Artifact`, and World `Event` remain separate concepts.
- The Player UI must never hard-code who dies at 18:31; outcomes come from `simulateStory()`.
- Player save stores player actions/knowledge/activity progress, not canonical death/NPC-location outcomes.
- Fixed World Events such as 18:31 remain absolute even when player-relative Prologue scenes drift.
- Opening a decision scene freezes only the current foreground decision moment; the freeze is not persisted across close/offline.
- Local observations missed while absent are not backfilled. Phone messages may persist; phone calls become missed calls.
- Ordinary choices must change at least one of time, location, prose, knowledge, relationship response, or later availability.
- Choice impact class (`Flavor`, `Knowledge`, `Schedule`, `World Intervention`) is author-only and never rendered to the player.
- Diegetic Idle UI uses authored ambient prose, not progress bars, EXP, stamina, or random text spam.
- No Three.js dependency in v0.1.
- Do not modify `.github/workflows/**` unless the existing workflow is proven incapable of validating the player build.
- Do not push intentional RED-only commits to GitHub. Each pushed batch must be a GREEN candidate.
- Stop stacking dependent work immediately if GitHub Actions turns red.

## File Structure

The implementation should converge on this structure after integration:

```text
tools/event-graph-viewer/
  player.html
  src/player/
    main.tsx
    PlayerApp.tsx
    player.css
    runtime/
      types.ts            # PlayerSession, PlayerClock, DecisionLock, inbox types
      clock.ts            # real time <-> Story Time mapping; fake clock interface
      save.ts             # v2 normalization/read/write; no canonical World Truth
      replay.ts           # deterministic simulator replay from submitted action IDs
      timing.ts           # fixed vs player-relative scene readiness
      activity.ts         # ActivityRun + ambient beat projection
      observation.ts      # persistence / missed / deferred observation semantics
      choice.ts           # choice availability + effects
      travel.ts           # authored route durations + late-arrival semantics
      queue.ts            # deterministic Narrative Queue
      reconcile.ts        # one public reconcilePlayerSession() orchestration function
    components/
      NarrativeStage.tsx
      ActivityStage.tsx
      ArtifactStage.tsx
      ChoiceList.tsx
      PhoneOverlay.tsx
      CharacterDrawer.tsx

story/
  activities/protagonist.yaml
  artifacts/zhixia_letter.yaml
  locations/loop_01.yaml
  narrative/loop_01_prologue.yaml
  narrative/loop_01_player_1610_1831.yaml
  manifests/loop_01.yaml
```

Keep Author Viewer files in `src/App.tsx` / `src/components/**` separate from the Player surface.

## Review Focus

1. **Foreground decision freeze vs tab close/offline:** a decision opened at 17:56 must remain stable while reading in the same foreground session, but reopening at 18:08 must recompute available choices from 18:08.
2. **Player-relative scenes vs fixed World Events:** buying coffee may delay the letter discovery, but must never move the 18:31 station event.
3. **Observation persistence:** a local 18:05 station observation missed at home must never be backfilled; a phone message received offline must remain readable later.
4. **Save corruption / old save data:** malformed localStorage must create a valid v2 session without saving derived death/NPC-location fields.
5. **Late travel across 18:31:** leaving at 18:12 for a 22-minute route must be allowed; replay must resolve 18:31 before arrival at 18:34.

---

### Task 1: Build a deliberate integration baseline before Player work

**Files:**
- Merge current `main` with `docs/narrative-foundation-v0.1` on a new integration branch.
- Resolve: `tools/event-graph-viewer/vite.config.ts`
- Resolve if needed: `tools/event-graph-viewer/src/App.tsx`
- Resolve if needed: `tools/event-graph-viewer/src/styles.css`
- Preserve: `tools/event-graph-viewer/player.html`
- Preserve temporarily: `tools/event-graph-viewer/src/player/**`

**Interfaces:**
- Consumes: current `main` player entrypoint and Narrative Foundation story/runtime.
- Produces: one green branch containing both surfaces before any new Player Narrative code.

- [ ] **Step 1: Create integration branch from current main**

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c integration/player-narrative-ui-v0.1
```

- [ ] **Step 2: Merge the known-green Narrative Foundation branch without squashing**

```bash
git merge --no-ff origin/docs/narrative-foundation-v0.1
```

Expected conflict policy:

```text
vite.config.ts
  keep main's production base `/Loop_and_Town/`
  keep main's multi-page inputs: index.html + player.html
  keep Narrative Foundation's existing Vitest config

src/App.tsx
  keep Narrative Foundation Author Viewer / Character Graph behavior

src/player/**
  keep main prototype temporarily; do not port its 18:00 semantics forward
```

The merged `vite.config.ts` must end with this behavior:

```ts
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Loop_and_Town/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { viewer: 'index.html', player: 'player.html' },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
}));
```

- [ ] **Step 3: Run the full integration baseline locally**

```bash
cd tools/event-graph-viewer
npm install
npm run sync-story
npm test
npm run build
```

Expected: all existing Story Simulation, Narrative Foundation, Author Viewer, and old Player prototype tests pass; Vite emits both viewer and player entries.

- [ ] **Step 4: Commit the integration resolution**

```bash
git add .
git commit -m "chore: integrate narrative foundation with current main"
```

- [ ] **Step 5: Push and open a Draft integration PR to `main`**

Do not start Task 2 until GitHub Actions shows fresh PASS for sync-story, tests, and build.

---

### Task 2: Extend Narrative Foundation schema for player choices, relative scenes, ambient beats, and locations

**Files:**
- Modify: `tools/event-graph-viewer/src/narrative/types.ts`
- Modify: `tools/event-graph-viewer/src/lib/loadSimulationStory.ts`
- Modify: `tools/event-graph-viewer/src/narrative/validation.ts`
- Modify: `story/manifests/loop_01.yaml`
- Create: `story/locations/loop_01.yaml`
- Test: `tools/event-graph-viewer/tests/playerNarrativeSchema.test.ts`
- Test: `tools/event-graph-viewer/tests/narrativeLoader.test.ts`

**Interfaces:**
- Consumes: existing `NarrativeFoundation`, `StoryTimeInput`.
- Produces:
  - `ActivityAmbientBeat`
  - `PlayerChoiceBlock`
  - `PlayerChoiceOption`
  - `NarrativeSceneTiming`
  - `LocationDefinition`
  - `TravelRouteDefinition`
  - `NarrativeFoundation.locations`

- [ ] **Step 1: Write failing schema tests**

Create `tests/playerNarrativeSchema.test.ts` with assertions equivalent to:

```ts
it('loads relative scene timing, ambient beats, choices and travel routes', () => {
  const bundle = buildStoryBundleFromDocuments(realisticDocuments);
  const read = bundle.narrative.activities.find(x => x.id === 'rest_and_read');
  expect(read?.ambient?.map(x => x.offsetMinutes)).toEqual([5, 11, 17]);

  const scene = bundle.narrative.scenes.find(x => x.id === 'scene_arrival_choice');
  expect(scene?.timing).toEqual({ mode: 'fixed', at: '14:20' });

  const choice = scene?.blocks.find(x => x.type === 'choice');
  expect(choice?.options.map(x => x.id)).toEqual([
    'arrival_coffee',
    'arrival_convenience_store',
    'arrival_home',
  ]);

  expect(bundle.narrative.locations.routes).toContainEqual({
    id: 'home_to_station',
    from: 'old_house',
    to: 'old_station',
    durationMinutes: 22,
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

```bash
npm test -- playerNarrativeSchema.test.ts
```

Expected: FAIL because the new types/loader fields do not exist.

- [ ] **Step 3: Add exact type contracts**

Add to `src/narrative/types.ts`:

```ts
export type ActivityAmbientBeat = {
  id: string;
  offsetMinutes: number;
  text: string;
  requiresFacts?: string[];
};

export type PlayerChoiceEffect =
  | { type: 'start_activity'; activityId: string }
  | { type: 'travel'; routeId: string }
  | { type: 'submit_action'; actionId: string }
  | { type: 'grant_fact'; factId: string }
  | { type: 'set_location'; locationId: string }
  | { type: 'open_artifact'; artifactId: string };

export type PlayerChoiceOption = {
  id: string;
  label: string;
  effects: PlayerChoiceEffect[];
  availableUntil?: StoryTimeInput;
};

export type PlayerChoiceBlock = {
  type: 'choice';
  id: string;
  options: PlayerChoiceOption[];
};

export type NarrativeSceneTiming =
  | { mode: 'fixed'; at: StoryTimeInput }
  | { mode: 'after_activity'; activityId: string; offsetMinutes?: number }
  | { mode: 'after_scene'; sceneId: string; offsetMinutes?: number };

export type LocationDefinition = { id: string; name: string };
export type TravelRouteDefinition = {
  id: string;
  from: string;
  to: string;
  durationMinutes: number;
};
export type LocationGraph = {
  locations: LocationDefinition[];
  routes: TravelRouteDefinition[];
};
```

Extend `NarrativeBlock` with `PlayerChoiceBlock`; extend `ActivityDefinition` with `ambient?: ActivityAmbientBeat[]`; extend `NarrativeSceneDefinition` with `timing: NarrativeSceneTiming` and make legacy `at` optional only for loader compatibility; extend `NarrativeFoundation` with `locations: LocationGraph`.

- [ ] **Step 4: Extend manifest loader**

Add optional manifest field:

```ts
locations?: string;
```

Normalize snake_case fields:

```text
offset_minutes -> offsetMinutes
requires_facts -> requiresFacts
available_until -> availableUntil
duration_minutes -> durationMinutes
```

Load `locations` into `NarrativeFoundation.locations`.

- [ ] **Step 5: Add validation**

Validation must reject:

```text
choice references unknown activity/action/fact/artifact/route
route references unknown from/to location
ambient offset < 0
ambient offset > activity duration
relative scene references unknown activity/scene
```

- [ ] **Step 6: Run targeted + full tests + build**

```bash
npm test -- playerNarrativeSchema.test.ts narrativeLoader.test.ts
npm test
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add story tools/event-graph-viewer/src tools/event-graph-viewer/tests
git commit -m "feat: define player narrative story schema"
```

Push only after local GREEN; wait for GitHub Actions GREEN before Task 3.

---

### Task 3: Replace old save model with PlayerSession v2 and injectable clock

**Files:**
- Create: `tools/event-graph-viewer/src/player/runtime/types.ts`
- Create: `tools/event-graph-viewer/src/player/runtime/clock.ts`
- Create: `tools/event-graph-viewer/src/player/runtime/save.ts`
- Test: `tools/event-graph-viewer/tests/playerSession.test.ts`
- Test: `tools/event-graph-viewer/tests/playerClock.test.ts`

**Interfaces:**
- Produces:
  - `PlayerClock`
  - `PlayerSession`
  - `createPlayerSession(nowMs)`
  - `normalizePlayerSession(raw, nowMs)`
  - `readPlayerSession(storage, nowMs)`
  - `writePlayerSession(storage, session)`
  - `storyMinuteAt(session, nowMs)`

- [ ] **Step 1: Write failing save and clock tests**

```ts
it('never persists canonical world outcomes', () => {
  const session = createPlayerSession(1_000);
  expect(session).not.toHaveProperty('wakaharuDies');
  expect(session).not.toHaveProperty('doctorDies');
  expect(session).not.toHaveProperty('reporterLocation');
});

it('maps real minutes to world minutes at 1:1', () => {
  const session = createPlayerSession(1_000);
  expect(storyMinuteAt(session, 1_000 + 7 * 60_000)).toBe(14 * 60 + 27);
});

it('recovers from corrupt storage', () => {
  const storage = { getItem: () => '{broken', setItem: vi.fn() };
  expect(readPlayerSession(storage, 5_000).version).toBe(2);
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- playerSession.test.ts playerClock.test.ts
```

- [ ] **Step 3: Implement `PlayerSession`**

Use this contract:

```ts
export type DecisionLock = {
  sceneId: string;
  storyMinute: number;
};

export type ActiveActivityState = {
  activityId: string;
  startedAtStoryMinute: number;
};

export type PlayerSession = {
  version: 2;
  realTimeAnchorMs: number;
  storyStartMinute: number; // 14:20 => 860
  lastSeenRealMs: number;
  protagonistLocation: string;
  activeActivity: ActiveActivityState | null;
  completedActivityIds: string[];
  completedSceneIds: string[];
  consumedNarrativeIds: string[];
  submittedActionIds: string[];
  playerKnowledgeFactIds: string[];
  openedArtifactIds: string[];
  inboxItemIds: string[];
  decisionLock: DecisionLock | null;
};
```

`createPlayerSession(nowMs)` must initialize at 14:20 / `town_station`.

- [ ] **Step 4: Use a new storage key**

```ts
export const PLAYER_SAVE_KEY = 'ash-town-player-v2';
```

Do not overwrite `ash-town-player-v1`; v0.1 starts a clean compatible save while leaving old prototype data untouched.

- [ ] **Step 5: Define clock abstraction**

```ts
export interface PlayerClock {
  nowMs(): number;
}

export const realClock: PlayerClock = { nowMs: () => Date.now() };

export function storyMinuteAt(session: PlayerSession, nowMs: number): number {
  const elapsed = Math.max(0, nowMs - session.realTimeAnchorMs);
  return session.storyStartMinute + Math.floor(elapsed / 60_000);
}
```

Tests use an object whose `nowMs()` is manually advanced; do not encode accelerated production semantics in YAML.

- [ ] **Step 6: Run targeted + full + build**

```bash
npm test -- playerSession.test.ts playerClock.test.ts
npm test
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add tools/event-graph-viewer/src/player/runtime tools/event-graph-viewer/tests
git commit -m "feat: add player session v2 and clock"
```

---

### Task 4: Implement fixed vs player-relative scene timing and ordinary Prologue choices

**Files:**
- Create: `tools/event-graph-viewer/src/player/runtime/timing.ts`
- Modify: `story/narrative/loop_01_prologue.yaml`
- Modify: `story/activities/protagonist.yaml`
- Test: `tools/event-graph-viewer/tests/playerRelativeTiming.test.ts`
- Test: `tools/event-graph-viewer/tests/ordinaryChoices.test.ts`

**Interfaces:**
- Produces:
  - `resolveSceneMinute(scene, context): number | null`
  - ordinary-choice data for coffee / convenience store / direct home

- [ ] **Step 1: Write failing timing tests**

```ts
it('delays relative scenes when coffee consumes eight minutes', () => {
  const context = {
    fixedStoryMinute: 860,
    completedActivities: new Map([['arrival_coffee', { completedAt: 868 }]]),
    completedScenes: new Map<string, number>(),
  };
  const scene = { timing: { mode: 'after_activity', activityId: 'arrival_coffee' } } as NarrativeSceneDefinition;
  expect(resolveSceneMinute(scene, context)).toBe(868);
});

it('does not move the 18:31 fixed event scene', () => {
  const scene = { timing: { mode: 'fixed', at: '18:31' } } as NarrativeSceneDefinition;
  expect(resolveSceneMinute(scene, emptyContext)).toBe(18 * 60 + 31);
});
```

- [ ] **Step 2: Write failing ordinary-choice effect tests**

Assert all three arrival choices change at least one state dimension:

```ts
expect(choiceEffects('arrival_coffee')).toContainEqual({ type: 'start_activity', activityId: 'buy_coffee' });
expect(choiceEffects('arrival_convenience_store')).toContainEqual({ type: 'start_activity', activityId: 'visit_convenience_store' });
expect(choiceEffects('arrival_home')).toContainEqual({ type: 'travel', routeId: 'station_to_home_direct' });
```

- [ ] **Step 3: Implement timing resolver**

`resolveSceneMinute` rules:

```text
fixed -> convert authored StoryTime directly
after_activity -> completedAt(activity) + offset
after_scene -> completedAt(scene) + offset
missing anchor -> null
```

- [ ] **Step 4: Author Prologue choices**

`scene_arrival_choice` must render identical player-facing style for:

```text
先去買杯咖啡
去便利商店買水
直接回家
```

Author data may internally differ, but must not include labels such as `main`, `critical`, `impact`, or numeric rewards.

- [ ] **Step 5: Make the letter discovery player-relative**

The Artifact already exists at the old house. `scene_discover_zhixia_letter` must be triggered by completing the relevant home/mail activity, not by fixed `16:00`.

- [ ] **Step 6: Run tests + build**

```bash
npm test -- playerRelativeTiming.test.ts ordinaryChoices.test.ts prologueNarrative.test.ts
npm test
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add story tools/event-graph-viewer/src/player/runtime/timing.ts tools/event-graph-viewer/tests
git commit -m "feat: make prologue timing player-relative"
```

---

### Task 5: Add authored Ambient Prose runtime for Diegetic Idle Activity

**Files:**
- Create: `tools/event-graph-viewer/src/player/runtime/activity.ts`
- Modify: `story/activities/protagonist.yaml`
- Test: `tools/event-graph-viewer/tests/playerAmbientActivity.test.ts`

**Interfaces:**
- Consumes: Narrative Foundation `ActivityDefinition`.
- Produces:
  - `projectActivity(activity, startedAt, nowMinute, knownFacts)`
  - `ActivityPresentationState`

- [ ] **Step 1: Write failing ambient tests**

```ts
it('emits ambient beats in authored order without repeats', () => {
  const state = projectActivity(readActivity, 930, 947, new Set());
  expect(state.visibleAmbient.map(x => x.id)).toEqual(['read_05', 'read_11', 'read_17']);
  expect(new Set(state.visibleAmbient.map(x => x.id)).size).toBe(3);
});

it('uses fact-aware prose only when the player knows the fact', () => {
  const before = projectActivity(readActivity, 930, 941, new Set());
  const after = projectActivity(readActivity, 930, 941, new Set(['fact_zhixia_letter_discovered']));
  expect(before.visibleAmbient.map(x => x.text)).not.toContain('我又想起那個郵戳。');
  expect(after.visibleAmbient.map(x => x.text)).toContain('我又想起那個郵戳。');
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- playerAmbientActivity.test.ts
```

- [ ] **Step 3: Implement projection**

Use this output:

```ts
export type ActivityPresentationState = {
  activityId: string;
  status: 'running' | 'complete';
  idleLabel: string;
  visibleAmbient: ActivityAmbientBeat[];
  completedAtStoryMinute: number;
};
```

Only beats whose `offsetMinutes <= elapsed` and whose `requiresFacts` are satisfied are visible.

- [ ] **Step 4: Author the approved ambient prose**

For `rest_and_read`, include the approved beats:

```text
+5  樓下有人騎機車經過。聲音沿著巷子慢慢遠了。
+11 茶已經沒有剛才那麼燙了。
+17 我讀了三頁，才發現同一段看了兩次。
```

Add context-aware post-letter variants and equivalent small sets for cleaning, cooking, research, and waiting.

- [ ] **Step 5: Run targeted + full + build**

```bash
npm test -- playerAmbientActivity.test.ts activityRuntime.test.ts
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add story/activities tools/event-graph-viewer/src/player/runtime/activity.ts tools/event-graph-viewer/tests
git commit -m "feat: add diegetic ambient prose runtime"
```

---

### Task 6: Implement observation persistence, inbox, response deadlines, and foreground-only decision freeze

**Files:**
- Create: `tools/event-graph-viewer/src/player/runtime/observation.ts`
- Create: `tools/event-graph-viewer/src/player/runtime/choice.ts`
- Test: `tools/event-graph-viewer/tests/playerObservationPersistence.test.ts`
- Test: `tools/event-graph-viewer/tests/playerDeadline.test.ts`

**Interfaces:**
- Produces:
  - `projectPlayerObservation()`
  - `availableChoices()`
  - `openDecision()`
  - `clearDecisionLockOnBackground()`

- [ ] **Step 1: Write failing observation persistence tests**

```ts
it('does not backfill missed local observations', () => {
  const projected = projectPlayerObservation(stationDoctorArrival, {
    protagonistLocation: 'old_house',
    online: false,
    storyMinute: 18 * 60 + 10,
  });
  expect(projected).toBeNull();
});

it('keeps an offline phone message for later reading', () => {
  const projected = projectPlayerObservation(wakaharuMessage, {
    protagonistLocation: 'old_house',
    online: false,
    storyMinute: 18 * 60 + 8,
  });
  expect(projected?.persistence).toBe('inbox');
});
```

- [ ] **Step 2: Write failing deadline/freeze tests**

```ts
it('changes choices when a message is opened after its response deadline', () => {
  expect(availableChoices(messageScene, 17 * 60 + 56).map(x => x.id)).toContain('reply_wait_for_me');
  expect(availableChoices(messageScene, 18 * 60 + 8).map(x => x.id)).not.toContain('reply_wait_for_me');
});

it('keeps choices stable while the decision lock is open', () => {
  const lock = openDecision('scene_wakaharu_departure_message', 17 * 60 + 56);
  expect(availableChoices(messageScene, 18 * 60 + 8, lock).map(x => x.id)).toContain('reply_wait_for_me');
});

it('does not persist the freeze after background/close', () => {
  expect(clearDecisionLockOnBackground(openDecision('scene', 1076))).toBeNull();
});
```

- [ ] **Step 3: Implement persistence classes**

Use runtime-only projection values:

```ts
export type PlayerObservation = {
  id: string;
  sourceId: string;
  occurredAtStoryMinute: number;
  channel: 'local' | 'phone_message' | 'phone_call' | 'artifact';
  persistence: 'ephemeral' | 'inbox' | 'missed_call' | 'persistent';
};
```

Do not change World Truth visibility to make persistence work.

- [ ] **Step 4: Implement decision lock semantics**

`availableChoices(scene, nowMinute, lock)` must evaluate deadlines against `lock.storyMinute` only when `lock.sceneId === scene.id`; otherwise evaluate against `nowMinute`.

On `visibilitychange` to hidden and before unload, do not write `decisionLock` to storage; clear it in runtime state.

- [ ] **Step 5: Run targeted + full + build**

```bash
npm test -- playerObservationPersistence.test.ts playerDeadline.test.ts observationProjection.test.ts
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add tools/event-graph-viewer/src/player/runtime tools/event-graph-viewer/tests
git commit -m "feat: add player observation and deadline semantics"
```

---

### Task 7: Add authored locations, travel duration, and late-arrival semantics

**Files:**
- Create: `tools/event-graph-viewer/src/player/runtime/travel.ts`
- Modify: `story/locations/loop_01.yaml`
- Test: `tools/event-graph-viewer/tests/playerTravel.test.ts`

**Interfaces:**
- Produces:
  - `startTravel(routeId, startedAt, locationGraph)`
  - `projectTravel(run, nowMinute)`

- [ ] **Step 1: Write failing travel tests**

```ts
it('allows travel even when arrival is after 18:31', () => {
  const run = startTravel('home_to_station', 18 * 60 + 12, graph);
  expect(run.arrivesAtStoryMinute).toBe(18 * 60 + 34);
});

it('keeps the protagonist away from the station at 18:31 when arriving at 18:34', () => {
  const run = startTravel('home_to_station', 18 * 60 + 12, graph);
  expect(projectTravel(run, 18 * 60 + 31).location).toBe('in_transit');
  expect(projectTravel(run, 18 * 60 + 34).location).toBe('old_station');
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- playerTravel.test.ts
```

- [ ] **Step 3: Author minimal location graph**

Include at least:

```text
town_station
old_street
convenience_store
coffee_shop
old_house
wakaharu_cafe
hospital
post_office
old_station
```

Include explicit routes used by the vertical slice. `home_to_station` must be 22 minutes to lock the approved late-arrival example.

- [ ] **Step 4: Implement travel runtime**

```ts
export type TravelRun = {
  routeId: string;
  from: string;
  to: string;
  startedAtStoryMinute: number;
  arrivesAtStoryMinute: number;
};
```

No pathfinding; unknown direct route is a validation/runtime error.

- [ ] **Step 5: Run full gate and commit**

```bash
npm test -- playerTravel.test.ts
npm test
npm run build
git add story/locations tools/event-graph-viewer/src/player/runtime/travel.ts tools/event-graph-viewer/tests
git commit -m "feat: add authored player travel timing"
```

---

### Task 8: Implement deterministic world replay from PlayerSession actions

**Files:**
- Create: `tools/event-graph-viewer/src/player/runtime/replay.ts`
- Test: `tools/event-graph-viewer/tests/playerReplay.test.ts`

**Interfaces:**
- Consumes: `simulateStory({ story, actionIds, until })`.
- Produces: `replayPlayerWorld(story, session, storyMinute)`.

- [ ] **Step 1: Write failing replay tests**

```ts
it('derives 18:31 outcome from simulator actions rather than save fields', () => {
  const baseline = replayPlayerWorld(story, baselineSession, 18 * 60 + 31);
  const rescue = replayPlayerWorld(story, sessionWith(['protect_wakaharu']), 18 * 60 + 31);
  expect(baseline.state).not.toEqual(rescue.state);
  expect(JSON.stringify(rescueSession)).not.toContain('doctorDies');
});

it('is deterministic for the same session and minute', () => {
  expect(replayPlayerWorld(story, session, 1111)).toEqual(replayPlayerWorld(story, session, 1111));
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- playerReplay.test.ts
```

- [ ] **Step 3: Implement replay adapter**

```ts
export function replayPlayerWorld(
  story: StoryBundle,
  session: PlayerSession,
  storyMinute: number,
): StorySimulationResult {
  return simulateStory({
    story,
    actionIds: session.submittedActionIds,
    until: fromAbsoluteMinute(storyMinute),
  });
}
```

Use the existing StoryTime helper that converts absolute minute to `StoryTimeInput`; do not create a second time format.

- [ ] **Step 4: Run full gate and commit**

```bash
npm test -- playerReplay.test.ts storySimulationAcceptance.test.ts
npm test
npm run build
git add tools/event-graph-viewer/src/player/runtime/replay.ts tools/event-graph-viewer/tests
git commit -m "feat: replay player world through story simulator"
```

---

### Task 9: Build one deterministic reconcile + Narrative Queue pipeline

**Files:**
- Create: `tools/event-graph-viewer/src/player/runtime/queue.ts`
- Create: `tools/event-graph-viewer/src/player/runtime/reconcile.ts`
- Test: `tools/event-graph-viewer/tests/playerNarrativeQueue.test.ts`
- Test: `tools/event-graph-viewer/tests/playerOfflineReconcile.test.ts`

**Interfaces:**
- Produces:
  - `reconcilePlayerSession(input): PlayerRuntimeSnapshot`
  - `PlayerNarrativeItem`

- [ ] **Step 1: Write failing queue ordering test**

```ts
it('orders urgent interrupt before phone message, activity completion and ambient prose', () => {
  const queue = buildPlayerNarrativeQueue(items);
  expect(queue.map(x => x.kind)).toEqual([
    'interrupt',
    'phone_message',
    'activity_complete',
    'ambient',
  ]);
});
```

- [ ] **Step 2: Write failing offline reconciliation test**

```ts
it('replays elapsed world time and keeps only persistent observations', () => {
  const snapshot = reconcilePlayerSession({
    story,
    session: sessionLastSeenAt1650,
    nowMs: realTimeFor('18:10'),
    online: true,
  });
  expect(snapshot.inbox.some(x => x.kind === 'phone_message')).toBe(true);
  expect(snapshot.items.some(x => x.sourceId === 'evt_1805_doctor_arrival')).toBe(false);
});
```

- [ ] **Step 3: Define queue item contract**

```ts
export type PlayerNarrativeItem = {
  id: string;
  kind: 'interrupt' | 'phone_call' | 'phone_message' | 'scene' | 'choice' | 'artifact' | 'activity' | 'activity_complete' | 'ambient';
  storyMinute: number;
  priority: number;
  insertionOrder: number;
  sourceId: string;
};
```

Priority values are runtime constants, not authored numeric rewards:

```text
interrupt 500
phone_call 450
phone_message 400
activity_complete 300
scene/choice/artifact 250
ambient 100
```

- [ ] **Step 4: Implement `reconcilePlayerSession` orchestration**

Order:

```text
1. derive current Story Time from PlayerClock
2. replay World Truth from submitted actions
3. project protagonist activity/travel state
4. project observable + persistent narrative
5. evaluate relative scene readiness
6. evaluate current choice deadlines / foreground decision lock
7. build deterministic queue
8. return snapshot; do not mutate StoryBundle
```

- [ ] **Step 5: Run full gate and commit**

```bash
npm test -- playerNarrativeQueue.test.ts playerOfflineReconcile.test.ts
npm test
npm run build
git add tools/event-graph-viewer/src/player/runtime tools/event-graph-viewer/tests
git commit -m "feat: reconcile player narrative runtime"
```

---

### Task 10: Replace old PlayerApp with the novel-first Player surface

**Files:**
- Rewrite: `tools/event-graph-viewer/src/player/PlayerApp.tsx`
- Rewrite: `tools/event-graph-viewer/src/player/main.tsx`
- Rewrite: `tools/event-graph-viewer/src/player/player.css`
- Create: `tools/event-graph-viewer/src/player/components/NarrativeStage.tsx`
- Create: `tools/event-graph-viewer/src/player/components/ActivityStage.tsx`
- Create: `tools/event-graph-viewer/src/player/components/ArtifactStage.tsx`
- Create: `tools/event-graph-viewer/src/player/components/ChoiceList.tsx`
- Create: `tools/event-graph-viewer/src/player/components/PhoneOverlay.tsx`
- Test: `tools/event-graph-viewer/tests/PlayerNarrativeApp.test.tsx`

**Interfaces:**
- Consumes: `PlayerRuntimeSnapshot` from Task 9.
- Produces: player-facing Novel / Activity / Artifact / Choice / Interrupt rendering.

- [ ] **Step 1: Write failing UI tests**

```tsx
it('starts as a novel surface instead of case dashboard', async () => {
  render(<PlayerApp clock={fakeClockAt('14:20')} storage={memoryStorage()} loadStory={loadRealStory} />);
  expect(await screen.findByText(/灰潮鎮/)).toBeInTheDocument();
  expect(screen.queryByText('案卷')).not.toBeInTheDocument();
  expect(screen.queryByText('推理桌')).not.toBeInTheDocument();
  expect(screen.queryByText('世界線')).not.toBeInTheDocument();
});

it('renders choices with identical visual class and no impact label', async () => {
  const buttons = await screen.findAllByRole('button', { name: /咖啡|便利商店|直接回家/ });
  expect(new Set(buttons.map(x => x.className))).toEqual(new Set(['player-choice']));
  expect(screen.queryByText(/關鍵|主線|Knowledge|Schedule|World Intervention/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- PlayerNarrativeApp.test.tsx
```

- [ ] **Step 3: Implement one surface with five states**

`PlayerApp` owns loading/storage/reconcile hooks; components remain presentation-only.

```tsx
<main className="narrative-shell">
  <TimeMark storyMinute={snapshot.storyMinute} />
  {snapshot.primary.kind === 'activity' && <ActivityStage item={snapshot.primary} />}
  {snapshot.primary.kind === 'artifact' && <ArtifactStage item={snapshot.primary} />}
  {snapshot.primary.kind === 'interrupt' && <PhoneOverlay item={snapshot.primary} />}
  {snapshot.primary.kind === 'scene' && <NarrativeStage item={snapshot.primary} />}
  {snapshot.choices.length > 0 && <ChoiceList choices={snapshot.choices} />}
</main>
```

No persistent case/worldline dashboard.

- [ ] **Step 4: Implement paragraph/beat reveal without typewriter**

One click advances authored blocks. Reading blocks does not call any time-advance function.

- [ ] **Step 5: Implement quiet Activity styling**

Render only:

```text
15:34
正在看書

樓下有人騎機車經過。
```

Do not render progress %, remaining seconds, EXP, stamina, or spinner.

- [ ] **Step 6: Run targeted + full + build and commit**

```bash
npm test -- PlayerNarrativeApp.test.tsx
npm test
npm run build
git add tools/event-graph-viewer/src/player tools/event-graph-viewer/tests
git commit -m "feat: build novel-first player narrative surface"
```

---

### Task 11: Implement diegetic Artifact interactions and minimal secondary character UI

**Files:**
- Modify: `tools/event-graph-viewer/src/player/components/ArtifactStage.tsx`
- Create: `tools/event-graph-viewer/src/player/components/CharacterDrawer.tsx`
- Modify: `tools/event-graph-viewer/src/player/PlayerApp.tsx`
- Modify: `tools/event-graph-viewer/src/player/player.css`
- Test: `tools/event-graph-viewer/tests/playerArtifact.test.tsx`
- Test: `tools/event-graph-viewer/tests/playerCharacterCard.test.tsx`

**Interfaces:**
- Consumes: ArtifactDefinition + Player Knowledge projection.
- Produces: envelope/letter, phone message/call, simple document presentation, projected character cards.

- [ ] **Step 1: Write failing letter interaction test**

```tsx
it('shows the envelope before the letter body', async () => {
  renderAtLetterDiscovery();
  expect(screen.getByRole('button', { name: '翻看信封' })).toBeInTheDocument();
  expect(screen.queryByText(/回來一趟/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '拆開信封' }));
  expect(screen.getByText(/回來一趟/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Write failing Character Card leakage test**

```tsx
it('does not expose author-only secrets in player character card', async () => {
  openCharacter('周予安');
  expect(screen.getByText(/高中同學/)).toBeInTheDocument();
  expect(screen.queryByText(/hidden|secret|研究所真相/)).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Implement Artifact DOM/CSS presentation**

Use CSS transform/perspective only. Support these kinds in v0.1:

```text
letter
message
phone call
simple document/web result
```

No Three.js import.

- [ ] **Step 4: Implement CharacterDrawer from projected knowledge only**

The drawer receives already-projected `PlayerCharacterCard[]`; it must never import Character Bible secrets directly.

- [ ] **Step 5: Run full gate and commit**

```bash
npm test -- playerArtifact.test.tsx playerCharacterCard.test.tsx
npm test
npm run build
git add tools/event-graph-viewer/src/player tools/event-graph-viewer/tests
git commit -m "feat: add diegetic artifacts and player character cards"
```

---

### Task 12: Author and wire the playable 16:10→18:31 branch set

**Files:**
- Create: `story/narrative/loop_01_player_1610_1831.yaml`
- Modify: `story/manifests/loop_01.yaml`
- Modify if necessary: `story/actions/loop_01_actions.yaml`
- Modify if necessary: `story/activities/protagonist.yaml`
- Test: `tools/event-graph-viewer/tests/playerVerticalSliceAcceptance.test.ts`

**Interfaces:**
- Consumes: all runtime layers from Tasks 2–11.
- Produces: one deterministic playable slice with ordinary, knowledge, schedule, and world-intervention choices.

- [ ] **Step 1: Write failing acceptance scenarios first**

At minimum pin these routes:

```ts
it('direct-home route reaches the letter earlier than coffee route', ...);
it('sending Yuan to the post office changes his 18:10 observation route', ...);
it('showing the letter to Wakaharu changes the 18:18 information variant', ...);
it('ignoring the 17:55 message changes available responses later', ...);
it('late travel can reach the station after 18:31', ...);
it('different submitted actions can produce different simulator 18:31 outcomes', ...);
```

- [ ] **Step 2: Author 16:10–18:31 scenes and choices**

Required player-facing actions include natural-language variants for:

```text
問予安
自己去郵局
請予安去郵局
只把照片傳給他
找若晴
把信給若晴看
只問姊姊的事
問若晴今晚去哪
查研究所
去醫院
等予安
找記者
陪若晴
回家
17:55 後處理 / 不處理若晴訊息
18:20 後去找若晴 / 去找醫生 / 去車站 / 打電話 / 查完資料 / 回家
```

Not every option needs to alter 18:31, but every option must alter at least one approved state dimension.

- [ ] **Step 3: Keep world interventions inside simulator actions**

If a new world-state mutation is required, define it in `story/actions/loop_01_actions.yaml` and let `simulateStory()` apply it. Do not add outcome branches in React or Player Runtime.

- [ ] **Step 4: Verify hidden information never enters Player Narrative**

Acceptance must explicitly assert that hidden reporter/doctor schedule entries remain absent unless an observation rule is satisfied.

- [ ] **Step 5: Run full acceptance gate**

```bash
npm test -- playerVerticalSliceAcceptance.test.ts
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add story tools/event-graph-viewer/tests
git commit -m "feat: author playable first narrative slice"
```

Wait for GitHub Actions GREEN before Task 13.

---

### Task 13: Remove superseded prototype logic and perform whole-branch acceptance

**Files:**
- Delete if no longer imported:
  - `tools/event-graph-viewer/src/player/EvidenceBoard.tsx`
  - `tools/event-graph-viewer/src/player/WorldlineNotebook.tsx`
  - `tools/event-graph-viewer/src/player/knowledge.ts`
  - `tools/event-graph-viewer/src/player/logic.ts`
  - `tools/event-graph-viewer/src/player/model.ts`
  - `tools/event-graph-viewer/src/player/runtime.ts`
  - `tools/event-graph-viewer/src/player/story.ts`
  - old `tools/event-graph-viewer/src/player/clock.ts`
  - old `tools/event-graph-viewer/src/player/storage.ts`
- Delete/update superseded old player tests that assert Evidence Board / 18:00 anchor behavior.
- Test: `tools/event-graph-viewer/tests/playerNarrativeFoundationAcceptance.test.ts`

**Interfaces:**
- Produces: one Player Narrative implementation with no second story truth source.

- [ ] **Step 1: Add whole-branch acceptance test**

The test must verify all of the following in one fixture-driven run:

```text
14:20 starts as novel UI
ordinary arrival choice changes elapsed timeline
letter discovery is player-relative
reading does not advance time
Activity does advance time
ambient prose is ordered and non-repeating
hidden event is not shown
missed local observation is not backfilled
offline phone message persists
response deadline changes choices
decision lock protects reading only in foreground
late travel may arrive after 18:31
18:31 outcome comes from simulator
save contains no canonical death outcome
Author Viewer still renders
```

- [ ] **Step 2: Search for superseded concepts**

```bash
grep -R "VisibleRecord\|留下你認為重要的句子\|Knowledge +1\|WORLDLINE CHANGED" src/player tests || true
grep -R "1080\|18:00" src/player tests || true
```

Any remaining match must be either an explicit migration-test fixture or removed.

- [ ] **Step 3: Delete obsolete prototype files only after imports are gone**

Use TypeScript build as the import graph check.

- [ ] **Step 4: Run final local verification**

```bash
npm run sync-story
npm test
npm run build
```

Expected: zero failing tests and successful multi-page production build.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A
git commit -m "refactor: retire legacy player prototype"
```

- [ ] **Step 6: Push and wait for final GitHub Actions evidence**

Do not mark implementation ready until the latest head has:

```text
Sync story data  PASS
Run tests        PASS
Build viewer     PASS
```

- [ ] **Step 7: Compare final feature branch against the integration base**

Verify the feature diff contains only the planned player runtime/UI/story/test changes and no workflow changes.

---

## Execution Branch Strategy

Use two PR layers instead of one unsafe mega-merge:

```text
main
  ↑
  └─ integration/player-narrative-ui-v0.1
       = main + Story Simulation + Narrative Foundation
       = integration-only PR, must be green

integration/player-narrative-ui-v0.1
  ↑
  └─ feature/player-narrative-ui-v0.1
       = Tasks 2–13
       = Player Narrative UI feature PR
```

Do not retarget the feature PR directly to stale Narrative Foundation branches after implementation begins. If `main` moves while work is in progress, refresh the integration branch deliberately, rerun the full baseline, then rebase/merge the feature branch only after the integration branch is green again.

## CI Discipline

For every dependent task batch:

```text
write failing test locally
→ verify RED locally
→ implement minimal GREEN
→ targeted tests PASS
→ full npm test PASS
→ npm run build PASS
→ commit/push
→ GitHub Actions PASS
→ next task
```

Do not push a known-red test-only commit merely to demonstrate TDD.
