# Narrative Foundation v0.1 Design

日期：2026-09-24  
狀態：待審閱  
基底：`feature/story-simulation-v0.2`  

## 1. 目的

建立《灰潮鎮：第七封信》的敘事基礎層，讓後續長篇故事不再依賴 UI 內的硬編碼文案，而是由一致的人物設定、關係、知識、生活行程與敘事場景共同驅動。

這一版不直接製作完整 Player UI，也不擴寫 Loop 02。目標是先把「人物是誰、彼此什麼關係、各自知道什麼、原本會怎麼生活、玩家如何在小說中經歷世界」整理成可維護的 Source of Truth。

核心體驗：

> 玩家第一眼應該覺得自己正在讀一部會自己運作的小說，而不是操作一個推理資料庫。

新版設定若與舊 `player-first-loop`、`first-loop-story.md`、舊 `story.ts` 或其他 prototype 衝突，**以本設計與之後正式資料為準**。舊內容可以刪除、重寫或遷移，不要求向後相容其敘事結構。

---

## 2. 核心模型

```text
Character Bible
+ Relationship Graph
+ Knowledge Matrix
+ Character Base Schedules
+ Narrative Scenes
+ Diegetic Idle Activities
+ Artifacts
        ↓
Story Simulation / World Truth
        ↓
Observable Narrative Projection
        ↓
Player Narrative Renderer
```

三個概念必須分離：

```text
Event
= 世界裡真正發生了什麼

Narrative Scene
= 玩家如何經歷／閱讀這件事

Activity
= 這段時間主角正在做什麼，因此世界時間可以前進
```

Narrative Scene 不是 Event；泡茶、整理房間、做飯、看書也不應被塞進 Event Graph。

---

## 3. 敘事視角與寫作規則

### 3.1 第一人稱

正文固定使用第一人稱「我」。

例如：

> 我又看了一次郵戳。昨天。
>
> ……不可能。
>
> 姊姊死了五年。

按鈕不使用「你可以……」，而是直接寫動作：

```text
拆開信封
回覆予安
繼續查資料
現在出門
```

### 3.2 自我獨白

主角可以有情緒、回憶與有限推理，但不能替玩家完成核心推理。

允許：

> 我不想再去那個車站。

> 郵戳是真的。寄件人卻不可能是真的。至少，其中一件事有問題。

不允許：

> 所以一定有人模仿姊姊寄信。

後者屬於玩家應該自己建立的假說。

### 3.3 人名首次出場規則

任何重要角色第一次出現時，正文不得假設玩家已經知道他是誰。第一次出場至少交代：

- 主角和此人的既有關係。
- 主角對他的第一印象／記憶。
- 當下足以理解對話的背景。

例如：

> 周予安。高中同學，也是我離開灰潮鎮後少數還偶爾聯絡的人。

之後才可以只寫「予安」。

---

## 4. 新版故事起點

### 4.1 回鄉原因

正式採用：

> 主角五年後回到灰潮鎮，是為了整理長期空置的老家，準備出售。

她**不是因為收到姊姊的信才回來**。

這讓回鄉、整理房間、遇到舊朋友、看到姊姊的生活痕跡都能先以普通生活自然發生。

神祕信件是在回到老家之後才被發現。

### 4.2 Prologue 情緒曲線

```text
普通返鄉生活
→ 懷舊
→ 和舊識重新接觸
→ 整理房屋
→ 安靜的生活時間
→ 姊姊留下的生活痕跡
→ 微小的不協調
→ 發現不可能存在的信
→ 主線正式開始
```

前段可以包含對主線沒有直接因果作用的生活內容。這些內容的功能是建立人物、地點與「我曾經屬於這裡」的感覺，而不是全部變成線索。

---

## 5. Prologue 14:20–16:10

這一段是第一輪正式小說開場的基準節奏。具體文字日後可以調整，但功能與資訊順序固定。

### 14:20｜抵達灰潮鎮

- 下火車、拖行李。
- 描寫月台、空氣、舊招牌與五年後的小變化。
- 不提輪迴、不提 18:31。
- 主角知道姊姊五年前死亡，但不主動進入案件回憶。

### 14:25–14:40｜普通生活

