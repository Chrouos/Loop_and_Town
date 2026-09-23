# First Loop Story Graph v0.2 Design

**Date:** 2026-09-23  
**Status:** Revised draft for review  
**Depends on:** `feature/worldline-simulator-v0.1` / PR #2  
**Source material:** `docs/first-loop-story.md`, `docs/core-gameplay.md`, `docs/event-graph-spec.md`, `docs/worldbuilding.md`

---

## 1. Goal

把 Worldline Simulator v0.1 推進成第一個真正符合遊戲核心的完整 Loop。

核心模型：

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
Full Worldline History
↓
Player 只看到可觀察到的結果
```

第一版只做一個 Loop：

```text
Day 0 14:20
→ NPC 按自己的生活軌跡運作
→ 玩家做少量介入
→ 某些 Schedule / State 偏移
→ 隱藏條件改變
→ 延遲結果出現
→ Day 1 00:00 Loop Range 結束
```

Loop 不等於一天。這只是第一個 Loop 剛好跨越 Day 0 下午到 Day 1 午夜。

---

## 2. Design Principles

1. **Loop is a range**：Loop 是作者定義的時間範圍，不寫死成 24 小時。
2. **NPC live without the player**：核心 NPC 有 Base Schedule，玩家離開也會照常行動。
3. **Actions change conditions, not endings**：玩家改 route / location / flags，不直接選 `wakaharu_dies`。
4. **Base Schedule is immutable**：世界線偏移不修改 authored schedule，而是讓某些 entry 因 state 不同而執行或跳過。
5. **Hidden causality is normal**：真正 Condition 只存在於 World Truth；Player View 不揭露完整因果。
6. **Delayed consequence is first-class**：玩家可能數小時後才看到行動後果。
7. **The world must remain understandable**：少數行為影響核心條件，不讓每個小動作都造成不可預測蝴蝶效應。
8. **One Loop first**：先把第一輪做到可玩、可推理，再做 reset、Loop 2、跨輪知識。

---

## 3. Four Layers

### 3.1 World Truth

Simulator 的完整真實狀態。

例如：

```text
flags.reporter_confronted = true
characters.reporter.route = hotel_then_old_lab
characters.reporter.location = old_lab
characters.doctor.location = old_station
```

玩家不一定知道這些值。

### 3.2 NPC Base Schedule

NPC 原本會怎麼生活。

```text
17:40 doctor leaves hospital
17:58 doctor reaches old station
18:10 yuan passes station area
```

Base Schedule 是 Baseline Worldline 的來源。

### 3.3 Worldline Overrides

玩家行動或事件改變 World State，使後續 Base Schedule Entry 的條件成立或失效。

例如：

```text
17:35 stop_doctor
→ characters.doctor.route = stay_hospital
→ 17:40 / 17:58 前往車站的 entries 被 skipped
```

不直接 patch authored schedule。

### 3.4 Player Knowledge

v0.2 不建立獨立 Knowledge Graph。

Player Knowledge 先定義為：

```text
Player Actions
+ observable History Entries
```

也就是玩家只能知道實際被揭露或觀察到的事情。

例如 Author 知道：

```text
16:40 confront reporter
17:30 reporter returns hotel
19:50 reporter enters old lab
21:14 reporter missing
```

Player 只知道：

```text
16:40 confront reporter
21:14 reporter missing
```

跨 Loop 自動保存、假說推理、知識圖譜留到後續版本。

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

### Range semantics

v0.2 使用 **end inclusive**：

```text
start <= item.at <= end
```

因此 Day 1 00:00 可以記錄 `loop_end`。

規則：

- range 之外的 Schedule / Event / Action 不執行。
- `runUntil()` 不得越過 Loop end。
- 到 end 時先完成該分鐘的合法 Queue Item，再結束 simulation。
- v0.2 不真的 reset world state。
- v0.2 不啟動下一個 Loop。
- `reset_policy` 第一版只有 `at_range_end`。

未來可以擴充條件式 reset / loop escape，但不是本版需求。

---

## 5. Story Time

```ts
interface StoryTime {
  day: number;
  time: string;
}

