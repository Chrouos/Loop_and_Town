# 玩家端第一個輪迴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent, real-time, playable first loop that uses the existing Worldline Simulator and reveals only what the player has learned.

**Architecture:** Add a separate Vite HTML entry and `src/player/` within `tools/event-graph-viewer` so the React app and simulator share dependencies and canonical `story/` data. A pure clock/save layer maps elapsed wall time to a fictional loop; an adapter replays confirmed actions through the existing simulator; a knowledge projector gates narrative records and cross-loop comparison. The existing Viewer remains unchanged except for the additional Vite entry.

**Tech Stack:** TypeScript 5.6, React 18, Vite 5, Vitest 2, Testing Library, js-yaml, localStorage.

**Spec:** `docs/superpowers/specs/2026-09-23-player-first-loop-design.md`

## Global Constraints

- `story/` is the sole source of world-event rules; do not duplicate variant selection in UI.
- First visit starts at fictional 18:00; 18:20 is the action cutoff; 18:31 and 21:14 are simulated; first midnight occurs after six elapsed hours, later loops every 24 hours.
- `World Truth` must not be directly rendered as player knowledge.
- Preserve all four acceptance outcomes exactly, including the 21:14 delayed difference.
- No omniscient Diff, free-form actions, generative NPCs, cross-device sync, or automatic audio.
- A maximum of six selected excerpts; unsupported inference must not become a confirmed connection.
- The casefile voice distinguishes source, formation time, acquisition time, observation, report and medical estimate.
- Keyboard and reduced-motion modes must support the same core flow.
- Legacy saves never fabricate simulator actions or worldline results.

## Review Focus

- Repeated reload at an event boundary must not create two messages or archive two identical loops (Task 3 test).
- Future timestamps or a clock moved backwards must not erase confirmed knowledge or unresolve an event (Task 1 test).
- A document describing an unobserved death must remain hidden until its source actually arrives (Task 3 test).
- Opening directly on a narrow screen or at 200% text size must keep the letter button and primary choices usable (Task 4 browser check).
- A malformed legacy save or save from another origin must not inject HTML or alter confirmed actions (Task 6 test).

## File structure

- `tools/event-graph-viewer/player.html`: independent player entry.
- `tools/event-graph-viewer/vite.config.ts`: multi-page build inputs for index and player.
- `tools/event-graph-viewer/src/player/model.ts`: versioned player save types and normalization.
- `tools/event-graph-viewer/src/player/clock.ts`: wall timestamp to fictional loop/time mapping.
- `tools/event-graph-viewer/src/player/runtime.ts`: confirmed action replay through `createSimulation`.
- `tools/event-graph-viewer/src/player/story.ts`: authored visible documents, provenance and evidence references; no world-state rules.
- `tools/event-graph-viewer/src/player/knowledge.ts`: reveal gating and idempotent notifications.
- `tools/event-graph-viewer/src/player/logic.ts`: evidence board, supported claims and known-only comparison.
- `tools/event-graph-viewer/src/player/storage.ts`: localStorage persistence and legacy import.
- `tools/event-graph-viewer/src/player/PlayerApp.tsx`, `main.tsx`, `player.css`: narrative interaction.
- `tools/event-graph-viewer/tests/player/*.test.ts(x)`: fake-clock, acceptance, knowledge, UI and migration tests.

---

## Exact implementation contracts

The snippets below pin the test and implementation shape for each task. Keep neighboring signatures stable; derive the final module internals by making each test fail and pass.

### Task 1: Anchored clock and versioned save

**Files:** Create `src/player/clock.ts`, `src/player/model.ts`, `tests/player/clock.test.ts`; update Vite TypeScript includes only if needed.

**Interfaces:** `timeAt(anchorMs: number, nowMs: number): { loop: number; minute: number; elapsedMs: number; nextMidnightMs: number }`; `normalizeSave(raw: unknown, nowMs: number): PlayerSave`; `PlayerSave` includes `version: 1`, `anchorMs`, `lastConfirmedMs`, `loops: Record<number, LoopSave>`, `knowledge: KnowledgeSave`. `LoopSave` includes `actionIds: string[]`, `sealed: boolean`, `revealedIds: string[]`.

