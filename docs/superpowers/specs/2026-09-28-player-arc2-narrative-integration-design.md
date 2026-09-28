# Player Arc 2 Narrative Integration Design

Date: 2026-09-28
Status: Design approved in conversation; awaiting written-spec review

## 1. Intent and success criteria

The author viewer can already load the complete Loop 01–07 / Final story bundle, but the player surface still uses a Loop 1-only hard-coded `STORY_RECORDS` list. This slice connects the existing player runtime to the declarative story manifest without replacing the anchored clock, scheduler, or save model.

The first playable target is Loop 2: the protagonist remembers Loop 1, Wakaharu survives, and Doctor Chen becomes the 18:31 victim. The player should see authored Loop 2 scenes and evidence through the existing case-reading interaction, while hidden author truth and numeric relationship state remain inaccessible.

Success means:

1. The player loads Loop 2 narrative data through the manifest and does not require per-loop hard-coded appends.
2. Loop 1 onboarding and current anchored-timeline behavior remain unchanged.
3. Creating Loop 2 preserves protagonist memory, Character Insight, and canon-approved discovered evidence while clearing loop-local actions, temporary state, and relationship values.
4. Loop 2 scenes are filtered by player visibility, scene timing, acquisition rules, and per-loop read state.
5. Player tests prove the survivor narrative and the absence of NPC cross-loop memory or raw relationship numbers.

## 2. Scope and non-goals

### In scope

- A player-facing story bundle loader built on the existing `story/manifests/loop_01.yaml` references.
- A normalized player narrative scene projection for Loop 2.
- Save-schema support for persistent Character Insight and discovered evidence.
- Loop reset boundaries that preserve meta knowledge but create fresh loop-local state.
- Player UI integration in the existing case/reading surface.
- Loop 2 acceptance tests and regression coverage for Loop 1.

### Out of scope

- Replacing the author viewer or its `AuthorStoryBundle` contract.
- Exposing the full DAG, worldline selector, relationship dimensions, or final-decision conditions to players.
- Implementing every Loop 3–7 and Final player surface in this slice.
- Changing the anchored real-time clock, entry windows, scheduler ordering, or action-duration semantics.
- Adding a second wall-clock or narrative progression engine.

## 3. Architecture

The player will consume one typed story boundary, with author-only documents kept outside the player projection:

```text
story/manifests/loop_01.yaml
        ↓
loadPlayerStoryBundle
        ↓
simulation + player narrative scenes + artifacts
        ↓
loop-scoped narrative projection
        ↓
PlayerApp / case reader
```

The loader may reuse the existing YAML and manifest primitives, but its return type must contain only data the player runtime needs. DAG nodes, worldline paths, raw relationship state, final-decision thresholds, and author visibility metadata must not be passed into player components.

The player projection uses the current simulation minute and reconciled loop history. A scene is eligible only when:

- it belongs to the active loop document;
- its visibility is player-allowed;
- its required facts/location/activity conditions are satisfied;
- its authored time has been reached;
- it has not already been consumed in the active loop unless its acquisition is persistent/meta;
- its source event or variant, when present, matches the replayed simulation history.

Loop 1 keeps the current opening flow and evidence-board behavior. Loop 2 adds scene-driven records and choices through the same `PlayerApp` case reader rather than a parallel screen.

## 4. Save and reset model

Extend `KnowledgeSave` with bounded, player-safe collections:

```ts
type CharacterInsight = {
  id: string;
  characterId: string;
  sourceLoop: number;
  text: string;
};

type KnowledgeSave = {
  // existing fields
  characterInsights: CharacterInsight[];
  discoveredEvidence: string[];
};
```

The normalizer must cap collection sizes, reject malformed entries, and preserve v1/v2 migration behavior. It must never import hidden relationship dimensions or NPC outcome IDs into player knowledge.

`createNextLoop` performs the boundary transaction:

```text
preserve: protagonist memory, Character Insight, allowed evidence, history summaries
reset: actionIds, revealedIds, pending/sealed flags, loop clock, relationship state, local scene consumption
```

The first slice can represent relationship reset as a loop-local runtime boundary without rendering relationship numbers. If the existing simulator has no relationship state in its player save, the implementation must keep the boundary explicit in types/helpers so later relationship effects have one insertion point.

## 5. Player UI behavior

- Loop 1 opens with the existing envelope onboarding.
- After a reset, Loop 2 opens with `loop02_1420_reset_awareness` as a readable scene at the canonical `06:12` entry.
- The case drawer lists eligible Loop 2 narrative records with the same read/unread and per-loop keying semantics as existing records.
- The Loop 2 scene sequence exposes Wakaharu's independent life and the Doctor's changed route; it must not say that Wakaharu remembers Loop 1.
- Relationship effects may alter authored choices or future eligibility, but raw Trust / Closeness / Respect / Pressure values are never rendered.
- Author-only scene, DAG, path, and final-decision metadata remain unavailable in player mode.

## 6. Error handling and compatibility

- Missing manifest narrative files fail through the existing player load error surface with the source path.
- Duplicate scene IDs and unresolved player narrative references fail before rendering a partial player bundle.
- Legacy saves without the new fields normalize to empty arrays.
- Existing imported legacy notes remain notes and are not promoted to canonical evidence or Character Insight.
- If a Loop 2 scene cannot be projected, the player keeps the current safe case view and reports a readable error rather than exposing raw YAML.

## 7. Testing strategy

Write tests first for:

1. Player loader returns Loop 1 + Loop 2 narrative scenes from the manifest and rejects duplicate IDs.
2. Loop 2 projection selects the reset-awareness, Wakaharu, Doctor, 18:31, bell, and reset scenes in authored order.
3. Loop 2 replay exposes Doctor death while keeping Wakaharu alive and does not grant NPC cross-loop memory.
4. `createNextLoop` preserves Character Insight/evidence and clears loop-local data.
5. Player UI renders Loop 2 text and choices without raw relationship values or author labels.
6. Existing Loop 1 player acceptance, anchored timeline, storage, and visibility tests remain green.

Verification gates:

- focused red-green tests for loader, projection, save boundary, and PlayerApp;
- full `npm test` from `tools/event-graph-viewer`;
- `npm run build`;
- `git diff --check`;
- a production-source scan confirming story YAML contains no wall-clock API usage.

## 8. Delivery slices

The implementation plan should deliver in this order:

1. Typed player bundle and narrative projection boundary.
2. Save normalization and loop reset metadata boundary.
3. Loop 2 player scene/evidence integration.
4. Player UI acceptance and full compatibility verification.

Loop 3–7 and Final player content can then be added as content slices against the same boundary, without changing the clock or save architecture.
