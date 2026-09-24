# Player Narrative UI v0.1 Design

日期：2026-09-24  
狀態：待審閱（self-review complete）  
基底：`docs/narrative-foundation-v0.1` @ `dd87a225559eb10359781caa6ae47ca7edffa680`  
範圍：Loop 01，Day 0 14:20 → 18:31 第一個可玩 vertical slice

## 1. 目的

建立真正給玩家玩的 Narrative UI，讓已完成的 Narrative Foundation、Story Simulation、Observation Projection 與 Diegetic Idle Activity 進入同一條玩家體驗。

這一版不是把舊 `PlayerApp` 換皮，也不是把 Author Viewer 搬給玩家。

核心體驗：

> 玩家第一輪先像在讀一部會自己運作的返鄉小說；隨著時間推進，普通生活選擇開始改變位置、資訊與人物行程，最後在 18:31 看到第一個世界線結果。

成功標準不是「玩家一定救到若晴」，而是：

```text
普通生活
→ Diegetic Idle
→ 異常進入主線
→ 玩家花時間行動
→ NPC schedules 同時運作
→ 玩家可能看到／錯過不同資訊
→ 18:31 由 Simulator 解析不同結果
```

玩家端不得直接看見 hidden truth、Event Graph、schedule condition 或 action impact 類型。

---

## 2. 已核准設計原則

### 2.1 UI 盡量消失

玩家主畫面優先級：

```text
1. 小說正文
2. 場景 Artifact
3. 當下行動
4. 很淡的時間／狀態
5. 人物／筆記等 secondary tools
```

不再以案件管理面板為主畫面。

### 2.2 Event / Scene / Activity 分離

```text
Event
= 世界裡真正發生什麼

Narrative Scene
= 玩家如何經歷／閱讀這件事

Activity
= 主角這段時間正在做什麼，因此 World Time 前進
```

Player UI 只能消費這些 projection，不能自己重新定義世界因果。

### 2.3 普通選項也有影響

玩家會遇到大量看似無關緊要的選項，例如：

```text
買咖啡
去便利商店
直接回家

整理廚房
整理書房
先坐一下

再坐一會兒
先走了
```

即使不影響 18:31，也至少應改變一項：

- World Time。
- 主角位置。
- Ambient Prose。
- 人物反應。
- Player Knowledge。
- 後續 Scene 內容。
- 後續可選行動。

沒有「假選項」，也沒有 UI 標示「重要選項」。

### 2.4 玩家不知道哪些選項會改世界線

所有選項維持同一種視覺語言。

禁止：

```text
⚠ 關鍵選項
主線選項
世界線變更
Knowledge +1
好感度 +5
```

重要性只能由後續結果顯現。

### 2.5 世界不等待玩家，但不懲罰閱讀速度

部分事件有真正 deadline。

規則：

```text
事件出現但玩家尚未查看
→ World Time 繼續
→ 情況可能改變、選項可能自然消失

玩家正式打開該 Narrative Scene
→ 鎖定「決策時刻」
→ 玩家可以慢慢閱讀與思考
→ 提交 action 後 World Time 再繼續
```

玩家故意不處理訊息／電話，本身就是一種行為。

---

## 3. Architecture

採用：**新的 Player Narrative Layer 直接建立在 Narrative Foundation + Story Simulation 上。**

不直接延續 `main` 上舊版 `src/player/**` 的敘事模型。

```text
                 Story YAML
                     │
        ┌────────────┴────────────┐
        │                         │
Narrative Foundation      Story Simulation
        │                         │
        └───────────┬─────────────┘
                    ↓
             Player Runtime
                    │
        ┌───────────┼───────────────┐
        ↓           ↓               ↓
   World Clock   Activity       Observation
        │           │               │
        └───────────┼───────────────┘
                    ↓
            Narrative Queue
                    ↓
              Player UI
```

### 3.1 Player Runtime 的責任

Player Runtime 負責：

- real-time anchor 與 Story Time mapping。
- 玩家 session / save。
- active Activity。
- offline reconciliation。
- observation context。
- Narrative Queue。
- submitted actions。
- Player Knowledge projection。
- Artifact read/open state。

