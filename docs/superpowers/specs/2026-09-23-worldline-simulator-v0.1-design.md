# Worldline Simulator v0.1 Design

Date: 2026-09-23
Status: Draft for review
Depends on: PR #1 `feat: add Event Graph Viewer v0.1`

## 1. Goal

Build the first deterministic world simulation layer for **Loop_and_Town**.

The simulator must prove one core gameplay promise:

> The player changes one condition, the world recalculates its event chain, and a different worldline emerges automatically.

The first milestone is intentionally narrow. It only needs to simulate the 18:31 station event and its delayed consequences, then feed the generated history into the existing Timeline and Worldline Diff views.

## 2. Success criteria

Simulator v0.1 is successful when all of the following are true:

1. A World State can be created from a deterministic initial snapshot.
2. A Player Action can mutate World State before a scheduled event.
3. Event conditions can be evaluated against World State.
4. Exactly one matching Variant can be selected deterministically by priority.
5. Variant effects mutate World State.
6. Delayed effects are scheduled and later executed.
7. Every action/event/effect produces Worldline History entries.
8. Two different Player Actions can produce different 18:31 outcomes.
9. The resulting histories can be displayed by the existing Timeline and Worldline Diff views without manually authored fixtures.
10. The same initial state + same action sequence always produces the same result.

## 3. Explicit non-goals

Do not include these in v0.1:

- LLM-generated NPC behavior.
- Free-form natural-language actions.
- Relationship simulation.
- NPC knowledge/belief graphs.
- Full-day NPC schedules.
- Real-time clock synchronization.
- Offline/background simulation.
- Random chance.
- Save files / persistence.
- Multiplayer.
- Visual Event Graph editing.
- Complex expression language or arbitrary code execution inside YAML.

These are future systems and must not be required for the first simulator proof.

## 4. Core architecture

```text
Story YAML
   |
   v
Story Loader / Normalizer
   |
   +--------------------+
   |                    |
   v                    v
World Definition     Event Definition
   |                    |
   +---------+----------+
             |
             v
       World Simulator
             |
      +------+------+----------------+
      |             |                |
      v             v                v
World State   Event Queue   Worldline History
                                  |
                             +----+----+
                             |         |
                             v         v
                         Timeline    Diff
```

The simulator must remain independent from React/UI code.

The Viewer consumes simulator output; the simulator must not depend on Viewer components.

## 5. Determinism rule

All v0.1 simulation is deterministic.

Given:

```text
Initial World State
+
Player Action sequence
+
Story Event definitions
```

The output must always be identical.

No random numbers, timestamps from the local machine, network state, or LLM output may influence resolution.

This is important because worldline comparison only becomes trustworthy when the same inputs reproduce the same timeline.

## 6. World State

World State is the current truth of the simulated world.

Example shape:

```yaml
clock:
  day: 1
  time: "18:20"

characters:
  wakaharu:
    location: old_station
    status: alive
  doctor:
    location: old_station
    status: alive
  reporter:
    location: hotel
    status: alive

world:
  anomaly_1831_observed: false

flags:
  player_protected_wakaharu: false
  player_stopped_doctor: false
```

### Rules

- State contains facts, not narrative prose.
- State mutation must happen only through explicit simulator actions/effects.
- UI may read State but must not mutate it directly.
- Story YAML references State through known paths such as `characters.wakaharu.location`.

## 7. Player Actions

Player Action is an explicit intervention that mutates World State.

For v0.1, actions are authored data, not free-form commands.

Example:

```yaml
id: protect_wakaharu
at: "18:20"
label: 阻止若晴前往舊車站

effects:
  - set:
      path: characters.wakaharu.location
      value: home
  - set:
      path: flags.player_protected_wakaharu
      value: true
```

Minimum v0.1 scenario actions:

```text
A. do_nothing
B. protect_wakaharu
C. stop_doctor
D. protect_wakaharu + stop_doctor
```

Expected demonstration outcome:

```text
do_nothing
→ 若晴死亡

protect_wakaharu
→ 醫生死亡

stop_doctor
→ 若晴死亡

protect_wakaharu + stop_doctor
→ 無人死亡
```

The exact story logic remains editable in YAML; these outcomes define the initial acceptance scenario, not hard-coded engine behavior.

## 8. Condition model

v0.1 must not use `eval()` or arbitrary JavaScript expressions from YAML.

Use a constrained condition AST.

Example:

```yaml
when:
  all:
    - path: characters.wakaharu.location
      op: eq
      value: old_station
    - path: characters.wakaharu.status
      op: eq
      value: alive
```