- [ ] **Step 1: Write failing tests.** Check `timeAt(0, 0).minute === 1080`, `timeAt(0, 20 * 60000).minute === 1100`, `timeAt(0, 6 * 3600000).loop === 2`, `timeAt(0, 30 * 3600000).loop === 3`; normalize malformed JSON into an empty v1 save and clamp a backwards `nowMs` to `lastConfirmedMs`.
```ts
// tests/player/clock.test.ts
expect(timeAt(0, 20 * 60_000)).toMatchObject({ loop: 1, minute: 1100 });
expect(timeAt(0, 30 * 3_600_000).loop).toBe(3);
expect(normalizeSave('{broken', 0).version).toBe(1);
```

- [ ] **Step 2: Run** `npm test -- player/clock.test.ts`; Expected: FAIL because clock/model modules do not exist.
- [ ] **Step 3: Implement** first-loop cutoff `FIRST_MIDNIGHT_MS = 6 * 3600000`; for elapsed below it use `18 * 60 + floor(elapsed / 60000)`; afterward use `loop = 2 + floor((elapsed - FIRST_MIDNIGHT_MS) / 86400000)` and minute-of-day modulo 24h. Parse save fields via allowlisted primitives; preserve known loops and knowledge; never trust timestamps later than current validated progress.
```ts
// src/player/clock.ts
const FIRST_MIDNIGHT_MS = 6 * 3_600_000;
export function timeAt(anchorMs: number, nowMs: number) {
  const elapsedMs = Math.max(0, nowMs - anchorMs);
  const afterFirst = Math.max(0, elapsedMs - FIRST_MIDNIGHT_MS);
  const loop = elapsedMs < FIRST_MIDNIGHT_MS ? 1 : 2 + Math.floor(afterFirst / 86_400_000);
  const minute = elapsedMs < FIRST_MIDNIGHT_MS ? 1080 + Math.floor(elapsedMs / 60_000) : Math.floor((afterFirst % 86_400_000) / 60_000);
  const nextMidnightMs = anchorMs + FIRST_MIDNIGHT_MS + (loop - 1) * 86_400_000;
  return { loop, minute, elapsedMs, nextMidnightMs };
}
```

- [ ] **Step 4: Re-run** `npm test -- player/clock.test.ts`; Expected: PASS.
- [ ] **Step 5: Commit** `feat: add anchored game clock and save normalization`.

### Task 2: Replay confirmed interventions through Simulator

**Files:** Create `src/player/runtime.ts`, `tests/player/runtime.test.ts`; import `createSimulation` and `loadSimulationStory` from existing modules.

**Interfaces:** `confirmAction(save: PlayerSave, id: 'protect_wakaharu' | 'stop_doctor', nowMs: number): PlayerSave`; `replayLoop(definition: SimulationDefinition, initial: WorldState, save: PlayerSave, loop: number, minute: number): SimulationResult`. The adapter applies the confirmed IDs in canonical order at 18:20 before `runUntil`; before 18:20 it does not instantiate a simulation at a backwards clock.

- [ ] **Step 1: Write failing acceptance tests** with canonical YAML loaded via `?raw` imports, as existing simulator story tests do. Assert `[] → wakaharu_dies → reporter missing`, `[protect_wakaharu] → doctor_dies → reporter alive`, `[stop_doctor] → wakaharu_dies → reporter missing`, `[both] → no_death → reporter alive`; `confirmAction` accepts 18:19 and rejects 18:20 and duplicate IDs.
```ts
// tests/player/runtime.test.ts
for (const [ids, outcome, missing] of [
  [[], 'wakaharu_dies', true],
  [['protect_wakaharu'], 'doctor_dies', false],
  [['stop_doctor'], 'wakaharu_dies', true],
  [['protect_wakaharu', 'stop_doctor'], 'no_death', false],
] as const) {
  const save = withActions(ids);
  const result = replayLoop(definition, initialState, save, 1, 1274);
  expect(result.history.find(x => x.eventId === 'evt_1831_station' && x.kind === 'event')?.variantId).toBe(outcome);
  expect(result.history.some(x => x.eventId === 'evt_2114_reporter_missing' && x.kind === 'event')).toBe(missing);
}
```