可安排數個沒有核心因果作用的小事件，例如：

- 買水或咖啡。
- 買晚餐材料。
- 發現以前常去的店換了招牌。
- 便利商店老闆一時把主角認成林知夏。
- 看見以前搭公車的站牌被移走。

這些事件不應自動產生 Evidence Card。

### 14:40｜周予安第一次正式出場

目的：先讓玩家認識「朋友」，而不是「調查助手」。

內容以普通寒暄為主：

- 五年沒見。
- 工作與近況。
- 主角這次回來是整理老家、準備出售。
- 鐘錶店還在。
- 可以自然帶出林知夏的一點生活記憶，但不談神祕事件。

### 15:00｜回到老家

主角開始整理房屋：

- 開窗。
- 清灰塵。
- 搬紙箱。
- 丟掉過期用品。
- 翻到自己以前留下的東西。
- 看見姊姊的生活痕跡。

這段主要建立家庭感與失去姊姊後留下的空洞。

### 15:30｜第一個 Diegetic Idle Activity

例如：

> 整理了一陣子，我的手上全是灰。
>
> 反正房仲傍晚才會回電話。
>
> 我泡了杯茶，從書架抽了一本以前沒看完的小說。

進入：

```text
Activity: rest_and_read
```

世界時間開始前進，其他 NPC 照自己的 Schedule 行動。

### 15:50｜回到生活場景

主角重新整理門口或堆積郵件。

### 約 16:00｜發現信件

第一次真正的不可能事件：

```text
寄件人：林知夏
郵戳：昨天
```

Artifact 以真正信封／信紙形式呈現，不先顯示「重要句子」。

讀信後，主角可以有短暫自我獨白，但不替玩家解釋成輪迴。

### 16:10 之後

正式進入第一輪主線。既有 Story Simulation 的事件時間可以在實作階段依新版 Prologue 重新對齊；若舊 16:10 事件與新版小說節奏衝突，以新版敘事安排為準，並同步更新 simulator story data 與 acceptance tests。

---

## 6. Character Bible

### 6.1 Source of Truth

重要人物要有正式 Character Definition，建議資料結構：

```text
story/characters/
  protagonist.yaml
  zhixia.yaml
  yuan.yaml
  wakaharu.yaml
  doctor.yaml
  reporter.yaml
  detective.yaml
```

人物背景不得只存在於小說段落或 React component。

### 6.2 Character Definition

最小欄位：

```yaml
id: yuan
name: 周予安
age: 27

identity:
  occupation: 鐘錶店店主
  hometown: 灰潮鎮

background:
  summary: ...
  history: []

personality:
  traits: []
  habits: []
  dislikes: []

speech:
  tone: casual
  calls:
    protagonist: ...
    zhixia: ...

knowledge:
  initial: []
  hidden: []

secrets: []

schedule_ref: schedules/yuan.yaml
```

### 6.3 第一版核心人物

至少建立：

1. 主角。
2. 林知夏。
3. 周予安。
4. 許若晴。
5. 陳柏勳。
6. 葉庭安。
7. 周志遠。

### 6.4 主角設定原則

主角要有足夠人格支撐第一人稱小說，但不能把玩家鎖死成完全固定性格。

固定：

- 五年前因姊姊死亡離開灰潮鎮。
- 和周予安是高中舊識。
- 對老家與姊姊有複雜但未完全解決的情緒。
- 這次回來是整理老家準備出售。

避免過度固定：

- 不預設玩家對每個嫌疑人的最終態度。
- 不預設政治／道德立場。
- 不替玩家選擇核心推理結論。

---

## 7. Relationship Graph

### 7.1 關係是方向性的

```text
A 對 B 的感受 ≠ B 對 A 的感受
```

資料建議：

```yaml
- from: wakaharu
  to: zhixia
  type: attachment
  public: true
  summary: 把知夏視為姊姊般的重要存在

- from: zhixia
  to: wakaharu
  type: protective
  public: false
  summary: 知夏一直試圖讓若晴遠離研究所事件
```

### 7.2 關係可見層級

Relationship Graph 至少支援：

```text
Public
Author Truth
Player Known
```

- Public：一般人可知的身分／關係。
- Author Truth：完整作者設定。
- Player Known：玩家目前已合理得知的關係。