Supported operators for v0.1:

```text
eq
neq
exists
not_exists
```

Logical groups:

```text
all
any
not
```

This keeps validation, debugging, and future visualization predictable.

## 9. Variant resolution

An Event may contain multiple Variants.

Example:

```yaml
id: evt_1831_station
at: "18:31"

variants:
  - id: wakaharu_dies
    priority: 100
    when: ...
    effects: ...

  - id: doctor_dies
    priority: 90
    when: ...
    effects: ...

  - id: no_death
    priority: 0
    when: ...
    effects: ...
```

Resolution algorithm:

```text
1. Load Event
2. Sort Variants by priority descending
3. Evaluate each Variant condition
4. Select first matching Variant
5. Apply effects
6. Schedule delayed effects
7. Record Worldline History
```

### Ambiguity policy

If multiple Variants match, priority decides.

If two matching Variants have the same priority, simulator should fail validation or raise an explicit ambiguity error in v0.1.

Silent non-deterministic selection is forbidden.

## 10. Effect model

Use a constrained set of effect operations.

Required v0.1 operations:

### set

```yaml
- set:
    path: characters.wakaharu.status
    value: dead
```

### add_flag

Convenience alias for setting a boolean flag to true.

```yaml
- add_flag: world.anomaly_1831_observed
```

### emit_event

Schedule another named event.

```yaml
- emit_event:
    event_id: evt_2114_reporter_missing
    at: "21:14"
```

No arbitrary scripts are allowed.

## 11. Delayed Effects / Event Queue

Delayed consequences are a first-class gameplay system.

Example:

```yaml
delayed_effects:
  - id: reporter_missing_after_station
    delay_minutes: 163
    effects:
      - emit_event:
          event_id: evt_2114_reporter_missing
```

The simulator maintains an ordered queue.

Queue item minimum fields:

```text
executeAt
sourceEventId
sourceVariantId
delayedEffectId
effects
```

Ordering rule:

```text
earlier executeAt first
then insertion order
```

This guarantees deterministic resolution when multiple delayed effects share the same timestamp.

## 12. Simulation clock

v0.1 uses a virtual clock, not real time.

Recommended internal representation:

```text
minute-of-day integer
```

Examples:

```text
18:20 = 1100
18:31 = 1111
21:14 = 1274
```

YAML remains human-readable as `HH:mm`; loader converts it to minutes.

This avoids timezone and Date-object complexity in the engine.

## 13. Worldline History

Worldline History is an append-only simulation log.

It records what actually happened in a specific run.

Suggested entry shape:

```ts
interface WorldlineEntry {
  sequence: number;
  time: string;
  minute: number;
  kind: 'player-action' | 'event' | 'effect' | 'delayed-effect';
  eventId?: string;
  variantId?: string;
  actionId?: string;
  title: string;
  sourceId?: string;
  changes?: StateChange[];
}
```

StateChange example:

```ts
{
  path: 'characters.wakaharu.status',
  before: 'alive',
  after: 'dead'
}
```

This allows Viewer to explain not only that a worldline changed, but why.

## 14. Simulator API

Keep the engine API small.

Suggested public interface:

```ts
createSimulation(definition, initialState)

simulation.applyAction(action)
simulation.runUntil('18:31')
simulation.runUntil('23:59')

simulation.getState()
simulation.getHistory()
simulation.getPendingEvents()
```

Alternative one-shot helper:

```ts
simulate({
  definition,
  initialState,
  actions,
  until: '23:59',
})
```

The one-shot form is useful for tests and Worldline Diff generation.

## 15. Integration with existing Viewer

Viewer v0.1 already contains Graph, Timeline, and Worldline Diff views.

Simulator integration should change the data flow from:

```text
hard-coded fixture
→ Timeline / Diff
```

into:

```text
Scenario controls
→ Simulator
→ Worldline History
→ Timeline / Diff
```

The Event Graph view remains based on authored story definitions.

The Timeline and Diff views display actual simulator output.

## 16. Minimal Scenario UI

The first integration UI should stay intentionally simple.

Example:

```text
Scenario: 18:31 車站事件

[ ] 阻止若晴去車站
[ ] 阻止醫生去車站

[Simulate]
```

Then show:

```text
Worldline A
vs
Worldline B
```

The simulator itself must not contain UI-specific assumptions.

## 17. Suggested project structure