Player Runtime 不負責：

- 手寫誰死亡。
- 手寫 NPC 最終位置。
- 重新實作 Story Simulator condition。
- 直接推導 hidden causal chain。

### 3.2 Save 原則

> Save 存玩家做過什麼，不存世界應該變成什麼。

概念資料：

```text
PlayerSession
├─ realTimeAnchor
├─ currentStoryTime
├─ activeActivity
├─ completedScenes
├─ consumedNarrativeItems
├─ submittedActions
├─ playerKnowledge
├─ openedArtifacts
└─ lastSeenRealTime
```

不要把下列結果當 canonical save：

```text
wakaharuDies = true
doctorDies = false
reporterAtOldLab = true
```

World Truth 必須能由 initial state + submitted actions + elapsed Story Time deterministic replay 得到。

---

## 4. Time Model

### 4.1 Production mapping

Player runtime 預設：

```text
1 real minute = 1 world minute
```

Story YAML 只記錄 world minutes / StoryTime；真實 timestamp 不寫進 story data。

### 4.2 Dev / test clock

實作必須提供 injectable clock，例如：

```text
RealClock
FakeClock
DevAcceleratedClock
```

測試可：

```text
advanceTo(18:31)
```

或使用加速 mapping。

Production Story semantics 不因測試加速而改變。

### 4.3 Scene 不消耗 Story Time

玩家讀正文多久都不影響 canonical time。

時間只由：

- Activity。
- travel。
- waiting。
- explicit timed action。
- real-time elapsed while world is running。

推進。

### 4.4 Absolute World Time 與 Player-relative Scene Time

14:20～16:00 的 Prologue 時間是 **baseline / nominal timeline**，不是所有 Scene 都強制固定在該分鐘。

必須分成兩類：

```text
Fixed World Event
= 不管玩家做什麼，世界在該 Story Time 解析
例如：NPC schedule、18:31 station event

Player-relative Scene / Activity
= 何時發生取決於玩家前面花掉多少時間與所在位置
例如：買咖啡、整理房間、發現信、去咖啡店
```

因此：

```text
Baseline
14:20 arrive
14:30 groceries
14:40 Yuan encounter
15:00 old house
16:00 discover letter
```

不代表玩家買咖啡多花 8 分鐘後，系統仍把她瞬移回 baseline。

普通生活 Choice 的時間成本必須真的累積。

### 4.5 林知夏的信：存在時間與發現時間分離

信件本身在玩家回到老家前就已經存在於世界中。

```text
Artifact exists at old house
≠
Player has discovered artifact
```

`16:00` 是 baseline route 的預期發現時間，不是固定強制 Event。

玩家若先做更多生活 Activity，可以更晚才整理到那封信；直接回家、優先整理郵件則可以更早發現。

因此「發現信」是 observation / interaction result，而不是 UI 到 16:00 自動送出 Artifact。

### 4.6 周予安第一次出場的時間也允許路徑差異

周予安第一次出場必須在 v0.1 早期自然完成角色介紹，但不必靠固定 14:40 瞬移。

可以依 route 使用：

- 老街相遇。
- 店門口相遇。
- 主角回家途中遇到。
- 其他同等自然的 alternate scene。

其時間與位置可以依玩家前面的生活 Choice 偏移。

Author data 必須確保第一個 vertical slice 至少存在一條合理 fallback，不因玩家買咖啡就永久失去核心人物介紹。

---

## 5. Player Surface

Player Game 與 Author Viewer 維持不同 surface。

第一版 Player UI 只有五種主要呈現狀態：

```text
Narrative
Activity
Artifact
Choice
Interrupt
```

它們不是五個獨立頁面，而是同一個 scene surface 的狀態轉換。

### 5.1 Narrative

正文固定第一人稱。

不採逐字 typewriter 作為主要閱讀方式；改用 paragraph / beat reveal。

```text
段落 A
↓ 玩家繼續
段落 B
↓
短獨白
```

