# First Loop Story Graph v0.2 Design

**Date:** 2026-09-23  
**Status:** Draft for review  
**Depends on:** `feature/worldline-simulator-v0.1` / PR #2  
**Source material:** `docs/first-loop-story.md`, `docs/core-gameplay.md`, `docs/event-graph-spec.md`, `docs/worldbuilding.md`

---

## 1. Goal

把目前的 Worldline Simulator v0.1 從「18:31 + 21:14 技術驗證」推進成第一個完整、可重播、可比較的 **第一輪故事因果圖**。

這一階段不是把整篇小說逐句變成 Event，也不是建立完整 Visual Novel runtime。

核心目標是建立第一輪的 **Causal Spine**：

```text
玩家行動
→ World State 改變
→ Event Variant 改變
→ 後續事件 / 情報 / 延遲後果改變
→ Worldline History 可解釋
```

同時保留 **Narrative Layer**，讓故事文字與情緒節奏可以附著在因果節點上，但不讓敘事內容參與 simulator 判定。

---

## 2. Player Experience Target

第一輪不是讓玩家解開案件，而是讓玩家建立一個「看似合理但錯誤」的模型：

```text
17:40 醫生秘密離院
→ 18:05 與若晴接觸
→ 18:31 若晴死亡
→ 玩家自然懷疑醫生
```

同一輪必須另外埋下兩種世界線思考：

1. **資訊取捨**：派周予安去郵局，就會得到郵局異常，但失去車站目擊情報。
2. **延遲因果**：16:40 拆穿葉庭安，直到 21:14 才看到「失蹤」後果。

午夜時玩家才真正知道這是一個 Loop：

```text
23:59 鐘聲
→ 00:00 Loop End
→ 世界將在下一階段的 Loop Runtime 中重置
```

第一輪結束後，玩家應自然產生下一輪實驗：

> 如果阻止許若晴去車站，她還會死嗎？

---

## 3. Design Principles

1. **Causal events only**：只有會改變世界狀態、情報、後續事件或世界線理解的節點進 Event Graph。
2. **Narrative is not logic**：對白、氛圍與小說文字不能成為 condition expression。
3. **Actions mutate state, not endings**：玩家不能直接選 `wakaharu_dies` / `doctor_dies`。
4. **Delayed consequences are first-class**：16:40 的行動可以到 21:14 才產生可見結果。
5. **Trade-offs over correct answers**：第一輪選擇應讓玩家交換情報，而不是單純正確 / 錯誤。
6. **Simulator remains deterministic**：相同 initial state + actions + story definitions 必須產生相同結果。
7. **First Loop does not require the final game runtime**：這一版仍以作者 / debug simulator 為主要驗證介面。
8. **Do not over-model**：Relationship、NPC Knowledge、完整 Schedule、Truth Card Engine 等留待後續專門階段。

---

## 4. Scope

### In scope

- 第一輪 14:20 → 次日 00:00 的完整因果骨架。
- 第一輪核心事件 YAML。
- 三個第一輪故事 Action：
  - `send_yuan_to_post_office`
  - `show_letter_to_wakaharu`
  - `confront_reporter`
- 現有 debug Actions：
  - `protect_wakaharu`
  - `stop_doctor`
  仍保留給 Worldline Simulator / 作者測試使用。
- 正式修正 21:14 因果來源。
- 周予安郵局 / 車站目擊資訊取捨。
- 跨午夜 absolute story time。
- 第一輪 canonical scenario test。
- 至少兩組 Worldline Diff acceptance cases。
- Event / Variant 的最小 Narrative metadata。

### Out of scope

- 真正執行世界 reset。
- Loop 02 runtime。
- 玩家跨 Loop Knowledge persistence。
- 完整 Event Card / Truth Card engine。
- Trust / Relationship 數值模型。
- NPC 通用 Schedule engine。
- Offline / real-time clock synchronization。
- 完整 VN dialogue renderer。
- 自由文字玩家行動。
- LLM NPC。
- 隨機事件。

---

## 5. First Loop Causal Spine

第一輪主要節點：