- [ ] **Step 2: Run** `npm test -- player/runtime.test.ts`; Expected: FAIL because adapter is missing.
- [ ] **Step 3: Implement** validation against the two canonical IDs, a deterministic action ordering array, and replay from fresh `createSimulation` per call. For 18:00–18:19 return the initial state plus empty history without advancing the simulator (the current initial state starts at 18:20).
```ts
// src/player/runtime.ts, core replay sequence
const simulation = createSimulation(definition, initial);
for (const id of ['protect_wakaharu', 'stop_doctor'] as const) {
  if (save.loops[loop]?.actionIds.includes(id)) simulation.applyAction(id);
}
simulation.runUntil(formatTime(minute));
return { state: simulation.getState(), history: simulation.getHistory() };
```

- [ ] **Step 4: Re-run** `npm test -- player/runtime.test.ts`; Expected: PASS.
- [ ] **Step 5: Commit** `feat: connect player choices to canonical simulation`.

### Task 3: Player knowledge and offline reconciliation

**Files:** Create `src/player/story.ts`, `src/player/knowledge.ts`, `tests/player/knowledge.test.ts`; extend `model.ts` for strictly typed revealed record IDs.

**Interfaces:** `visibleRecords(save: PlayerSave, loop: number): VisibleRecord[]`; `reconcilePlayer(save: PlayerSave, nowMs: number, definition: SimulationDefinition, initial: WorldState): PlayerSave`. Story records declare `id`, `source`, `formedAt`, `obtainedAt`, `body`, `excerpts`, and the event/variant requirements; the projector uses runtime history only to decide eligibility, then records revelation IDs in the save. It must not return full History as player content.

- [ ] **Step 1: Write failing tests.** At virtual 18:30 no death document; at 18:31 record only a blackout observation; at 18:40 add a sourced station bulletin showing the confirmed outcome; at 21:14 queue the variant-specific consequence and at 21:20 reveal the sourced reporter message. Reload twice at 21:20 leaves the same number of revealed IDs; a 2-day absence seals each elapsed loop once and reports only unread known records.
```ts
// tests/player/knowledge.test.ts
let s = reconcilePlayer(freshAt(0), 30 * 60_000, definition, initialState);
expect(visibleRecords(s, 1).some(r => r.id.includes('death'))).toBe(false);
s = reconcilePlayer(s, 31 * 60_000, definition, initialState);
expect(visibleRecords(s, 1).some(r => r.id === 'station-blackout')).toBe(true);
s = reconcilePlayer(s, 40 * 60_000, definition, initialState);
expect(visibleRecords(s, 1).some(r => r.id === 'station-bulletin-wakaharu')).toBe(true);
```

- [ ] **Step 2: Run** `npm test -- player/knowledge.test.ts`; Expected: FAIL because story/knowledge modules do not exist.
- [ ] **Step 3: Author** a small fixed manifest: sister letter; five-year-old death summary; 18:31 blackout; variant-specific 18:40 bulletin; variant-specific 21:20 follow-up. Use explicit source and two separate timestamp fields. Gate by resolved `eventId` and `variantId`; use a unique `loop:id` key for each reveal and persist a seal marker for completed loops.
- [ ] **Step 4: Implement** `reconcilePlayer` iterating elapsed loops, replaying no action for unplayed loops, capping malformed spans with an explicit safe report rather than an unbounded synchronous loop. Do not reveal 21:14 cause merely because its event follows 18:31.
```ts
// src/player/knowledge.ts, idempotent reveal
for (const record of STORY_RECORDS) {
  if (record.revealMinute > observedMinute) continue;
  if (!record.matches(history)) continue;
  const key = `${loop}:${record.id}`;
  if (!save.loops[loop].revealedIds.includes(key)) save.loops[loop].revealedIds.push(key);
}
```

- [ ] **Step 5: Re-run** `npm test -- player/knowledge.test.ts`; Expected: PASS.
- [ ] **Step 6: Commit** `feat: gate evidence by player knowledge and reconcile offline loops`.

