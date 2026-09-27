# Real-time Anchored Timeline Design v0.1

Date: 2026-09-28
Status: Draft
Scope: Time architecture only; no runtime implementation in this PR

## 1. Goal

Loop_and_Town should feel connected to real-world time without forcing the player's device clock to equal Graytide Town's story clock.

A player may begin at 17:00, but the first loop must still begin at 06:12 on the return train. Existing story schedules such as `at: "14:25"` remain Graytide Town times, not wall-clock times.

The selected model is **Hybrid Real-time Anchored Timeline**:

```text
Real Time
   -> Worldline Anchor
   -> Time Scale
   -> Simulation Time
   -> Event Scheduler
   -> Narrative / NPC / Event Graph
```

## 2. Core principles

1. **Real Time and Graytide Town Time are different clocks.**
2. Every loop/worldline owns an anchor that maps real elapsed time to simulation elapsed time.
3. Existing `HH:mm` schedule values remain simulation/story time.
4. Reset is driven by simulation time, not the player's local midnight.
5. Offline time may advance the world.
6. Worldline History records both simulation time and real timestamp for replay/debugging.
7. Loop 1 may use an accelerated time scale while later loops can use a different configurable scale.

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

Initially Narrative Time is derived directly from Simulation Time, but it remains a separate presentation concept so later scenes may hide, blur, freeze, or distort displayed time without changing the simulation.

## 4. Worldline Anchor

Each active loop stores an anchor.

Conceptual model:

```yaml
clock:
  mode: anchored
  simulation_start: "06:12"
  scale: 6.0
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

The engine should expose this through one clock abstraction rather than allowing components to calculate time independently.

## 5. Time scale

Time scale is configurable per loop or progression phase.

Initial intended policy:

```text
Loop 1     accelerated, default target: 6x
Loop 2+    configurable by design/balance
```

The exact scale is balance data, not a hard-coded story rule.

Requirements:

- `scale > 0`
- changing scale must preserve continuity
- a scale change must re-anchor at the current simulation time
- schedules and event definitions never multiply time themselves

Example of safe scale change:

```text
old anchor -> calculate current simulation time
           -> create new anchor at now
           -> apply new scale
```

## 6. Offline progression

When the player leaves, store enough state to reconstruct elapsed real time.

On resume:

```text
last real timestamp
      + real elapsed while offline
      * active scale / offline policy
      -> target Simulation Time
      -> process due events in chronological order
```

Offline progression must use the same Event Scheduler as online progression.

It must not create a second simplified story path.

### 6.1 Offline event processing

Events crossed during offline time are processed in deterministic order:

```text
time asc
 -> dependency order
 -> stable event id as final tie-breaker
```

The engine should produce a resume summary from the resulting Worldline History rather than silently mutating state.

### 6.2 Offline cap

A configurable cap should exist to prevent extremely long absences from causing unbounded simulation work.

This spec does not fix the cap value.

## 7. Reset semantics

Reset is based on Graytide Town Simulation Time.

```text
23:59 bell
   -> 00:00 reset boundary
   -> close current Worldline History
   -> preserve protagonist meta-memory
   -> clear loop-local mutable state
   -> create new worldline/loop
   -> create new anchor at Simulation Time 06:12
```

The player's real time does not need to be midnight.

Example:

```text
Real 18:47 -> Simulation 23:59
Real 18:48 -> Simulation 00:00 -> Reset
Real 18:48 -> new anchor -> Simulation 06:12
```

This preserves the fiction that Graytide Town's loop clock is distinct from the player's device clock.

## 8. Event Graph integration

Event Graph nodes should continue to describe story conditions and simulation times, not real timestamps.

Preferred rule:

```text
Story data knows Simulation Time
Runtime knows Real Time
WorldlineClock is the only bridge between them
```

Timed event example:

```yaml
id: convergence
at: "18:31"
```

The scheduler asks `WorldlineClock.now()` and determines whether the event is due.

Delayed effects should also be expressed in simulation duration/time.

## 9. NPC schedule integration

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

## 10. Worldline History

Every significant state transition should be traceable to both clocks.

Conceptual entry:

```yaml
- event_id: convergence
  loop: 2
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
- comparing different worldlines

## 11. Persistence model

Minimum persisted clock state:

```yaml
loop_id: 2
worldline_id: WL-03
anchor:
  real_started_at: ISO-8601 timestamp
  simulation_started_at: HH:mm or normalized simulation minute
clock:
  scale: number
  offline_progression: boolean
last_observed_real_at: ISO-8601 timestamp
```

Internally, implementation should prefer a normalized monotonic simulation value such as `simulationMinute` or elapsed simulation milliseconds.

`HH:mm` remains the authoring/display representation.

## 12. Boundary and correctness rules

### Day wrap

The clock must explicitly handle the transition:

```text
23:59 -> 00:00 -> Reset -> 06:12
```

It must not accidentally continue to `Day 2 00:01` before reset processing finishes.

### Device clock changes

The initial implementation may use wall-clock timestamps, but the clock layer must centralize this dependency so later anti-tamper/server-time logic can replace it.

Story systems must never call `Date.now()` directly.

### Pause

If gameplay introduces pause semantics later, pause should freeze Simulation Time by re-anchoring on resume.

Pause behavior is not required for v0.1 implementation unless already needed by the existing player.

## 13. First-loop behavior

First entry always begins at Simulation Time 06:12 regardless of real local time.

Example:

```text
Player opens game at Real 17:00
        -> create Loop 1 anchor
        -> Simulation 06:12
        -> opening train scene
```

With a 6x scale:

```text
10 real minutes = 60 simulation minutes
```

This allows the first loop to teach the world and reach Reset without requiring a real 17h48m wait.

## 14. Architecture boundary

Target runtime dependency direction:

```text
RealClock
   -> WorldlineClock
      -> EventScheduler
         -> Event Graph
         -> NPC Schedules
         -> delayed effects
         -> convergence/reset
              -> Worldline History
```

Rules:

- UI reads the clock; UI does not own it
- Event Graph reads simulation time; it does not know wall time
- schedules remain declarative
- reset creates a new anchor
- persistence stores anchor state
- history stores both real and simulation timestamps

## 15. Out of scope for this spec PR

- final numeric time-scale balancing
- anti-cheat/server authoritative time
- notification scheduling
- background OS execution
- UI clock redesign
- implementation code
- migration of all story files

## 16. Implementation acceptance criteria

A later implementation PR is complete when all of the following are true:

1. Starting the game at any real hour begins Loop 1 at 06:12.
2. Existing `story/schedules/*.yaml` values still trigger at their Graytide Town `HH:mm` times.
3. Time progresses according to a configurable scale.
4. Closing and reopening advances Simulation Time according to the offline policy.
5. Events crossed while offline are replayed deterministically.
6. 00:00 triggers Reset and a new 06:12 anchor without depending on device midnight.
7. Worldline History records simulation time plus real timestamp.
8. Event Graph Viewer can consume the same history rather than maintaining a separate clock model.
9. Story/runtime code outside the clock abstraction does not directly derive story state from wall-clock time.

## 17. Testing requirements for implementation

Required clock-level tests:

- real 17:00 first boot -> simulation 06:12
- 6x scale advances 10 real minutes -> 60 simulation minutes
- scale change preserves current simulation time
- offline resume advances correctly
- offline events execute in deterministic chronological order
- 23:59 -> 00:00 triggers exactly one reset
- reset re-anchors to 06:12
- NPC `at: HH:mm` behavior remains unchanged
- worldline history contains both clock domains
- simulated device-time jump is isolated to the clock layer

## 18. Future extensions

The architecture intentionally leaves room for:

- per-loop time scales
- story-driven temporary acceleration
- pause/freeze scenes
- server-authoritative anchors
- push notifications for upcoming events
- Event Graph Viewer dual-axis display: real time vs Graytide Town time
- replay/scrubbing through Worldline History

## 19. Summary

The canonical model is:

```text
Player Real Time
      -> Worldline Anchor
      -> configurable Time Scale
      -> Graytide Town Simulation Time
      -> Event Scheduler
      -> Event Graph / NPC / delayed consequences
      -> Worldline History
      -> 00:00 Reset
      -> new 06:12 anchor
```

This preserves real-world connection while keeping the narrative deterministic, preventing late-day first-time players from missing the opening, and giving the project one shared time model for idle progression, event scheduling, and worldline replay.
