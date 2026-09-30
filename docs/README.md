# Documentation Guide

這個目錄同時包含目前 Canon、Story 文件、Author tooling 規格，以及過去的設計 / implementation history。

為避免舊文件重新覆蓋最新玩法，開發前先依本頁判斷文件優先級。

## Precedence

遇到內容衝突時依下列順序判定：

```text
Core Gameplay Spec
        ↓
Story Canon
        ↓
Active subsystem spec
        ↓
ROADMAP / active implementation PR
        ↓
Historical dated plan / spec
```

### 1. Core Gameplay — highest priority

- `core-gameplay-spec-v0.1.md`
- `core-gameplay.md`：快速摘要，不能覆蓋完整 Spec

目前最重要 invariants：

- World Never Waits
- Single Main Action
- Single Focus
- Faded ≠ Paused
- Attention Shift Takes Time
- Perception Boundary
- Memory Is Player-selected
- No Auto Deduction
- Finite Information
- Asymmetric Loop Persistence

任何文件若違反上述規則，視為舊設計。

## 2. Story Canon

- `story-canon-background.md`：灰潮鎮社會背景、研究所原始目的、18:31 與故事核心反轉
- `story-canon-memory.md`
- `story-canon-time.md`
- `character-bible.md`
- `relationship-map.md`
- `main-story.md`
- chapter / final story documents

Story Canon 可以定義人物、事件與特殊劇情例外，但不能重新定義 Core Gameplay。

例如：

```text
知夏曾是特殊記憶持有者
```

可以是 Story Exception；不能因此推出：

```text
所有 NPC 都有 memory_residue
```

## 3. Author / Debug tooling

- `event-graph-spec.md`
- Event Graph / Causal Timeline related specs

Author tooling 可以知道：

- exact causal edges
- hidden conditions
- downstream effects
- convergence inputs
- cross-worldline truth

Player UI 不能直接繼承這些答案。

```text
Author causal truth ≠ Player Investigation Wall
```

## 4. Development Roadmap

Repo root：`ROADMAP.md`

Roadmap 決定目前實作順序與 PR dependency，但不能改寫 Gameplay Canon。

## Historical documents

`docs/superpowers/plans/**` 與 `docs/superpowers/specs/**` 是當時的設計與實作紀錄。

它們可用來了解：

- 為什麼某段 code 存在
- 當時驗收目標
- schema / migration 歷史
- 已被替換方案的背景

但**不能單獨作為最新 gameplay requirement**。

### Known superseded assumptions

下列舊假設曾出現在 historical docs，目前已被取代：

- Event Card / Truth Card 由系統自動核發或改寫給玩家
- Character Insight 自動解鎖正確推理
- generic NPC `memory_residue`
- Player Worldline Diff 直接顯示真正 causal difference
- Offline Report 自動列出錯過的重要情報
- 固定 `Continue` / case-reader / web-app-style narrative 作為最終 Player UI
- fixed per-character Typewriter 作為 canonical speech model
- 傳統 Skip / Fast-forward 改變 World Time
- 閱讀、對話、選擇或 Attention 凍結 World Time
- Attention Redirect 等同 True Interrupt
- 只允許「系統認為重要」的資訊成為 Memory

### Historical document rule

如果 dated document 與最新 Core Gameplay 衝突：

> 保留它作為歷史紀錄，但衝突段落不具規範效力。

若該文件仍被 active implementation 直接引用，應更新該文件或在文件頂部加入 superseded notice，而不是靠開發者自行猜測。

## Before implementing Player gameplay

至少確認：

```text
1. 我正在實作的是 Author tool 還是 Player experience？
2. World Event 是否被錯當成 Player Knowledge？
3. 玩家是否真的 Perceive 過？
4. Persistent Memory 是否來自 Player Capture？
5. 是否偷偷自動提示重要性 / 因果 / 矛盾？
6. 是否讓 World Time 因 UI 行為停止？
7. 是否讓 NPC 記住不該跨 Loop 的事情？
```

只要其中一題有疑問，先回到 `core-gameplay-spec-v0.1.md`。
