# Playable Final Vertical Slice｜P0–P4 implementation

> Status: implemented on PR #24; the canonical player interface is `player.html` (`src/player/PlayerApp.tsx`). The standalone `playerNarrative` experiment is not the save or clock authority.
>
> Scope: one complete evidence-to-intervention-to-00:00 loop, not the entire final chapter’s production art, dialogue, location navigation, or full world simulation.

## P0｜唯一正式 Player 與時間來源

- `src/player/PlayerApp.tsx`, `runtime.ts`, `clock.ts`, `model.ts`, `knowledge.ts` own live Player interactions and the v2 Save.
- The earlier narrative experiment now begins at 06:12 rather than 14:20 and does not freeze world time when reading dialogue; old progressed saved minutes are not overwritten.
- Stage updates follow real elapsed time. A normal observation never pauses or interrupts the current main action by itself.
- The simulator’s `CorrectionSession` is Author Truth, separate from the player's captured memories.

## P1｜四個 finite observations

All four are `acquisition: presence`, with a finite time window. **They also require physical arrival at the old station**: the player explicitly departs after 07:40, spends twenty world minutes traveling, and cannot observe through walls, from town, or while en route. The station visit and any return trip are persisted per Loop, never across resets. Time does **not** wait for the player to hover, shift attention, complete an observation or deliberately capture.

| Local time | Cue | What it establishes | What it does not prove |
| --- | --- | --- | --- |
| 17:33–17:42 | `signal-ledger` | Target and Observed have inconsistent Sync Epochs | The culprit or the physical coupling |
| 17:48–17:57 | `backup-relay` | Two physical primary/recovery markings | Whether the backup can still rewrite |
| 18:14–18:23 | `track-damage` | Exposure risk along an alternate physical route | A mandatory death or substitute victim |
| 18:50–18:59 | `external-ack` | An independently retained observation is needed to validate isolation | That the shutdown has already succeeded |

Missed clues cannot be recovered retroactively from player History or the Author Event Graph; in another loop the protagonist may choose to observe them. Deliberately captured evidence survives reset; relationships and NPC memories do not.

## P2｜Player-authored hypothesis → intervention

- The player must capture `signal-ledger` and `backup-relay`, place both in the Investigation Wall, manually connect them, and explicitly select the proposed dual-bridge hypothesis.
- Only that hypothesis unlocks `request_backup_inspection`. The action must be chosen before the current 18:20 deadline; it is an observable action with a real world-state flag.
- The hypothesis is **not** the answer. It may be incomplete or wrong, and does not grant player knowledge of the real stop mechanism automatically.

## P3｜NPC schedule and autonomous result

- At 18:26, Yuan inspects only if **requested** and actually present near the station area. The event is a schedule entry, not a guaranteed reward.
- If a prior independent post-office assignment takes Yuan away, his inspection cannot happen. The displayed response reflects the resulting World History.
- An actual inspection may confirm the interface but is **not consent to disable it**.
- For later author-side Final intervention, participation checks use each candidate's route, alive status, provenance and current information. The protagonist cannot remotely force a character onto a dangerous route.

## P4｜Play from observed evidence to A/B/C

The player must:
1. Be in a later Loop, preserve the needed P1 memories, and have manually submitted the P2 hypothesis.
2. Request the real P3 inspection and actually read Yuan's report **in that Loop**.
3. Independently retain the route-risk observation. After 18:31, explain the conflicting sources to the people currently available.
4. Request help from NPCs with relevant ability and willing participation; unavailable NPCs cannot be teleported or forced. Each principal action uses real in-world time; no two final actions can occur in the same story minute.
5. Either accept a one-time informed Forward Seal (A), keep the session unsealed (B), or find and disable both Write-back permissions, fence old epochs, capture the independent monitor and verify before sealing permanently (C).

The program uses `reduceCorrection` and the exact same end-condition types as the Author Simulator. At 23:59 a final check occurs; at 00:00:
- **B / failed primary-only:** `RETRY` to 06:12, preserving only the player-side Captured Memory.
- **A:** `FORWARD` to 10/4 00:01 with active future Writer permissions.
- **C:** `FORWARD` to 10/4 00:01 with primary and backup revoked and a permanent seal.
- **Both revoked but never sealed:** `SAFETY_HOLD`, not an automatic success.

The Final scene presents the **character's observations and concrete choices**, not the Author's G1–G5 dashboard or answer key. Full extended character reactions, integrated traversal/location artwork, and a playable post-10/4 epilogue remain future content, not tested features.

## Regression / QA

- `finalPlayerPerception.test.ts` — time windows, attention, missability.
- `finalPlayerHypothesis.test.ts` — manual capture and graph connection.
- `finalNpcAgency.test.ts` — same player request with two independent NPC itineraries.
- `finalPlayableFlow.test.ts` — A/B/C, failed primary-only, missing independent proof, timing, and agency.
- `finalCorrectionRuntime.test.ts` — Author fixture parity, recovery and safety hold.
- All earlier Story DAG, chronologies, opening, capture, and loop replay tests must remain green.

Run from `tools/event-graph-viewer`: `npm test -- --run` and `npm run build`. Use the corresponding CI run as the actual proof, rather than only static documentation.

## Non-negotiable follow-up authoring boundaries

- Do not turn observations into guaranteed knowledge or use a success notification as independent Writer-isolation proof.
- Do not use `foregroundFreeze` to stop world time or put NPC episodic memory in `PlayerSave.knowledge`.
- Do not claim every Final character interaction is completed; this slice validates the mechanism with selected named characters and timed inputs.
- Ending C affects the *local* autonomous writer, not all Pilot Sites or the real-world physical universe.
