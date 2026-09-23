# Event Graph Viewer

灰潮鎮劇情資料的 read-only 視覺化與除錯工具。

目前提供三個核心視圖：

```text
story/*.yaml
    ↓
sync-story
    ↓
load + normalize
    ↓
┌──────────────┬──────────────┬────────────────┐
Event Graph    Timeline       Worldline Diff
因果關係         實際時間線       世界線差異
```

## 本機啟動

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

## Story Sync

根目錄的 `story/` 是唯一 Source of Truth。

```bash
npm run sync-story
```

會把：

```text
../../../story/events/
../../../story/schemas/
```

同步到：

```text
public/story/events/
public/story/schemas/
```

`public/story/` 是產生物，不應手動編輯。

## 架構

```text
story/*.yaml           劇情與 Event Graph Source of Truth
scripts/sync-story.mjs 前端資料同步
src/lib/loadStory.ts   YAML → normalized model
src/lib/eventGraph.ts  Event / Variant / Delayed Effect projection
src/lib/timeline.ts    世界線時間排序
src/lib/worldlineDiff.ts 世界線差異計算
src/components/        Graph / Timeline / Diff UI
src/fixtures/          v0.1 世界線範例
```

## Event Graph

目前圖會保留：

```text
Event
  ↓
Variant
  ↓
Delayed Effect
```

例如：

```text
[18:31 車站事件]
        ↓
 [若晴死亡]
        ↓ +163m
 [記者失蹤]
```

Delayed Effect 不是單純備註，而是 Event Graph 的第一級節點。

## Timeline

Timeline 顯示某一輪真正發生過的事件，依遊戲內時間排序。

```text
17:40 醫生離院
18:05 醫生與若晴碰面
18:31 若晴死亡
```

## Worldline Diff

同一 Event 會以 `eventId` 對齊。

```text
Loop 04              Loop 05
18:31 若晴死亡   →   18:31 醫生死亡
21:14 未發生     →   21:14 記者失蹤
```

Variant 改變會標記成「變更」，而不是拆成兩個互不相關的事件。

## v0.1 限制

- Viewer 目前是 read-only。
- Worldline 資料目前使用 fixture，之後會改接 Simulator / runtime log。
- Graph layout 目前由前端計算，尚未讀取 `story/layouts/*.json`。
- 尚未提供 YAML 編輯、Graph 拖曳存檔與 Event Simulator。

後續資料格式與設計原則請見 [`../../docs/event-graph-spec.md`](../../docs/event-graph-spec.md)。
