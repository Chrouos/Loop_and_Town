# Story Canon｜時間與世界線規則

> 本文件定義《灰潮鎮：第七封信》的 Story Time / Reset Canon。
>
> Player interaction 與 Attention / Perception 規則以 `docs/core-gameplay-spec-v0.1.md` 為最高優先。
>
> 主角返鄉原因與五年後地方更新見 `docs/story-canon-return-and-reactivation.md`。

---

# 現在的 Hard Reset

五年後，灰潮鎮的地方更新重新碰觸五年前被隔離的研究／城市系統。

同一時期，主角因林家老屋處理需求返鄉。

兩件事共享同一個地方更新背景，但不能寫成：

```text
主角回來
→ Loop 因此開始
```

也不能寫成：

```text
收到信
→ 信召喚主角返鄉
→ Hard Reset 啟動
```

目前 10 月 3 日的 canonical loop：

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

---

# 固定規則

- Hard Reset canonical checkpoint：**10 月 3 日 06:12**
- 18:31 不是 Reset，也不是固定死亡時間
- 18:31 是 Causal Convergence Point
- 00:00 是該輪 World State Reset boundary
- 一般 NPC 不保留上一輪記憶
- NPC Personality / values / stable habits 維持角色一致性
- 主角自然保留跨 Loop 的主觀經歷
- Player-facing persistent record 仍以 Captured Memory / Investigation Wall 為準

目前**不固定**：

- 主角成為 Anchor / Reference 的精確技術原因
- 警告信的精確投遞機制
- 警告信是否具有任何跨世界線動態修改能力
- 00:00 Hard Reset 的最終停止條件
- Ending A / C 為什麼能永久停止 Hard Reset

---

# 警告信與 06:12 checkpoint

主角在 06:12 醒來以前，就已經收到知夏名義寄出的警告信。

因此 Reset 回到 06:12 時：

```text
信仍在外套口袋裡
```

**不需要**額外解釋成：

```text
信具有抗 Reset 能力
或
信是特殊跨線物件
```

它只是 checkpoint 原本就包含的 World State。

目前固定的信件資訊只有：

```text
寄件人署名：林知夏
郵戳：昨天
知夏已死亡五年
核心警告：不要回來
```

任何「Reset 後信件自動多出新文字」都不是目前 Canon，必須等信件機制定案後再加入。

---

# World Never Waits

Story Time 不因玩家：

- 離線
- 閱讀
- Dialogue
- Choice
- Attention Shift
- Observation
- Memory Capture

而停止。

例如：

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

重要 Story Event 不應等待玩家回前景才發生。

玩家可能完全錯過事件，只在稍後看到 aftermath；這是 Gameplay，不是 runtime error。

---

# 五年前不是同一種 Hard Reset

林知夏五年前經歷的現象，不等同現在每天 `00:00 → 06:12` 的 Hard Reset。

高層上仍稱為：

> **Soft Rewrite / Worldline Rewrite**

五年前可出現：

- 被改寫結果的殘留
- 尚未發生事件的資訊
- 媒介中時間順序錯位的紀錄
- 知夏保留上一個 Reality State 的主觀資訊

但知夏為什麼能記得、她與研究系統的 Observer / Reference 關係如何形成，目前仍需後續細化。

不能把它抽象成一般 NPC 的 `memory_residue`。

---

# 18:31 Canon

```text
18:31 ≠ 世界要求一個人死亡
18:31 ≠ Reset
18:31 ≠ 單純事故時間

18:31 = Causal Convergence / Synchronization Point
```

目前已確定的研究高層方向：

```text
Urban / Disaster Digital Twin
→ Prediction
→ Intervention
→ Reality Write-back / Synchronization 異常
→ Simulation 與 Reality 邊界污染
```

因此不同 Worldline 在 18:31 附近可以產生不同 Failure Path。

例如：

```text
Loop 01 → 若晴死亡
Loop 02 → 柏勳死亡
Loop 03 → 主角沒有確認到任何已知死者
```

共同點是 Convergence 仍存在。

不是「每輪必須交出一名死者」。

---

# Hard Reset 與死亡必須分開

目前 Story Canon 明確要求：

```text
死亡
≠
Hard Reset trigger
```

因此 Chapter 3 才能成立：

```text
18:31 沒有已知死者
↓
時間仍前進
↓
23:59 鐘聲
↓
00:00 Hard Reset
```

這代表故事後期必須解釋的問題是：

> 系統到底在判定什麼「沒有完成」？

而不是：

> 這一輪到底死了誰？

答案尚未完全鎖定，不能由章節作者自行補成「Anchor 必須死亡」或「一定要有一名死者」。

---

# Real-time Anchored Timeline

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

---

# Live Sync Entry

Live Sync 的 Player Entry Point 可以晚於 06:12。

例如：

```text
玩家 17:05 進入

06:12 世界已開始
→ NPC 正常生活
→ 事件正常發生
→ 17:05 玩家才進入
```

玩家沒有親眼看到 06:12～17:05，不代表 Author Worldline History 不存在。

同時：

```text
Author Worldline History
≠
Player Knowledge
```

---

# 舊時間資料 Migration

早期 Prototype 曾以 `14:20` 作為返鄉 / 敘事開場。

Production Story Canon 已遷移為：

1. 06:12 列車醒來
2. 07:20～08:00 抵達
3. 角色上午生活照常存在
4. 18:31 Causal Convergence
5. 23:59 Bell
6. 00:00 Hard Reset

`14:20` 只可存在於 historical fixture / dated design document。

---

# Author Rule

新增 Story DAG / Narrative 時遵守：

```text
06:12 canonical checkpoint
→ NPC 自己的上午生活
→ Player intervention
→ information / relationship / route changes
→ 18:31 Convergence
→ delayed consequence
→ 23:59 Bell
→ 00:00 Reset
```

世界線差異必須來自 DAG 因果，不是章節作者直接指定「這輪換誰死」。

---

# Player Knowledge boundary

Story Canon 可以知道完整事件；Player 必須走：

```text
World Event
→ Attention
→ Perception
→ optional Capture
```

系統不能因多輪都在 18:31 發生異常，就直接顯示：

```text
[Invariant discovered]
18:31 是核心真相
```

這個結論應由玩家自己建立。
