# First Loop Story Graph v0.2 Design

**Date:** 2026-09-23  
**Status:** Revised draft for review  
**Depends on:** `feature/worldline-simulator-v0.1` / PR #2  
**Source material:** `docs/first-loop-story.md`, `docs/core-gameplay.md`, `docs/event-graph-spec.md`, `docs/worldbuilding.md`

---

## 1. Goal

把目前的 Worldline Simulator v0.1 從「少數手寫事件的技術驗證」推進成第一個真正符合遊戲核心的 **完整 Loop 模型**。

這一版的核心不是「一天等於一個 Loop」，也不是「玩家選 A 就跳到劇情 A」。

正式模型是：

```text
Loop Range
+ NPC Base Schedule
+ Hidden World Conditions
+ Player Intervention
↓
Schedule / State Override
↓
Event Conditions
↓
Event Variant / Delayed Consequence
↓
Worldline History
↓
Player 只看到可觀察到的結果
```

玩家前期不會直接知道自己改變了哪個關鍵條件，也不會被系統告知真正因果。

第一個 Loop 只需要做到：

```text
Day 0 14:20
→ 世界依 NPC 原本生活軌跡運作
→ 玩家做少量介入
→ 某些 NPC 行程因此偏移
→ 隱藏條件被改變
→ 數十分鐘到數小時後出現不同結果
→ Day 1 00:00 Loop Range 結束
```

---

## 2. Core Design Principle

### 2.1 Loop 不等於 Day

Loop 是一段作者定義的時間範圍：

```text
Loop = [start, end)
```

第一版剛好是：

```text
start = Day 0 14:20
end   = Day 1 00:00
```

未來可以是：

```text
Day 0 08:00
→ Day 3 23:59
```

Simulator 不應假設一個 Loop 只能有一天。

### 2.2 NPC 先有生活，劇情才發生

NPC 不是等待玩家點擊的劇情節點。

每個核心 NPC 有自己的 Base Schedule：

```text
時間到
→ NPC 移動 / 工作 / 見面 / 離開
→ World State 改變
→ 某個 Event 的條件可能成立
```

如果玩家什麼都不做，世界依 Baseline Worldline 自行演進。

### 2.3 玩家改變條件，不直接改結果

玩家行動只能改變：

- NPC location
- NPC route / assignment
- world flag
- knowledge / observable fact
- 某些未來 Schedule Entry 是否仍有效

玩家不能直接執行：

```text
choose doctor_dies
choose reporter_missing
```

結果仍由 Event Conditions 決定。

### 2.4 真正因果對玩家隱藏

Simulator 知道：

```text
A + B + C
→ Event X
```

玩家可能只看到：

```text
我做了 A
...
Event X 發生了
```

因此玩家得到的是 correlation，而不是系統直接告訴他的 causation。

這是跨 Loop 推理的核心。

---

## 3. Four-Layer World Model

v0.2 將世界明確分成四層。

### Layer 1 — World Truth

完整的內部世界狀態。

例如：

```text
reporter_confronted = true
reporter.location = old_lab
doctor.location = old_station
lab_power = true
```

這些資料允許 Event Resolver 判斷真正結果。

玩家不一定知道這些值。

### Layer 2 — NPC Schedule

角色原本會怎麼生活。

```text
17:40 doctor leaves hospital
17:58 doctor arrives old station
18:05 doctor meets wakaharu
```

Schedule 是世界自然運作的基線。

### Layer 3 — Worldline Overrides

玩家行動或已發生事件造成的偏移。

例如：

```text
17:35 player stops doctor
↓
doctor route override = stay_hospital
```

原始 Base Schedule 保留不變；目前世界線使用 Effective Schedule。

### Layer 4 — Player Knowledge

玩家實際知道的事情。

例如玩家可能只知道：

```text
16:40 我拆穿了葉庭安
21:14 葉庭安失蹤
```

但不知道：

```text
19:50 她前往舊研究所
20:03 研究所電力恢復
```

v0.2 不做自動因果推理，只記錄「玩家已觀察到哪些 facts / events」。

---

## 4. Loop Range

新增 Loop Definition：

```yaml
id: gray_tide_first_loop
range:
  start:
    day: 0
    time: "14:20"
  end:
    day: 1
    time: "00:00"
reset_policy: at_range_end
```

