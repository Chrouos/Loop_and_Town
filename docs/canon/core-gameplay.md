# 核心玩法設計

> 本文件是 Core Gameplay 的快速入口。
>
> 完整規則以 `docs/core-gameplay-spec-v0.1.md` 為唯一 canonical source of truth。
> 若舊設計、Story 文件、Player UI 或歷史 plan 與該 Spec 衝突，一律以最新 Core Gameplay Spec 為準。

## 一句話定位

玩家不是被系統告知「哪個是線索」，而是在一個不會等待自己的世界裡，透過 **注意、感知、記住、推理與介入**，逐輪建立自己的真相模型。

## 核心循環

```text
World continuously moves
        ↓
Scene / Dialogue / Ambient / Opportunity
        ↓
Player Attention
        ↓
Perception
        ↓
Memory Capture
        ↓
Memory Library
        ↓
Investigation Wall
        ↓
Player-created hypothesis
        ↓
Choice / Memory Input / Different Action
        ↓
Different Event / Worldline
        ↓
New World State
```

## Canonical Rules

### World Never Waits

世界時間不因玩家：

- 離線
- 閱讀
- 猶豫
- 對話
- Attention Shift
- Memory Capture

而停止。

玩家錯過事件是 Gameplay 的一部分。

### Single Main Action + Single Focus

主角同一時間只能親自執行一個 Main Action，也只能有一個主要 Attention Focus。

短暫看向別處不等於啟動第二個 Action。

```text
Main Action
→ Peripheral Cue
→ Hover / Notice
→ Click / Attend
→ Attention Shift
→ Observe
→ Auto Return
```

真的放下目前事情、追出去或改做另一件主要行動，才是 True Interrupt。

### Perception Boundary

```text
World Event ≠ Player Knowledge
```

只有主角實際感知到的內容，才有資格被記住。

沒有看到的人影，不能事後自動變成照片。
只聽到模糊撞擊聲，就只能留下模糊的聲音資訊。

### Memory Capture

Memory 不是系統核發的「正確線索卡」。

玩家可以自行 Capture 真正感知到的 Moment：

- Text
- Visual
- Sound
- Composite Moment

Capture 的內容可以重要，也可以完全無關。

系統不得主動判定：

- 重要線索
- 矛盾
- 誰在說謊
- 正確因果
- 正確 hypothesis

### Investigation Wall

Investigation Wall 是玩家自己的推理空間。

```text
Memory = 我記得什麼
Investigation Wall = 我認為這些事情可能有什麼關係
```

玩家可以自由排列、連線、寫 Note，但系統不自動補因果關係。

### Dialogue Is Gameplay

Dialogue 期間世界仍持續發生。

普通回答可以依主角人格自然進行；真正影響：

- 意圖
- 行動
- Relationship
- Worldline
- 風險

的時刻才使用少量 Meaningful Choice。

特定 Narrative Node 也可接受玩家持有的 Memory Input。

### Loop Persistence

Reset 後的持續性是不對稱的：

```text
主角 Captured Memory       → 保留
Investigation Wall         → 保留
主角自己的主觀經歷         → 故事上記得
NPC Relationship State     → Reset
NPC 上一輪記憶             → Reset
World State                → 依 Loop 規則 Reset
NPC personality / values   → 穩定
```

一般 NPC 不存在通用的 `memory_residue` 機制。

## Worldline 與因果

玩家介入可以改變整條因果鏈，而不是只切換一個結局。

```text
玩家改變 A 的行程
→ A 沒遇到 B
→ B 改走另一條路
→ C 沒拿到資訊
→ 數小時後出現不同後果
```

Author Event Graph 可以知道真正因果。
Player 端不能因此自動知道因果。

```text
Author causal truth ≠ Player hypothesis
```

## Event Graph / Worldline History

Event Graph、Timeline、Worldline Diff 的完整 truth 屬於 Author / Debug tooling。

Player 只能使用自己實際 Perceive / Capture 到的資訊建立跨 Loop 比較。

因此以下舊概念不再是 Player-facing 核心系統：

- Event Card 自動改寫
- Truth Card 自動補完
- Invariant 自動提示
- 系統直接告訴玩家哪個 Action 造成分歧
- Offline Report 列出錯過的關鍵情報

## 放置 / Offline

玩家離線時世界仍持續運作。

回來時不應得到一份會洩漏因果或關鍵資訊的系統報表。

玩家可以：

- 看到世界留下的結果
- 收到故事上合理會收到的訊息
- 發現某人已經離開
- 發現 Opportunity 已錯過
- 在下一輪提前等待同一時間點

Delegation 只在合理故事情境中成立，不做成：

```text
選 NPC → 選任務 → 等時間 → 領獎勵
```

## Presentation

Player presentation 的目前方向：

- Spatial Typography
- Rhythmic Text
- Text Echo
- Elastic Attention
- Weak Affordance
- Ambient Narrative

原則：

> 能用世界本身表達的資訊，就不要額外建立 UI。

避免把遊戲重新做成：

- Quest Panel
- Action List
- Generic Continue
- Notification Feed
- Evidence Award Popup
- Fast-forward World Time

## 文件優先級

完整細節請依序參考：

1. `docs/core-gameplay-spec-v0.1.md` — Core Gameplay Canon
2. `docs/story-canon-memory.md` — Story memory/reset rules
3. `docs/story-canon-time.md` — Story time/reset canon
4. `docs/event-graph-spec.md` — Author Event Graph contract
5. `ROADMAP.md` — Development / merge order

`docs/superpowers/plans/**` 與 `docs/superpowers/specs/**` 是設計歷史與實作紀錄；其中較早文件若與上述 Canon 衝突，不具規範效力。
