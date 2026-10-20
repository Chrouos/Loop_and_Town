# Loop 01 End-to-End Validation — Gap List

> Date: 2026-10-20 · Baseline: `main` @ 0c09abb
>
> Method: real `PlayerApp` mounted in jsdom with the full manifest story bundle (Loop 01–07 + Final narrative documents), clock advanced through 27 checkpoints from 06:12 to 00:01 (ACCELERATED ×12), visibilitychange-driven reconciliation, stage / case drawer / save inspected at each checkpoint. Passive path (no player action besides opening the letter). Follow-up probes: authored-scene visibility in Loops 1/2/3/5/7, speaker labels across all player narratives.
>
> Suite baseline: 551 tests, 550 passed + 1 deterministic failure (`PlayerApp.test.tsx` early-morning Live Sync test missing the 2 s reset-presentation wait its siblings already use) — fixed in the same change as this document. Production build passes.

## What works

- 06:12 opening on the return train, letter envelope, train-rustle / train-wheel / paper Attention opportunities appear in their windows.
- 07:40 station travel offer appears; P1 station observations stay missable when the player never travels (`perceivedSceneIds` empty, no Memory created).
- 18:00 Yuan message arrives as an incoming notice; 18:31 blackout appears as a finite Attention opportunity and disappears by 18:41.
- Author world history runs the full passive worldline (`wakaharu_dies`, 20:30 old case, 22:40 warning, 23:59 bells, 00:00 loop end) while the player is absent.
- 00:00 enters the reset presentation and waits for the Reset lifecycle without creating Loop 2.
- No author metadata leaked into the stage or case drawer.

## Gaps

### G1 — Loop 01 authored narrative is never shown to the player (P0) — fixed

> Fixed on `fix/loop01-validation`: Loop 1 now projects authored scenes like every other loop. `projectPlayerNarrativeRecords` takes `PlayerSceneConditions` and only shows a gated scene when the player side can verify it: `requiresLocation` against `protagonistLocationAt` (train before 07:40, en route / old station from the station visit, otherwise old house), `requiresFacts` against facts derived from player actions (only `fact_zhixia_letter_received` ← letter opened today), `afterActivityId` against the default protagonist schedule. Unverifiable scenes stay hidden instead of contradicting each other. Covered by `tests/player/loop01AuthoredNarrative.test.tsx`.
>
> Remaining follow-ups: café / hospital scenes are unreachable because the player can only travel between the old house and the old station; activity- and fact-choice branches (`prologue_after_coffee`, `prologue_after_store`, `scene_after_research`, `scene_after_waiting_for_yuan`, `scene_2038_wakaharu_portfolio_sent`) have no player-side trigger yet.

`PlayerApp.tsx` and `knowledge.ts#reconcilePlayer` set the record source to `undefined` when `loopId === 1`, so Loop 1 falls back to the static `STORY_RECORDS` in `src/player/story.ts`. `revealNarrative` still writes ~38 `loop_01_player.yaml` scene ids into `revealedIds`, but nothing renders them.

Observed at 23:00 in Loop 1: case drawer holds 4 records (letter, Yuan message, old case summary, station bulletin). None of the authored scenes — Yuan reunion, café scenes, 18:05 handoff, 20:30 detective, 22:40 watch warning, 23:20 kitchen — are reachable. The 22:40 clue「如果你第二次看見 18:31，不要先救第一個死者」never reaches the player, although Loop 2 design depends on it.

The inline comment in `PlayerApp.tsx` says "Real-world cues and authored scenes coexist in every loop", which the code contradicts.

### G2 — Yuan and Zhixia dialogue renders as「對方」 (P0) — fixed

> Fixed by adding `yuan: '予安'` and `zhixia: '知夏'` to `SPEAKER_LABELS`, matching the existing short-name style. The regression test asserts no projected line in any loop falls back to「對方」.

`SPEAKER_LABELS` in `src/player/narrativeRecords.ts` maps only protagonist / wakaharu / doctor / reporter / detective. Unlabelled lines per loop (variant-free projection): Loop 1: 11, Loop 3: 5, Loop 4: 6, Loop 5: 7, Loop 6: 2, Loop 7: 7. Yuan is the main companion; Loop 05 ("only I remember") is almost entirely his dialogue.

### G3 — Generic record titles and sources (P1) — fixed

> Fixed: all 117 player narrative scenes carry an authored `title` (short, first-person, no clue-highlight wording per Core Gameplay §23.2), and the source names who was there (「予安」「若晴、陳醫師」, or「你自己」; phone scenes add「／手機」). A test requires every scene to have a title unique within its chapter.

