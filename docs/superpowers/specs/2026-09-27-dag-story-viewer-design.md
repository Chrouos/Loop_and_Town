# DAG Story Viewer + Causal Narrative Design v0.2

## Status

Author / debug design for managing story causality.

This document is aligned with the current Core Gameplay v0.1.

Important boundary:

> **Author causal truth is not the same thing as Player knowledge.**

The Viewer may know every cause, hidden state and downstream effect. The Player-facing game must still obey Attention, Perception Boundary, Memory Capture and No Auto Deduction.

---

# 1. Core model

```text
Story = Event Graph
Worldline = one realized path through the graph
Novel Scene = narrative presentation attached to nodes / transitions
Player Knowledge = only what the protagonist actually perceived
Captured Memory = player-selected persistent record of perceived moments
```

The Event Graph is primarily an **authoring model**.

It must not automatically become the player's Investigation Wall.

---

# 2. Author Viewer vs Player tools

## Author Viewer

May show:

- all Nodes
- all Edges
- hidden conditions
- relationship values
- schedule changes
- route changes
- future Nodes
- convergence conditions
- downstream causal chain
- Worldline comparison

## Player Worldline History

May show realized history only according to the product's player-facing rules.

It must not expose hidden author causality simply because the Viewer knows it.

## Investigation Wall

Completely different purpose:

```text
Author Viewer       = what the story engine knows is causally true
Investigation Wall  = what the player thinks may be related
```

Investigation Wall connections have no required causal semantics and are player-authored.

---

# 3. DAG reading form

Main Author view should prioritize understandable causal chains rather than a dense card wall.

```text
[N01 與若晴聊攝影]
        │
        │ relationship / context change
        ▼
[N02 若晴放下戒心]
        │
        │ reveal route information
        ▼
[N03 若晴提到車站計畫]
        │
        ├── player later tells reporter ──────┐
        │                                     ▼
        │                            [N06 庭安改變行程]
        │                                     │
        │                                     ▼
        │                            [N07 庭安遇見柏勳]
        │                                     │
        │                                     ▼
        │                            [N08 交付被延後]
        │
        └── player later changes 若晴 route ──┐
                                              ▼
                                     [N04 若晴沒有去車站]
                                              │
                                              ▼
                                     [N05 柏勳改變路線]
```

Viewer default label:

- Node ID
- human-readable title
- time
- character / location
- edge effect
- Worldline path state

Do not render entire Before / After / hidden state directly on the graph.

---

# 4. Node Detail

Node Inspector can contain:

```text
N06｜庭安改變行程
時間：17:42
角色：葉庭安
地點：咖啡店 → 舊車站

Trigger
- previous world state
- player action that really occurred

Before
- original schedule

After
- changed schedule

Immediate effects
- route
- local state

Delayed effects
- downstream schedule / opportunity changes

Narrative scene
- authored scene content
```

The Inspector is for authors. It may state exact causality unavailable to the player.

---

# 5. Edge types

Recommended author-facing Edge types:

```text
relationship
knowledge
route
schedule
state
delay
choice
observation
memory_input
convergence
```

Examples:

```text
trust +1
pressure +1
route → old_station
delay +7m
player tells reporter
Memory Input: station_silhouette
```

Do **not** use normal NPC cross-loop memory labels such as:

```text
memory_residue +1
yuan remembers previous loop
```

Normal NPCs do not retain previous Loop memory.

If story canon contains a special memory-holder mechanism such as Zhixia, represent it as a story-specific exceptional event/state, not a generic relationship metric.

---

# 6. Information nodes must respect Perception Boundary

The Event Graph can contain a World Event before the player perceives it.

Example:

```text
[World Event] 門後有人經過
```

This does **not** mean the player knows it.

Player knowledge path should be modeled separately:

```text
World Event
    ↓
Peripheral Cue available
    ↓
Player Attention reaches source
    ↓
Perceived Moment
    ↓
optional Memory Capture
```

Therefore avoid a single generic edge like:

```text
Event happened → player knows fact
```

unless perception is guaranteed by the scene.

---

# 7. Memory nodes

There are three different concepts and they must not be collapsed:

```text
World Event
Perceived Moment
Captured Memory
```

A `Captured Memory` node / state exists only when the player actively captured a perceived moment.

Example:

```text
[N201 門口人影事件]
        ↓ cue available
[N202 玩家 Attend 門口]
        ↓ perception
[N203 看見模糊手臂]
        ↓ optional capture
[M204 Captured Memory: 模糊手臂]
```

If the player never looked:

```text
N201 happened
M204 does not exist
```

---

# 8. Day 01 causal structure

The first day should contain many small causal chains, not one giant binary branch.

Example structure:

```text
回鄉
  ↓
知夏房間
  ↓
若晴 / 予安 / 庭安 / 柏勳多條人物線
  ↓
route / information / relationship changes
  ↓
18:31 Convergence
  ↓
aftermath
  ↓
23:59
  ↓
00:00 Reset
```

Small choices should usually change information or relationship first; only meaningful downstream accumulation should alter large worldline outcomes.

---

# 9. 若晴 chain example

```text
[N020 16:10 遇見若晴]
       │
       ├── ordinary conversation
       │       ↓
       │   [N021 若晴談攝影]
       │       ↓
       │   [N022 relationship state changes]
       │       ↓
       │   [N023 車站計畫在談話中被說出]
       │
       └── player pressure route
               ↓
           [N024 若晴提高防備]
               ↓
           information / schedule variant
```

