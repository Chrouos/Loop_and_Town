# Real-time Anchored Timeline Design v0.3

Date: 2026-09-28
Status: Draft
Scope: Time architecture only; no runtime implementation in this PR

## 1. Goal

Loop_and_Town should feel connected to real-world time without forcing the player's device clock to equal Graytide Town's story clock in every loop.

A player may begin at 17:00, but the first loop must still begin at 06:12 on the return train. Existing story schedules such as `at: "14:25"` remain Graytide Town times, not wall-clock timestamps.

From Loop 2 onward, the player may choose whether the new loop follows an accelerated story clock or synchronizes its entry point to real-world time.

The selected model is **Hybrid Real-time Anchored Timeline**:

```text
Real Time
   -> Loop Time Mode
   -> Loop Anchor
   -> Time Scale / Live Sync mapping
   -> Simulation Time
   -> Event Scheduler
   -> Narrative / NPC / Event Graph
```

## 2. Core principles

1. **Real Time and Graytide Town Time are different clock domains.**
2. Every loop instance owns exactly one active clock anchor.
3. Worldline state may change inside a loop without creating a new clock anchor.
4. Existing `HH:mm` schedule values remain simulation/story time.
5. Reset is driven by simulation time, not the player's local midnight.
6. Offline time may advance the world, but it must not silently consume future loops.
7. Worldline History records both simulation time and real timestamp for replay/debugging.
8. Loop 1 is always an accelerated onboarding loop beginning at 06:12.
9. Loop 2+ may choose a Time Mode at loop creation.
10. A Time Mode is locked for that loop and cannot be toggled mid-loop.
11. In Live Sync, the loop still begins at 06:12; only the player's **Entry Point** changes.

## 3. Clock model

### 3.1 Real Time

Wall-clock timestamp supplied by the runtime.

Example:

```text
2026-09-28T17:00:00+08:00
```

Real Time is never used directly by story nodes or NPC schedules.

### 3.2 Simulation Time

The authoritative time inside Graytide Town.

Important story anchors:

```text
06:12  loop start / protagonist's canonical return point
07:20-08:00  arrival window
09:10  investigation phase begins
18:31  Convergence
23:59  bell
00:00  Reset boundary
```

Existing schedule entries such as:

```yaml
at: "14:25"
```

continue to mean **Simulation Time 14:25**.

### 3.3 Narrative Time

The formatted time shown to the player.

Initially Narrative Time is derived directly from Simulation Time, but it remains a presentation concept so later scenes may hide, blur, freeze, or distort displayed time without changing simulation state.

### 3.4 Player Entry Point

Player Entry Point is the simulation time at which the player becomes an active participant in the current loop.

It is not the same thing as Loop Start.

```text
Loop Start   = 06:12
Player Entry = mode-dependent
```

Example in Live Sync:

```text
Real 17:05
   -> Loop has conceptually existed since Simulation 06:12
   -> scheduler reconstructs 06:12..17:05
   -> Player Entry Point = 17:05
```

This lets different real-world play times produce different openings without changing the canonical beginning of the loop.

## 4. Ownership model

The clock belongs to the **Loop instance**, not to the current Worldline label.

```text
Loop Instance
├── Time Mode
├── Clock Anchor
├── Simulation Time
├── Player Entry Point
├── Scheduler State
└── Worldline History
    ├── WL-00
    ├── WL-02
    └── WL-06
```

A Worldline transition is a narrative/state transition inside the same loop.

Changing from `WL-00` to `WL-02` must not reset or re-anchor time.

A new loop anchor is created when:

- first boot creates Loop 1
- Reset creates the next loop
- a clock-preserving re-anchor is needed for an approved scale change
- future pause/resume semantics explicitly require it

## 5. Time Modes

Two runtime Time Modes are defined.

```text
ACCELERATED
LIVE_SYNC
```

### 5.1 Accelerated Mode

Accelerated Mode maps real elapsed time into faster Graytide Town simulation time.

```text
Simulation elapsed = Real elapsed * scale
```

It is used for:

- Loop 1 onboarding
- players who do not want real-time scheduling
- play sessions during the Live Sync inactive gap
- future accessibility / pacing preferences

