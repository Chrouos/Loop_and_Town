# Causal Timeline Workbench Design

## Status

Design approved for the next Event Graph Viewer iteration.

This document is a **design spec only**. It does not claim runtime or UI implementation is complete.

---

# Goal

把目前的 Event Graph Viewer 從「完整 DAG 的資料結構視覺化」改成「作者可以快速理解世界線因果的工作台」。

核心問題不是 Graph 不夠完整，而是 Graph 已經完整到難以閱讀。

Viewer 預設必須讓作者先回答：

```text
What happened
+
When
+
To whom
+
Why
+
What changed
```

而不是先理解：

```text
node id
edge id
flags
route field
runtime state key
```

---

# Design Principles

## 1. Story first, debug second

主畫面使用自然語言敘事。

例如：

```text
若晴沒有去車站
  ↓ 沒有人收資料
柏勳自行帶回資料
  ↓ 改變返程
柏勳進入維修通道
  ↓ 18:31 仍在異常區
柏勳死亡
```

不要在主畫面直接顯示：

```text
characters.doctor.route
flags.reporter_confronted
N05_doctor_enters_maintenance
E18_documents_to_convergence
```

技術欄位放到 Node Inspector 的 Debug Data 區域。

---

## 2. Time is a first-class axis

目前 DAG depth 不等於故事時間。

Viewer v2 的閱讀座標應優先反映 Simulation Time。

```text
14:20 → 15:00 → 16:10 → 17:20 → 18:31 → 20:00 → 23:59 → 00:00
```

因果線可以跨時間，但不能讓 layout 看起來像時間順序被打亂。

---

## 3. Worldline is a Trace, not another Graph

Canonical model：

```text
Causal Graph
    +
Current State
    +
Player Action
    +
NPC Schedule
    ↓
Simulation Result
    ↓
Worldline Trace
```

Story DAG 表示「所有可能因果」。

Worldline Trace 表示「某一輪實際發生的事件」。

不要為每條世界線複製一份 Graph。

---

# Main UI

主畫面只保留四種控制：

```text
Loop / Worldline
Character Filter
Search
Compare
```

其餘空間全部給 Causal Timeline。

```text
┌─────────────────────────────────────────────────────────────┐
│ Loop 02 ▼   14:00 ─────────────── 18:31      Search       │
│            [全部] [若晴] [柏勳] [庭安] [予安]              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 若晴 ──[聊攝影]──[透露車站]──[留在咖啡店]──────────────── │
│          │             │               │                    │
│          │ trust +1    │               │ no recipient       │
│          ▼             │               ▼                    │
│ 玩家 ──────────────[阻止若晴]      [柏勳沒有遇到若晴]       │
│                                         │                   │
│                                         ▼                   │
│ 柏勳 ───────────────────────────[自行帶資料]─[維修通道]──── │
│                                                    │        │
│                                                    ▼        │
│                                             [18:31 收束]     │
│                                                    │        │
│                                                    ▼        │
│                                               柏勳死亡       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Graph 本身就是故事閱讀介面。

---

# Information Hierarchy

Viewer 只保留三層資訊。

```text
Level 1
Causal Timeline
→ 一眼看這一輪發生什麼

Level 2
Node Inspector
→ 點事件才看 Why / Effect

Level 3
Debug Data
→ 作者需要查 runtime state 時才展開
```

預設：

```text
簡單
  ↓
點 Node 再解釋
  ↓
真的 Debug 才看技術欄位
```

禁止：

```text
Graph + State + Character + Edge + Debug + Diff + Metadata
全部同時出現在主畫面
```

---

# Causal Focus Mode

預設不要一次顯示完整 Story DAG。

點任一 Node 後，以它為中心顯示局部因果：

```text
upstream 2 hops
      ↓
A → B → [CURRENT] → D → E
                    ↑
             downstream 2 hops
```

操作：

```text
← Why did this happen
→ What does this affect
◎ Show full chain to 18:31
◉ Show this character only
```

例如選擇：

```text
柏勳進入維修通道
```

應直接得到：

```text
WHY
若晴沒到車站
→ 沒有人收資料
→ 柏勳自行帶走資料
→ 改走維修通道

THEN
→ 18:31 仍在異常區
→ 柏勳死亡
→ 庭安取消研究所行程
→ 志遠重新調查五年前事故
```

---

# Node Inspector

Inspector 預設不存在。

點 Node 才從右側展開。

```text
┌──────────────────────────┐
│ 柏勳進入維修通道          │
│ 18:24                    │
│                          │
│ 為什麼發生？              │
│ 若晴沒到車站              │
│ → 沒有人收資料            │
│ → 柏勳自己帶走            │
│                          │
│ 接下來影響                │
│ → 18:31 仍在異常區        │
│ → 柏勳死亡                │
│                          │
│ [看完整因果鏈]            │
│                          │
│ ▸ Debug Data             │
└──────────────────────────┘
```

Inspector 預設只顯示 Narrative Meaning。

Debug Data 展開後才可看到：

```text
node.id
edge.type
state mutations
flags
route
schedule key
condition expression
raw YAML refs
```

---

# Timeline Lanes

角色不需要再有一塊獨立資訊牆。

角色本身就是 Timeline Lane。

```text
       16:10      17:20      18:05       18:31