### v0.2 semantics

- Simulator 只執行 range 內的事件、Schedule Entries、Player Actions。
- `runUntil()` 不得越過 Loop end。
- Day 1 00:00 記錄 `loop_end`。
- v0.2 不實際執行 world reset。
- v0.2 不啟動下一個 Loop。

`reset_policy: at_range_end` 是第一版固定策略。

未來可以擴充條件式 reset / loop escape，但不在這一版實作。

---

## 5. Story Time

使用跨日 absolute minute。

```ts
interface StoryTime {
  day: number;
  time: string;
}

type StoryTimeInput = string | StoryTime;
```

舊格式仍合法：

```yaml
at: "18:31"
```

等同：

```yaml
at:
  day: 0
  time: "18:31"
```

換算：

```text
absoluteMinute = day * 1440 + minuteOfDay
```

因此：

```text
Day 0 23:59 = 1439
Day 1 00:00 = 1440
```

---

## 6. NPC Base Schedule

新增 `story/schedules/`。

第一版只替真正影響核心因果的 NPC 建 Schedule：

- 許若晴 `wakaharu`
- 陳柏勳 `doctor`
- 葉庭安 `reporter`
- 周予安 `yuan`

周志遠與其他 NPC 暫時仍可由 Event 表達，不需要為了完整而建立無作用行程。

### Schedule Definition

```yaml
character: doctor
entries:
  - id: doctor_leave_hospital
    at:
      day: 0
      time: "17:40"
    effects:
      - set:
          path: characters.doctor.location
          value: road_to_old_station

  - id: doctor_arrive_station
    at:
      day: 0
      time: "17:58"
    when:
      path: characters.doctor.route
      op: eq
      value: old_station
    effects:
      - set:
          path: characters.doctor.location
          value: old_station
```

Schedule Entry 可以有 `when`。

若條件不成立，該 entry 會被記錄為 skipped，但不執行 effects。

這讓玩家改變 route 後，不需要刪掉原始 Schedule。

---

## 7. Base Schedule vs Effective Schedule

Simulator 不直接修改 authored schedule。

概念：

```text
Base Schedule
+ Current World State
+ Worldline Overrides
↓
Effective Schedule
```

v0.2 不建立複雜通用 Schedule Planner。

Worldline Override 只透過 World State 表達，例如：

```text
characters.doctor.route = stay_hospital
characters.yuan.assignment = post_office
characters.reporter.route = hotel_then_old_lab
```

後續 Schedule Entry 的 `when` 自然決定是否執行。

因此不新增：

```text
cancel_schedule_entry
replace_schedule
patch_schedule
```

等額外 DSL。

YAGNI：第一版只需要 state-driven schedule conditions。

---

## 8. Hidden World Conditions

「玩家不知道自己觸發了什麼」不是額外的特殊系統，而是 Event Graph 的正常行為。

作者可定義：

```yaml
variants:
  - id: reporter_missing
    when:
      all:
        - path: flags.reporter_confronted
          op: eq
          value: true
        - path: characters.reporter.location
          op: eq
          value: old_lab
        - path: world.lab_power
          op: eq
          value: true
```

這些 condition 是 World Truth。

Player View 不顯示完整 condition expression。

### 設計原則

不要讓每個日常操作都造成重大蝴蝶效應。

第一輪應該是：

```text
大量普通生活行為
→ 大部分只改局部狀態

少數關鍵行為
→ 改變 hidden condition
→ 延遲後果
```

世界必須可理解，而不是純 Chaos。

---

## 9. Visibility / Observation

Event 與 Schedule Entry 可帶最小 visibility metadata：

```ts
type Visibility = 'observable' | 'hidden' | 'debug';
```

語意：

- `observable`：玩家在當下可直接看到，加入 Player Knowledge。
- `hidden`：世界有發生，但玩家當下不知道。
- `debug`：只給 Author / Debug Viewer 顯示。

Event / Variant 可額外帶：

```yaml
narrative:
  summary: "葉庭安提早離開。"
  beat: unease
visibility: observable
```

完整對白仍不塞入 Event YAML。

---

## 10. History Separation

Simulator 應保留完整 Worldline History，但 Player View 使用投影後資料。

### Full Worldline History

記錄：

```text
schedule entry applied / skipped
player action
state effect
event resolved
delayed / emitted event
hidden event
observable event
```