### 7.3 Character Graph Viewer

Author Viewer 新增 `Character Graph`，與 Event Graph 分離。

主要能力：

- 人物節點。
- 有方向的 relationship edge。
- 點擊人物顯示 Character Card。
- 切換 Public / Author Truth / Player Known。
- 顯示 Background、Relationships、Knowledge、Secrets、Schedule、Narrative appearances。

Character Graph 不直接修改資料；YAML 仍是 Source of Truth。

---

## 8. Knowledge Matrix

### 8.1 目的

避免角色說出自己不可能知道的資訊，也避免小說旁白提前洩漏 Player 尚未取得的 World Truth。

概念：

```text
World Truth
        ↓
Character Knowledge
        ↓
Character Dialogue / Action

World Truth
        ↓
Player Knowledge
        ↓
Narrative Projection
```

### 8.2 Knowledge Fact

建議每個重要知識有穩定 ID：

```yaml
id: fact_zhixia_dead_five_years
summary: 林知夏五年前死亡
```

角色引用 fact ID：

```yaml
knowledge:
  initial:
    - fact_zhixia_dead_five_years
```

### 8.3 Author Validation

Narrative Scene 若指定某角色直接說出一個 fact，author tooling 應能檢查該角色在該時間點是否具備此 Knowledge。

v0.1 不要求建立完整邏輯證明器，但至少要能做到：

- 未知 fact ID → validation error。
- 明確標記 dialogue requires fact，但角色無此 fact → author warning/error。
- Player narrative 不得自動讀取 hidden World Truth。

---

## 9. Character Base Schedule

既有 Story Simulation 已有 NPC Base Schedule。Narrative Foundation 擴充原則為：**主角也必須有 Base Schedule**。

概念：

> 如果今天完全沒有神祕事件，主角本來會怎麼過這一天？

例如：

```yaml
character_id: protagonist
entries:
  - at: { day: 0, time: "14:20" }
    activity: arrive_town
  - at: { day: 0, time: "14:35" }
    activity: buy_groceries
  - at: { day: 0, time: "15:00" }
    activity: clean_house
  - at: { day: 0, time: "15:30" }
    activity: rest_and_read
  - at: { day: 0, time: "17:20" }
    activity: prepare_dinner
  - at: { day: 0, time: "18:10" }
    activity: dinner
  - at: { day: 0, time: "19:00" }
    activity: sort_belongings
```

這些是 baseline life，不代表玩家一定照表走。

玩家介入、調查、外出或 observable event 可以 override 後續 Activity。

---

## 10. Diegetic Idle Activity

### 10.1 定義

玩家不是「等待遊戲跑時間」。

而是：

```text
主角正在生活／移動／調查
        ↓
這些事情需要時間
        ↓
世界在這段時間繼續運作
```

這就是 Diegetic Idle Activity。

### 10.2 Activity 類型

v0.1 只需要少量分類：

```text
life
  看書
  做飯
  整理房間

travel
  步行
  搭車

investigation
  查電腦
  翻資料
  前往現場

waiting
  等電話
  等人
  等某個時間
```

不建立 RPG 體力值或複雜技能系統。

### 10.3 Activity Definition

建議：

```yaml
id: research_postmark
category: investigation

duration:
  nominal_minutes: 32

presentation:
  start:
    - 我把筆電搬到桌上。
    - 先從昨天的郵件紀錄開始查。
  idle_label: 正在查資料……
  complete:
    - 搜尋結果裡，有一筆紀錄讓我停了下來。

interruptible: true
```

### 10.4 時間語意

Narrative Scene 本身不消耗模擬時間。

Activity 才會推進 World Time。

```text
Narrative Scene
    ↓
Activity starts
    ↓
Simulation advances
    ↓
Activity completes or is interrupted
    ↓
Narrative Scene
```

不在 UI 顯示「故事暫停／世界暫停」。對玩家而言只是閱讀與行動自然交替。

### 10.5 Interrupt

Observable Event 可以中斷 Activity：

```text
16:20–17:00 查資料
16:43 手機來電
→ Activity paused/interrupted
→ Narrative Scene
```

Hidden Event 不應中斷玩家：