### Task 4: Standalone narrative game surface

**Files:** Create `player.html`, `src/player/main.tsx`, `src/player/PlayerApp.tsx`, `src/player/player.css`, `tests/player/PlayerApp.test.tsx`; modify `vite.config.ts` with `build.rollupOptions.input = { viewer: resolve(__dirname, 'index.html'), player: resolve(__dirname, 'player.html') }`.

**Interfaces:** PlayerApp loads `loadSimulationStory()`, normalizes and reconciles storage, renders `visibleRecords`, and writes only via `confirmAction` / evidence functions; Viewer imports nothing from PlayerApp.

- [ ] **Step 1: Write failing interaction tests.** Opening envelope by button and Enter reveals the letter; clicking story text does not auto-confirm an action; two action choices can be confirmed before 18:20 and are read-only afterward; virtual 18:31 shows only known observation; opening after an absence lists unread records without disclosing the full variant history.
```tsx
// tests/player/PlayerApp.test.tsx
render(<PlayerApp now={() => start} storage={memoryStorage} loadStory={fakeStory} />);
await user.click(screen.getByRole('button', { name: /拆開信封/ }));
expect(screen.getByText(/回來一趟/)).toBeVisible();
await user.click(screen.getByRole('button', { name: /保護若晴/ }));
expect(readSave(memoryStorage, start).loops[1].actionIds).toContain('protect_wakaharu');
```

- [ ] **Step 2: Run** `npm test -- player/PlayerApp.test.tsx`; Expected: FAIL because player entry/UI do not exist.
- [ ] **Step 3: Implement** a single black narrative stage with one focused interaction at a time; on-demand document drawer and reply drawer; sourced record page, visible fictional clock and next scheduled contact; envelope button with visible caption and original accessible alt text. Use `setInterval` plus visibility event to call reconciliation, and a localStorage `storage` listener for another tab.
- [ ] **Step 4: Add** only envelope, notification and midnight transitions, each dismissible; `prefers-reduced-motion: reduce` removes transitions and cursor animation. No autoplay audio. Escape closes a drawer, focus returns to its opener.
```tsx
// src/player/main.tsx
createRoot(document.getElementById('root')!).render(<PlayerApp />);
// player.html contains <div id="root"></div> and <script type="module" src="/src/player/main.tsx"></script>
```

- [ ] **Step 5: Run** `npm test -- player/PlayerApp.test.tsx` and `npm run build`; Expected: PASS and built `dist/player.html`.
- [ ] **Step 6: Check** in browser at desktop, 390px width and 200% zoom: letter CTA, clock, primary action and drawer close remain visible and keyboard usable. Record screenshots or a short QA note in the commit body.
- [ ] **Step 7: Commit** `feat: add focused playable casefile entry`.

### Task 5: Evidence board and known-only cross-loop comparison

**Files:** Create `src/player/logic.ts`, `src/player/EvidenceBoard.tsx`, `src/player/WorldlineNotebook.tsx`, `tests/player/logic.test.ts`, `tests/player/board.test.tsx`; modify `PlayerApp.tsx` and `player.css`.

**Interfaces:** `pinExcerpt(save, ref): PlayerSave`; `judgeLink(save, first, second, claimId): { save: PlayerSave; feedback: string }`; `knownDiff(save, leftLoop, rightLoop): KnownDiffRow[]`. `ref` uses `recordId:excerptId`; source record must be revealed in that loop. Position coordinates stored separately from evidence truth.

- [ ] **Step 1: Write failing tests.** Six valid pins allowed, seventh rejected; fabricated/unread reference rejected; unsupported claim gives feedback without adding connection; comparing two loops with only one known outcome shows `尚未查到` for the other; two known differing outcomes show changed victim and candidate repeated 18:31, never label it a proven universal law.
```ts
// tests/player/logic.test.ts
const one = pinExcerpt(saveWithRevealedLetter(), 'letter:postmark');
expect(one.knowledge.pins).toContain('letter:postmark');
const guessed = judgeLink(one, 'letter:postmark', 'old-death:date', 'sister-alive');
expect(guessed.save.knowledge.connections).toHaveLength(0);
expect(knownDiff(twoLoopsOneKnown(), 1, 2)[0].right).toBe('尚未查到');
```