Every projected narrative record is titled「鎮上的對話」or「時間線片段」with source「時間線紀錄」, except three hard-coded Loop 02 ids in `sceneTitle`. Loop 7 drawer at 23:00 shows three identical "17:58 鎮上的對話" entries. The player cannot tell records apart without opening each one. Needs an authored `title` (and optionally `source`) field on narrative scenes.

### G4 — Final narrative is loaded but unreachable (P1) — fixed

> Fixed with G5: loops carry a `chapterId`; the Final chapter projects `final_player.yaml`, and `finalInvestigationReady` now requires the Final chapter instead of `currentLoopId >= 2`.

`final_player.yaml` is loaded with `loopId: 'final'`, but no runtime path ever projects `'final'`; `currentLoopId` is always numeric. Final gameplay (`finalGameplay.ts`) is gated on `currentLoopId >= 2` at the old station and uses static records only. Decide how the Final chapter is entered (loop number, story condition, or player-proven hypothesis) before Loop 07 integration.

### G5 — Chapter content is keyed to loop count, not player progress (design question)

`projectPlayerNarrativeRecords` selects the document whose `loopId` equals `save.currentLoopId`. A player's fifth loop always plays the Loop 05 chapter, regardless of what they perceived, captured or changed in Loops 1–4. Loop 8+ has no narrative at all.

> Implemented: `src/player/chapters.ts`, rules in `story/loops/chapter_progression.yaml` (manifest key `chapter_progression`), rule recorded in `docs/core-gameplay-spec-v0.1.md` §17.2. Conditions for 1→2, 2→3, 3→4 and 4→5 confirmed by the author on 2026-10-20; 5→6, 6→7 and 7→Final auto-advance until canon is settled. Covered by `tests/player/chapterProgression.test.ts`, which also proves the death-free worldline is reachable with `protect_wakaharu` + `stop_doctor`.

**Decision (2026-10-20): chapters unlock by story progress.** Each chapter has an unlock condition evaluated at reset; if it is not met, the next loop replays the current chapter. Conditions read **Player Knowledge** (opened records, perceived scenes, captured memories), never Author world history.

Conditions:

| Next chapter | Unlock condition (player knowledge) | Basis in `docs/main-story.md` |
| --- | --- | --- |
| Loop 02 活下來的人 | The player knows Wakaharu died at 18:31 (opened `station-bulletin-wakaharu` or perceived `scene_1831_wakaharu`) | Ch2 premise: stop Wakaharu from walking into the known danger |
| Loop 03 沒有已知死者 | The player knows someone other than Wakaharu died at 18:31 (opened `station-bulletin-doctor`) | Ch2 reversal: stopping the first death ≠ stopping 18:31 |
| Loop 04 五年前 | The player lived a loop with no known death (opened `station-bulletin-none`) and still reached the 00:00 reset | Ch3 reversal: death ≠ Hard Reset trigger |
| Loop 05 只有我記得 | The player captured words from all three five-years-ago scenes: `loop04_0910_detective_confrontation`, `loop04_1140_seven_records`, `loop04_1310_reporter_confession` | Ch4: reconstruct Zhixia's death day from three professions |
| Loop 06 / 07 | Auto-advance for now — `main-story.md` marks the Ch6 letter mechanism and parts of Ch7 as not yet canon | — |
| Final | After Chapter 7 (auto-advance for now). Final P0–P4 mechanics now open only in the Final chapter | Ch7 → Final |

Saves from before this change have no `chapterId` and keep playing the chapter matching their loop number.

### G6 — Orphan prologue file (P2) — fixed

> Removed `story/narrative/loop_01_prologue.yaml` and its tracked generated copies; the loader test fixture now names `loop_01_player.yaml`.

`story/narrative/loop_01_prologue.yaml` is not in the manifest; its `prologue_*` ids overlap with `loop_01_player.yaml`. Only `tests/narrativeLoader.test.ts` still reads it. Remove or mark as fixture.

### G7 — Tracked generated output is stale (P2)

`tools/event-graph-viewer/public/story/` and `tools/event-graph-viewer/dist/` are committed, but both are regenerated by `sync-story` / `build` in CI. A local build rewrites ~90 tracked files with real content differences (e.g. `public/story/schedules/yuan.yaml` lacks the 07:40 train meeting present in `story/`). Add both to `.gitignore` and remove them from the index. The deploy workflow also still builds the `pr-25` preview although #25 was salvaged as #33.

### G8 — Choices ignore where the player is (P1) — fixed