### 5.2 Live Sync Mode

Live Sync makes the player's current real local clock time the target Graytide Town Entry Point.

Example:

```text
Real 07:32 -> Simulation Entry 07:32
Real 14:20 -> Simulation Entry 14:20
Real 17:05 -> Simulation Entry 17:05
Real 21:40 -> Simulation Entry 21:40
```

Live Sync does **not** mean that the loop begins at that time.

The loop always has a canonical beginning at 06:12.

```text
06:12 Loop Start
   -> world progresses
   -> NPC schedules execute
   -> events occur
   -> worldline state changes
   -> current real time becomes Player Entry Point
```

### 5.3 Mode selection and locking

Loop 1 is forced to Accelerated Mode.

Loop 2+ may choose a mode when the loop is created.

Conceptual player-facing choice:

```text
[跟著現在走]
-> LIVE_SYNC

[回到記憶開始的地方]
-> ACCELERATED
```

The selected mode is locked until the next Reset.

Invalid behavior:

```text
17:00 LIVE_SYNC
 -> switch to ACCELERATED
 -> jump simulation
 -> trigger events
 -> switch back to LIVE_SYNC
```

This would make Event Graph outcomes exploitable and non-deterministic.

Mode changes therefore happen only at loop boundaries.

## 6. Loop Anchor

Each active loop stores one anchor.

Accelerated example:

```yaml
loop:
  id: 2
  time_mode: accelerated
  worldline_id: WL-03

clock:
  simulation_start: "06:12"
  scale: 12.0
  offline_progression: true

anchor:
  real_started_at: "2026-09-28T17:00:00+08:00"
  simulation_started_at: "06:12"
```

Live Sync example:

```yaml
loop:
  id: 2
  time_mode: live_sync
  worldline_id: WL-03

clock:
  simulation_start: "06:12"
  scale: 1.0
  offline_progression: true
  sync_local_time_of_day: true

anchor:
  loop_real_date: "2026-09-28"
  simulation_started_at: "06:12"
```

The engine exposes time through one `WorldlineClock` abstraction rather than allowing components to calculate story time independently.

Despite the name, `WorldlineClock` is loop-owned runtime infrastructure.

## 7. Accelerated Mode scale

Time scale is configurable per loop or progression phase.

The first-loop goal is expressed as a target duration rather than a fixed scale:

```text
Loop 1 target real duration: 60-120 minutes
```

Graytide Town time from 06:12 to 00:00 is 17h48m, or 1068 simulation minutes.

Useful balance references:

```text
9x  -> ~119 real minutes
12x -> ~89 real minutes
18x -> ~59 real minutes
```

Initial tuning baseline:

```text
Loop 1 baseline scale: 12x
```

This value remains balance configuration, not a hard-coded story rule.

Requirements:

- `scale > 0`
- changing scale must preserve continuity
- an allowed scale change must re-anchor at the current simulation time
- schedules and event definitions never multiply time themselves
- Time Mode itself cannot change during the loop

Safe scale change inside Accelerated Mode:

```text
old anchor
   -> calculate current simulation time
   -> create replacement anchor at now
   -> apply new scale
```

## 8. Live Sync bootstrap

When a Live Sync loop is entered, the world must be reconstructed from its canonical 06:12 start to the player's real-time Entry Point.

Example: player enters at 17:05.

```text
06:12 Loop Start
   -> 07:20 NPC event
   -> 09:10 investigation starts
   -> 13:40 reporter event
   -> 15:30 document event
   -> 17:05 Player Entry Point
```

This bootstrap uses the same Event Scheduler and Event Graph rules as foreground play.

It must not fabricate a separate simplified world state.

The resulting pre-entry events are written to Worldline History.

### 8.1 Entry scenes are window-based

Narrative openings should not require one authored scene per minute.

Initial Entry Windows:

```text
06:12-08:59  dawn
09:00-11:59  morning
12:00-15:59  afternoon
16:00-18:30  evening
18:31-21:59  post_convergence
22:00-23:59  late_night
```

The simulation remains minute-accurate.

The Entry Window only selects presentation/narrative framing.

Example:

```text
Real 17:23
-> Simulation Entry 17:23
-> Entry Window = evening
```

### 8.2 Different entry times may expose different information

Some optional knowledge may naturally be easier to discover during specific windows.

Example:

```text
07:40 NPC appears at station
```

A player entering at 07:32 may observe this directly.

A player entering at 17:00 may only learn about it later through records, testimony, investigation, or a future loop.

Important rule:

**Core progression must not require unreasonable real-world attendance such as waking at 03:00.**

Time-specific discovery may reward curiosity, but critical information needs alternate acquisition paths once the protagonist has enough knowledge.

This connects Live Sync to the game's meta-memory system rather than turning real-world availability into a hard progression lock.

## 9. Live Sync inactive gap: 00:00-06:11

Graytide Town's playable loop ends at 00:00 and canonically restarts at 06:12.

Therefore real local time `00:00-06:11` has no direct one-to-one Simulation Entry Point in Live Sync.

The engine must not invent a fake `02:00` Graytide Town state.

During this interval:

```text
LIVE_SYNC direct entry = unavailable
```

The player must still be allowed to play.

The runtime should offer or automatically route to an Accelerated/Memory Entry path beginning at 06:12.

Conceptually:

```text
Real 02:20
   -> Live Sync is between loops
   -> [回到記憶開始的地方]
   -> Accelerated Mode / 06:12 entry
```

A future version may add a dedicated liminal/reset-space scene, but v0.3 does not require it.

## 10. Clock vs Scheduler responsibility

The clock answers only:

```text
"What time is it in Graytide Town?"
```

The scheduler answers:

```text
"What happened between the previous simulation time and the new simulation time?"
```

Canonical runtime flow:

```text
WorldlineClock.now()
      -> EventScheduler.advance(from, to)
      -> find crossed events
      -> resolve dependencies / conditions
      -> Event Graph / NPC Schedules / delayed effects
      -> append Worldline History
```

`WorldlineClock` must not directly trigger events, Convergence, bell, or Reset.

This separation is required for deterministic replay, tests, Live Sync bootstrap, offline catch-up, and debugging.

## 11. Offline progression

When the player leaves after entering a loop, persist enough state to reconstruct elapsed real time.

On resume:

```text
last real timestamp
      + elapsed time / active Time Mode
      -> candidate target Simulation Time
      -> scheduler catch-up
```

Offline progression uses the same Event Scheduler as online progression.

It must not create a second simplified story path.

### 11.1 Accelerated offline target

```text
simulation elapsed = real elapsed * active scale
```

### 11.2 Live Sync offline target

Within the active Live Sync window:

```text
simulation target time-of-day = current real local time-of-day
```

The scheduler advances from the last processed Simulation Time to that target.

### 11.3 Deterministic offline event processing

Events crossed during offline time are processed in deterministic order:

```text
time asc
 -> dependency order
 -> stable event id as final tie-breaker
```

The engine produces a resume summary from resulting Worldline History rather than silently mutating state.

## 12. Critical boundaries

Offline catch-up after the player has already entered the loop must stop when it reaches a **Critical Boundary**.

Initial critical boundaries:

```text
18:31  Convergence
23:59  Bell
00:00  Reset
```

The exact set may later be expressed as event metadata, but the behavioral rule is fixed:

```text
Offline catch-up
   -> process normal events
   -> encounter Critical Boundary
   -> stop simulation catch-up
   -> persist pending boundary state
   -> require foreground resume to continue narrative transition
```

### 12.1 Live Sync bootstrap vs offline catch-up

Live Sync's first entry into a new loop is different from resuming an already-entered loop.

During **initial Live Sync bootstrap**, the scheduler may reconstruct past ordinary events and past narrative phases up to the Entry Point so that a player can genuinely enter later in the day.

Example:

```text
Player first enters this loop at 21:40
06:12 -> ... -> 18:31 Convergence -> ... -> 21:40 Entry
```

The player did not personally witness earlier events; their history representation must respect protagonist knowledge and should not reveal hidden facts merely because the simulator processed them.

The Reset boundary remains absolute: bootstrap must never cross `00:00` into a later loop.

During **offline resume after Player Entry**, Critical Boundary stop rules apply normally so major transitions are not silently consumed while the player is absent.

