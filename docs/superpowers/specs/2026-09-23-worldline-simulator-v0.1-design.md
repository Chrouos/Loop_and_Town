# Worldline Simulator v0.1 Design

Date: 2026-09-23
Status: Approved for implementation
Depends on: PR #1 `feat: add Event Graph Viewer v0.1`

## 1. Goal

Build the first deterministic world simulation layer for **Loop_and_Town**.

The simulator must prove the core gameplay promise:

> The player changes one condition, the world recalculates its event chain, and a different worldline emerges automatically.

v0.1 intentionally focuses on one causal chain: player interventions before 18:31, the 18:31 station event, and a delayed consequence at 21:14.

## 2. Binding acceptance scenario

The simulator is not complete unless the same initial state produces all four outcomes below by changing Player Actions only.

```text
do_nothing ([])
→ 18:31 wakaharu_dies
→ 若晴死亡
→ 21:14 reporter_missing 發生

protect_wakaharu
→ 18:31 doctor_dies
→ 醫生死亡
→ 21:14 reporter_missing 不發生

stop_doctor
→ 18:31 wakaharu_dies
→ 若晴死亡
→ 21:14 reporter_missing 發生

protect_wakaharu + stop_doctor
→ 18:31 no_death
→ 無人死亡
→ 21:14 reporter_missing 不發生
```

`do_nothing` is represented by an empty action list, not by a special engine action.

The 21:14 divergence is mandatory. It proves that a changed worldline can produce a delayed consequence instead of merely changing one immediate card.

For v0.1, `wakaharu_dies` schedules the 21:14 reporter event directly. Extra conditions such as `reporter.exposed_by_player` are intentionally excluded from this acceptance path so the delayed consequence remains deterministic and testable.

## 3. Success criteria

Simulator v0.1 is successful when all of the following are true:

1. A World State can be created from a deterministic initial snapshot.
2. Player Actions mutate World State before scheduled events.
3. Authored events with `at` are inserted into the simulation queue when a simulation is created.
4. Event conditions are evaluated against World State.
5. Exactly one matching Variant is selected deterministically.
6. Variant effects mutate World State.
7. Delayed effects are queued and later executed.
8. `emit_event` can enqueue a named event at a specified time or immediately at the current simulation time.
9. Every action/event/effect/delayed effect produces append-only Worldline History.
10. All four binding acceptance scenarios pass.
11. At least one 18:31 outcome changes whether the 21:14 event occurs.
12. Timeline and Worldline Diff consume simulator-generated output rather than authored worldline fixtures.
13. Same initial state + same action sequence + same story definition always produces identical state and history.

## 4. Explicit non-goals

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

## 5. Architecture

```text
Story YAML
   |
   v
Story Loader / Validator
   |
   +---------------------------+
   |                           |
   v                           v
Initial World State        Event / Action Definitions
   |                           |
   +-------------+-------------+
                 |
                 v
           World Simulator
                 |
      +----------+-----------+
      |                      |
      v                      v
 World State          Simulation Queue
                             |
                             v
                    Worldline History
                             |
                       Viewer Projection
                        /           \
                       v             v
                  Timeline       Worldline Diff
```

The simulator must remain independent from React/UI code.

Story data is the Source of Truth. Viewer components never mutate simulation state.

## 6. World State

World State stores facts, not narrative prose.

Example:

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

State mutation occurs only through explicit actions/effects.

## 7. Player Actions

Player Actions are authored data that mutate World State.

Required v0.1 actions:

```yaml
- id: protect_wakaharu
  at: "18:20"
  label: 阻止若晴前往舊車站
  effects:
    - set:
        path: characters.wakaharu.location
        value: home
    - add_flag: flags.player_protected_wakaharu

- id: stop_doctor
  at: "18:20"
  label: 阻止醫生前往舊車站
  effects:
    - set:
        path: characters.doctor.location
        value: clinic
    - add_flag: flags.player_stopped_doctor
```

Actions change State; they never directly select an ending or Variant.

## 8. Condition model

No `eval()` or arbitrary JavaScript is allowed.

Condition AST:

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

Supported operators:

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

Missing paths are explicit evaluation errors for `eq` / `neq`; `exists` and `not_exists` are the supported way to test path presence.

## 9. Variant resolution

An Event contains ordered Variants.

```yaml
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
    fallback: true
    effects: ...
```

Resolution:

```text
matching conditional variants
→ highest priority
→ if none match, explicit fallback
→ effects
→ delayed effects
→ history
```

Rules:

- Multiple matching conditional Variants may exist; highest priority wins.
- Two matching conditional Variants with the same priority are an ambiguity error.
- At most one Variant per Event may have `fallback: true`.
- A fallback Variant must not define `when`.
- Fallback is evaluated only after all conditional Variants fail.
- No match and no fallback is a definition/runtime error.

## 10. Effect model

Required operations:

### set

```yaml
- set:
    path: characters.wakaharu.status
    value: dead
```

### add_flag

```yaml
- add_flag: world.anomaly_1831_observed
```

Equivalent to setting the referenced path to `true`.

### emit_event

```yaml
- emit_event:
    event_id: evt_2114_reporter_missing
    at: "21:14"
```

Semantics:

```text
emit_event with `at`
→ enqueue named event at that absolute virtual time

emit_event without `at`
→ enqueue named event at current simulation time
```

An emitted event is resolved through the same Event Resolver as authored scheduled events.

## 11. Simulation Queue

There is one deterministic ordered queue for all executable simulation work.

Queue item kinds:

```text
scheduled-event
emitted-event
delayed-effect
```

On `createSimulation()`:

```text
load authored Event definitions
→ every Event with `at` becomes a scheduled-event queue item
```

Minimum queue fields:

```text
kind
executeAt
insertionOrder
eventId?
sourceEventId?
sourceVariantId?
delayedEffectId?
effects?
```

Ordering:

```text
earlier executeAt first
then lower insertionOrder first
```

This ordering applies across all queue item kinds.

## 12. Delayed effects

Delayed effects are first-class data.

For the binding acceptance scenario:

```yaml
delayed_effects:
  - id: reporter_missing_after_wakaharu_death
    delay_minutes: 163
    effects:
      - emit_event:
          event_id: evt_2114_reporter_missing
```

18:31 + 163 minutes = 21:14.

A delayed effect executes its own effects at `executeAt`; an `emit_event` without `at` therefore emits at 21:14 in this case.

## 13. Simulation clock

Use a virtual minute-of-day integer internally.

```text
18:20 = 1100
18:31 = 1111
21:14 = 1274
```

YAML remains `HH:mm`.

`runUntil(target)` processes queue items whose `executeAt <= target` and advances the virtual clock to the requested target after processing.

Calling `runUntil()` with a time earlier than the current virtual clock is an error.

## 14. Worldline History

History is append-only and records what actually happened.

```ts
interface WorldlineHistoryEntry {
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

```ts
interface StateChange {
  path: string;
  before: unknown;
  after: unknown;
}
```

History must be sufficient to explain why two worldlines differ.

## 15. Viewer projection

The simulator's complete history is not the same type as a Viewer row.

Use an explicit projection boundary:

```text
WorldlineHistoryEntry[]
        |
        +→ projectTimelineEntries()
        |
        +→ projectWorldlineEvents()
```

`projectWorldlineEvents()` yields at most one event-resolution row per Event occurrence and is the input to Worldline Diff.

This prevents the existing `Map<eventId, ...>` style diff from accidentally collapsing action/effect history while keeping the simulator log complete.

The existing authored Event Graph continues to visualize story definitions, not runtime history.

## 16. Simulator API

```ts
createSimulation(definition, initialState)

simulation.applyAction(action)
simulation.runUntil('18:31')
simulation.runUntil('23:59')

simulation.getState()
simulation.getHistory()
simulation.getPendingEvents()
```

One-shot helper:

```ts
simulate({
  definition,
  initialState,
  actions,
  until: '23:59',
})
```

`getState()` and `getHistory()` must return data that callers cannot mutate to change simulator internals.

## 17. Story data for v0.1

Required files:

```text
story/world/day_01_initial.yaml
story/actions/day_01_actions.yaml
story/events/day_01_1831.yaml
story/events/day_01_2114.yaml
```

The minimum scenario data is migrated to the structured AST in this spec.

Do not build a repository-wide migration framework.

## 18. 18:31 scenario definition

The 18:31 event must derive the four acceptance outcomes from State.

Conceptually:

```text
wakaharu at station + doctor at station
→ wakaharu_dies

wakaharu away + doctor at station
→ doctor_dies

wakaharu at station + doctor away
→ wakaharu_dies