> Fixed: `confirmAction` rejects `protect_wakaharu` unless the player is in town, the choice shows why it is unavailable, and `travelToOldStation` refuses to leave after the promise. Covered by `tests/player/choiceLocation.test.ts`. Author review of Wakaharu's 18:05 schedule after the promise is still open.

Active path: player travels to the old station at 17:10, then at 18:01 can still choose「保護若晴：今晚，我陪你留下來」. The response reads「你答應在若晴出門前陪她留在家裡」while the player is physically at the station. Choices should be gated or reworded by `protagonistLocationAt`, and the author should review whether Wakaharu's 18:05 arrival schedule is consistent with her「今晚先不去車站」reply.

### G9 — Authored scenes surface as「新消息」, not on the stage (P1) — fixed

> Fixed: when the passage on stage has finished playing, the stage opens the earliest revealed authored scene the player has not watched. It holds while a drawer is open, during Attention or Capture, and while the 18:20 decision is still open. The incoming counter now counts only `message` records. Opening an authored scene marks it watched in every loop (previously skipped in Loop 1). Covered by `tests/player/loop01AuthoredNarrative.test.tsx`.

Authored scenes never play on the scene stage as they happen; they only raise the「鎮上有 N 則新消息」counter and sit in the case drawer. After G1, Loop 1 reports 8 new messages by 17:10 although they are scenes the protagonist lived through, not messages. Decide whether the auto-flow stage should present newly revealed scenes while the player is idle, and restrict the incoming counter to phone / message records.

### G10 — Inline capture of authored scene words always failed (P0) — fixed

Clicking a clue word inside an authored scene called `pinExcerpt`, which only knows the static `STORY_RECORDS`, so it always failed with「這段文字還沒有取得來源」; the Evidence Board would also have shown the raw ref. Authored scene words now become a text Persistent Memory (`memory:<loop>:<record>:<excerpt>`, original words only) via `rememberNarrativeExcerpt`; static records keep the legacy table pins. This also makes the Chapter 4 `captured` condition playable.

### Test flakiness fixed on the way

- `PlayerApp.test.tsx` early-morning Live Sync case: reset presentation wait widened to 2 s like its siblings.
- `inlineMemory.test.tsx`: the capture test rendered a second line that replaces the clickable phrase after 500 ms; under full-suite load the click landed after the swap. The test now renders the single line it asserts on.

### G11 — Player sees scenes the protagonist was not in (P1, needs author decision)

Several player-facing scenes have no `protagonist` among participants, so the player watches events the protagonist could not perceive:

- `loop02_1742_doctor_departure`, `loop02_1805_doctor_no_recipient`, `loop02_1812_doctor_decides_return`, `loop02_1824_maintenance_passage` (Doctor alone)
- `loop02_1950_reporter_replans` (Reporter alone)
- `loop03_1910_wakaharu_resignation` (Wakaharu alone)

This conflicts with the Perception Boundary (World Event ≠ Player Knowledge). Options: move them to the author-only DAG, rewrite them as what the protagonist later hears or reconstructs, or gate them behind an explicit in-world source (a call, a witness, a record).

## Active path (second pass, after G1/G2)

Walked through the real `PlayerApp`: open letter → depart for the old station 17:10 → attend + capture `signal-ledger`, `backup-relay`, `track-damage`, `station-blackout`, `external-ack` → read Yuan's message, choose `protect_wakaharu` → 00:00 reset → hand memory back → ACCELERATED restart → Loop 2.

Works:

- every station cue: Attend → Observation → Perception → Capture; five Persistent Memories created, none without perception
- `protect_wakaharu` changes the same-loop worldline (`evt_1831_station/doctor_dies`, `evt_1805_envelope_handoff/doctor_no_recipient`)
- authored Loop 1 scenes follow the player to the station (`scene_1810_yuan_observation`, `scene_1818_guarded`, `scene_1831_doctor`) and drop `scene_1820_old_house`
- Reset → Loop 2: all five memories persist, station visit and actions reset, Loop 2 opening scene plays, Investigation Wall starts empty with the memories in the library

Not covered yet:

- Investigation Wall placement / manual link / hypothesis submission through the UI (data-level coverage exists in `finalPlayerHypothesis.test.ts`)
- M7 gaps: miss while focused, Convergence during Capture, Bell while reading

## Recommended order

1. ~~G1 + G2~~, ~~G8 + G9 + G10~~, ~~G5 + G4~~ (done)
2. ~~G3~~, ~~G6~~ (done)
3. G11 (scenes outside the protagonist's perception)
4. Author input: Chapter 6 / 7 / Final unlock conditions; Wakaharu's schedule after the 18:00 promise
5. Wall UI walkthrough + M7 gap tests
6. G7 cleanup