type StoryTimeInput = string | StoryTime;
```

舊格式：

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

例：

```text
Day 0 23:59 = 1439
Day 1 00:00 = 1440
```

Queue、History、Diff 都以 `absoluteMinute` 排序。

---

## 6. Initial World State

第一個 Loop 的最小狀態：

```yaml
clock:
  day: 0
  time: "14:20"

characters:
  wakaharu:
    location: cafe
    route: old_station
    status: alive

  doctor:
    location: hospital
    route: old_station
    status: alive

  reporter:
    location: town
    route: normal
    status: available

  yuan:
    location: with_player
    assignment: none
    status: available

flags:
  wakaharu_saw_letter: false
  reporter_confronted: false
  yuan_sent_to_post_office: false
  old_case_1831_revealed: false
  sister_warning_found: false
  midnight_bells_heard: false
  loop_ended: false
```

只建立第一輪真正需要的 state path。

不加入 Trust score、Inventory、Knowledge Graph 等泛化系統。

---

## 7. NPC Base Schedule

新增 `story/schedules/`。

第一版只替四名會影響核心因果的 NPC 建 Schedule：

- 許若晴 `wakaharu`
- 陳柏勳 `doctor`
- 葉庭安 `reporter`
- 周予安 `yuan`

### Schedule Definition

```yaml
character: doctor
entries:
  - id: doctor_leave_hospital
    at:
      day: 0
      time: "17:40"
    when:
      path: characters.doctor.route
      op: eq
      value: old_station
    effects:
      - set:
          path: characters.doctor.location
          value: road_to_old_station
    visibility: hidden

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
    visibility: hidden
```

Schedule Entry condition 不成立時：

- 不執行 effects。
- Full History 記錄為 skipped。
- Player History 不顯示 skipped entry。

---

## 8. Base Schedule vs Effective Schedule

```text
Base Schedule
+ Current World State
↓
condition evaluation
↓
Applied / Skipped Schedule Entries
↓
Effective Worldline
```

v0.2 不新增：

```text
cancel_schedule_entry
replace_schedule
patch_schedule
```

玩家只改 state，例如：

```text
characters.doctor.route = stay_hospital
characters.yuan.assignment = post_office
characters.reporter.route = hotel_then_old_lab
```

後續 Schedule Entry 的 `when` 自然決定結果。

---

## 9. Core NPC Baselines

### 許若晴

```text
14:20 cafe
16:10 cafe
17:52 leave cafe
18:05 old_station
18:18 old_station
18:31 old_station
```

`protect_wakaharu` 可把 `route = home`，使前往車站的 entries skipped。

### 陳柏勳

```text
14:20 hospital
17:40 leave hospital
17:58 old_station
18:05 meet wakaharu
18:20 route back toward hospital
```

`stop_doctor` 可把 `route = stay_hospital`。

### 葉庭安

Baseline：

```text
16:40 meets player
17:30 normal route
19:50 does not enter old lab
21:14 available
```

若玩家拆穿她：

```text
route = hotel_then_old_lab
17:30 hotel
19:50 old_lab
21:14 reporter event evaluates true conditions
```

### 周予安

Baseline：

```text
15:00 with player
17:50 shopping_street
18:10 station_area
18:30 clock_shop
```

若被派去郵局：

```text
assignment = post_office
17:50 post_office
18:10 post_office
18:30 returning
19:10 returns with postal information
```

---

## 10. Hidden World Conditions

Hidden causality 不需要新的神祕 DSL。

它就是正常 Condition，只是不投影到 Player View。

第一輪 21:14 正式條件保持最小：

```yaml
when:
  all:
    - path: flags.reporter_confronted
      op: eq
      value: true
    - path: characters.reporter.location
      op: eq
      value: old_lab
```

玩家前期不知道這兩個條件共同導致結果。

未來 Event 可以增加第三、第四個 hidden condition，但 v0.2 不先加入沒有劇情用途的條件。

---

## 11. Visibility

```ts
type Visibility = 'observable' | 'hidden' | 'debug';
```

- `observable`：本輪設計上玩家可知道，進 Player History。
- `hidden`：世界真實發生，但 Player History 不顯示。
- `debug`：只供 Author / Debug tooling 使用。

v0.2 的 visibility 是作者明確標註，不做「依玩家距離自動判斷是否看得到」的 perception engine。

Event / Variant / Schedule Entry 可帶：

```yaml
visibility: observable
narrative:
  summary: "葉庭安提早離開。"
  beat: unease