```text
Day 0
14:20  evt_1420_return_to_town
15:00  evt_1500_sister_room
16:10  evt_1610_wakaharu_cafe
16:40  evt_1640_reporter_encounter
17:40  evt_1740_doctor_leaves_hospital
17:58  evt_1758_doctor_arrives_station
18:05  evt_1805_envelope_handoff
18:18  evt_1818_wakaharu_last_conversation
18:31  evt_1831_station
19:10  evt_1910_yuan_information
20:30  evt_2030_old_case_reveal
21:14  evt_2114_reporter_missing
22:40  evt_2240_sister_warning
23:59  evt_2359_midnight_bells

Day 1
00:00  evt_0000_loop_end
```

不是所有事件都要有多個 Variant。

例如 `evt_2030_old_case_reveal` 可以是 deterministic beat，其功能只是把：

```text
林知夏死亡時間 = 18:31
```

正式寫入本輪可見資訊。

---

## 6. First Loop Actions

### 6.1 `send_yuan_to_post_office`

時間：15:00。

效果：

```text
characters.yuan.assignment = post_office
flags.yuan_sent_to_post_office = true
```

因果：

```text
15:00 派周予安去郵局
→ 18:10 他不在車站附近
→ 無法提供葉庭安目擊資訊
→ 19:10 帶回郵局異常
```

### 6.2 `show_letter_to_wakaharu`

時間：16:10。

v0.2 不建立完整 Trust System，只使用明確 flag：

```text
flags.wakaharu_saw_letter = true
```

它允許 18:18 事件採用「若晴願意留下警告」的 Variant。

### 6.3 `confront_reporter`

時間：16:40。

效果：

```text
flags.reporter_confronted = true
characters.reporter.route = hotel_then_old_lab
```

真正的 delayed chain：

```text
16:40 confront_reporter
→ reporter route changes
→ 19:50 reporter goes to old lab
→ 21:14 evt_2114_reporter_missing
```

21:14 不再由 `wakaharu_dies` 觸發。

---

## 7. Information Trade-off: 周予安

這是第一輪最重要的「沒有完美選項」示範。

### Worldline A — 派去郵局

```text
15:00 send_yuan_to_post_office
→ 19:10 postal_record_anomaly
→ 玩家得知：郵戳是真的，但系統沒有寄件紀錄
→ station_reporter_sighting 不發生
```

### Worldline B — 留在身邊

```text
15:00 不派周予安
→ 18:10 station_reporter_sighting
→ 玩家得知：葉庭安曾出現在車站附近
→ 19:10 postal_record_anomaly 不發生
```

這兩個資訊互斥不是因為 UI 強制選 A/B，而是因為角色同一時間不能出現在兩個地方。

v0.2 不建立通用 NPC Schedule solver；只用 World State + Event Variant 表達這個因果。

---

## 8. Formal 21:14 Delayed Consequence

v0.1 的技術 demo：

```text
wakaharu_dies
→ delay 163 minutes
→ evt_2114_reporter_missing
```

在 v0.2 必須移除。

正式故事因果：

```text
confront_reporter at 16:40
→ delayed effect / scheduled state change
→ evt_2114_reporter_missing at 21:14
```

Acceptance：

```text
confront_reporter
→ 21:14 reporter_missing occurs

no confront_reporter
→ 21:14 reporter_missing does not occur
```

18:31 的 victim 不應決定 21:14 是否發生。

因此以下兩條世界線都必須成立：

```text
wakaharu_dies + confront_reporter
→ reporter_missing

wakaharu_dies + no confront_reporter
→ reporter remains available
```

這個測試用來防止 v0.1 demo 因果殘留。

---

## 9. 18:31 Event

`evt_1831_station` 繼續作為核心 Event。

作者 Debug Simulator 仍支援：

```text
no protection
→ wakaharu_dies

protect_wakaharu
→ doctor_dies

stop_doctor
→ wakaharu_dies

protect_wakaharu + stop_doctor
→ no_death
```

但第一輪 canonical story 不主動給玩家 `protect_wakaharu` / `stop_doctor` 這兩個能力。

原因：第一輪的功能是讓玩家先觀察規律，而不是第一次就完成因果實驗。

因此：

```text
Canonical Loop 01
→ evt_1831_station / wakaharu_dies
```

Debug worldlines 可以偏離 canonical path，但不代表玩家第一輪 UI 已經解鎖這些 Action。