閱讀速度不影響 World Time。

### 5.2 Dialogue

不採傳統大量立繪 + 固定底部對話框作為核心形式。

範例：

```text
周予安

「真的打算賣掉？」

我把鑰匙塞回口袋。

「不然留著也沒有人住。」
```

角色名稱可以淡淡標示，但文字與環境仍是視覺中心。

### 5.3 Secondary UI

第一版只保留非常淡的：

```text
右上：時間
左下：人物
右下：筆記 / 更多
```

無互動時可降低 opacity。

不要讓：

```text
案卷
世界線
證據數量
任務列表
完成率
```

長期佔據主畫面。

---

## 6. Diegetic Idle Activity UI

Idle 不是 loading state。

> 主角正在生活，因此世界趁這段時間繼續運作。

範例：

```text
15:34

正在看書
```

不要顯示：

```text
████████ 43%
剩餘 11:32
EXP +5
```

### 6.1 Ambient Prose

Activity 期間要持續有少量生活敘事。

例如 `rest_and_read`：

```text
start
我翻回上次夾書籤的地方。前面的內容幾乎忘光了。

+5 min
樓下有人騎機車經過。聲音沿著巷子慢慢遠了。

+11 min
茶已經沒有剛才那麼燙了。

+17 min
我讀了三頁，才發現同一段看了兩次。

complete
我把書闔上。
```

### 6.2 Ambient Prose 要和 Activity 綁定

整理房間：

- 紙箱底下積了一層灰。
- 找到一支沒水的原子筆，卻還是放回抽屜。
- 太陽的位置慢慢換到另一扇窗。

做飯：

- 水開始滾了。
- 刀碰到砧板的聲音比想像中大。
- 冰箱的冷氣在腳邊散掉。

查資料：

- 搜尋結果幾乎都是五年前的新聞。
- 換了幾組關鍵字。
- 發現自己查得比想像中久。

等待：

- 手機沒有亮。
- 巷子外有人收垃圾。
- 又把手機翻過來看一次。

### 6.3 Ambient Prose 可 state-aware

同一 Activity 可以依 Player Knowledge / context 選不同 pool。

例如看過林知夏的信後再看書：

> 我又想起那個郵戳。

> 書上的字看得進去，意思卻完全沒留下來。

這些不是 Event，不寫入 Event Graph。

### 6.4 不做純 random spam

Ambient prose 採 authored beats / pool selection：

```text
Activity start
→ duration-aware beat slots
→ 依 context 選句
→ 同一次 Activity 不重複
```

避免每 N 秒完全隨機一句。

### 6.5 Interrupt

observable urgent event 可以自然打斷 Activity。

```text
17:26
正在準備晚餐……

水剛開始冒泡。

叩、叩。

我停下手上的動作。
```

Hidden event 不打斷 Activity，也不顯示。

---

## 7. Artifact UI

Artifact 要像真的世界內物件，而不是 metadata panel。

v0.1 優先使用：

```text
DOM
+ CSS perspective
+ transform
+ shadow
+ subtle parallax
```

不在這一版加入 Three.js dependency。

Three.js 留給之後真正需要空間感的場景，例如車站、鐘樓或輪迴異常。

### 7.1 林知夏的信

流程：

```text
Narrative Scene
→ 看見信封
→ 信封出現在場景中央
→ 玩家翻看 / 看郵戳
→ 拆開信封
→ 信紙抽出
→ 閱讀完整信件
→ 主角短反應
```

玩家不先看到：

```text
Artifact ID
sender metadata
important excerpt
```

### 7.2 v0.1 Artifact 最小集合

至少支援：

- 實體信封 / 信紙。
- 手機訊息。
- 手機來電。
- 簡單文件 / 網頁結果。

---

## 8. Choice System

### 8.1 玩家端不分級

玩家看不到 Choice 類型。

Author/runtime 內部可以分類：

```text
Flavor
Knowledge
Schedule
World Intervention
```

但 UI 一律用自然語言呈現。

### 8.2 Choice 不直接指定 ending

Choice 應產生：