這是作者的真實因果紀錄。

### Player History

只包含：

```text
observable events
player actions
已公開 facts
```

不顯示：

```text
hidden conditions
hidden schedule transitions
未被玩家觀察到的 NPC 行為
```

因此同一輪可以有：

```text
Author Timeline
16:40 reporter confronted
17:30 reporter returns hotel
19:50 reporter enters old lab
20:03 lab power restored
21:14 reporter missing
```

而 Player Timeline 只有：

```text
16:40 拆穿葉庭安
21:14 葉庭安失蹤
```

---

## 11. First Loop Range

第一個 Loop：

```text
Day 0 14:20
→ Day 1 00:00
```

這只是第一章的第一個 range，不是引擎限制。

第一輪主要 Causal Spine：

```text
14:20  玩家回到灰潮鎮
15:00  姊姊房間
16:10  許若晴咖啡店
16:40  葉庭安出現
17:40  醫生 Base Schedule：離院
17:58  醫生抵達舊車站
18:05  醫生與若晴碰面
18:10  周予安可能目擊葉庭安
18:18  若晴最後一次對話
18:31  車站異常事件
19:10  周予安可能帶回郵局情報
20:30  五年前舊案
21:14  葉庭安可能失蹤
22:40  姊姊警告
23:59  鐘聲
Day 1 00:00  Loop End
```

---

## 12. First Loop Base Schedules

### 12.1 許若晴

Baseline：

```text
14:20 cafe
16:10 cafe
17:52 leaves cafe
18:05 old_station
18:18 old_station
18:31 old_station
```

核心 state：

```text
characters.wakaharu.location
characters.wakaharu.route
characters.wakaharu.status
```

第二輪 Debug Action `protect_wakaharu` 可以讓 route 改成 `home`。

### 12.2 陳柏勳

Baseline：

```text
14:20 hospital
17:40 leaves hospital
17:58 old_station
18:05 meets wakaharu
18:20 route_back_hospital
```

核心 state：

```text
characters.doctor.location
characters.doctor.route
characters.doctor.status
```

Debug Action `stop_doctor` 改 `route = stay_hospital`。

### 12.3 葉庭安

Baseline：

```text
16:40 meets player
17:30 follows normal route
19:50 does not enter old lab
21:14 available
```

若玩家 `confront_reporter`：

```text
route = hotel_then_old_lab
17:30 hotel
19:50 old_lab
21:14 hidden condition may resolve reporter_missing
```

### 12.4 周予安

Baseline：

```text
15:00 with player
17:50 shopping_street
18:10 station_area
18:30 clock_shop
```

若 `send_yuan_to_post_office`：

```text
assignment = post_office
17:50 post_office
18:10 post_office
18:30 returning
19:10 reports postal anomaly
```

這自然造成情報 trade-off。

---

## 13. First Loop Player Interventions

第一輪正式可用的 Story Actions：

### `send_yuan_to_post_office`

Day 0 15:00。

```text
characters.yuan.assignment = post_office
```

結果：

```text
18:10 無法目擊葉庭安
19:10 得到郵局異常
```

### `show_letter_to_wakaharu`

Day 0 16:10。

```text
flags.wakaharu_saw_letter = true
```

結果：

```text
18:18 若晴願意說出更多資訊
```

### `confront_reporter`

Day 0 16:40。

```text
flags.reporter_confronted = true
characters.reporter.route = hotel_then_old_lab
```

玩家當下只看到葉庭安改變態度並離開。

真正後續透過她的 Schedule + Event Conditions 發生。

### Debug-only Actions

保留：

```text
protect_wakaharu
stop_doctor
```

它們用來驗證第二輪可能的世界線，但第一輪 Player UI 不解鎖。

---

## 14. 18:31 Event

`evt_1831_station` 繼續是核心 Event。

結果由 18:31 當下 state 決定，而不是由玩家直接選。

Acceptance：

```text
wakaharu at station
→ wakaharu_dies

wakaharu absent + doctor at station
→ doctor_dies

wakaharu absent + doctor absent
→ no_death
```

第一輪 baseline：

```text
wakaharu_dies
```

這仍然刻意建立 False Causality：

```text
醫生秘密離院
→ 醫生與若晴見面
→ 若晴死亡
→ 玩家自然懷疑醫生
```

---

