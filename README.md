# 灰潮鎮：第七封信

以安靜的文字敘事展開的輪迴推理遊戲。

玩家收到已故姊姊寄來的信後回到故鄉，逐漸發現這座小鎮被困在同一天。遊戲時間與現實世界同步，小鎮不會等待玩家；每次介入都可能改變 NPC 行程、關係與後續事件，甚至在數小時後才產生延遲後果。

## 核心玩法

```text
觀察事件
→ 建立假設
→ 介入一個節點
→ 世界自行運行
→ Event Card 被改寫
→ 比較世界線
→ 找出因果與 Invariant
→ 下一輪
```

核心原則：

> 改得動的，通常是結果；改不動的，才可能接近真相。

## 設計文件

- [`docs/core-gameplay.md`](docs/core-gameplay.md)：核心玩法、世界線、延遲影響、Event Card、Invariant、放置機制。
- [`docs/worldbuilding.md`](docs/worldbuilding.md)：灰潮鎮、輪迴規則、核心人物與主線 Mystery。
- [`docs/first-loop-story.md`](docs/first-loop-story.md)：第一輪《第一個今天》故事試稿。
- [`docs/event-graph-spec.md`](docs/event-graph-spec.md)：Event Graph、Worldline History、視覺化工具與資料管理規格。

## Event Graph

劇情邏輯以機器可讀資料作為 Source of Truth，視覺化工具只負責檢查、比較與模擬。

```text
YAML 劇情檔
→ Schema Validation
→ Event Graph Engine
→ Graph View / Timeline / Worldline Diff / Simulator
```

目前範例：

- [`story/events/day_01_1831.yaml`](story/events/day_01_1831.yaml)：18:31 事件與不同世界線 Variant。
- [`story/schemas/event-graph.schema.json`](story/schemas/event-graph.schema.json)：初版 Event Graph JSON Schema。

## Event Graph Viewer v0.1

[`tools/event-graph-viewer/`](tools/event-graph-viewer/) 已提供第一版 read-only 劇情除錯工具。

目前可查看：

```text
Event Graph
→ Event / Variant / Delayed Effect 因果關係

Timeline
→ 單一 Loop 真正發生過的事件

Worldline Diff
→ 比較兩輪同一 Event 如何被改寫
```

本機啟動：

```bash
cd tools/event-graph-viewer
npm install
npm run dev
```

測試與建置：

```bash
npm test
npm run build
```

詳細說明請見 [`tools/event-graph-viewer/README.md`](tools/event-graph-viewer/README.md)。

## 世界線設計方向

同一事件會因玩家行動改寫，例如：

```text
Loop 01：18:31 許若晴死亡
Loop 02：18:31 陳柏勳死亡
Loop 03：18:31 無人死亡
```

玩家真正要推理的不是單一結果，而是：

- 哪個行動造成分歧。
- 哪些後果是延遲發生。
- 哪些條件不論怎麼改都仍然存在。
- 為什麼 18:31 一直出現。

## 後續開發方向

- 世界線 Simulator / runtime log
- 現實時間同步與 Offline Report
- NPC Schedule / Relation / Knowledge State
- Event Graph Validator
- `story/layouts/*.json` 與可拖曳 Graph layout
- Event Graph 編輯器
