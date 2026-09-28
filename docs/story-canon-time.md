# Story Canon｜時間與世界線規則

這份文件是《灰潮鎮：第七封信》時間機制的 Canon Source of Truth。

---

## 現在的 Hard Reset

五年後、主角收到第七封信並回到灰潮鎮後，世界進入可被主角直接感知的每日 Hard Reset。

```text
10 月 3 日 06:12
主角在進入灰潮鎮前的返鄉列車上醒來
        ↓
07:20～08:00
抵達灰潮鎮／開始一天
        ↓
18:31
Causal Convergence 開始
        ↓
23:59
鐘聲／修正進入最後階段
        ↓
00:00
Hard Reset 完成
        ↓
10 月 3 日 06:12
```

### 固定規則

- Hard Reset checkpoint：**10 月 3 日 06:12**。
- 18:31 不是 Reset 時間，也不是固定死亡時間。
- 18:31 是世界線開始進入高強度因果收束／修正的時間點。
- 00:00 是該輪修正完成並重置世界狀態的時間。
- **只有主角保留跨 Loop 記憶。其他角色不保留上一輪記憶，也不會因反覆 Reset 逐漸想起其他 Loop。**
- 其他角色的人格、喜好、價值觀與穩定習慣會保持一致，因此主角可以跨 Loop 累積 Character Insight。
- 第七封信與部分跨線資訊不完全服從一般 Reset。

記憶與 Character Insight 的詳細規則見 `docs/story-canon-memory.md`。

---

## 五年前不是同一種 Loop

林知夏五年前經歷的不是現在這種「每天 00:00 明確回到 06:12」的 Hard Reset。

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

因此知夏會出現：

- 記得沒有發生過的對話。
- 對尚未發生的事故具有強烈確信。
- 知道同一天可能產生不同結果。
- 在錄音、紙本、通話資料裡留下時間順序錯位的資訊。

她把這些不同結果整理成 Worldline，但不代表她五年前每天都經歷一次完整午夜 Reset。

這裡的 Worldline Residue 指**知夏作為當時記憶持有者以及媒介中的資訊殘留**，不是一般 NPC 會逐步恢復其他世界線記憶。

---

## 18:31 的 Canon 定義

```text
18:31 ≠ 世界要求一個人死亡
18:31 ≠ Reset
18:31 ≠ 單純事故時間

18:31 = Causal Convergence Point
```

世界線偏離既有因果越大，18:31 之後越容易出現修正症狀：

- 電力／設備異常
- 路線與位置偏移
- 事故
- 資訊與紀錄矛盾
- 資訊時間錯位
- 嚴重時出現傷亡

所以以下世界線都成立：

```text
Loop 01 → 若晴死亡
Loop 02 → 柏勳死亡
Loop 03 → 無人死亡
```

三者共同點是 **18:31 的收束仍存在**，而不是「一定有人死」。

---

## 舊時間資料 Migration

早期可玩資料曾以 `14:20` 作為返鄉／敘事開場；Loop 01～03 的 scene、schedule、event 已完成第一階段 canonical migration。

`14:20` 只保留在歷史設計文件與測試 fixture 中，不再是 production story source 的 runtime timestamp。

### 規則

- 從 Arc 4 開始，Canon 一律以 **06:12 Hard Reset** 為準。
- Loop 01～03 的 migration 已統一為：
  1. 06:12 列車醒來
  2. 07:20～08:00 抵達
  3. 保留原事件相對順序與因果距離
  4. 重新對齊角色既有 08:00、11:30、14:00 等私人行程
  5. 固定 18:31、23:59、00:00 不變

> **Story Canon 時鐘以本文件為準；production story YAML 已以 06:12 作為返鄉／重置入口。**

---

## Author Rule

以後新增 Story DAG / Narrative 時，時間順序必須符合：

```text
06:12 Hard Reset
→ 人物自己的上午生活
→ 玩家介入
→ 資訊／信任／路線逐層改變
→ 18:31 Convergence
→ 延遲後果
→ 23:59 Bell
→ 00:00 Reset
```

世界線的差異應由 DAG 因果產生，不應由章節作者直接指定「這輪換誰死」。