- action submission。
- Activity。
- schedule override。
- state change。
- knowledge change。

Event outcome 仍由 Simulator condition 解析。

禁止：

```text
choice A → bad ending
choice B → doctor dies
```

### 8.3 沒有錯的生活選擇

例如 14:20：

```text
先去買杯咖啡
去便利商店買水
直接回家
```

可能造成：

```text
咖啡店
→ +8 分鐘
→ 聽到居民聊天

便利商店
→ +6 分鐘
→ 老闆認出主角
→ 建立小鎮背景

直接回家
→ 早一點抵達
→ 多一段整理時間
```

都不是「錯」。

### 8.4 Time is the resource

看更多不一定更好。

```text
查一份資料 35 分鐘
```

就代表這 35 分鐘可能：

- 錯過人物。
- 錯過電話。
- 錯過 observation window。
- 失去前往另一地點的時間。

不要做 stamina / action point 系統。

---

## 9. Deadline Model

### 9.1 Observation Window

事情發生時，主角在合理位置／channel 才能看見。

```text
18:05 醫生抵達舊車站
```

主角在車站：看到。

主角在家：不知道，也不顯示「你錯過線索」。

### 9.2 Response Deadline

例如若晴 17:55 傳訊息。

立即打開時可能有：

```text
回她
打電話
現在去找她
```

18:08 才打開時，原選項可以自然不存在，改成：

```text
打給她
直接去車站
```

不要顯示灰色的「已過期選項」。

### 9.3 Feasibility Deadline

允許玩家做「來不及的正確決定」。

例如：

```text
18:12 從老家出發
路程 22 分鐘
18:31 事件先發生
18:34 才抵達
```

UI 不應因為「時間不足」而阻止玩家出發。

### 9.4 Decision Freeze

只有玩家正式打開需要決策的 Scene 時，才凍結該決策瞬間。

同一個前景 runtime session 中：

```text
17:56 打開訊息 Scene
→ decisionAt = 17:56
→ 閱讀 / 思考的真實時間不計入 Story Time
→ 17:56 的有效 Choice 不因玩家讀得慢而消失
→ 提交後從 17:56 繼續
```

這個 freeze 是 **foreground interaction lease**，不是可永久保存的世界暫停。

### 9.5 Decision Freeze 不跨離線持久化

若玩家在決策 Scene 開啟後關閉／離開遊戲：

- 不自動替玩家提交 Choice。
- 不把 freeze token 存成永久 pause。
- 下次回來先做 offline reconciliation。
- 再依新的 current Story Time 重新投影 Scene / Choice。
- 原本 17:56 可用的回覆，在 18:08 可能已經不存在。

因此同時滿足：

```text
閱讀速度不成為操作能力
+
玩家離線時世界仍不等待
```

---

## 10. Narrative Queue

Player runtime 將可呈現內容投影成 deterministic queue。

優先序：

```text
urgent interrupt
→ direct phone call / direct message
→ current activity completion
→ requested scene / choice
→ ambient observation
```

同優先級按 World Time + insertion order。

### 10.1 未讀事件

玩家可以看到「手機亮了」但不一定立即處理。

```text
手機震動
↓
玩家繼續 Activity
↓
世界繼續走
↓
之後查看
→ 顯示「七分鐘前」
```

### 10.2 Offline reconciliation

離線期間 world simulation 照常跑。

回來後根據 channel / persistence 決定投影：

- 未接來電。
- 新訊息。
- 留言。
- Activity completion。
- 可持久化的結果。

現場 observation 若已錯過，不能事後自動補知識。

---

## 11. Player Character Cards

Player Character Card 是 Character Bible 的 projection，不是 Author Truth。

例如第一次認識周予安：

```text
周予安
27 歲
老街鐘錶店

高中同學。
離開灰潮鎮後，偶爾還有聯絡。
```

之後 Player Knowledge 增加才更新。

禁止暴露：

- secrets。
- hidden knowledge。
- 未觀察到的 relationship truth。

更新文案使用自然語言，例如：

```text
人物更新
新增了一段記憶
```