## 13. Reset semantics

Reset is based on Graytide Town Simulation Time.

Foreground transition:

```text
23:59 Bell
   -> 00:00 Reset boundary
   -> close current Loop / Worldline History
   -> preserve protagonist meta-memory
   -> clear loop-local mutable state
   -> create next Loop instance
   -> select/resolve next Time Mode
   -> create new loop clock state
```

The player's real time does not need to be midnight in Accelerated Mode.

In Live Sync, the simulation clock follows the active real-time window, but Reset still belongs to Graytide Town's narrative boundary and scheduler semantics.

Offline progression must never automatically run through multiple loops.

Invalid behavior:

```text
player offline
 -> Loop 1 Reset
 -> Loop 2 progresses
 -> Loop 2 Reset
 -> Loop 3 progresses
```

Required behavior:

```text
player offline
 -> current loop advances
 -> reaches Reset boundary
 -> stop
 -> player resumes
 -> show offline/worldline summary
 -> perform Reset presentation
 -> create next loop
```

## 14. Event Graph integration

Event Graph nodes describe story conditions and simulation times, not real timestamps.

Preferred rule:

```text
Story data knows Simulation Time
Runtime knows Real Time
Loop-owned WorldlineClock is the only bridge
```

Timed event example:

```yaml
id: convergence
at: "18:31"
critical_boundary: true
```

The scheduler compares graph/event times against the simulation interval passed to `advance(from, to)`.

Delayed effects are also expressed in simulation duration/time.

Event Graph nodes should not contain separate Accelerated and Live Sync versions unless the narrative itself differs.

Both modes consume the same canonical event data.

## 15. NPC schedule integration

Current files under `story/schedules/` keep their existing semantics.

Example:

```yaml
character_id: protagonist
entries:
  - id: protagonist_arrive
    at: "14:25"
    activity_id: walk_home
```

No real timestamp is added to author-facing NPC schedules.

This keeps story authoring deterministic and readable.

In Live Sync, an NPC event scheduled for 14:25 still occurs at Simulation 14:25 even if the player first enters at 17:00.

## 16. Worldline History and knowledge visibility

Every significant state transition should be traceable to both clock domains.

Conceptual internal entry:

```yaml
- event_id: convergence
  loop_id: 2
  worldline_id: WL-03
  simulation_time: "18:31"
  real_timestamp: "2026-09-28T18:31:00+08:00"
  cause: scheduled
  player_present: false
```

History is the source for:

- player-facing timeline recap
- Event Graph Viewer replay
- Live Sync pre-entry reconstruction
- offline resume summary
- debugging delayed consequences
- comparing different worldline paths within a loop

Internal history is not automatically identical to player knowledge.

The simulator may know that an event happened while the protagonist does not.

Therefore player-facing recap must filter history through knowledge/reveal rules.

```text
Worldline History (truth)
        -> Knowledge Filter
        -> Player-visible History
```

This is especially important for late Live Sync entries.

A `worldline_id` change does not imply a clock reset.

## 17. Persistence model

Minimum persisted state:

```yaml
loop_id: 2
worldline_id: WL-03
time_mode: live_sync
player_entry:
  entered: true
  simulation_time: "17:05"
  entry_window: evening
anchor:
  real_started_at: optional ISO-8601 timestamp
  loop_real_date: optional local date
  simulation_started_at: HH:mm or normalized simulation minute
clock:
  scale: number
  offline_progression: boolean
  sync_local_time_of_day: boolean
scheduler:
  last_processed_simulation_time: normalized simulation value
  pending_critical_boundary: optional event id
last_observed_real_at: ISO-8601 timestamp
```

Internally, implementation should prefer a normalized monotonic simulation value such as `simulationMinute` or elapsed simulation milliseconds.

`HH:mm` remains the authoring/display representation.

## 18. Boundary and correctness rules

### Day wrap

The scheduler must explicitly handle:

```text
23:59 -> 00:00 -> Reset
```

It must not accidentally continue to `Day 2 00:01` before reset processing finishes.

### Live Sync date boundary

Live Sync is tied to a local real date for its active loop window.

