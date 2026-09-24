# Story Simulation v0.2 Design

**Date:** 2026-09-23  
**Status:** Draft for review  
**Depends on:** `feature/worldline-simulator-v0.1` / PR #2  
**Supersedes:** earlier First Loop Story Graph v0.2 draft  
**Source material:** `docs/first-loop-story.md`, `docs/core-gameplay.md`, `docs/event-graph-spec.md`, `docs/worldbuilding.md`

---

## 1. Goal

在正式製作玩家端遊戲之前，先把第一個 Loop 做成一個**可執行、可重播、可比較的故事模型**。

這個階段的交付物不是 Player UI，而是：

```text
Story Definition
→ NPC Base Schedule
→ Hidden World State
→ Player Intervention
→ Event Graph Resolution
→ Full Worldline History
→ Observable Player History
→ Worldline Diff
```

我們要先回答：

> 這個故事在不同玩家介入下，是否真的能自然跑出不同但可解釋的世界線？

只有 Story Simulation 驗證通過後，才開始 Player Game implementation。

---

## 2. Core Model

正式核心模型：

```text
Loop Range
+ Initial World State
+ NPC Base Schedules
+ Hidden World Conditions
+ Player Interventions
↓
Effective Schedule / State
↓
Event Conditions
↓
Event Variant / Delayed Consequence
↓
Worldline History
↓
Player Observable History
```

### 核心原則

1. **Loop 不等於一天。** Loop 是作者定義的時間 Range。
2. **NPC 沒有玩家也會生活。** Base Schedule 是第一級資料。
3. **玩家不直接選劇情結果。** 玩家只能改變狀態、位置、路線、任務或旗標。
4. **事件結果由 World State 決定。** Event Variant 依 condition resolve。
5. **玩家不應立即知道因果。** Hidden condition / hidden schedule movement 只出現在 Author History。
6. **同一輸入必須 deterministic。** 相同初始狀態與介入必須得到相同世界線。
7. **故事先於遊戲 UI。** v0.2 不新增 playable frontend。

---

## 3. Scope

### In scope

- 第一個 Loop：Day 0 14:20 → Day 1 00:00（end inclusive）。
- Cross-day `StoryTime` / absolute minute。
- NPC Base Schedule。
- Schedule `when` 條件與 applied / skipped history。
- Player Intervention 對 world state / route / assignment 的改變。
- Hidden / Observable visibility。
- Full Author History 與 Player History 分離。
- 第一輪完整 Story Graph YAML。
- 第一輪代表世界線 WL-00 ～ WL-07。
- Story simulation runner。
- Author Timeline / Worldline Diff。
- 第一輪故事 acceptance tests。

### Out of scope

- 玩家端遊戲 UI。
- 即時倒數 / 瀏覽器離線補算。
- 真正 Loop reset runtime。
- Loop 02。
- 跨 Loop 玩家記憶 persistence。
- 卡片 UI / Evidence Board。
- Hypothesis engine。
- Relationship / Trust 數值系統。
- 通用 NPC AI / pathfinding。
- LLM NPC。
- 隨機事件。

---

## 4. Loop Range

第一個 Loop：

```yaml
loop:
  id: gray_tide_loop_01
  range:
    start:
      day: 0
      time: "14:20"
    end:
      day: 1
      time: "00:00"
```

Loop range **end inclusive**。

因此 Day 1 00:00 的 `evt_0000_loop_end` 會被執行並記入 history。

Simulator 不應假設 Loop 永遠只有一天。未來可以是：

```text
Day 0 08:00
→ Day 3 23:59
```

---

## 5. Story Time

```ts
interface StoryTime {
  day: number;
  time: string;
}

type StoryTimeInput = string | StoryTime;
```

舊語法：

```yaml
at: "18:31"
```

等同：

```yaml
at:
  day: 0
  time: "18:31"
```

排序使用：

```text
absoluteMinute = day * 1440 + minuteOfDay
```

例：

```text
Day 0 23:59 = 1439
Day 1 00:00 = 1440
```

History 必須包含：

```ts
day: number;
time: string;
absoluteMinute: number;
sequence: number;
```

---

## 6. Story Truth Layers

### 6.1 World Truth

Simulator 實際知道的完整因果：

```text
State
+ Schedule
+ Conditions
→ Outcome
```

### 6.2 Full Worldline History

記錄所有真正發生過的事情：

- schedule applied
- schedule skipped
- hidden movement
- player action
- state effect
- event resolved
- emitted / delayed event
- observable event

