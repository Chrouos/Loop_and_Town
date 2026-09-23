# Event Graph 管理規格

## 目的

Event Graph 是劇情與世界線模擬的 Source of Truth。
視覺化工具只是編輯、檢查與模擬介面，不應把畫布本身當成唯一資料來源。

推薦流程：

```text
YAML 劇情檔
→ Schema Validation
→ Event Graph Engine
→ Graph View / Timeline View / Worldline Diff / Simulator
```

## 專案結構

```text
story/
├─ characters/
├─ events/
│  ├─ day_01.yaml
│  └─ day_01_1831.yaml
├─ cards/
├─ world/
│  ├─ locations.yaml
│  └─ invariants.yaml
├─ schemas/
│  └─ event-graph.schema.json
└─ layouts/
   └─ day_01.layout.json

tools/
└─ event-graph-viewer/
```

`layouts/` 與劇情資料分開。
視覺化工具拖曳節點時，只改 layout，不要讓劇情 YAML 出現大量無意義 Git diff。

## Event Graph 基本模型

一個 Event 建議包含：

```text
id
時間 / 觸發時機
地點
前置條件
variants
即時 effects
延遲 delayed_effects
卡片變化
下一事件 / schedule 變化
```

核心不是「玩家選 A → 劇情 A」，而是：

```text
World State
+
Conditions
↓
Event Variant
↓
Effects
↓
New World State
```

## Event 與 Variant

同一事件可以因世界狀態不同得到不同結果。

例如 `18:31 車站事件`：

```text
若晴在車站 + 醫生未介入
→ 若晴死亡

若晴受到保護 + 醫生在車站
→ 醫生死亡

若晴與醫生都不在車站
→ 事件可能改寫為另一種異常
```

這些不是獨立劇本，而是同一個 Event 的不同 Variant。

## Delayed Effect

延遲影響必須是第一級資料，而不是只寫在對白或腳本裡。

例如：

```yaml
triggered_by: player_exposes_reporter
execute_at: "21:14"
effects:
  - set: characters.reporter.status
    value: missing
```

如此 Simulator 才能回答：

> 玩家 16:40 的行動，為什麼 21:14 才看到結果？

## Worldline History

Event Graph 描述「可能發生什麼」。
Worldline History 則記錄「某一輪實際發生什麼」。

每輪至少記錄：

```text
loop_id
resolved event variant
world state before
world state after
player action
scheduled delayed effects
card mutations
```

例如：

```text
Loop 07
17:30 玩家保護若晴
18:31 evt_1831_station → doctor_dies

若晴：Dead → Alive
醫生：Alive → Dead
```

這些紀錄用於 Timeline、Worldline Diff 與卡片歷史。

## 卡片與 Event Graph

Event Variant 可以直接改寫 Event Card。

例如：

```text
card: event_1831
field: victim
Loop 01 → wakaharu
Loop 02 → doctor
Loop 03 → null
```

Truth Card 不應由單一世界線覆蓋，而是根據玩家跨 Loop 得到的 Knowledge 更新。

## Invariant

Invariant 建議不要一開始全部手寫成答案。
系統可以從多輪 Worldline History 自動算候選：

```text
每輪都相同的時間
每輪都相同的地點
總是先於某事件發生的節點
不受玩家行動影響的狀態
```

但「是否為真正核心真相」仍由劇情設計定義。

## 視覺化工具

至少需要三個主要視圖。

### 1. Event Graph

```text
[玩家拆穿記者]
       ↓
[記者恐慌]
       ↓
[改變 Schedule]
       ↓ +4h
[前往研究所]
       ↓
[21:14 失蹤]
```

需要能查看：

- 條件
- Effects
- Delayed Effects
- 關聯 NPC
- 關聯卡片

### 2. Timeline

依時間排列實際世界事件。

```text
17:40       18:05       18:31          21:14
醫生離院 → 若晴碰面 → 18:31 Event ──→ 延遲事件
```

### 3. Worldline Diff

比較兩輪實際結果。

```text
Loop 04                  Loop 05
17:40 醫生離院           17:40 醫生被攔下
18:05 若晴碰面           18:05 若晴獨自行動
18:31 若晴死亡        →  18:31 醫生死亡
```

這個視圖同時是玩家功能，也是劇情 Debug 工具。

## Validator / CI 建議

每次提交劇情資料時檢查：

- Event ID 是否重複
- Character / Location 引用是否存在
- Event 引用是否存在
- 時間格式是否合法
- Variant 是否永遠不可能成立
- 是否存在 Unreachable Event
- 是否存在不應出現的循環依賴
- 互斥條件是否可能同時命中
- 同時間同角色是否被排進兩個不同地點
- Delayed Effect 的來源 Event 是否存在

## Source of Truth 原則

```text
劇情邏輯 → YAML
資料結構 → JSON Schema
畫布座標 → layout.json
玩家實際歷史 → runtime worldline log
視覺化工具 → 只讀 / 編輯上述資料
```

這能確保劇情可 review、可 diff、可測試，也能日後讓工具自動生成圖。