```text
tools/event-graph-viewer/
└─ src/
   ├─ simulator/
   │  ├─ types.ts
   │  ├─ state.ts
   │  ├─ conditionEvaluator.ts
   │  ├─ effectExecutor.ts
   │  ├─ eventResolver.ts
   │  ├─ eventQueue.ts
   │  ├─ simulator.ts
   │  └─ history.ts
   │
   └─ components/
      └─ ScenarioSimulator.tsx

story/
├─ world/
│  └─ day_01_initial.yaml
├─ actions/
│  └─ day_01_actions.yaml
└─ events/
   ├─ day_01_1831.yaml
   └─ day_01_2114.yaml
```

The engine may live in the Viewer package for v0.1, but code boundaries must allow extracting it into a standalone package later.

## 18. Story data migration

The current `day_01_1831.yaml` prototype uses string-like conditions/effects in places.

Simulator v0.1 should migrate only the minimum required sample data to the structured AST described in this spec.

Do not attempt a repository-wide migration framework yet.

## 19. Validation requirements

Before simulation, definitions should reject:

- duplicate Event IDs.
- duplicate Variant IDs within the same Event.
- invalid time format.
- unknown condition operators.
- unknown effect operations.
- invalid state paths where detectable.
- matching Variants with duplicate priority where ambiguity can occur.
- delayed effects with negative delay.
- emitted Event IDs that do not exist.

v0.1 validation can be implemented as TypeScript runtime validation plus tests. A full schema compiler is not required.

## 20. Error behavior

Errors must be explicit and debuggable.

Examples:

```text
Unknown state path: characters.foo.location
Ambiguous variants in evt_1831_station at priority 100
Unknown emitted event: evt_missing
No matching variant for evt_1831_station
```

For v0.1, `No matching variant` should be considered a definition error unless the Event explicitly defines a fallback Variant.

## 21. Test strategy

Use TDD for simulator behavior.

### Unit tests

Condition Evaluator:

```text
eq / neq
all / any / not
missing paths
```

Effect Executor:

```text
set
add_flag
state change recording
```

Event Resolver:

```text
priority selection
fallback
ambiguity detection
```

Event Queue:

```text
time ordering
same-time insertion ordering
delayed execution
```

### Scenario tests

Primary acceptance scenario:

```text
Initial state
+ no action
→ wakaharu_dies

Initial state
+ protect_wakaharu
→ doctor_dies

Initial state
+ stop_doctor
→ wakaharu_dies

Initial state
+ protect_wakaharu + stop_doctor
→ no_death
```

Then verify at least one 18:31 outcome changes whether a 21:14 event occurs.

### UI integration test

Select two action sets, run simulation, confirm Worldline Diff displays the generated differences.

## 22. Performance expectations

v0.1 targets a tiny scenario.

No optimization work is needed beyond avoiding obviously unbounded loops.

The simulator should include a safety guard such as:

```text
maximum processed events per run
```

This prevents malformed emit-event cycles from locking the browser.

Suggested initial limit: 1,000 processed events.

## 23. Future extension points

The architecture should allow, but not implement yet:

```text
NPC Schedule
NPC Knowledge
Relationships
Trust
Inventory
Observation / player-known vs world-true state
Randomized events with seeded RNG
Real-time synchronization
Offline simulation
Save / replay
Loop reset rules
Cross-loop memory
Invariant detection
```

A likely future split is:

```text
World Truth State
!=
Player Knowledge State
```

This distinction is central to the game design, but belongs after the deterministic simulator is stable.

## 24. Core design principles

1. **Story data is the Source of Truth.**
2. **Simulation is deterministic before it becomes dynamic.**
3. **Player Actions change State; they do not directly select endings.**
4. **Events resolve from State conditions.**
5. **Delayed effects are first-class, not special-case callbacks.**
6. **Worldline History is append-only and explainable.**
7. **Viewer visualizes results; it does not own game logic.**
8. **No arbitrary code execution from story YAML.**
9. **The smallest playable causal loop is more valuable than a broad incomplete simulator.**

## 25. v0.1 completion definition

Worldline Simulator v0.1 is complete when this flow works end-to-end:

```text
Load initial state
        |
Apply Player Action(s)
        |
Advance virtual clock
        |
Resolve 18:31 Event from conditions
        |
Mutate World State
        |
Schedule / execute delayed consequence
        |
Generate Worldline History
        |
Render Timeline
        |
Compare against another run in Worldline Diff
```

And the repository demonstrates at least two materially different worldlines generated from the same initial world by changing Player Actions only.