### 6.3 Player Observable History

只包含玩家合理能知道的內容：

- 玩家自己的 action
- `visibility: observable` 的事件
- 明確取得的 facts / clues

不包含：

- hidden conditions
- hidden NPC movement
- skipped schedule reasons
- 作者用 debug facts

玩家看到的是 correlation，不是完整 causation。

---

## 7. Visibility

```ts
type Visibility = 'observable' | 'hidden' | 'debug';
```

語意：

- `observable`：玩家當下可直接得知。
- `hidden`：世界中實際發生，但玩家當下不知道。
- `debug`：只供作者工具使用。

Event、Variant、Schedule Entry 都可以帶 visibility。

Narrative metadata：

```ts
interface NarrativeMetadata {
  summary?: string;
  beat?: string;
}
```

完整小說對白不塞入 Event YAML。

---

## 8. NPC Base Schedule

Base Schedule 描述「如果玩家完全不干預，角色原本會怎麼生活」。

 authored schedule 不允許 runtime 修改。

```text
Base Schedule
+ Current World State
↓
Effective Schedule
```

Player Intervention 只修改 state，例如：

```text
characters.doctor.route = stay_hospital
characters.yuan.assignment = post_office
characters.reporter.route = hotel_then_old_lab
```

Schedule Entry 再以 `when` 判斷是否執行。

### Schedule Entry concept

```yaml
- id: doctor_leave_hospital
  at:
    day: 0
    time: "17:40"
  visibility: hidden
  when:
    path: characters.doctor.route
    op: eq
    value: old_station
  effects:
    - set:
        path: characters.doctor.location
        value: road_to_old_station
```

如果 `when` 不成立：

```text
schedule entry = skipped
state 不改變
Author History 留下 skipped 紀錄
Player History 不顯示
```

v0.2 不新增 `cancel_schedule_entry` / `patch_schedule` / `replace_schedule` DSL。

---

## 9. Core Characters and Baseline Schedules

第一版只建核心角色，不模擬全鎮居民。

### 9.1 許若晴 / Wakaharu

Baseline：

```text
14:20 cafe
16:10 cafe
17:45 leave cafe
18:05 old_station / meet doctor
18:18 old_station
18:31 old_station
```

若 `protect_wakaharu`：

```text
route = home
→ 後續 old_station schedule entries skip
```

### 9.2 陳柏勳 / Doctor

Baseline：

```text
14:20 hospital
17:40 leave hospital
17:58 old_station
18:05 meet wakaharu
18:20 return route
```

若 `stop_doctor`：

```text
route = stay_hospital
→ 17:40 / 17:58 / 18:05 station entries skip
```

### 9.3 葉庭安 / Reporter

Baseline：

```text
16:40 meet player
17:30 normal route
19:50 normal location
21:14 available
```

若 `confront_reporter`：

```text
route = hotel_then_old_lab
17:30 return hotel        [hidden]
19:50 enter old_lab       [hidden]
21:14 hidden condition may resolve reporter_missing
```

### 9.4 周予安 / Yuan

Baseline：

```text
15:00 with player
17:50 town
18:10 station area
18:30 clock shop
```

若 `send_yuan_to_post_office`：

```text
assignment = post_office
17:50 post_office
18:10 post_office
18:30 return route
19:10 report postal anomaly
```

因此情報取捨來自角色真的不在同一個地方，不是 UI 人工隱藏 clue。

---

## 10. Player Interventions

### Story actions

#### `send_yuan_to_post_office`

Day 0 15:00：

```text
characters.yuan.assignment = post_office
flags.yuan_sent_to_post_office = true
```

#### `show_letter_to_wakaharu`

Day 0 16:10：

```text
flags.wakaharu_saw_letter = true
```

#### `confront_reporter`

Day 0 16:40：

```text
flags.reporter_confronted = true
characters.reporter.route = hotel_then_old_lab
```

### Author-only intervention actions

用來模擬後續 Loop 的可能性，但第一輪 Player UI 不會提供：

#### `protect_wakaharu`

```text
characters.wakaharu.route = home
```

#### `stop_doctor`

```text
characters.doctor.route = stay_hospital
```

v0.2 不做 action unlock system。

---

## 11. First Loop Story Graph