## 15. 21:14 Reporter Event

v0.1 的技術 demo：

```text
wakaharu_dies
→ reporter_missing
```

必須移除。

正式模型：

```text
16:40 confront_reporter
→ reporter.route 改變
→ Schedule 讓她在 19:50 到 old_lab
→ Hidden Conditions 在 21:14 被重新判斷
→ reporter_missing 或 safe
```

第一版 condition 可以保持最小：

```text
reporter_confronted == true
AND reporter.location == old_lab
→ reporter_missing
```

不要為了戲劇性提前加入尚未需要的 `lab_power` 等第三條件。

重要的是架構支援未來加入更多 hidden conditions。

Acceptance：

```text
confront_reporter
→ reporter_missing

no confrontation
→ reporter remains available
```

而且 18:31 的 victim 不影響這個判斷。

---

## 16. Information Trade-off: 周予安

不派去郵局：

```text
18:10 yuan at station_area
→ observable event: saw_reporter
→ player knowledge += reporter_was_near_station
```

派去郵局：

```text
18:10 yuan at post_office
→ saw_reporter event condition 不成立
19:10 postal anomaly report
→ player knowledge += postal_record_missing
```

不額外寫：

```text
if chose post office: hide reporter clue
```

情報差異必須從 Schedule / State 自然產生。

---

## 17. Narrative Layer

Narrative metadata 與 simulator logic 分離。

```ts
interface NarrativeMetadata {
  summary?: string;
  beat?: string;
}
```

規則：

- Simulator 可以完全忽略 narrative。
- Condition / Effect 不得讀取 narrative。
- Narrative 可以依 Event Variant 不同而改變。
- 長篇故事仍保留於 `docs/first-loop-story.md` 或未來專門 content files。

---

## 18. Simulation Ordering

所有世界變化都進入同一條 absolute-time orchestration。

同時間固定 precedence：

```text
1. Base Schedule Entry
2. Scheduled / Emitted Event
3. Player Action
```

理由：玩家必須先看到該時間點已經發生的世界狀態，再做出介入。

例如：

```text
15:00 evt_1500_sister_room
→ 15:00 send_yuan_to_post_office
```

而不是 Action 先發生。

同類型同分鐘則維持 insertion order。

### One-shot simulation

```text
1. 建立 Loop Range。
2. Enqueue range 內 Base Schedule Entries。
3. Enqueue authored scheduled Events。
4. Resolve requested Actions，依 absolute time 排序；同分鐘維持 caller order。
5. Simulator 逐分鐘順序處理 Schedule → Event → Action。
6. Event / Action 可以 enqueue 未來 emitted events。
7. 到 Loop end 停止。
```

手動 `createSimulation()` API 仍保留。

---

## 19. Data Model Additions

### Loop

```ts
interface LoopDefinition {
  id: string;
  range: {
    start: StoryTime;
    end: StoryTime;
  };
  reset_policy: 'at_range_end';
}
```

### Schedule

```ts
interface ScheduleDefinition {
  character: string;
  entries: ScheduleEntryDefinition[];
}

interface ScheduleEntryDefinition {
  id: string;
  at: StoryTimeInput;
  when?: Condition;
  effects: Effect[];
  visibility?: Visibility;
  narrative?: NarrativeMetadata;
}
```

### Event / Variant

沿用 v0.1，新增：

```ts
visibility?: Visibility;
narrative?: NarrativeMetadata;
```

### History

新增：

```ts
day: number;
absoluteMinute: number;
visibility: Visibility;
kind: 'schedule' | 'player-action' | 'event' | 'effect' | 'delayed-effect';
```

Schedule skipped 記錄於 Full History，但不進 Player History。

---

## 20. Story File Structure

```text
story/
├─ manifests/
│  └─ first_loop.yaml
├─ loops/
│  └─ first_loop.yaml
├─ world/
│  └─ first_loop_initial.yaml
├─ schedules/
│  ├─ wakaharu.yaml
│  ├─ doctor.yaml
│  ├─ reporter.yaml
│  └─ yuan.yaml
├─ actions/
│  └─ first_loop_actions.yaml
└─ events/
   ├─ day_01_1420.yaml
   ├─ day_01_1500.yaml
   ├─ day_01_1610.yaml
   ├─ day_01_1640.yaml
   ├─ day_01_1810.yaml
   ├─ day_01_1818.yaml
   ├─ day_01_1831.yaml
   ├─ day_01_1910.yaml
   ├─ day_01_2030.yaml
   ├─ day_01_2114.yaml
   ├─ day_01_2240.yaml
   ├─ day_01_2359.yaml
   └─ day_02_0000_loop_end.yaml
```

