# Real-time Anchored Timeline Design v0.2

Date: 2026-09-28
Status: Draft
Scope: Time architecture only; no runtime implementation in this PR

## 1. Goal

Loop_and_Town should feel connected to real-world time without forcing the player's device clock to equal Graytide Town's story clock.

A player may begin at 17:00, but the first loop must still begin at 06:12 on the return train. Existing story schedules such as `at: "14:25"` remain Graytide Town times, not wall-clock times.

The selected model is **Hybrid Real-time Anchored Timeline**:

```text
Real Time
   -> Loop Anchor
   -> Time Scale
   -> Simulation Time
   -> Event Scheduler
   -> Narrative / NPC / Event Graph
```

## 2. Core principles

1. **Real Time and Graytide Town Time are different clocks.**
2. Every loop instance owns exactly one active clock anchor.
3. Worldline state may change inside a loop without creating a new clock anchor.
4. Existing `HH:mm` schedule values remain simulation/story time.
5. Reset is driven by simulation time, not the player's local midnight.
6. Offline time may advance the world, but it must not silently cross narrative-critical boundaries such as Reset.
7. Worldline History records both simulation time and real timestamp for replay/debugging.
8. Loop 1 uses a configurable accelerated scale chosen to target a practical first-loop duration.

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
06:12  Reset / protagonist wakes on the return train
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

## 4. Ownership model

The clock belongs to the **Loop instance**, not to the current Worldline label.

```text
Loop Instance
├── Clock Anchor
├── Simulation Time
├── Scheduler State
└── Worldline History
    ├── WL-00
    ├── WL-02
    └── WL-06
```

A Worldline transition is a narrative/state transition inside the same loop.

Changing from `WL-00` to `WL-02` must not reset or re-anchor time.

Only the following operations create a new loop anchor:

- first boot into Loop 1
- Reset into a new loop
- explicit re-anchor required by a scale change or future pause/resume semantics

## 5. Loop Anchor

Each active loop stores one anchor.

Conceptual model:

```yaml
loop:
  id: 2
  worldline_id: WL-03

clock:
  mode: anchored
  simulation_start: "06:12"
  scale: 12.0
  offline_progression: true

anchor:
  real_started_at: "2026-09-28T17:00:00+08:00"
  simulation_started_at: "06:12"
```

Authoritative calculation:

```text
real_elapsed = now - real_started_at
simulation_elapsed = real_elapsed * scale
simulation_now = simulation_started_at + simulation_elapsed
```

The engine should expose this through one `WorldlineClock` abstraction rather than allowing components to calculate time independently.

Despite the name, `WorldlineClock` is loop-owned runtime infrastructure.

## 6. Time scale

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

Loop 2+ scales remain configurable by design/balance.

Requirements:

- `scale > 0`
- changing scale must preserve continuity
- a scale change must re-anchor at the current simulation time
- schedules and event definitions never multiply time themselves

Safe scale change:

```text
old anchor
   -> calculate current simulation time
   -> create replacement anchor at now
   -> apply new scale
```

## 7. Clock vs Scheduler responsibility

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

This separation is required for deterministic replay, tests, offline catch-up, and debugging.

## 8. Offline progression

When the player leaves, persist enough state to reconstruct elapsed real time.

On resume:

```text
last real timestamp
      + real elapsed while offline
      * active scale / offline policy
      -> candidate target Simulation Time
      -> scheduler catch-up
```

Offline progression uses the same Event Scheduler as online progression.

It must not create a second simplified story path.

### 8.1 Deterministic offline event processing

Events crossed during offline time are processed in deterministic order:

```text
time asc
 -> dependency order
 -> stable event id as final tie-breaker
```

The engine should produce a resume summary from resulting Worldline History rather than silently mutating state.

### 8.2 Critical boundaries

Offline catch-up must stop when it reaches a **Critical Boundary**.

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

### 8.3 Reset must not happen invisibly offline

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
 -> create next loop anchor at 06:12
```

This preserves Reset as a narrative event rather than turning it into a background timer operation.

### 8.4 Offline cap

A configurable cap should still exist to prevent extremely long absences from causing unbounded simulation work.

The effective catch-up end is therefore:

```text
min(candidate target time, offline cap, first critical boundary)
```

This spec does not fix the numeric offline-cap value.

## 9. Reset semantics

Reset is based on Graytide Town Simulation Time.

Foreground transition:

```text
23:59 Bell
   -> 00:00 Reset boundary
   -> close current Loop / Worldline History
   -> preserve protagonist meta-memory
   -> clear loop-local mutable state
   -> create next Loop instance
   -> create new anchor at Simulation Time 06:12
```

The player's real time does not need to be midnight.

Example:

```text
Real 18:47 -> Simulation 23:59
Real 18:48 -> Simulation 00:00 -> Reset
Real 18:48 -> new Loop anchor -> Simulation 06:12
```

If 00:00 is reached while offline, the engine stops at the boundary and waits for foreground resume before creating the next loop.

## 10. Event Graph integration

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

## 11. NPC schedule integration

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

## 12. Worldline History

Every significant state transition should be traceable to both clocks.

Conceptual entry:

```yaml
- event_id: convergence
  loop_id: 2
  worldline_id: WL-03
  simulation_time: "18:31"
  real_timestamp: "2026-09-28T20:04:10+08:00"
  cause: scheduled