不要顯示 `Knowledge +1`。

---

## 12. 14:20 → 18:31 First Vertical Slice

本節時間代表 baseline route；除 fixed world events 外，玩家的生活 choice 可以讓 Scene 提前、延後、換地點或錯過。

### 12.1 14:20–16:00：普通返鄉生活

玩家尚不知道這是一個因果推理遊戲。

```text
14:20 抵達灰潮鎮
│
├─ 買咖啡
├─ 去便利商店
└─ 直接回家
        ↓
約 14:40 周予安第一次出場（route-dependent）
        ↓
普通寒暄
        ↓
約 15:00 老家
│
├─ 整理廚房
├─ 整理書房
├─ 收行李
└─ 先坐一下
        ↓
生活 Activity
        ↓
看書 / 喝茶 / 整理 / 散步
        ↓
baseline 約 16:00 發現信件
```

這段大量選項主要改生活節奏、背景資訊與時間，不要求每個都是伏筆。

### 12.2 發現信：第一個異常

看到林知夏寄來、郵戳為昨天的信。

發現時間依玩家前面 Activity 而變動。

玩家可以：

```text
拆開
先看郵戳
拍照
先放著
```

「先放著」也合法；世界繼續走。

Ambient prose 可以開始受信件存在影響。

### 12.3 發現信後：自然調查

不顯示「主線任務」。

玩家可能想到：

```text
問予安
去郵局
查網路
找若晴
先做晚餐
```

### 12.4 予安的蝴蝶效應

例如：

```text
自己去郵局
請予安去
只把照片傳給他
不處理
```

其中請予安去郵局可能改變他 18:10 的位置，因此改變 observation，但玩家第一輪不知道。

### 12.5 約 16:30 若晴

若晴不是強制瞬移出現的 NPC。

玩家有機會去咖啡店，也可以不去；實際抵達時間取決於前面已花掉的時間。

若見到她，可自然選：

```text
把信給她看
只問姊姊的事
問她今晚去哪
換話題
```

`show_letter_to_wakaharu` 仍只改世界 state / knowledge，不直接指定 18:31 結果。

### 12.6 16:40–17:30：事情開始做不完

同時存在多個合理方向：

```text
查研究所
找醫生
等予安
找記者
陪若晴
回家
```

每件事都需要時間。

普通行動也可能造成 observation 差異，例如：

```text
再坐一下
→ 多花十幾分鐘
→ 看到某人經過

先走
→ 沒看到某人
→ 但來得及去醫院
```

### 12.7 17:40 世界自行運作

陳柏勳依 fixed NPC schedule 離院。

玩家只有在合理位置／channel 才知道。

### 12.8 約 17:55 Deadline 第一次明顯出現

若晴可能傳訊息：

> 我準備出門了。

訊息送出的實際條件由 story data / schedule 定義，不要求 UI 強制剛好 17:55 才顯示。

玩家不查看，世界就繼續。

晚幾分鐘查看，Scene 與選項自然不同。

### 12.9 18:05 Observation Window

醫生抵達車站。

這是 fixed world event / schedule consequence。

只有玩家當下能合理觀察才知道。

### 12.10 18:10 回收予安 schedule 差異

未派予安去郵局：可能目擊葉庭安。

派去郵局：不在原位置，沒有目擊，但可能建立之後的郵局情報路徑。

不顯示「失去線索」。

### 12.11 18:18 若晴資訊差異

若她先前看過信，可以提供較完整內容。

沒看過則資訊不完整。

Knowledge 差異不等於自動改寫 18:31 結果。

### 12.12 18:20–18:31 最後取捨

玩家可以：

```text
去找若晴
去找醫生
直接去車站
打電話
把資料查完
回家
```

所有選項都允許。

若從太遠地方太晚出發，可以在 18:31 事件後才抵達。

### 12.13 18:31 第一個世界線結果

18:31 是 fixed world event。

由 Simulator condition 解析：

```text
若晴在場
→ 若晴死亡

若晴不在 + 醫生在
→ 醫生死亡

兩人都不在
→ 無人死亡
→ 異常仍發生
```