醫生 17:40 / 17:58 / 18:05 等生活軌跡改由 Schedule 表達，不再為每一個移動建立 Event。

這是 v0.1 → v0.2 很重要的資料模型修正。

### Manifest

```yaml
loop: loops/first_loop.yaml
world: world/first_loop_initial.yaml
actions: actions/first_loop_actions.yaml
schedules:
  - schedules/wakaharu.yaml
  - schedules/doctor.yaml
  - schedules/reporter.yaml
  - schedules/yuan.yaml
events:
  - events/day_01_1420.yaml
  - events/day_01_1500.yaml
  - events/day_01_1610.yaml
  - events/day_01_1640.yaml
  - events/day_01_1810.yaml
  - events/day_01_1818.yaml
  - events/day_01_1831.yaml
  - events/day_01_1910.yaml
  - events/day_01_2030.yaml
  - events/day_01_2114.yaml
  - events/day_01_2240.yaml
  - events/day_01_2359.yaml
  - events/day_02_0000_loop_end.yaml
```

---

## 21. Author View vs Player View

### Author / Debug View

可以看到：

```text
Base Schedule
Effective Schedule
Hidden World State
Event Conditions
Matched / Failed Conditions
Hidden Events
Full Worldline History
```

### Player View

只看到：

```text
自己的 Action
observable Event
已取得的 Facts
Event Card / Timeline 可見內容
```

Player View 不顯示：

```text
「你因為 16:40 拆穿記者，所以觸發 21:14 失蹤」
```

即使 Author View 完整知道這條因果。

---

## 22. First Loop Acceptance Scenarios

### A — Baseline worldline

無 Story Action。

```text
18:10 yuan sees reporter
18:18 wakaharu gives incomplete warning
18:31 wakaharu_dies
19:10 postal event absent
21:14 reporter missing absent
23:59 bells
Day 1 00:00 loop_end
```

### B — Send Yuan to post office

```text
15:00 send_yuan_to_post_office
→ yuan assignment changes
→ 18:10 yuan is not at station
→ reporter sighting absent
→ 19:10 postal anomaly observable
```

### C — Show letter to Wakaharu

```text
16:10 show_letter_to_wakaharu
→ 18:18 warning_revealed
→ player learns "18:31 不是死亡時間"
```

### D — Confront reporter

```text
16:40 confront_reporter
→ reporter route changes
→ 19:50 reporter reaches old_lab through schedule
→ 21:14 reporter_missing
```

Player History 不顯示 19:50 hidden movement。

### E — Reporter causality decoupled from 18:31

```text
confront_reporter + protect_wakaharu
→ 18:31 may become doctor_dies
→ 21:14 reporter_missing still occurs
```

與：

```text
no confrontation + baseline
→ 18:31 wakaharu_dies
→ 21:14 reporter_missing does not occur
```

### F — Debug schedule override

```text
stop_doctor
→ doctor.route = stay_hospital
→ 17:40+ station schedule entries skipped
→ doctor remains hospital-side
```

Base Schedule 定義本身保持不變。

### G — Cross-midnight

```text
23:59 bells
<
Day 1 00:00 loop_end
```

History absoluteMinute 單調不減。

### H — Hidden causality

Author History：

```text
16:40 confront_reporter
19:50 reporter enters old_lab
21:14 reporter_missing
```

Player History：

```text
16:40 confront_reporter
21:14 reporter_missing
```

用測試保證 hidden schedule entry 不洩漏到 Player View。

---

## 23. Worldline Diff Acceptance

至少驗證：

### Reporter Diff

```text
Worldline A                    Worldline B
16:40 confront                16:40 no confront
19:50 old_lab [hidden]        19:50 normal route [hidden]
21:14 missing              →  21:14 no event
```

Player Diff 不直接顯示 hidden 19:50 root cause。

### Yuan Diff

```text
Worldline A                    Worldline B
15:00 post office             15:00 baseline
18:10 no sighting          →  18:10 sees reporter
19:10 postal anomaly       →  19:10 no postal event
```