```

History is the source for:

- player-facing timeline recap
- Event Graph Viewer replay
- offline resume summary
- debugging delayed consequences
- comparing different worldline paths within a loop

A `worldline_id` change does not imply a clock reset.

## 13. Persistence model

Minimum persisted state:

```yaml
loop_id: 2
worldline_id: WL-03
anchor:
  real_started_at: ISO-8601 timestamp
  simulation_started_at: HH:mm or normalized simulation minute
clock:
  scale: number
  offline_progression: boolean
scheduler:
  last_processed_simulation_time: normalized simulation value
  pending_critical_boundary: optional event id
last_observed_real_at: ISO-8601 timestamp
```

Internally, implementation should prefer a normalized monotonic simulation value such as `simulationMinute` or elapsed simulation milliseconds.

`HH:mm` remains the authoring/display representation.

## 14. Boundary and correctness rules

### Day wrap

The scheduler must explicitly handle:

```text
23:59 -> 00:00 -> Reset -> 06:12
```

It must not accidentally continue to `Day 2 00:01` before reset processing finishes.

### Device clock changes

The initial implementation may use wall-clock timestamps, but the clock layer centralizes this dependency so later anti-tamper/server-time logic can replace it.

Story systems must never call `Date.now()` directly.

### Pause

If gameplay introduces pause semantics later, pause freezes Simulation Time by re-anchoring on resume.

Pause behavior is not required for v0.1 implementation unless already needed by the existing player.

## 15. First-loop behavior

First entry always begins at Simulation Time 06:12 regardless of real local time.

Example:

```text
Player opens game at Real 17:00
        -> create Loop 1 anchor
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

## 16. Architecture boundary

Target runtime dependency direction:

```text
RealClock
   -> WorldlineClock (owned by Loop)
      -> EventScheduler.advance(from, to)
         -> Event Graph
         -> NPC Schedules
         -> delayed effects
         -> convergence / bell / reset boundary
         -> Worldline History
```

Rules:

- UI reads the clock; UI does not own it
- WorldlineClock reports time; it does not fire story events
- EventScheduler owns interval advancement and crossed-event discovery
- Event Graph reads simulation time; it does not know wall time
- schedules remain declarative
- Worldline changes do not re-anchor the clock
- Reset creates a new Loop and therefore a new anchor
- persistence stores loop-owned anchor state
- history stores both real and simulation timestamps

## 17. Out of scope for this spec PR

- final numeric time-scale balancing
- anti-cheat/server authoritative time
- notification scheduling
- background OS execution
- UI clock redesign
- implementation code
- migration of all story files

## 18. Implementation acceptance criteria

A later implementation PR is complete when all of the following are true:

1. Starting the game at any real hour begins Loop 1 at 06:12.
2. Existing `story/schedules/*.yaml` values still trigger at their Graytide Town `HH:mm` times.
3. Time progresses according to a configurable scale.
4. Loop 1 scale can be tuned to target roughly 60-120 real minutes.
5. Worldline transitions inside a loop do not recreate the clock anchor.
6. Closing and reopening advances Simulation Time according to the offline policy.
7. Offline events execute deterministically through the same Event Scheduler.
8. Offline catch-up stops at the first Critical Boundary.
9. Offline progression never silently starts a later loop after Reset.
10. 00:00 triggers exactly one foreground Reset and a new 06:12 Loop anchor.
11. Worldline History records simulation time plus real timestamp.
12. Event Graph Viewer can consume the same history rather than maintaining a separate clock model.
13. Story/runtime code outside the clock abstraction does not directly derive story state from wall-clock time.
14. WorldlineClock does not directly fire events; scheduler advancement does.

## 19. Testing requirements for implementation

Required clock/scheduler-level tests:

- real 17:00 first boot -> simulation 06:12
- 12x scale advances 10 real minutes -> 120 simulation minutes
- scale change preserves current simulation time
- worldline id change preserves anchor identity and current time
- offline resume advances correctly
- offline events execute in deterministic chronological order
- offline catch-up stops at Convergence when configured as critical
- offline catch-up stops at Reset boundary
- offline catch-up does not auto-run Loop 2
- 23:59 -> 00:00 triggers exactly one reset
- reset creates a new Loop anchor at 06:12
- NPC `at: HH:mm` behavior remains unchanged
- worldline history contains both clock domains
- `WorldlineClock.now()` alone has no event side effects
- `EventScheduler.advance(from, to)` owns crossed-event processing
- simulated device-time jump is isolated to the clock layer

## 20. Future extensions

The architecture intentionally leaves room for:

- per-loop time scales
- story-driven temporary acceleration
- pause/freeze scenes
- server-authoritative anchors
- push notifications for upcoming events
- configurable Critical Boundary metadata
- Event Graph Viewer dual-axis display: real time vs Graytide Town time
- replay/scrubbing through Worldline History

## 21. Summary

The canonical model is:

```text
Player Real Time
      -> Loop Anchor
      -> configurable Time Scale
      -> Graytide Town Simulation Time
      -> EventScheduler.advance(from, to)
      -> Event Graph / NPC / delayed consequences
      -> Worldline History
      -> Critical Boundary
      -> foreground Reset
      -> new Loop anchor at 06:12
```

This preserves real-world connection while keeping the narrative deterministic, preventing late-day first-time players from missing the opening, preventing offline play from silently consuming future loops, and giving the project one shared time model for idle progression, event scheduling, and worldline replay.