```text
Day 0

14:20  evt_1420_return_to_town
   │
15:00  evt_1500_sister_room
   │
   └─ ACTION? send_yuan_to_post_office

16:10  evt_1610_wakaharu_cafe
   │
   └─ ACTION? show_letter_to_wakaharu

16:40  evt_1640_reporter_encounter
   │
   └─ ACTION? confront_reporter
                 │
                 └─ reporter.route = hotel_then_old_lab
                        │
17:30                   └─ schedule: reporter_return_hotel [hidden]
                        │
17:40  schedule: doctor_leave_hospital
   │
17:58  schedule: doctor_arrive_station
   │
18:05  evt_1805_envelope_handoff
   │
18:10  evt_1810_yuan_station_observation
   │       ├─ yuan at station → saw_reporter
   │       └─ yuan at post office → yuan_absent
   │
18:18  evt_1818_wakaharu_last_conversation
   │       ├─ wakaharu_saw_letter → warning_revealed
   │       └─ otherwise → guarded
   │
18:31  evt_1831_station
   │       ├─ wakaharu at station → wakaharu_dies
   │       ├─ wakaharu absent + doctor at station → doctor_dies
   │       └─ both absent → no_death
   │
19:10  evt_1910_yuan_information [only if post-office assignment]
   │       └─ postal_record_anomaly_found
   │
19:50  schedule: reporter_enter_old_lab [hidden, confronted route only]
   │
20:30  evt_2030_old_case_reveal
   │       └─ five_year_old_death_time = 18:31
   │
21:14  evt_2114_reporter_status
   │       ├─ confronted + reporter at old_lab → reporter_missing
   │       └─ otherwise → no_visible_event
   │
22:40  evt_2240_sister_warning
   │
23:59  evt_2359_midnight_bells
   │
Day 1
00:00  evt_0000_loop_end
```

---

## 12. Important Causal Chains

### 12.1 False Causality: Doctor

第一輪玩家自然看到：

```text
17:40 醫生偷偷離院
→ 18:05 與若晴碰面
→ 18:31 若晴死亡
```

玩家很容易得到：

> 醫生可能殺了若晴。

但 Simulator 不應把「醫生是兇手」寫成 truth。

這只是 Player Knowledge 形成的合理錯誤假說。

### 12.2 Yuan information trade-off

```text
send_yuan_to_post_office
→ Yuan 18:10 不在車站
→ 沒看到 Reporter
→ 19:10 得到 postal anomaly
```

反之：

```text
no send
→ Yuan 18:10 在車站附近
→ 看見 Reporter
→ 沒有 19:10 postal result
```

### 12.3 Reporter delayed consequence

```text
16:40 confront_reporter
→ reporter.route changes
→ 17:30 hotel [hidden]
→ 19:50 old_lab [hidden]
→ 21:14 reporter_missing
```

Player History 第一輪只需要看到：

```text
16:40 拆穿葉庭安
...
21:14 葉庭安失蹤
```

不告訴玩家中間真正的因果鏈。

### 12.4 18:31 invariant investigation

不同 intervention 可以改變 18:31 的受害者：

```text
baseline                     → wakaharu_dies
protect_wakaharu             → doctor_dies
stop_doctor                  → wakaharu_dies
protect_wakaharu+stop_doctor → no_death
```

但 18:31 異常仍然 resolve。

這用來引導玩家後續理解：

> 可變的是結果；不變的時間點才更接近真相。

---

## 13. Same-time Ordering

Simulator 同一 absolute minute 固定順序：

```text
Schedule
→ Event
→ Player Action
```

理由：

玩家應先看到當下情境，再做該時間點的介入。

例如：

```text
15:00 evt_1500_sister_room
→ 15:00 send_yuan_to_post_office
```

同種類內：

- schedule：authored insertion order
- event：queue insertion order
- action：caller input order

---

## 14. Representative Worldlines

### WL-00 Baseline

Actions：無。

Expected：

```text
18:10 Yuan sees Reporter
18:31 wakaharu_dies
19:10 no postal anomaly
21:14 no reporter_missing
23:59 midnight bells
00:00 loop end
```

### WL-01 Postal

Actions：

```text
send_yuan_to_post_office
```

Expected：

```text
18:10 Yuan absent
18:31 wakaharu_dies
19:10 postal anomaly
21:14 no reporter_missing
```

### WL-02 Trust

Actions：

```text
show_letter_to_wakaharu
```

Expected：

```text
18:18 warning_revealed
18:31 wakaharu_dies
```

### WL-03 Reporter

Actions：

```text
confront_reporter
```

Expected：

```text
17:30 reporter_return_hotel [hidden]
19:50 reporter_enter_old_lab [hidden]
21:14 reporter_missing
```

### WL-04 Rescue

Author intervention：