The engine must not map the next calendar day's 01:00 to Simulation 01:00, because that time does not exist in the canonical loop.

### Device clock changes

The initial implementation may use wall-clock timestamps, but the clock layer centralizes this dependency so later anti-tamper/server-time logic can replace it.

Story systems must never call `Date.now()` directly.

### Time zone changes

A future implementation must decide whether Live Sync follows device local time or a loop-locked time zone after travel.

For v0.3, this remains an implementation decision but must stay inside the clock abstraction.

### Pause

If gameplay introduces pause semantics later, pause freezes Simulation Time only in modes where that behavior is explicitly supported.

Pause behavior is not required for v0.1 runtime implementation.

## 19. First-loop behavior

First entry always begins at Simulation Time 06:12 regardless of real local time.

Loop 1 is always Accelerated Mode.

Example:

```text
Player opens game at Real 17:00
        -> create Loop 1
        -> Time Mode = ACCELERATED
        -> Simulation 06:12
        -> opening train scene
```

Balance target:

```text
06:12 -> 00:00
should normally take ~60-120 real minutes
```

Initial baseline:

```text
12x
10 real minutes = 120 simulation minutes
full loop ~= 89 real minutes
```

The value remains configurable so narrative pacing can be tuned without changing story files.

## 20. Loop 2+ behavior

At each Reset after Loop 1, the next loop resolves a Time Mode.

```text
Reset
  -> choose Time Mode
      ├── LIVE_SYNC
      └── ACCELERATED
  -> create loop
  -> lock mode
```

### Live Sync example: early entry

```text
Real 07:32
06:12 Loop Start
  -> bootstrap 80 minutes
  -> Player Entry 07:32
  -> dawn Entry Scene
```

### Live Sync example: afternoon entry

```text
Real 14:20
06:12 Loop Start
  -> world reconstructs morning events
  -> Player Entry 14:20
  -> afternoon Entry Scene
```

### Live Sync example: late entry

```text
Real 21:40
06:12 Loop Start
  -> world reconstructs events including post-Convergence state
  -> Player Entry 21:40
  -> late/post-Convergence Entry Scene
  -> limited remaining time before Bell
```

Different entry times are intentionally allowed to create different first impressions of the same loop.

## 21. Architecture boundary

Target runtime dependency direction:

```text
RealClock
   -> Loop Time Mode
   -> WorldlineClock (owned by Loop)
      -> EventScheduler.advance(from, to)
         -> Event Graph
         -> NPC Schedules
         -> delayed effects
         -> convergence / bell / reset boundary
         -> Worldline History
            -> Knowledge Filter
               -> player-visible recap / entry scene
```

Rules:

- UI reads the clock; UI does not own it
- WorldlineClock reports time; it does not fire story events
- EventScheduler owns interval advancement and crossed-event discovery
- Event Graph reads simulation time; it does not know wall time
- schedules remain declarative
- Worldline changes do not re-anchor the clock
- Time Mode is chosen at loop creation and locked until Reset
- Loop Start remains 06:12 in both modes
- Player Entry Point may vary in Live Sync
- Reset creates a new Loop and therefore new clock state
- persistence stores loop-owned time state
- internal history and player knowledge are separate concepts

## 22. Out of scope for this spec PR

- final numeric Accelerated time-scale balancing
- anti-cheat/server authoritative time
- notification scheduling
- background OS execution
- final UI design for Time Mode choice
- final prose for each Entry Window
- time-zone travel policy
- implementation code
- migration of all story files

## 23. Implementation acceptance criteria

A later implementation PR is complete when all of the following are true:

1. Starting the game at any real hour begins Loop 1 at 06:12.
2. Loop 1 always uses Accelerated Mode.
3. Existing `story/schedules/*.yaml` values still trigger at their Graytide Town `HH:mm` times.
4. Accelerated Mode progresses according to configurable scale.
5. Loop 1 scale can be tuned to target roughly 60-120 real minutes.
6. Loop 2+ can resolve either Live Sync or Accelerated Mode at loop creation.
7. Time Mode cannot be switched mid-loop.
8. Worldline transitions inside a loop do not recreate the clock anchor.
9. Live Sync keeps canonical Loop Start at 06:12.
10. Live Sync maps current real local time to Player Entry Point during the active window.
11. Live Sync bootstrap reconstructs 06:12..Entry Point using the normal scheduler.
12. Entry Window selection is presentation-only and does not change simulation precision.
13. Real 00:00-06:11 does not produce invalid Simulation 00:00-06:11 Live Sync states.
14. Players during the inactive Live Sync gap still have a playable Accelerated/Memory path.
15. Closing and reopening advances Simulation Time according to the active mode's offline policy.
16. Offline events execute deterministically through the same Event Scheduler.
17. Offline catch-up after Player Entry stops at configured Critical Boundaries.
18. Offline progression never silently starts a later loop after Reset.
19. 00:00 triggers exactly one Reset.
20. Worldline History records simulation time plus real timestamp and player-presence metadata.
21. Player-facing history does not reveal hidden events merely because Live Sync bootstrap simulated them.
22. Event Graph Viewer can consume the same canonical history rather than maintaining a separate clock model.
23. Story/runtime code outside the clock abstraction does not directly derive story state from wall-clock time.
24. WorldlineClock does not directly fire events; scheduler advancement does.

## 24. Testing requirements for implementation

Required clock/scheduler-level tests:

- real 17:00 first boot -> Loop 1 Accelerated -> simulation 06:12
- 12x scale advances 10 real minutes -> 120 simulation minutes
- scale change preserves current simulation time
- worldline id change preserves anchor identity and current time
- Loop 2 Live Sync at real 07:32 -> Entry Point 07:32
- Loop 2 Live Sync at real 14:20 -> Entry Point 14:20
- Loop 2 Live Sync at real 21:40 -> Entry Point 21:40
- Live Sync bootstrap processes scheduled events before Entry Point
- pre-entry hidden event is not automatically exposed to player knowledge
- Entry Window maps 17:23 -> evening
- real 02:20 Live Sync does not create Simulation 02:20
- inactive Live Sync gap provides Accelerated/Memory fallback
- Time Mode cannot be changed after loop creation
- offline resume advances correctly for Accelerated Mode
- offline resume advances correctly for Live Sync Mode
- offline events execute in deterministic chronological order
- offline catch-up after Player Entry stops at Convergence when configured as critical
- offline catch-up stops at Reset boundary
- offline catch-up does not auto-run next loop
- 23:59 -> 00:00 triggers exactly one reset
- reset creates new loop clock state
- NPC `at: HH:mm` behavior remains unchanged
- worldline history contains both clock domains
- `WorldlineClock.now()` alone has no event side effects
- `EventScheduler.advance(from, to)` owns crossed-event processing
- simulated device-time jump is isolated to the clock layer

## 25. Future extensions

The architecture intentionally leaves room for:

- per-loop Accelerated time scales
- story-driven temporary acceleration
- pause/freeze scenes
- server-authoritative anchors
- push notifications for upcoming time-sensitive events
- configurable Critical Boundary metadata
- richer Entry Window scenes
- a dedicated 00:00-06:11 liminal/reset space
- time-zone aware Live Sync behavior
- Event Graph Viewer dual-axis display: real time vs Graytide Town time
- replay/scrubbing through Worldline History

## 26. Summary

The canonical model is:

```text
Loop 1
  -> ACCELERATED
  -> fixed Player Entry 06:12

Reset
  -> choose next Time Mode
      ├── ACCELERATED
      │    -> Player Entry 06:12
      │
      └── LIVE_SYNC
           -> Loop Start 06:12
           -> scheduler reconstructs world
           -> Real Time determines Player Entry Point
           -> Entry Window selects opening presentation

Then for both modes:

WorldlineClock
  -> EventScheduler.advance(from, to)
  -> Event Graph / NPC / delayed consequences
  -> Worldline History
  -> Knowledge Filter
  -> Critical Boundary / Reset
  -> next Loop
```

This preserves a deterministic loop structure while making real-world time materially affect how the player re-enters Graytide Town. A player who opens the game in the morning, afternoon, or late at night can encounter the same loop from a different temporal position, while the protagonist's retained memory provides alternate ways to recover missed information across future loops.