玩家 UI 只演出結果，不顯示：

```text
BAD END
GOOD END
WORLDLINE CHANGED
```

這不是第一輪結束，只是 v0.1 vertical slice 的驗收終點。

---

## 13. 18:31 Presentation

前半段 UI 一直保持安靜，因此 18:31 才能形成第一個視覺／聲音高潮。

原則：

- 不提前顯示危險倒數。
- 18:30 仍維持克制。
- 18:31 Event 可以暫時奪走 Activity presentation。
- 依 worldline outcome 顯示不同 scene。
- 不解釋 hidden causal chain。

玩家應該只感覺：

> 我做的某些普通事情，好像改變了誰在什麼時間出現在什麼地方。

---

## 14. 舊 Player Prototype 的處理

`main` 上現有：

```text
tools/event-graph-viewer/player.html
tools/event-graph-viewer/src/player/**
```

視為 prototype。

可評估重用：

- localStorage persistence 概念。
- clock adapter 概念。
- player entrypoint / Vite multi-page setup。

不直接保留：

- 18:00 hard-coded anchor semantics。
- `VisibleRecord.body + excerpts`。
- Evidence Board 主介面。
- `+` 重要句子收藏。
- 舊 `protect_wakaharu / stop_doctor` 專用 runtime。
- UI 內硬編故事。

若實作時新舊 Player code 衝突，以本 spec 為準，可以刪除或重寫舊 prototype。

---

## 15. Data / Runtime Extensions Needed

實作階段預期需要擴充，但具體型別由 implementation plan 決定：

### 15.1 Activity Ambient Beats

Activity 定義需要能描述：

- relative timing / beat slots。
- default prose。
- context-aware prose variants。
- non-repeat semantics。

### 15.2 Player Choice Presentation

Choice story data 需要支援：

- label。
- action / activity reference。
- availability condition。
- deadline / response window（若需要）。
- 不暴露 author-only impact classification。

### 15.3 Observation Persistence

不同 channel 需要 persistence policy：

```text
local observation → 通常不可補看
phone message → 可持久化
phone call → 未接來電
artifact → 一旦取得可重開
```

### 15.4 Travel / Location

為支援 feasibility deadline，主角位置與 travel duration 必須成為 runtime 可計算資料，不可以只靠 Scene 文案假裝移動。

v0.1 不需要完整地圖尋路系統，只需要 authored location-to-location travel durations。

### 15.5 Temporal Ownership Validation

Author tooling / tests 至少要能區分：

- fixed absolute world event。
- player-relative scene/activity。

並防止同一段 story 同時宣告：

```text
「選擇會延遲 8 分鐘」
+
「下一個 player-relative scene 永遠固定在原時間」
```

這類矛盾。

---

## 16. Testing / CI Safety

這一階段延續 Narrative Foundation 的 CI 原則。

### 16.1 不修改 workflow，除非實際證明現有 workflow 無法驗證新 Player surface

預設不碰：

```text
.github/workflows/**
```

### 16.2 不把 intentional RED commit 推上 GitHub PR branch

TDD 可在本地／隔離環境做 RED → GREEN，但遠端 branch 只接受預期可綠的完整 commit。

每個 dependent batch：

```text
targeted tests
→ full npm test
→ npm run build
→ push
→ GitHub Actions GREEN
→ 下一批
```

若 GitHub Actions red，停止疊新功能直到修綠。

### 16.3 必須加入的 acceptance tests

至少覆蓋：

- 14:20 → 18:31 deterministic replay。
- Scene 閱讀不推進 Story Time。
- Activity 推進 Story Time。
- 普通 Choice 的 duration 真的會偏移後續 player-relative scene。
- fixed 18:31 event 不因前面 player-relative scene 偏移而改時刻。
- 信件存在時間與玩家發現時間分離。
- Ambient beat ordering / non-repeat。
- hidden event 不進 Player Narrative。
- local observation 錯過後不自動補知識。
- phone message 離線後可持久化。
- response deadline 改變可用 Choice。
- 打開 decision scene 後不因真實閱讀時間失效。
- decision freeze 不跨 reload / offline 持久化。
- travel 太晚出發仍允許，但可能 18:31 後抵達。
- Choice UI 不暴露 impact type。
- 不同 submitted actions 可由同一 Simulator 產生不同 18:31 outcome。
- Player save 不直接保存 canonical death outcome。