```text
protect_wakaharu
```

Expected：

```text
wakaharu station schedule skipped
18:31 doctor_dies
```

### WL-05 Stop Doctor

Author intervention：

```text
stop_doctor
```

Expected：

```text
doctor station schedule skipped
18:31 wakaharu_dies
```

### WL-06 Both

Author interventions：

```text
protect_wakaharu
stop_doctor
```

Expected：

```text
both station routes skipped
18:31 no_death
```

### WL-07 Independence

Actions：

```text
protect_wakaharu
confront_reporter
```

Expected：

```text
18:31 doctor_dies
21:14 reporter_missing
```

這條用來證明 21:14 與 18:31 victim 解耦。

---

## 15. Story Simulator Requirements

v0.2 必須能以程式方式執行：

```ts
simulateStory({
  manifest,
  actionIds,
  until,
}): SimulationResult
```

`SimulationResult` 至少提供：

```ts
{
  state,
  fullHistory,
  playerHistory
}
```

Author tooling 還需要：

```ts
simulateNamedWorldline(worldlineId)
compareWorldlines(left, right)
```

實際 function naming 可在 implementation plan 中依現有 module pattern固定，但行為不得偏離本節。

---

## 16. Author Simulation Output

目標是能產生類似：

```text
=== WL-03 Reporter ===

D0 14:20 EVENT     return_to_town              observable
D0 16:40 ACTION    confront_reporter            observable
D0 17:30 SCHEDULE  reporter_return_hotel        hidden
D0 18:31 EVENT     wakaharu_dies                observable
D0 19:50 SCHEDULE  reporter_enter_old_lab       hidden
D0 21:14 EVENT     reporter_missing              observable
D0 23:59 EVENT     midnight_bells                observable
D1 00:00 EVENT     loop_end                      observable
```

Player projection：

```text
D0 14:20 回到灰潮鎮
D0 16:40 拆穿葉庭安
D0 18:31 許若晴死亡
D0 21:14 葉庭安失蹤
D0 23:59 鐘聲
D1 00:00 Loop End
```

---

## 17. Worldline Diff Requirements

至少支援兩個核心 Diff。

### Diff A: Reporter

```text
WL-00                        WL-03
16:40 —                      confront_reporter
17:30 —                   →  reporter_return_hotel [hidden]
19:50 —                   →  reporter_enter_old_lab [hidden]
21:14 —                   →  reporter_missing
```

### Diff B: Yuan

```text
WL-00                        WL-01
15:00 —                   →  send_yuan_to_post_office
18:10 saw_reporter        →  yuan_absent
19:10 —                   →  postal_anomaly
```

Author Diff 可以顯示 hidden rows；Player Diff 只能顯示 observable rows。

---

## 18. Story File Structure

```text
story/
├─ manifests/
│  └─ loop_01.yaml
├─ loops/
│  └─ loop_01.yaml
├─ world/
│  └─ loop_01_initial.yaml
├─ schedules/
│  ├─ wakaharu.yaml
│  ├─ doctor.yaml
│  ├─ reporter.yaml
│  └─ yuan.yaml
├─ actions/
│  └─ loop_01_actions.yaml
├─ events/
│  ├─ loop_01_1420.yaml
│  ├─ loop_01_1500.yaml
│  ├─ loop_01_1610.yaml
│  ├─ loop_01_1640.yaml
│  ├─ loop_01_1805.yaml
│  ├─ loop_01_1810.yaml
│  ├─ loop_01_1818.yaml
│  ├─ loop_01_1831.yaml
│  ├─ loop_01_1910.yaml
│  ├─ loop_01_2030.yaml
│  ├─ loop_01_2114.yaml
│  ├─ loop_01_2240.yaml
│  ├─ loop_01_2359.yaml
│  └─ loop_01_end.yaml
└─ worldlines/
   └─ loop_01_worldlines.yaml
```

Manifest 只列 Definition 成員，不定義執行順序。

執行順序永遠來自 StoryTime + queue semantics。

---

## 19. Manifest Concept

```yaml
loop: loops/loop_01.yaml
world: world/loop_01_initial.yaml
schedules:
  - schedules/wakaharu.yaml
  - schedules/doctor.yaml
  - schedules/reporter.yaml
  - schedules/yuan.yaml
actions: actions/loop_01_actions.yaml
events:
  - events/loop_01_1420.yaml
  - events/loop_01_1500.yaml
  - events/loop_01_1610.yaml
  - events/loop_01_1640.yaml
  - events/loop_01_1805.yaml
  - events/loop_01_1810.yaml
  - events/loop_01_1818.yaml
  - events/loop_01_1831.yaml
  - events/loop_01_1910.yaml
  - events/loop_01_2030.yaml
  - events/loop_01_2114.yaml
  - events/loop_01_2240.yaml
  - events/loop_01_2359.yaml
  - events/loop_01_end.yaml
worldlines: worldlines/loop_01_worldlines.yaml
```