```text
16:40 reporter leaves hotel [hidden]
```

玩家若在做飯，畫面仍只是做飯。

### 10.6 Activity 的代價

Activity 的主要資源是「時間」。

調查不是免費按鈕：

```text
查研究所資料
→ 花費世界時間
→ NPC schedule 照常前進
→ 可能錯過其他 observable event
```

前期不必精確告訴玩家「需要 32 分鐘」。可以用小說語言：

> 這大概得花一點時間。

玩家透過多輪逐漸理解各種行動的時間成本。

---

## 11. Narrative Scene

### 11.1 角色

Narrative Scene 負責小說呈現，不負責定義世界真相。

建議資料：

```yaml
id: scene_prologue_arrival
at: { day: 0, time: "14:20" }

trigger:
  type: observable_event
  ref: evt_1420_return_to_town

requirements:
  player_knows: []

blocks:
  - type: narration
    text: 火車進站時，我差點沒認出月台。
  - type: monologue
    text: 五年而已。原來可以變這麼多。

next:
  activity: walk_from_station
```

### 11.2 Scene Block

v0.1 可先支援：

```text
narration
monologue
dialogue
artifact
choice
```

避免把 CSS／React layout 細節塞入 story data。

### 11.3 Choice

Choice 表示主角下一個可採取的行動，不直接指定結局：

```yaml
- label: 現在去醫院
  action_ref: visit_hospital
```

Action 仍只改 state / schedule / activity，Event outcome 由 Simulator condition 決定。

---

## 12. Artifact

### 12.1 定義

Artifact 是世界裡真的存在、玩家可以閱讀的物件，例如：

- 信件。
- 手機訊息。
- 照片。
- 新聞。
- 舊案文件。
- 筆記。

### 12.2 Artifact 不等於 Evidence Snippet

淘汰舊設計：

```text
留下你認為重要的句子
xxx ＋
```

不再由系統預先挑好「重要句子」。

玩家首先取得的是完整 Artifact。

未來若要記錄片段，可使用：

- 選中文字後「記下」。
- 手動寫筆記。
- 把整份 Artifact 收入案卷。

但這不是 Narrative Foundation v0.1 的必要交付。

### 12.3 第七封信

新版 Artifact 必須支援實體信封與信紙的分層呈現：

```text
Scene
→ 看見信封
→ Artifact: envelope
→ 拆開
→ Artifact: letter
→ Scene reaction
```

玩家不會先看到 metadata panel 再看正文。

---

## 13. Player Narrative Layer

玩家主畫面優先級：

```text
1. 小說正文
2. 場景 Artifact
3. 當下行動
4. 很淡的時間／狀態提示
5. 案卷／人物／世界線等 secondary tools
```

不要重新出現：

```text
案卷 / 推理桌 / 世界線 / 存檔
```

四個同等重要的主導覽按鈕搶走閱讀注意力。

Author Viewer 與 Player Game 維持兩個不同用途的 surface。

---

## 14. Character Card（Player）

Character Bible 是 Author Truth；玩家人物卡是 projection。

第一次認識周予安：

```text
周予安
高中同學。
家裡經營老街的鐘錶店。
```

之後取得新資訊再更新：

```text
新增：
五年前，他似乎也知道鐘樓的事。
```

玩家人物卡不得一次顯示 Character Bible 的 secrets / hidden knowledge。

---

## 15. Author Tool：Character Graph

Event Graph Viewer 後續新增第四個 author view：

```text
Event Graph
Character Graph
Timeline
Worldline Diff
```

Character Graph 主要不是美術功能，而是長篇故事一致性工具。

作者應能快速回答：

- 這兩人是否認識？
- 關係是哪個方向？
- 某時間點這個角色知道什麼？
- 某人的秘密是否已經曝光？
- 角色目前在哪裡／原本會做什麼？
- 此角色第一次在哪個 Narrative Scene 出場？

---

## 16. 舊內容處理

以下舊設計若與本 spec 衝突，實作階段可以直接移除或重寫：

