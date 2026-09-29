# M8 Story Integration and M9 Game Feel Player UI Design

> Gameplay authority: `docs/core-gameplay-spec-v0.1.md` is the canonical source of truth. This document defines the player-facing UI and presentation work that projects that model; it does not redefine World Time, Perception, Memory, or Investigation semantics.

## Goal

Build the player-facing UI from the latest Core Gameplay and Player UI direction, then carry the same surface through the complete story sequence from Loop 01 to Final. The result should feel like a place that continues to exist while the player looks, waits, captures, misses, and returns.

## Scope

### M8 — Story integration across loops

Use the current `PlayerApp` at `/player.html` as the canonical player entry point. Integrate the already-authored narrative documents into one continuous player runtime:

```text
Loop 01
→ Loop 02
→ Loop 03 / 04
→ Loop 05 / 06
→ Loop 07
→ Final
```

Every loop slice must verify:

- authored story causality remains author-side data;
- only actually perceived scenes can become player-facing records;
- a missed opportunity remains missed;
- player choices alter the next worldline or scene availability;
- `Memory Capture` is the only guaranteed persistent player record;
- normal NPC relationship state and ordinary prior-loop memory reset;
- authored `Memory Input` can affect a later narrative node without becoming automatic deduction.

The player surface may show a scene, peripheral cue, spatial text, document, memory, or waiting state. It must not show raw DAG edges, hidden conditions, invariant labels, author-only relationship variables, or automatic clue importance.

### M9 — Game-feel polish

After each semantic slice is green, add presentation on top of the existing projections:

- scene-first stage layout with location, time, and worldline context kept quiet;
- pixel-inspired environmental layers built from DOM/CSS and authored scene metadata;
- low-frequency ambient motion and parallax that never changes simulation state;
- fade and crossfade transitions for scene, attention, capture, and loop reset;
- directional sound affordances through optional authored cues and a user-controlled audio layer;
- ambient waiting states that communicate ongoing world activity without notification-feed UI;
- reduced-motion behavior that removes nonessential animation while preserving state and timing;
- keyboard, touch, and controller-friendly focus/hold/advance interactions.

Game Feel must never pause World Time, grant Perception, create Memory, rank clues, or reveal Author Truth. All visual/audio effects consume a player-safe projection and are disposable presentation state.

## Design principles

1. **Scene before chrome.** The stage, not a dashboard, is the primary surface.
2. **One main focus.** Hover/notice may redirect attention; Attend/Observation takes time; Capture occupies focus.
3. **Faded is still alive.** Background content may become quieter but continues to advance in the runtime.
4. **No answer-shaped UI.** The player sees what was perceived, not why it happened or how important it is.
5. **Tunable presentation.** Duration, easing, hit areas, blur, audio level, and parallax strength are implementation parameters.
6. **Accessible by default.** Every meaningful action has a semantic control and a reduced-motion path.

## Architecture

### Canonical runtime path

```text
Story manifest
→ Player-safe story bundle
→ current loop + worldline projection
→ Perception / Memory / Investigation state
→ PlayerPresentationModel
→ SceneStage + peripheral layers + controls
```

`PlayerPresentationModel` is a view model only. It may contain:

- current location and display time;
- current scene or ambient activity;
- player-visible text/visual/sound moments;
- attention phase and capture affordance;
- loop transition phase;
- reduced-motion and audio preferences.

It must not contain author-only causal edges or use them to make player decisions.

### File boundaries

- `src/player/PlayerApp.tsx`: canonical player orchestration and persistence calls.
- `src/player/ui/`: scene stage, HUD, ambient layers, transition and control primitives.
- `src/player/presentation/`: pure projection from runtime state to presentation-safe data.
- `src/playerNarrative/`: legacy narrative prototype; no new gameplay rules are added here. It remains only until the final route/test audit proves it is unused.
- `tests/player/` and `tests/integration/`: semantic and UI acceptance coverage.
- `story/narrative/**`: authored player-safe narrative and presentation metadata only.

### M8 loop contract

The integration must expose a deterministic contract for a loop boundary:

```ts
type LoopIntegrationResult = {
  nextLoopId: number | 'final';
  worldlineId: string;
  resetNpcState: true;
  retainedMemoryIds: string[];
  retainedWallState: true;
  pendingPlayerVisibleScenes: string[];
};
```