```

---

## 12. History Separation

### Full Worldline History

記錄：

```text
schedule applied
schedule skipped
player action
event resolution
effect
delayed / emitted event
visibility
state changes
```

這是 Author Truth。

### Player History

由 Full History projection 產生：

```text
player actions
+ visibility == observable 的 entries
```

Player History 不顯示：

- hidden condition expressions
- hidden NPC movement
- skipped schedule entries
- debug-only entries

---

## 13. Narrative Layer

```ts
interface NarrativeMetadata {
  summary?: string;
  beat?: string;
}
```

規則：

- Simulator 可以忽略 narrative。
- Condition / Effect 不得引用 narrative。
- Variant 可有不同 summary。
- 長篇對白仍留在 `docs/first-loop-story.md` 或未來 narrative content files。

Narrative 是表現層，不是世界規則。

---

## 14. First Loop Causal Spine

```text
Day 0
14:20  回到灰潮鎮
15:00  姊姊房間
16:10  許若晴咖啡店
16:40  葉庭安出現
17:40  醫生 Schedule：離院
17:52  若晴 Schedule：前往舊車站
17:58  醫生 Schedule：抵達舊車站
18:05  醫生與若晴碰面 / 信封交接
18:10  周予安可能目擊葉庭安
18:18  若晴最後一次對話
18:31  車站異常事件
19:10  周予安可能帶回郵局情報
20:30  五年前舊案
21:14  葉庭安可能失蹤
22:40  姊姊警告
23:59  鐘聲

Day 1
00:00  loop_end
```

17:40 / 17:52 / 17:58 / 19:50 這類 NPC 移動屬於 Schedule。

18:05 / 18:31 / 21:14 這類有劇情意義、會依條件改變結果的節點屬於 Event。

---

## 15. First Loop Player Actions

### `send_yuan_to_post_office`

Day 0 15:00：

```text
characters.yuan.assignment = post_office
flags.yuan_sent_to_post_office = true
```

結果不是直接「給郵局線索」，而是先改變他的生活軌跡。

### `show_letter_to_wakaharu`

Day 0 16:10：

```text
flags.wakaharu_saw_letter = true
```

18:18 Event 因此可能採用 `warning_revealed` Variant。

### `confront_reporter`

Day 0 16:40：

```text
flags.reporter_confronted = true
characters.reporter.route = hotel_then_old_lab
```

玩家當下只知道她改變態度並離開。

### Debug-only

```text
protect_wakaharu
stop_doctor
```

保留給作者模擬第二輪可能世界線；第一輪玩家 UI 不解鎖。

---

## 16. Yuan Information Trade-off

Baseline：

```text
18:10 yuan.location == station_area
→ evt_1810_yuan_station_observation / saw_reporter
→ observable
```

派去郵局：

```text
18:10 yuan.location == post_office
→ saw_reporter condition false
→ 19:10 evt_1910_yuan_information / postal_anomaly
→ observable
```

不能寫成：

```text
if player chose post office:
  hide reporter clue
```

情報取捨必須由角色實際位置自然產生。

---

## 17. 18:31 Event

`evt_1831_station` 依當下 state 決定 Variant。

```text
wakaharu at old_station
→ wakaharu_dies

wakaharu absent + doctor at old_station
→ doctor_dies