- 「主角因收到信才回灰潮鎮」。
- 第一次遊戲固定從虛構 18:00 開始。
- `VisibleRecord.body + excerpts` 作為主要小說資料。
- `留下你認為重要的句子 +`。
- 一開始大量案卷資料直接開放。
- 舊版 real-time anchor 18:00 的節奏。
- 把 Narrative Scene 當 Event。
- 沒有 Character Bible 支撐的人物背景。
- 舊 `first-loop-story.md` 中和新版 Prologue / Character Bible / Story Simulation 衝突的內容。

可以保留並遷移：

- 灰潮鎮世界觀。
- 姊姊五年前死亡這個核心事實。
- 18:31 / 午夜鐘聲 / 輪迴等核心 Mystery。
- Story Simulation v0.2 的 condition、schedule、worldline history 架構。
- 已驗證的「玩家行動改 state，而不是直接選結果」原則。
- Hidden Truth / Player Knowledge 分離。

---

## 17. 與 Story Simulation v0.2 的整合

Narrative Foundation 不取代 simulator，而是建立其上層敘事與人物資料。

需要允許之後調整：

- Loop 01 initial state。
- 14:20–16:10 事件／schedule。
- 主角 schedule。
- 既有 action time。
- 第一輪事件時間，如果和新版小說節奏有衝突。

但每次修改 simulator story data，都必須同步更新：

- named worldline acceptance tests。
- author Story Graph tests。
- Player History visibility tests。
- cross-day / loop-end invariants。

不得只改小說文本，卻讓 simulator 時間線維持另一套真相。

---

## 18. CI / 開發安全策略

Narrative Foundation 的實作必須避免破壞目前 GitHub Actions。

### Spec 階段

只修改：

```text
docs/superpowers/specs/**
```

目前 `Event Graph Viewer` workflow 的 path filter 不包含 docs，因此不觸發 viewer CI。

### Implementation 階段

採 stacked branch，基於已驗證綠燈的 Story Simulation v0.2。

所有 production 變更遵守：

```text
RED test
→ 確認失敗原因正確
→ minimal implementation
→ GitHub Actions GREEN
→ 下一個 task
```

不得在前一個 commit CI 尚未綠燈時繼續堆下一個 production task。

若修改 `.github/workflows/**`，必須作為獨立 task，不能和 Narrative feature 混在一起。

---

## 19. v0.1 驗收範圍

Narrative Foundation v0.1 完成時，至少要能回答／驗證：

1. 七位核心角色都有 Character Definition。
2. 角色間重要關係有方向性資料。
3. 重要 Mystery facts 有穩定 Knowledge ID。
4. 初始 Knowledge Matrix 可被 author tooling 讀取。
5. 主角有 Base Schedule。
6. Activity 可以推進世界時間。
7. observable event 可以 interrupt Activity。
8. hidden event 不會中斷 Player Narrative。
9. Narrative Scene 與 Event 是不同資料型別。
10. Artifact 是完整物件，不再依賴預先挑選 excerpt。
11. Prologue 可以從 14:20 走到約 16:10，前段包含真正的普通生活。
12. 第七封信是在回到老家之後才被發現。
13. Character Graph 可以呈現 author relationship data。
14. Player Character Card 不洩漏 hidden facts。
15. 所有修改後的 Story Simulation acceptance tests 仍保持綠燈。

---

## 20. 明確不做

v0.1 不做：

- Loop 02 正文。
- 完整 Evidence Board 重做。
- 自由文字 NPC 對話生成。
- Relationship 數值養成系統。
- RPG stats / stamina。
- 玩家可任意選擇任何 Activity 的 sandbox。
- 複雜 epistemic logic proof engine。
- 後端帳號／跨裝置同步。
- 最終美術與 Three.js 場景。

先建立可長期維護的故事基礎，再做完整 Player Game。

---

## 21. 下一階段

本 spec 核准後，才進入 implementation plan。

建議 implementation 分層：

```text
1. Character / Relationship / Knowledge schemas
2. Core Character Bible data
3. Protagonist Schedule + Activity model
4. Narrative Scene + Artifact schema
5. Prologue source data
6. Narrative projection runtime
7. Character Graph author tooling
8. Story Simulation realignment
9. Player Narrative Renderer
10. final story / CI acceptance
```

在第 8 步之前，前面資料層應能獨立驗證，不急著重寫 Player UI。