Important gameplay alignment:

`N023` occurring in dialogue does not automatically produce a persistent card.

The player may:

- hear it fully
- miss part of it because Attention moved
- Capture it
- remember it only narratively
- use a Captured Memory later if the node accepts it

---

# 10. 予安 chain — no NPC memory residue

Old design used:

```text
bring yuan to station
→ memory_residue +1
→ next loop déjà vu
```

This is superseded.

Current design:

```text
[N033 玩家請予安協助]
        │
        ├── [N050 郵局調查]
        │        ↓
        │   current-loop information
        │
        └── [N051 予安前往車站]
                 │
                 ├── current-loop danger / pressure
                 ├── current-loop schedule change
                 └── [N054 20:00 錯過房仲]
```

At Reset:

```text
予安 memory → reset
予安 relationship state → reset
主角 Captured Memory of what happened → persists
```

The emotional point is that the protagonist remembers what happened with him while he does not.

---

# 11. 18:31 Convergence

Convergence is resolved from accumulated world state, not directly selected by the player.

```text
route states
+ schedule states
+ character decisions
+ current-loop relationship conditions
+ information distribution
        ↓
[N100 18:31 Convergence]
        ↓
possible variants
```

Possible variants may include:

```text
若晴死亡
柏勳死亡
無人死亡
予安受傷
庭安失蹤
設備異常
```

But no variant should award cross-loop NPC memory as a generic reward / consequence.

---

# 12. Worldline paths

Worldline View highlights the actual path through the same Graph.

Do not duplicate one entire Graph per Loop.

Example:

```text
Loop 01 path
→ baseline interactions
→ route set A
→ 18:31 variant A

Loop 02 path
→ different information / relationship path
→ route set B
→ 18:31 variant B
```

Comparison should answer author questions such as:

- what changed first?
- which character decision moved next?
- which delayed effect reached 18:31?

---

# 13. Player-facing Worldline History boundary

Player-facing history must never be treated as omniscient author truth.

For each event, distinguish:

```text
happened in world
perceived by protagonist
captured as Memory
visible in player history
```

The exact policy for player Worldline History can be tuned, but hidden unperceived details must not leak through Author Viewer data.

---

# 14. No automatic Invariant / Truth Card

The engine / Author Viewer may know:

```text
18:31 is invariant across two realized loops
```

But Player UI must not automatically generate:

```text
[Invariant Card]
18:31 is the key
```

Instead the player can Capture observations across loops and arrange them on Investigation Wall:

```text
[Loop 01 · 18:31 event]
          │
          │ player line
          ▼
[Loop 02 · 18:31 event]

Note: 「又是 18:31？」
```

The hypothesis belongs to the player.

---

# 15. Layout principles

Author reading mode should keep a stable time direction.

Suggested:

```text
Top → Bottom = time
Left ↔ Right = simultaneous character lanes / alternatives
```

Example:

```text
                    17:50

 若晴 lane      庭安 lane      柏勳 lane      予安 lane
    │               │              │              │
    ▼               ▼              ▼              ▼
   回家            去車站          去車站          郵局
    │               │              │              │
    └───────────────┴───────┬──────┘              │
                            ▼                     │
                      18:31 Convergence ◄─────────┘
```

---

# 16. Viewer interaction

Author tool features:

1. Pan / Zoom
2. Node Inspector
3. Worldline selector
4. Highlight realized path
5. Compare worldlines
6. Search character / time / location
7. Focus one character influence chain
8. Show downstream effects
9. Toggle hidden author state

`Show downstream effects` is an **author function**.

Do not copy it into Player Investigation Wall as an automatic causal highlighter.

---

# 17. Canon authoring order

New story content should follow:

```text
Canon Truth
↓
World Event Node
↓
Edge / Condition
↓
Character decision / state change
↓
Downstream effect
↓
Worldline Path
↓
Perception opportunities
↓
Novel / gameplay scene
```

This extends the old Graph-first rule with one required gameplay layer:

> A World Event is not automatically Player Knowledge.

---

# 18. Story exception: Zhixia

If Zhixia is canonically established as a previous special memory holder, this can appear in Author Graph as a dedicated story mechanism.

Example:

```text
Zhixia special worldline-memory mechanism
→ records / carriers / seventh-letter handoff
→ protagonist becomes current memory holder
```

Do not generalize this into:

```text
NPC exposure to 18:31
→ residue points
→ eventually remembers prior loops
```

---

# 19. Success criteria

The Author Viewer should answer:

1. why did a character choose this route?
2. what earlier information / relationship change caused it?
3. which delayed effects reached a later event?
4. how do two Worldlines differ?
5. what did the world actually do?
6. separately, what did the protagonist have an opportunity to perceive?
7. which perceived moments were actually Captured?

The Player tools should **not** automatically answer:

- which clue matters most
- who is lying
- which two memories contradict
- what caused an event
- which path is correct

---

# 20. Summary

```text
AUTHOR SIDE
World truth
→ Event Graph
→ causal edges
→ Worldline path

PLAYER SIDE
World event
→ Attention
→ Perception
→ optional Memory Capture
→ Investigation Wall
→ player hypothesis
```

The same story data can support both surfaces, but their knowledge boundaries must remain different.