### 16.4 CI Gate

每個重要 integration batch 都要取得 fresh GitHub Actions evidence：

```text
Sync story data  PASS
Tests            PASS
Build            PASS
```

不能只依賴前一次 run。

---

## 17. Branch / Integration Constraint

目前 `main` 與 Narrative Foundation stack 已經分歧。

本 spec 暫時 stack 在：

```text
docs/narrative-foundation-v0.1
```

因為這裡包含已完成並驗證的 Narrative Foundation。

在真正 implementation / merge 到 main 前，implementation plan 必須包含一個明確 integration task：

```text
current main
+ Story Simulation stack
+ Narrative Foundation
+ Player Narrative UI
→ deliberate integration branch
→ resolve player prototype conflicts
→ full tests + build
```

禁止直接把 stale stacked branch 盲目 merge 到 main。

---

## 18. Out of Scope for v0.1

這一版不做：

- 18:31 之後完整到午夜的 Player flow。
- Loop 02。
- 真正玩家世界線 Notebook。
- 自由文字筆記／選中文字摘錄。
- 複雜 inventory。
- 好感度 UI。
- stamina / energy。
- Three.js 場景。
- 完整地圖 pathfinding。
- 配音系統。
- 大量人物立繪。
- 由 AI 即時生成 canonical story prose。

---

## 19. Acceptance Criteria

Player Narrative UI v0.1 完成時，必須能實際做到：

1. 玩家從 14:20 以小說形式開始，而不是案件 Dashboard。
2. 14:20–16:00 至少有多個普通生活 choice，且不同 choice 留下可觀察差異與實際時間差。
3. Prologue baseline 時間不會把玩家強制瞬移回固定 Scene；player-relative scenes 會依前面時間成本偏移。
4. Diegetic Activity 期間 World Time 真正前進，並顯示與活動一致的 Ambient Prose。
5. Ambient Prose 不變成 random spam，且可依 context 改變。
6. 林知夏的信「存在」與「被發現」分離，並以 Artifact 形式實際演出。
7. 玩家可以暫時忽略信件，世界仍繼續。
8. 主線後有多個 Knowledge / Schedule / World Intervention 類型的 choice，但玩家 UI 不區分。
9. 玩家不可能靠「把所有選項都點過」取得最佳結果，因為時間與 observation window 有成本。
10. phone / local observation / offline reconciliation 依不同 persistence policy 正確處理。
11. Deadline 不使用遊戲化 countdown UI。
12. 玩家在同一前景 session 打開 decision scene 後可以慢慢閱讀，不因閱讀速度損失選項。
13. 關閉／離開遊戲後 decision freeze 不持久化；回來時世界依 elapsed time 重新 reconcile。
14. 太晚出發仍允許 travel，並可在事件後才抵達。
15. 18:31 outcome 由 Story Simulator 決定，不由 Player UI hard-code。
16. 至少可透過不同玩家行動看到不同 18:31 結果。
17. Player surface 從頭到尾不暴露 hidden truth / author impact classification。
18. Author Viewer 仍可正常使用。
19. Full test suite 與 production build 綠燈。

---

## 20. 最終設計摘要

```text
玩家不是在管理案件
而是在過主角的今天

普通生活選擇
→ 花掉時間
→ 改變位置 / 對話 / 知識
→ 有時悄悄改變 NPC schedule
→ 世界不等待玩家
→ 有些事情因此被看到
→ 有些事情永遠錯過
→ 18:31 結果改變

玩家第一輪不知道哪些選項重要
第二輪開始利用記憶主動測試因果
```

Player Narrative UI 的核心不是「更多按鈕」，而是：

> **UI 本身盡量消失，世界、時間與小說內容才是介面。**
