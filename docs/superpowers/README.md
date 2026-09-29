# Historical Design / Implementation Records

`docs/superpowers/plans/**` 與 `docs/superpowers/specs/**` 保存專案設計與實作演進歷史。

這些文件**不是目前 Core Gameplay 的最高權威**。

若內容與以下文件衝突：

1. `docs/core-gameplay-spec-v0.1.md`
2. `docs/story-canon-memory.md`
3. `docs/story-canon-time.md`
4. `docs/event-graph-spec.md`
5. repo root `ROADMAP.md`

以較新的 Canon 為準。

## 已知被取代的舊設計

歷史文件可能仍描述：

- Event Card / Truth Card 自動發給玩家
- Evidence Board 只接受系統挑好的重要資訊
- Character Insight 自動解鎖答案
- generic NPC `memory_residue`
- Player Worldline Diff 直接顯示真正因果
- Offline Report 列出錯過的事件 / 關鍵情報
- fixed Typewriter / Continue / case-reader-first UI
- 閱讀、對話或 major transition 暫停 World Time
- 18:31 / 23:59 等玩家回前景才發生
- 傳統 Fast-forward 改變 World Time

以上都不能直接作為新 runtime requirement。

## Author vs Player

很多舊 Viewer / Simulator 文件會顯示完整事件結果、Invariant 或因果鏈。

這些資料若屬 Author / Debug tooling 是合法的；不能因此直接搬到 Player UI。

```text
Author Truth
≠
Player Knowledge
```

Player 仍必須遵守：

```text
World Event
→ Attention
→ Perception
→ optional Memory Capture
→ Investigation
```

## 開發使用方式

舊文件可以用來理解：

- schema 為何這樣設計
- 某個測試的歷史來源
- 某段 runtime 的 migration 背景
- 已被替代方案曾解決什麼問題

但只要要新增 Player-facing behavior，先回到 Core Gameplay Spec。