wakaharu away + doctor away
→ no_death
```

`wakaharu_dies` schedules `reporter_missing_after_wakaharu_death`.

`doctor_dies` and `no_death` do not schedule it.

## 19. 21:14 scenario definition

`evt_2114_reporter_missing` is a normal Event definition.

When emitted at 21:14 it mutates:

```text
characters.reporter.status: alive → missing
```

and records an event-resolution History entry.

The event must not be globally pre-scheduled at simulator creation; it occurs only when emitted by the delayed causal chain.

## 20. Validation

Reject before simulation when detectable:

- duplicate Event IDs.
- duplicate Action IDs.
- duplicate Variant IDs within an Event.
- duplicate delayed-effect IDs within a Variant.
- invalid time format.
- unknown condition operators.
- unknown effect operations.
- invalid state paths for authored `set` / condition paths where validation can determine them from the initial state.
- more than one fallback Variant.
- fallback Variant with `when`.
- matching conditional Variants with duplicate priority.
- negative delayed-effect delay.
- emitted Event IDs that do not exist.
- authored scheduled event earlier than initial clock.

## 21. Error behavior

Errors are explicit and debuggable.

Examples:

```text
Unknown state path: characters.foo.location
Ambiguous variants in evt_1831_station at priority 100
Unknown emitted event: evt_missing
No matching variant for evt_1831_station
Cannot run simulation backwards: 21:14 -> 18:31
Processed event limit exceeded: 1000
```

## 22. Tests and TDD

Implementation uses RED → GREEN → REFACTOR.

Required unit coverage:

```text
Condition Evaluator
- eq / neq
- exists / not_exists
- all / any / not
- missing path error

Effect Executor
- set
- add_flag
- emit_event current-time scheduling
- emit_event absolute-time scheduling
- state-change recording

Event Resolver
- priority selection
- explicit fallback
- duplicate matching priority ambiguity
- no-match error

Simulation Queue
- time ordering
- same-time insertion ordering
- authored scheduled events
- delayed execution

Simulator
- cannot run backwards
- processed event safety limit
- deterministic repeat run
- immutable returned snapshots
```

Binding scenario tests:

```text
[]
→ 18:31 wakaharu_dies
→ 21:14 reporter_missing

[protect_wakaharu]
→ 18:31 doctor_dies
→ no 21:14 reporter_missing

[stop_doctor]
→ 18:31 wakaharu_dies
→ 21:14 reporter_missing

[protect_wakaharu, stop_doctor]
→ 18:31 no_death
→ no 21:14 reporter_missing
```

UI integration test:

```text
select action sets
→ simulate
→ Timeline renders generated event history
→ Diff renders changed/missing generated events
```

## 23. Performance / safety

v0.1 targets a tiny scenario.

Maximum processed queue items per `runUntil`/one-shot run: **1,000**.

Exceeding the limit is an explicit error to prevent malformed emit cycles from locking the browser.

## 24. Suggested project structure

```text
tools/event-graph-viewer/
└─ src/
   ├─ simulator/
   │  ├─ types.ts
   │  ├─ time.ts
   │  ├─ state.ts
   │  ├─ conditionEvaluator.ts
   │  ├─ eventQueue.ts
   │  ├─ effectExecutor.ts
   │  ├─ eventResolver.ts
   │  ├─ validation.ts
   │  ├─ simulator.ts
   │  └─ projection.ts
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

The engine may live in the Viewer package for v0.1, but UI imports the engine; the engine must never import React components.

## 25. Branch / integration constraint

Implementation must be based on the branch containing PR #1 Viewer code, not the old `main` snapshot.

The design-spec branch already has PR #1 head as its parent, so implementation may branch from `docs/worldline-simulator-v0.1-spec` after this spec is finalized.

## 26. Future extension points

Architecture should allow, but not implement yet:

```text
NPC Schedule
NPC Knowledge
Relationships
Trust
Inventory
Observation / player-known vs world-true state
Seeded RNG
Real-time synchronization
Offline simulation
Save / replay
Loop reset rules
Cross-loop memory
Invariant detection
```

A future split is expected:

```text
World Truth State != Player Knowledge State
```

## 27. Core design principles

1. Story data is the Source of Truth.
2. Simulation is deterministic before it becomes dynamic.
3. Player Actions change State; they do not directly select endings.
4. Events resolve from State conditions.
5. Delayed effects are first-class queue work.
6. All executable work shares deterministic queue ordering.
7. Worldline History is append-only and explainable.
8. Viewer projection is separate from simulator history.
9. Viewer visualizes results; it does not own game logic.
10. No arbitrary code execution from story YAML.
11. The smallest playable causal loop is more valuable than a broad incomplete simulator.

## 28. Completion definition

v0.1 is complete when this works end-to-end:

```text
Load deterministic initial State
→ Apply authored Player Actions
→ Advance virtual clock
→ Resolve 18:31 from State
→ Mutate State
→ Schedule delayed consequence when applicable
→ Execute delayed effect at 21:14
→ Resolve emitted 21:14 Event
→ Generate complete Worldline History
→ Project History for Viewer
→ Render Timeline
→ Compare two generated histories in Worldline Diff
```

The four binding acceptance scenarios must pass exactly as written in section 2.
