# Event Graph 管理規格

> Event Graph 是 **Author / Simulation Truth**。
>
> Player Gameplay 的知識邊界以 `docs/core-gameplay-spec-v0.1.md` 為準。
> Author Graph 可以知道真正因果，但 Player 不會因此自動知道答案。

## 目的

Event Graph 管理：

- Canon event
- Event Variant
- 前置條件
- NPC / World State
- Immediate / Delayed Effect
- Schedule change
- Convergence input
- Worldline causal history

推薦流程：

```text
Story YAML
→ Schema Validation
→ Event Graph / Simulator
→ Author Timeline / Causal Workbench
→ Player-safe projection
```

最後一步不能省略。

```text
Author Truth ≠ Player Knowledge
```

## Source of Truth

```text
劇情因果       → story YAML
資料結構       → JSON Schema
Author layout  → layout data
實際世界歷史   → runtime Worldline History
玩家感知       → Perception state
玩家持久記憶   → Captured Memory
玩家推理       → Investigation Wall
```

Event Graph Viewer / Causal Timeline Workbench 是 Author / Debug 工具，不是 Player Investigation Wall。

## Event 基本模型

一個 Event 可以包含：

```text
id
simulation time / trigger
location
preconditions
participants
variants
immediate effects
delayed effects
schedule changes
causal links
perception opportunities
```

不再把 `card mutation` 當成 Player-facing 核心資料模型。

核心是：

```text
World State
+
Conditions
+
Character decisions
        ↓
Event Variant
        ↓
Effects / delayed effects
        ↓
New World State
```

不是：

```text
玩家按 A
→ 系統直接切到 A 結局
```

## Event 與 Variant

同一事件可以因世界狀態不同得到不同結果。

例如 `18:31`：

```text
Worldline A
→ 若晴在現場
→ Variant A

Worldline B
→ 若晴行程已改變
→ 柏勳走到另一條路徑
→ Variant B
```

Author Graph 可以保存完整條件與真實結果。

Player 只能知道自己實際 Perceive / Capture 到的部分。

## Delayed Effect

延遲影響是一級資料。

```yaml
triggered_by: event_x
execute_at: "21:14"
effects:
  - set: characters.reporter.status
    value: missing
```

Author tooling 可以回答：

```text
16:40 的事件
為什麼在 21:14 才造成後果？
```

Player UI 不應因此自動顯示這條 causal edge。

玩家需要從自己的 Memory 與 Investigation Wall 建立 hypothesis。

## Worldline History

Worldline History 記錄某輪實際發生的 Author Truth。

至少可追蹤：

```text
loop_id
simulation time
resolved event / variant
world state before / after
character decision
player action
scheduled delayed effects
causal source
player_present / perception opportunity
```

例如：

```text
Loop 07
17:30 player action
18:31 evt_1831_station → variant_b
21:14 delayed effect
```

完整 History 可用於：

- Author Timeline
- Causal Timeline Workbench
- Simulator replay
- deterministic tests
- Worldline comparison

但不能直接 dump 給 Player。

## Perception Projection

Event 發生不代表 Player 知道。

Canonical chain：

```text
World Event
    ↓
Opportunity / Peripheral Cue
    ↓
Player Attention
    ↓
Perception
    ↓
optional Memory Capture
```

Event Graph 可以描述「可被感知的機會」，但是否真的成為 Player Knowledge 由 runtime Attention / Perception 決定。

例如：

```text
18:31 門後有人離開
```

Author Graph：知道人物、原因、下一站。

Player 若只看到一隻手：

```text
Perception = 一隻手離開門框
```

系統不能把 Author node title、角色 ID 或 downstream effect 補給玩家。

## Invariant

Author tooling 可以從多輪 Worldline History 計算 invariant candidate，例如：

```text
每輪都出現的時間
固定先於某事件的節點
不受某組變數影響的 state
```

這些功能用於：

- Story design
- Debug
- Canon consistency
- Causal Workbench

**不能作為 Player 自動提示。**

Player 若要認為 `18:31` 是 invariant，必須來自自己跨 Loop 的 Perceived / Captured Moments 與 hypothesis。

## Author Views

### Event Graph

顯示：

- conditions
- effects
- delayed effects
- participants
- schedule changes
- causal edges

### Causal Timeline

顯示某 Worldline 的 chronological Author Truth。

### Worldline Diff

完整 Diff 是 Author / Debug 功能。

```text
Loop A                    Loop B
17:40 state A             17:40 state B
18:31 variant A       →   18:31 variant B
21:14 consequence A       consequence B
```

Player 端不能直接使用這個完整 Diff。

Player Investigation 只能比較玩家自己保存的 Memory：

```text
Captured Memory A
        ↕
Captured Memory B
        ↓
player-authored note / link / hypothesis
```

## Investigation Wall boundary

```text
Causal Timeline Workbench
= 作者知道實際因果

Investigation Wall
= 玩家認為事情可能如何相關
```

禁止直接把以下 Author 資訊投影成 Player 提示：

- `why`
- downstream effects
- hidden condition
- exact causal edge
- invariant flag
- correct contradiction
- correct suspect

## Relationship / NPC state

Event Graph 可以使用 loop-local Relationship State 作為條件，例如：

```text
trust
closeness
respect
pressure
availability
```

一般 NPC 不使用 generic cross-loop `memory_residue`。

Reset 後 NPC Relationship / prior-loop memory 依 Story Canon 重置。

## Time contract

Event Graph authoring 使用 Simulation Time，不直接存 real wall-clock timestamp。

```text
Story Event
→ Simulation Time

Runtime Clock
→ Real Time ↔ Simulation Time mapping
```

World Time 不因閱讀、對話、Attention 或玩家離線而等待。

Event Graph 不應設計成「等玩家打開畫面才觸發重要事件」。

## Validator / CI

至少檢查：

- duplicate Event ID
- unresolved Character / Location / Event refs
- invalid time format
- unreachable event / variant
- impossible or overlapping conditions
- invalid delayed-effect source
- same character scheduled at incompatible locations
- causal graph invalid cycles where prohibited
- Player projection accidentally exposing author-only fields

## Canonical boundary summary

```text
Author YAML / Event Graph
        ↓
World Simulation
        ↓
Worldline History
        ↓
Opportunity
        ↓
Attention
        ↓
Perception
        ↓
Memory Capture
        ↓
Player Investigation
```

核心原則：

> Event Graph 可以知道真相；玩家必須自己經歷並推理出來。