wakaharu absent + doctor absent
→ no_death
```

第一輪 Baseline：

```text
wakaharu_dies
```

玩家第一輪因此形成 False Causality：

```text
醫生秘密離院
→ 與若晴見面
→ 若晴死亡
→ 「醫生殺了她？」
```

---

## 18. 21:14 Reporter Event

v0.1 技術 demo 的：

```text
wakaharu_dies
→ reporter_missing
```

必須移除。

正式因果：

```text
16:40 confront_reporter
→ reporter.route = hotel_then_old_lab
→ 19:50 hidden Schedule Entry moves reporter to old_lab
→ 21:14 Event evaluates current World Truth
→ reporter_missing
```

如果沒有 confront：

```text
reporter.route = normal
→ 19:50 old_lab entry skipped
→ 21:14 missing condition false
```

18:31 的 victim 不影響這條因果。

---

## 19. Simulation Ordering

所有 Queue Item 使用 absolute time。

同時間 precedence：

```text
1. Schedule Entry
2. Event
3. Player Action
```

同類型同分鐘維持 insertion order。

理由：NPC 先完成該分鐘自然發生的行為，世界事件再依當下 state resolve，最後玩家才對看到的情境做當分鐘介入。

例如：

```text
15:00 evt_1500_sister_room
→ 15:00 send_yuan_to_post_office
```

如果同分鐘沒有 Schedule Entry，Event 自然就是第一個可見項目。

### One-shot simulation

```text
1. 建立 Loop Range。
2. Enqueue Base Schedule Entries。
3. Enqueue authored scheduled Events。
4. Resolve requested Actions 並按 absolute time 排序；同分鐘維持 caller order。
5. 依 precedence 執行 Queue。
6. Schedule / Event / Action 都可以改 World State。
7. Event / Action 可以 enqueue 未來 emitted events。
8. 執行到 Loop end inclusive 後停止。
```

---

## 20. Data Model Additions

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

沿用 v0.1 並新增：

```ts
visibility?: Visibility;
narrative?: NarrativeMetadata;
```

### History

```ts
day: number;
absoluteMinute: number;
visibility: Visibility;
kind: 'schedule' | 'player-action' | 'event' | 'effect' | 'delayed-effect';
status?: 'applied' | 'skipped';
```

---

## 21. Story File Structure

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
   ├─ day_01_1805.yaml
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

17:40 / 17:52 / 17:58 / 19:50 等 NPC 行程放在 schedules，而不是 events。

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
  - events/day_01_1805.yaml
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

Manifest 列出成員，不決定執行順序；順序仍由 StoryTime + Queue precedence 決定。

---

## 22. Author View vs Player View

### Author / Debug View

可看到：

- Base Schedule
- applied / skipped Schedule Entry
- Hidden World State
- Event Conditions
- Event Variant
- hidden entries
- Full Worldline History

### Player View

只看到：

- 自己的 Actions
- observable entries
- observable narrative summary
- 由 observable history 形成的 Timeline / Diff

Player View 不顯示：

```text
「因為你 16:40 拆穿她，19:50 她去了研究所，所以 21:14 失蹤」
```

玩家必須跨 Loop 自己驗證這個假說。

---

## 23. Acceptance Scenarios

### A — Baseline

無 Story Action：

```text
18:10 yuan sees reporter
18:18 incomplete warning
18:31 wakaharu_dies
19:10 postal event absent
21:14 reporter missing absent
23:59 bells
Day 1 00:00 loop_end
```

### B — Yuan post office

```text
15:00 send_yuan_to_post_office
→ assignment changes
→ 18:10 station sighting absent
→ 19:10 postal anomaly observable
```

### C — Show letter

```text
16:10 show_letter_to_wakaharu
→ 18:18 warning_revealed
→ observable narrative contains "18:31 不是死亡時間"
```

### D — Confront reporter

```text
16:40 confront_reporter
→ route changes
→ 19:50 hidden schedule moves reporter to old_lab
→ 21:14 reporter_missing
```

Player History 不包含 hidden 19:50 movement。

### E — Reporter causality independent from 18:31

```text
confront_reporter + protect_wakaharu
→ 18:31 may resolve doctor_dies
→ 21:14 reporter_missing still occurs
```

以及：

```text
no confrontation + baseline
→ 18:31 wakaharu_dies
→ 21:14 reporter_missing absent
```

### F — Schedule override

```text
stop_doctor
→ doctor.route = stay_hospital
→ old-station schedule entries skipped
→ authored Base Schedule remains unchanged
```

### G — Cross-midnight

```text
Day 0 23:59 bells
<
Day 1 00:00 loop_end
```

`absoluteMinute` 單調不減。

### H — Hidden causality projection

Author History：

```text
16:40 confront reporter
19:50 reporter enters old_lab
21:14 reporter missing
```

Player History：

```text
16:40 confront reporter
21:14 reporter missing
```

---

## 24. Worldline Diff Acceptance

### Reporter Diff

Author Diff 可以看：

```text
A                              B
16:40 confront                 16:40 no confront
19:50 old_lab [hidden]      →  normal route [hidden]
21:14 missing              →  no missing event
```

Player Diff 只呈現玩家真的知道的差異，不洩漏 19:50 hidden root cause。

### Yuan Diff

```text
A                              B
15:00 post office              baseline
18:10 no sighting          →  sees reporter
19:10 postal anomaly       →  no postal event
```

Diff 必須來自 simulator-generated history，不使用手寫 fixture worldlines。

---

## 25. Validation Requirements

延續 v0.1 validation，新增：

- Loop start 必須嚴格早於 Loop end。
- `StoryTime.day` 必須是非負整數。
- Schedule / Action / scheduled Event 必須滿足 `start <= at <= end`。
- emitted event 不得排入 current time 之前。
- Schedule Entry ID 在同一 character 內不可重複。
- Manifest 不可重複引用同一 schedule / event。
- Schedule character 必須存在於 initial state。
- Schedule `when` path 必須是合法 state path。
- `visibility` 只允許 `observable | hidden | debug`。
- History `absoluteMinute` 必須單調不減。
- 同分鐘 precedence 固定為 Schedule → Event → Action。
- narrative / visibility 不參與 condition state-path validation。

v0.2 不做 general unreachable-event static analysis。

---

## 26. TDD Order

```text
StoryTime
→ Loop Range
→ Schedule Queue + precedence
→ Conditional Schedule Entry
→ Schedule override through World State
→ Full History / Player History projection
→ Manifest loader
→ Real first-loop initial state + schedules
→ Yuan information trade-off
→ Reporter hidden causal chain
→ 18:31 variants
→ Cross-midnight loop end
→ Worldline Diff
→ Viewer integration
```

Acceptance tests 必須直接載入真實 `story/*.yaml`。

---

## 27. Scope

### In scope

- 一個完整 Loop Range：Day 0 14:20 → Day 1 00:00。
- Loop Definition。
- 四名核心 NPC Base Schedule。
- State-driven schedule overrides。
- Hidden / Observable visibility。
- Full History / Player History projection。
- 三個第一輪 Story Actions。
- 兩個 debug intervention actions。
- 18:31 世界線變化。
- 21:14 hidden causal chain。
- 周予安情報 trade-off。
- Cross-midnight StoryTime。
- Manifest loader。
- Author / Player projection foundation。

### Out of scope

- Loop 2 runtime。
- 真正 world reset。
- Loop ID progression。
- 跨 Loop Knowledge persistence。
- 自動 causal edge / hypothesis engine。
- Relationship / Trust engine。
- General NPC AI / planner。
- Perception / distance-based observation engine。
- 完整 Event Card / Truth Card runtime。
- Offline real-time synchronization。
- 完整 VN renderer。
- LLM NPC。
- 隨機事件。

---

## 28. Migration from v0.1

1. 保留 deterministic Event Resolver / Condition AST / Effect Executor。
2. `StoryTimeInput` 取代純 minute-of-day 假設。
3. 新增 Loop Range validation。
4. 新增 Schedule Definition / Schedule Queue Item。
5. NPC 移動從 Event 移到 Schedule。
6. `simulate()` 改為 Schedule → Event → Action orchestration。
7. 移除 `wakaharu_dies → reporter_missing` demo 因果。
8. `confront_reporter` 只改 reporter route / flags。
9. Reporter hidden Schedule 使她在條件成立時到 old_lab。
10. 21:14 Event 讀當下 World Truth。
11. History 增加 visibility / schedule status。
12. 新增 Player History projection。
13. Story loader 改由 manifest 驅動。
14. Viewer 保留 Author Debug；Player-facing Timeline / Diff 使用 observable projection。

---

## 29. Definition of Done

v0.2 完成時，必須能從真實 Story YAML 重播第一個 Loop，並證明：

```text
NPC 沒有玩家介入時會依自己的 Schedule 生活。

玩家改變的是 route / state / condition，
不是直接指定劇情結果。

Base Schedule 不被修改；
世界線差異來自 applied / skipped entries。

玩家可以無意中改變 hidden condition，
數小時後才看到結果。

Author 能看到完整真正因果；
Player 只能看到實際被揭露的片段。

18:31 與 21:14 是不同因果鏈。

Loop 是時間 Range，不等於一天。
```

第一版只把這一個 Loop 做完整，不擴充第二輪或多日內容。