若晴 ──●──────────●──────────●───────────●
        攝影        行程        車站          結果

柏勳 ──────────────●──────────●───────────●
                    離院        交付          結果

庭安 ──●──────────────────────●───────────●
        咖啡店                  車站
```

這樣 Graph 可以同時回答：

- 誰
- 什麼時間
- 在哪裡
- 做了什麼
- 被誰影響

---

# Convergence

18:31 不是普通 Event，而是多條因果鏈的 Convergence。

視覺上必須是明確的收束點。

```text
若晴 route ──────────┐
柏勳 route ──────────┤
庭安 schedule ───────┤
予安 exposure ───────┤
player knowledge ────┤
                     ▼
              [18:31 Convergence]
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
       若晴死       柏勳死       無人死
```

Outcome 不是玩家直接選擇，而是前面 State 的 resolve 結果。

---

# Worldline Compare

Worldline Diff 不應常駐在主畫面。

只有按 `Compare` 才打開比較模式。

支援 Worldline Set，而不是固定 A / B：

```text
Worldlines
☑ Loop 01
☑ Loop 02
☑ Loop 03
□ Loop 04
```

Timeline 可以疊加：

```text
                  17:20        18:05        18:31

Loop 01 若晴 ───── station ───── handoff ───── DEAD
Loop 02 若晴 ───── cafe ────────────────────── ALIVE
Loop 03 若晴 ───── home ────────────────────── ALIVE

Loop 01 柏勳 ─────────────── leave ─────────── ALIVE
Loop 02 柏勳 ─────────────── maintenance ───── DEAD
Loop 03 柏勳 ─────────────── hospital ───────── ALIVE
```

Diff summary：

```text
                 Loop 01        Loop 02

若晴 17:35       去車站    →    留咖啡店
柏勳 18:12       已離開    →    帶資料返回
柏勳 18:24       —         →    維修通道
18:31 victim     若晴      →    柏勳
```

同時分離：

```text
Variable
├─ character
├─ route
├─ knowledge
├─ relationship
└─ schedule

Invariant
├─ 18:31
├─ blackout
├─ bell
└─ reset
```

---

# Author-facing Vocabulary

資料層可以保留目前 Story DAG schema，但 UI 不應把所有資料都叫 generic Node / Edge。

作者視角可以使用：

```text
Node
├─ Scene
├─ Decision
├─ State Change
├─ Convergence
└─ Outcome

Relation
├─ Causes
├─ Enables
├─ Prevents
├─ Delays
├─ Reveals
└─ Routes
```

例如 UI 顯示：

```text
柏勳自行帶資料
   ↓ 改變返程
進入維修通道
```

Debug 才顯示：

```text
edge.type = route
characters.doctor.route = maintenance_corridor
```

---

# Existing Design to Keep

保留 PR #16 已建立的核心方向：

```text
Story = DAG
Worldline = Graph 上的一次實際 Path / Trace
branch + reconvergence
Node Inspector
Author / Player visibility
Worldline selector
18:31 Convergence
```

Viewer v2 不是推翻 Story DAG。

它只是把閱讀方式從：

```text
Full DAG
→ 作者自己理解
```

改成：

```text
Causal Timeline
+ Focus Graph
+ Timeline Lane
+ Worldline Trace
+ State Diff
→ Viewer 幫作者理解
```

---

# Main Screen Scope

主畫面只允許：

```text
Top Bar
├─ Loop / Worldline
├─ Character Filter
├─ Search
└─ Compare

Main Canvas
└─ Causal Timeline Graph

Optional Right Drawer
└─ Node Inspector

Optional Compare Drawer / Mode
└─ Worldline Diff
```

不要再讓固定 Sidebar 佔據主要閱讀空間。

---

# Success Criteria

完成後作者應能在約 10 秒內回答：

1. 柏勳為什麼這一輪死了？
2. 17:20 的某個選擇影響哪些後續事件？
3. 18:31 前每個角色在哪裡？
4. Loop 01 / 02 / 03 哪些狀態改變？
5. 哪些 Invariant 不管怎麼改都沒變？
6. 畫面上的內容是劇情、角色狀態，還是 runtime debug field？

如果仍需要拖著完整 DAG 找線，代表 Viewer 沒有達成這份設計的目的。

---

# Non-goals

這次設計不要求：

- 改寫 Story DAG Canon
- 把世界線重新簡化成二元分支
- 在主畫面顯示所有 raw state
- 一次呈現所有角色、所有 Node、所有 Edge
- 取代 Simulator
- 讓 Graph layout 寫回 Story YAML

---

# Concept Summary

```text
Story DAG
   ↓
Causal Timeline
   ↓
Focus on one event
   ↓
Why / What next
   ↓
Timeline lanes
   ↓
18:31 Convergence
   ↓
Worldline Trace
   ↓
Compare Variables / Invariants
```

Product name for this iteration：

**Causal Timeline Workbench**