- [ ] **Step 2: Run** `npm test -- player/logic.test.ts player/board.test.tsx`; Expected: FAIL because board/logic modules do not exist.
- [ ] **Step 3: Implement** authored claim IDs and exact source-pair support in `logic.ts`, maximum six pins, reversible removal and board positions; UI has drag/pointer arrangement plus keyboard move controls, card source detail and explicit two-card connect action.
- [ ] **Step 4: Implement** known-only notebook with Event ID alignment and separate observation versus hypothesis typography; never call full Viewer `diffWorldlines` on unfiltered world history.
```ts
// src/player/logic.ts, source gating before pin or connect
if (!revealedRefs(save).has(ref)) throw new Error('這段文字還沒有取得來源。');
if (save.knowledge.pins.length >= 6) throw new Error('桌上只能留下六段文字。');
// knownDiff reads save.loops[n].revealedIds, never raw simulation history.
```

- [ ] **Step 5: Run** targeted tests and `npm run build`; Expected: PASS.
- [ ] **Step 6: Commit** `feat: add selective evidence board and worldline notebook`.

### Task 6: Persistence, legacy import and final verification

**Files:** Create `src/player/storage.ts`, `tests/player/storage.test.ts`; modify `PlayerApp.tsx` and `README.md`.

**Interfaces:** `readSave(storage, nowMs)`, `writeSave(storage, save)`, `importLegacy(raw, current): PlayerSave`, `exportSave(save): string`. Same-origin migration reads old key `ash-town-bible-v1`; different-origin migration accepts pasted or explicitly selected JSON only. The player UI explains how to copy the old save from the old site's browser console with `copy(localStorage.getItem('ash-town-bible-v1'))`; this is a user-initiated export, never a cross-origin read. Neither writes fabricated action IDs.

- [ ] **Step 1: Write failing tests.** Corrupt JSON opens fresh save; HTML in legacy text renders as text; known old `memory` maps to an imported personal note or document reference; unknown event outcomes do not set action IDs; repeated import does not double the excerpts; JSON exported and re-imported preserves established loops.
```ts
// tests/player/storage.test.ts
const restored = importLegacy(JSON.stringify({ memory: { letter: 2 }, lines: ['letter|sister'] }), fresh);
expect(restored.loops[1].actionIds).toEqual([]);
expect(restored.knowledge.notes).toContainEqual(expect.objectContaining({ source: 'legacy' }));
expect(importLegacy('{broken', fresh).version).toBe(1);
```

- [ ] **Step 2: Run** `npm test -- player/storage.test.ts`; Expected: FAIL because storage module does not exist.
- [ ] **Step 3: Implement** versioned save read/write with `try/catch`; import only allowlisted old fields, and add visible opt-in import/export controls. React renders all imported text as text nodes, never `dangerouslySetInnerHTML`. Show a short import dialog with the exact old-site export instruction `copy(localStorage.getItem('ash-town-bible-v1'))`, plus a paste field and JSON file selection.
```ts
// src/player/storage.ts, allowlisted legacy mapping
const memory = isRecord(parsed.memory) ? parsed.memory : {};
if (Number(memory.letter) > 0) save.knowledge.notes.push({ source: 'legacy', text: '舊案卷：已讀過姊姊的信' });
// Do not copy parsed.tasks, parsed.world or parsed.hypothesis into simulator actionIds.
```

- [ ] **Step 4: Run** `npm test`, `npm run build`, `git diff --check`; Expected: all PASS.
- [ ] **Step 5: Manually check** a fresh visit, an imported old save, a resumed first loop, a two-loop known-only comparison, narrow screen and reduced motion. Confirm Viewer `/index.html` still loads and player `/player.html` loads.
- [ ] **Step 6: Update README** with player URL, local start/build commands, first-loop clock, local-only save limitation, and distinction between Viewer and player app.
- [ ] **Step 7: Commit** `feat: finish persistent first-loop experience`.