Action availability / unlock system 不在 v0.2 實作。

---

## 10. Narrative Layer

Simulator data 與敘事文字分開。

### Minimal metadata

Event / Variant 可選擇帶入：

```yaml
narrative:
  summary: "玩家回到灰潮鎮，第一次注意到鐘樓。"
  beat: unease
```

Variant 也可帶：

```yaml
narrative:
  summary: "若晴倒在舊車站，玩家把醫生視為最大嫌疑人。"
  beat: false_causality
```

v0.2 只定義以下欄位：

```ts
interface NarrativeMetadata {
  summary?: string;
  beat?: string;
}
```

它必須滿足：

- Simulator 可以完全忽略它。
- Condition / Effect 不可引用 narrative 欄位。
- Viewer 可以顯示 summary，但不是 v0.2 必要 acceptance。
- 完整對白仍保留在 `docs/first-loop-story.md` 或未來 narrative content files。

不把長篇小說文字塞入 Event YAML。

---

## 11. World State Additions

第一輪最小 state：

```yaml
clock:
  day: 0
  time: "14:20"

characters:
  wakaharu:
    location: cafe
    status: alive
  doctor:
    location: hospital
    status: alive
  reporter:
    location: town
    status: available
    route: normal
  yuan:
    location: town
    assignment: none

flags:
  yuan_sent_to_post_office: false
  yuan_saw_reporter_at_station: false
  postal_record_anomaly_found: false
  wakaharu_saw_letter: false
  reporter_confronted: false
  old_case_1831_revealed: false
  sister_warning_found: false
  midnight_bells_heard: false
  loop_ended: false
```

只增加第一輪因果需要的 facts。

不加入 trust score、inventory system、knowledge graph 等泛化資料。

---

## 12. Cross-Midnight Story Time

目前 v0.1 使用 minute-of-day：

```text
23:59 = 1439
00:00 = 0
```

這無法表達第一輪從 23:59 前進到「下一天 00:00」。

v0.2 引入最小 `StoryTime`：

```ts
interface StoryTime {
  day: number;
  time: string;
}
```

轉換：

```text
absoluteMinute = day * 1440 + parseTime(time)
```

例：

```text
Day 0 14:20 = 860
Day 0 23:59 = 1439
Day 1 00:00 = 1440
```

### Authored syntax

Scheduled Event：

```yaml
at:
  day: 0
  time: "23:59"
```

跨日 Event：

```yaml
at:
  day: 1
  time: "00:00"
```

為了相容 v0.1，以下仍合法：

```yaml
at: "18:31"
```

其語意等同：

```yaml
at:
  day: 0
  time: "18:31"
```

Action 與 `emit_event.at` 採同一個 `StoryTimeInput`。

```ts
type StoryTimeInput = string | StoryTime;
```

History 繼續提供 `time`，並新增 `day` 與 `absoluteMinute`，排序必須以 absolute minute 為準。

---

## 13. Loop End Semantics

`evt_0000_loop_end` 在 v0.2 是一個普通可記錄 Event：

```text
Day 1 00:00
→ flags.loop_ended = true
→ history append evt_0000_loop_end
```

它 **不執行**：

- world reset
- NPC reset
- action reset
- card persistence
- player memory persistence
- Loop ID increment

這些屬於下一個 `Loop Runtime` subsystem。

如此可以完整描述第一輪故事，而不提前綁死未來 loop architecture。

---

## 14. Story File Structure

建議：

```text
story/
├─ world/
│  └─ day_01_initial.yaml
├─ actions/
│  └─ day_01_actions.yaml
└─ events/
   ├─ day_01_1420.yaml
   ├─ day_01_1500.yaml
   ├─ day_01_1610.yaml
   ├─ day_01_1640.yaml
   ├─ day_01_1740.yaml
   ├─ day_01_1758.yaml
   ├─ day_01_1805.yaml
   ├─ day_01_1818.yaml
   ├─ day_01_1831.yaml
   ├─ day_01_1910.yaml
   ├─ day_01_2030.yaml
   ├─ day_01_2114.yaml
   ├─ day_01_2240.yaml
   ├─ day_01_2359.yaml
   └─ day_02_0000_loop_end.yaml
```