Diff 必須由 simulator-generated history 產生，不建立手寫 fixture worldlines。

---

## 24. Validation Requirements

延續 v0.1 validation，新增：

- Loop range start 必須早於 end。
- `StoryTime.day` 必須為非負整數。
- Schedule Entry 必須位於 Loop Range 內。
- Player Action 必須位於 Loop Range 內。
- Scheduled Event 必須位於 Loop Range 內。
- emitted event 不得排入目前時間之前。
- Schedule ID 在同一 character 內不可重複。
- Manifest 不可重複引用同一 schedule / event。
- Schedule character 必須存在於 initial world state。
- Schedule `when` path 必須存在於 initial schema/state path set。
- History absoluteMinute 必須單調不減。
- 同時間 precedence 必須保持 Schedule → Event → Action。
- Narrative / visibility metadata 不參與 condition state path validation。
- `visibility` 僅允許 `observable | hidden | debug`。

v0.2 不做 general unreachable-event static analysis。

---

## 25. Testing Strategy

TDD 順序：

```text
StoryTime
→ Loop Range
→ Schedule Queue / ordering
→ Conditional Schedule Entry
→ Player Action schedule override
→ Full History / Player History projection
→ Manifest loader
→ Real first-loop schedules
→ Yuan information trade-off
→ Reporter hidden delayed chain
→ 18:31 event
→ Cross-midnight loop end
→ Worldline Diff
→ Viewer integration
```

必須直接測真實 `story/*.yaml`，不能只測 hardcoded fixtures。

---

## 26. Scope

### In scope

- 一個完整 Loop Range：Day 0 14:20 → Day 1 00:00。
- Loop Definition。
- 四名核心 NPC Base Schedule。
- State-driven schedule overrides。
- Hidden / Observable visibility。
- Full History / Player History 分離。
- 三個第一輪 Story Actions。
- 兩個 debug intervention actions。
- 18:31 世界線變化。
- 21:14 hidden causal chain。
- 周予安情報 trade-off。
- Cross-midnight StoryTime。
- Manifest loader。
- Author / Player projection foundation。

### Out of scope

- 第二個 Loop 的 runtime。
- 真正 reset world state。
- Loop ID progression。
- 跨 Loop Knowledge persistence。
- 玩家自動畫 causal edge。
- 自動因果推理 / hypothesis engine。
- 完整 Event Card / Truth Card engine。
- Relationship / Trust 數值系統。
- 通用任務系統。
- 完整 NPC AI。
- LLM NPC。
- Offline real-time synchronization。
- 完整 Visual Novel renderer。
- 隨機事件。

---

## 27. Migration from v0.1

1. 保留 v0.1 deterministic Event Resolver / Condition AST / Effect Executor。
2. `StoryTimeInput` 取代純 `HH:mm` 假設。
3. 新增 Loop Range validation。
4. 新增 Schedule Definition 與 Schedule Queue Item。
5. 將 17:40 / 17:58 / 18:05 等 NPC 行程從劇情 Event 移至 schedules。
6. `simulate()` 改為 Schedule → Event → Action 的 chronological orchestration。
7. `wakaharu_dies → reporter_missing` demo delayed effect 移除。
8. `confront_reporter` 改變 reporter route。
9. Reporter schedule 使她進 old_lab。
10. 21:14 Event 依當下 Hidden World Conditions 判斷。
11. History 增加 visibility 並建立 Player History projection。
12. Story loader 改為 manifest 驅動。
13. Viewer 仍保留 Author Debug 能力；Player View 僅使用 observable projection。

---

## 28. Definition of Done

v0.2 完成時，必須可以從真實 Story YAML 重播第一個 Loop，並證明：

```text
NPC 沒有玩家介入時會依自己的 Schedule 生活。

玩家的行動改的是 world state / route，
不是直接指定故事結果。

Schedule 因 state 改變而自然偏離。

Hidden condition 可以在玩家不知道的情況下成立。

玩家可能數小時後才看到結果。

Author 可以看完整真正因果；
Player 只能看到自己實際觀察到的片段。

同樣 Event 在不同 world state 下可以得到不同 Variant。

Loop 是時間 Range，不等於一天。
```

第一版只需把這一個 Loop 做好，不擴充第二輪或多日內容。
