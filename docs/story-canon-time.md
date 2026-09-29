# Story Canon｜時間與世界線規則

> 本文件定義《灰潮鎮：第七封信》的 Story Time / Reset Canon。
>
> Player interaction 與 Attention / Perception 規則以 `docs/core-gameplay-spec-v0.1.md` 為最高優先。

## 現在的 Hard Reset

五年後、主角收到第七封信並回到灰潮鎮後，世界進入每日 Hard Reset。

```text
10 月 3 日 06:12
主角在返鄉列車上醒來
        ↓
07:20～08:00
抵達灰潮鎮
        ↓
18:31
Causal Convergence
        ↓
23:59
鐘聲／修正進入最後階段
        ↓
00:00
Hard Reset
        ↓
10 月 3 日 06:12
```

### 固定規則

- Hard Reset canonical checkpoint：**10 月 3 日 06:12**
- 18:31 不是 Reset，也不是固定死亡時間
- 18:31 是 Causal Convergence Point
- 00:00 是該輪世界狀態 Reset boundary
- 一般 NPC 不保留上一輪記憶
- NPC Personality / values / stable habits 維持角色一致性
- 第七封信與知夏的跨線資訊屬 Story-specific exception

主角跨 Loop 記得自己的主觀經歷，但可被系統保證檢索、放上 Investigation Wall、作為 Memory Input 的 persistent gameplay record 仍以 **Captured Memory** 為準。

詳細規則見 `docs/story-canon-memory.md`。

## World Never Waits

Story Time 不因玩家：

- 離線
- 閱讀
- Dialogue
- Choice
- Attention Shift
- Observation
- Memory Capture

而停止。

因此：

```text
18:31 到了
玩家不在線
→ 18:31 仍然發生
```

```text
23:59 到了
玩家正在閱讀
→ 鐘聲仍然發生
```

重要 Story Event 不應設計成「等待玩家回前景才發生」。

玩家可能完全錯過事件，只在稍後看到 aftermath；這是 Gameplay，不是 runtime error。

00:00 的跨 Loop runtime continuation、Time Mode / Entry Mode 如何建立屬 runtime architecture；無論 implementation 如何處理 presentation，都不能回頭改寫上一輪已經發生的事件。

## 五年前不是同一種 Loop

林知夏五年前經歷的不是現在這種「每天 00:00 明確回到 06:12」Hard Reset。

五年前主要是：

```text
未發生事件的記憶
＋
未來碎片
＋
被改寫結果的殘留
＋
媒介中提前出現的資訊
        ↓
Soft Rewrite / Worldline Residue
```

因此知夏可能：

- 記得沒有發生過的對話
- 對尚未發生的事故有異常確信
- 知道同一天可能產生不同結果
- 在錄音、紙本、通話資料留下時間順序錯位資訊

這裡的 Worldline Residue 是 **知夏作為特殊記憶持有者與媒介資訊的 Story Mechanism**。

不是：

```text
一般 NPC 靠近異常很多次
→ residue +1
→ 下一輪逐漸記起來
```

## 18:31 Canon

```text
18:31 ≠ 世界要求一個人死亡
18:31 ≠ Reset
18:31 ≠ 單純事故時間

18:31 = Causal Convergence Point
```

世界線偏離既有因果越大，18:31 後越可能出現修正症狀：

- 電力 / 設備異常
- 路線與位置偏移
- 事故
- 資訊與紀錄矛盾
- 時間錯位
- 嚴重時傷亡

所以以下都可以成立：

```text
Loop 01 → 若晴死亡
Loop 02 → 柏勳死亡
Loop 03 → 無人死亡
```

共同點是 Convergence 仍存在，不是「一定有人死」。

## Real-time Anchored Timeline

Story authoring 使用 Simulation Time。

```text
Story YAML
→ 06:12 / 18:31 / 23:59 / 00:00
```

Real Time ↔ Simulation Time mapping 由 runtime clock 負責。

```text
Real Time
   ↓
Loop Clock / Entry Mode
   ↓
Simulation Time
   ↓
Event Scheduler
```

Story node 不直接依賴 `Date.now()`，也不為 LIVE_SYNC / ACCELERATED 複製兩份事件。

## Live Sync Entry

Live Sync 的 Player Entry Point 可以晚於 06:12。

例如：

```text
玩家 17:05 進入

06:12 世界已開始
→ NPC 正常生活
→ 事件正常發生
→ 17:05 玩家才進入
```

玩家沒有親眼看到 06:12～17:05，不代表 Author Worldline History 不存在；同時 Author History 也不能直接變成 Player Knowledge。

```text
Worldline History
≠
Player Knowledge
```

## 舊時間資料 Migration

早期 Prototype 曾以 `14:20` 作為返鄉 / 敘事開場。

Loop 01～03 的 scene / schedule / event 已完成第一階段 canonical migration：

1. 06:12 列車醒來
2. 07:20～08:00 抵達
3. 保留原事件相對順序與因果距離
4. 對齊角色既有私人行程
5. 18:31 / 23:59 / 00:00 維持 Canon

`14:20` 只能保留在歷史設計文件或 fixture 中，不再作為 production Story Canon 的返鄉入口。

## Author Rule

新增 Story DAG / Narrative 時遵守：

```text
06:12 Hard Reset
→ NPC 自己的上午生活
→ Player Entry / intervention
→ information / relationship / route changes
→ 18:31 Convergence
→ delayed consequence
→ 23:59 Bell
→ 00:00 Reset
```

世界線差異必須來自 DAG 因果，而不是章節作者直接指定「這輪換誰死」。

## Player Knowledge boundary

Story Canon 可以知道完整事件；Player 必須走：

```text
World Event
→ Attention
→ Perception
→ optional Capture
```

時間本身也不能成為自動提示系統。

例如系統不應因多輪都在 18:31 發生異常，就直接顯示：

```text
[Invariant discovered]
18:31 是核心真相
```

這個結論應由玩家自己建立。