---

## 20. Validation Requirements

延續 v0.1 validator，新增：

- `StoryTime.day` 必須是非負整數。
- `StoryTime.time` 必須合法 `HH:mm`。
- Loop `start <= end`。
- 所有 scheduled item 必須落在 Loop Range 內。
- Schedule ID 不可重複。
- Schedule entry ID 不可重複。
- Character state path 必須存在。
- Manifest 引用必須存在。
- Manifest 不能重複載入相同 definition ID。
- Action 不可排入過去。
- Emitted event 不可排入目前時間以前。
- History absoluteMinute 必須單調不減。
- `visibility` 只能是 `observable | hidden | debug`。
- Player projection 不得洩漏 hidden/debug entry。
- Narrative metadata 不參與 state path validation。

v0.2 不做 unreachable graph 靜態證明。

---

## 21. Acceptance Tests

TDD 必須直接讀真實 `story/*.yaml`，不能只測 hardcoded fixture。

至少驗證：

1. Loop Range 可以跨午夜。
2. `at: "18:31"` 保持向後相容。
3. Base Schedule 在無玩家操作時 deterministic。
4. Schedule `when=false` 會 skip 且不修改 state。
5. 同分鐘順序為 Schedule → Event → Action。
6. Player History 不包含 hidden schedule movement。
7. WL-00 ～ WL-07 全部得到預期結果。
8. `wakaharu_dies` 不再觸發 reporter disappearance。
9. `confront_reporter` 即使 18:31 victim 改變，仍可造成 21:14 disappearance。
10. Yuan 不可能同時取得 station sighting 與 postal anomaly。
11. `protect_wakaharu + stop_doctor` 仍會 resolve 18:31 Event，但 variant 是 `no_death`。
12. 23:59 midnight bells 在所有代表世界線都存在。
13. Day 1 00:00 loop end 一定在 midnight bells 後。
14. 相同 inputs 重跑 history 完全一致。
15. Worldline Diff 由 simulation history 產生，不讀預製 diff fixture。

---

## 22. Story Review Gate

Story Simulator 完成後，在開始 Player Game 前，必須人工檢查：

- Baseline 是否能形成「醫生可能是兇手」的 False Causality。
- 玩家第一輪能否合理注意到 `18:31`。
- 郵局情報與車站目擊的 trade-off 是否自然。
- Reporter 21:14 延遲後果是否不會過早暴露原因。
- `protect_wakaharu` 是否真的讓世界線產生意外替代結果，而不是直接得到 happy ending。
- WL-06 無人死亡時，18:31 是否仍保有異常感。
- 23:59 是否足以作為目前世界線的 invariant。
- Player History 是否保留足夠推理資訊，又沒有洩漏 Author Truth。

Story Review 通過才開始 Player UI。

---

## 23. Implementation Order

下一份 implementation plan 必須依這個順序拆 TDD tasks：

```text
1. StoryTime + Loop Range
2. Schedule types + execution
3. Visibility + full/player history projection
4. Chronological orchestration
5. Manifest loader
6. First Loop Base Schedules
7. First Loop Actions
8. First Loop Events
9. WL-00 ~ WL-07 definitions
10. Story simulation runner
11. Worldline Diff
12. End-to-end canonical story tests
13. Author-facing simulation output
```

**不包含 Player Game UI。**

---

## 24. Completion Definition

Story Simulation v0.2 完成的定義不是「有畫面可以玩」。

而是：

```text
給定 Loop 01 + 任一代表 action set
↓
Simulator 可以從 14:20 自動跑到 00:00
↓
NPC 按自己的 Base Schedule 行動
↓
玩家 intervention 改變有效行程 / hidden conditions
↓
Event Graph 自動 resolve
↓
產生完整 Author History
↓
產生不洩漏 hidden truth 的 Player History
↓
可以比較兩條 Worldline
↓
WL-00 ~ WL-07 全部通過 acceptance tests
```

做到這一步，第一輪故事才算「可執行」。

下一階段才是：

```text
Story Simulation
→ Player Game Runtime
→ Visual / Narrative Presentation
```