v0.2 仍由 loader 明確列出 canonical story files 或使用一個 manifest。

推薦新增 manifest：

```yaml
# story/manifests/day_01.yaml
world: world/day_01_initial.yaml
actions: actions/day_01_actions.yaml
events:
  - events/day_01_1420.yaml
  - events/day_01_1500.yaml
  - ...
  - events/day_02_0000_loop_end.yaml
```

目的：避免 `loadSimulationStory.ts` 每增加一個事件就 hardcode 一個 import / fetch。

Manifest 只負責列 Story Definition 成員，不負責流程順序；事件真正執行順序仍由 `at` / Queue 決定。

---

## 15. Simulator Changes Required

v0.2 對 simulator 的必要改動限制在：

1. `StoryTimeInput` / absolute minute。
2. Queue 改用 absolute minute。
3. History 支援 `day` + `absoluteMinute`。
4. Loader 支援 manifest。
5. Event / Variant optional Narrative metadata。
6. 移除 v0.1 `wakaharu_dies → reporter_missing` delayed definition。
7. 支援第一輪新增 action / event story files。

不加入：

- general schedule resolver
- relationship engine
- knowledge engine
- reset engine

---

## 16. Canonical First Loop

Canonical Loop 01 不套用任何第二輪 debug intervention。

基本結果：

```text
Day 0 14:20  回到灰潮鎮
Day 0 15:00  姊姊房間
Day 0 16:10  若晴咖啡店
Day 0 16:40  記者出現
Day 0 17:40  醫生秘密離院
Day 0 17:58  醫生抵達車站
Day 0 18:05  信封交接
Day 0 18:18  若晴最後對話
Day 0 18:31  wakaharu_dies
Day 0 20:30  old_case_1831_revealed
Day 0 22:40  sister_warning_found
Day 0 23:59  midnight_bells
Day 1 00:00  loop_end
```

`19:10` 與 `21:14` 是否出現，依該輪第一輪 Action 而定。

「Canonical」在這裡代表第一輪劇情設計的基準世界線，不代表玩家不能做已開放的調查選擇。

---

## 17. Acceptance Scenarios

### Scenario A — 郵局情報

```text
Actions:
- send_yuan_to_post_office

Expected:
- postal_record_anomaly_found = true
- yuan_saw_reporter_at_station = false
- evt_1910_yuan_information resolves postal_anomaly
```

### Scenario B — 車站目擊

```text
Actions:
- no send_yuan_to_post_office

Expected:
- postal_record_anomaly_found = false
- yuan_saw_reporter_at_station = true
- evt_1910_yuan_information resolves station_sighting
```

### Scenario C — 拆穿記者

```text
Actions:
- confront_reporter

Expected:
- evt_2114_reporter_missing occurs
- reporter.status = missing
```

### Scenario D — 不拆穿記者

```text
Actions:
- no confront_reporter

Expected:
- evt_2114_reporter_missing does not occur
- reporter.status != missing
```

### Scenario E — 21:14 與 18:31 解耦

```text
Actions:
- confront_reporter
- protect_wakaharu

Expected:
- evt_1831_station may resolve doctor_dies
- evt_2114_reporter_missing still occurs
```

與：

```text
Actions:
- no confront_reporter
- no protect_wakaharu

Expected:
- evt_1831_station resolves wakaharu_dies
- evt_2114_reporter_missing does not occur
```

### Scenario F — Cross-midnight

```text
runUntil Day 1 00:00

Expected:
- evt_2359_midnight_bells occurs before evt_0000_loop_end
- history ordering remains deterministic
- flags.loop_ended = true
```

---

## 18. Worldline Diff Acceptance

至少驗證兩組對照。

### Diff 1 — Reporter delayed consequence

```text
Worldline A                     Worldline B
16:40 confront_reporter         16:40 no confrontation
21:14 reporter_missing       →  21:14 未發生
```

### Diff 2 — Information trade-off

```text
Worldline A                     Worldline B
15:00 派周予安去郵局            15:00 周予安留下
18:10 無車站目擊             →  18:10 目擊葉庭安
19:10 郵局異常               →  19:10 無郵局異常
```

Diff 必須來自 simulator-generated history，不建立新的 fixture worldlines。