The contract is produced by runtime state and authored transitions, not by the UI. Final resolution is selected by the resulting worldline and relationship state, not by an answer button that directly chooses an ending.

### M9 presentation contract

Presentation components accept explicit, player-safe props and callbacks:

- `SceneStage`: current scene plus atmospheric layers;
- `WorldHud`: quiet location/time/worldline context;
- `AmbientLayer`: non-modal peripheral cues;
- `AttentionSurface`: active observation and return/capture affordances;
- `LoopTransition`: reset and re-entry treatment;
- `PresentationPreferences`: reduced-motion and audio settings.

Presentation callbacks may request `Attend`, `Redirect`, `Capture`, `Release`, or `Advance`. The runtime remains responsible for validating and committing those actions.

## Interaction and visual behavior

### Normal scene

The player sees a quiet environment with a restrained HUD. Ambient movement and sound are peripheral. The main action and current focus remain readable without turning the screen into a list of actions.

### Attention

Hover/Notice changes emphasis without changing World Time. Attend begins the authored shift/observation sequence. The target becomes visually primary; other content fades but remains present. Completing Observation writes Perception and returns attention elastically.

### Capture

Hold or use the semantic Capture control on an already perceived moment. The moment is pulled slightly forward with a short sensory transition. The world continues, and the saved Memory retains only the original perceived fidelity.

### Waiting

Waiting screens show the world’s current activity and a nearby opportunity without promising that the player can inspect everything later. Missed windows remain missed. Ambient text is spatial/peripheral, never a notification feed.

### Loop reset

The 00:00 lifecycle boundary gets a deliberate transition. It may fade, mute, and recompose the stage, but it does not retroactively reveal missed information or preserve NPC state that the core model resets.

## Accessibility and device input

- all actions expose buttons or labelled controls in addition to pointer gestures;
- Hold has a keyboard/controller equivalent and a forgiving duration threshold;
- focus order follows the current scene and active focus;
- `prefers-reduced-motion` disables parallax, grain motion, cursor blinking, and nonessential fades;
- audio is optional, muted by default when the browser preference requires it, and never required to understand a scene;
- touch targets meet the existing mobile layout constraints;
- screen-reader text describes the current perceived moment without exposing hidden author metadata.

## Testing strategy

### M8 semantic acceptance

- load all narrative documents and verify unique scene IDs;
- complete the Loop 01 baseline and verify its 18:31 perception/capture path;
- enter Loop 02 with a changed worldline and verify only its authored visible scenes appear;
- miss an opportunity in Loop 03/04 and verify no later UI or Memory Library entry invents it;
- carry a captured moment through Loop 05/06 while normal NPC relationship state resets;
- verify Loop 07 and Final Memory Input affects authored availability without auto-solving the player’s Investigation Wall;
- verify Author Workbench data is not present in player projections.

### M9 presentation acceptance

- stage renders scene, ambient, attention, capture, waiting, and reset states;
- reduced-motion mode removes nonessential animation but preserves state transitions;
- pointer, keyboard, touch-compatible click, and controller-key equivalents reach the same runtime callback;
- transition components do not mutate runtime time or knowledge;
- presentation remains readable at the existing mobile breakpoint;
- browser verification covers `/player.html` at entry, active scene, waiting, attention, capture, and reset states.

## Non-goals

- no Three.js dependency or 3D world rewrite;
- no automatic clue ranking, contradiction detection, causal inference, or truth cards;
- no generic NPC cross-loop memory residue;
- no return to Dialogue Box / Action List / notification-feed UI;
- no production audio asset pipeline before the semantic and interaction layer is verified;
- no deletion of legacy prototype code until route and test usage is proven absent.

## Completion gate

The work is ready for integration only when:

- M8 Loop 01 → Final acceptance tests pass;
- M9 Player UI tests and production build pass;
- `docs/core-gameplay-spec-v0.1.md` remains unchanged in gameplay meaning;
- browser verification shows the latest Player UI at `/player.html`;
- reduced-motion and missed-opportunity checks pass;
- `git diff --check` passes;
- no Player bundle exposes Author-only causal truth.