---

## 19. Validation Requirements

延續 v0.1 validation，新增：

- `StoryTime.day` 必須是非負整數。
- `StoryTime.time` 必須為合法 `HH:mm`。
- Manifest 引用的 story file 必須存在。
- Manifest 不可重複引用同一 Event ID。
- Event absolute time 不得早於 initial clock，除非未來明確支援 past events。
- Delayed / emitted event 不可排到負 absolute minute。
- History absolute minute 必須單調不減。
- Narrative metadata 不參與 state path validation。

v0.2 不嘗試靜態證明所有 unreachable events。

---

## 20. Testing Strategy

TDD 順序：

```text
StoryTime tests
→ Queue cross-day ordering
→ History cross-day projection
→ Manifest loader
→ First-loop story state tests
→ 21:14 causal decoupling tests
→ 周予安 information trade-off tests
→ canonical story end-to-end
→ Viewer Timeline / Diff integration
```

測試必須至少包含：

- Day 0 23:59 < Day 1 00:00。
- 舊 `at: "18:31"` syntax 向後相容。
- 相同 inputs 仍 deterministic。
- 真實 `story/*.yaml` 被 acceptance tests 直接讀取。
- `wakaharu_dies` 本身不能再觸發 21:14。
- `confront_reporter` 不依賴 18:31 victim 仍可觸發 21:14。

---

## 21. Migration Strategy

1. 以 PR #2 的 simulator branch 為 base。
2. 先加入 StoryTime，保持舊 string time syntax 綠燈。
3. 加 manifest loader，先讓既有 18:31 / 21:14 data 走 manifest。
4. 新增第一輪事件檔。
5. 將 21:14 delayed source 從 `wakaharu_dies` 移到 `confront_reporter`。
6. 擴充 initial state 與第一輪 actions。
7. 加 canonical story acceptance tests。
8. 最後才更新 Viewer，讓 Timeline / Diff 顯示完整第一輪。

每一步都必須保持已有 v0.1 acceptance tests 可解釋；若正式故事因果刻意改變舊 acceptance，測試名稱與 spec 必須同步更新，而不是靜默刪除。

---

## 22. Branch / PR Strategy

此功能依賴尚未 merge 的 PR #2。

因此 spec 與後續 implementation 使用 stacked branch：

```text
main
└─ feature/worldline-simulator-v0.1       # PR #2
   └─ docs/first-loop-story-graph-v0.2    # this spec
      └─ feature/first-loop-story-graph-v0.2  # implementation later
```

PR #2 merge 後，再把 v0.2 implementation PR retarget 到 `main`。

不 force-push 既有 PR branch。

---

## 23. Completion Criteria

First Loop Story Graph v0.2 完成時，repository 必須能從 canonical story files deterministic 地產生：

```text
14:20 回鄉
→ 15:00 調查姊姊房間
→ 16:10 若晴
→ 16:40 記者
→ 17:40 / 17:58 / 18:05 醫生與信封路徑
→ 18:18 若晴警告
→ 18:31 第一個死亡事件
→ 19:10 條件式情報
→ 20:30 五年前 18:31
→ 21:14 條件式延遲後果
→ 22:40 姊姊警告
→ 23:59 鐘聲
→ Day 1 00:00 Loop End
```

並證明：

1. 第一輪故事不是線性 fixture，而是由 state / conditions / variants 產生。
2. 派周予安去郵局會造成資訊 trade-off。
3. 拆穿記者會造成真正的 delayed consequence。
4. 21:14 已與 18:31 victim 解耦。
5. 23:59 → Day 1 00:00 可被 simulator 正確排序。
6. Timeline / Worldline Diff 能使用生成的 history 顯示這些差異。
7. Simulator 不需要理解小說文字，就能重播整條第一輪因果鏈。

---

## 24. Future Work

完成 v0.2 後才考慮：

- Loop Runtime / world reset。
- Action unlock / availability。
- Event Card runtime。
- Truth Card / cross-loop knowledge。
- NPC generic schedules。
- Relationship / trust。
- Offline real-time simulation。
- 第一輪正式 VN presentation layer。
- 第二輪「阻止若晴」作為玩家第一次因果實驗。
