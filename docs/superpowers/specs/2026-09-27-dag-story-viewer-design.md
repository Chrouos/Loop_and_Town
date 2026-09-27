# DAG Story Viewer + Causal Narrative Design

## Goal

把《灰潮鎮：第七封信》的故事管理方式正式改成 **DAG / Event Graph**。

這份 Graph 同時服務三件事：

1. 作者看因果：為什麼 A 會影響 B，再影響 C。
2. 玩家讀世界線：這一輪實際走過哪些 Node。
3. 小說閱讀：點 Node 可展開完整場景、對話與人物狀態。

核心原則：

> Story = Graph。
> Worldline = Graph 上某一次實際走過的 Path。
> Novel Scene = Node 的可閱讀內容。

---

# 1. Viewer 最終閱讀形式

主畫面不是卡片牆，而是因果 DAG。

```text
[N01 與若晴聊攝影]
        │
        │ trust +1
        ▼
[N02 若晴放下戒心]
        │
        │ reveal: station_plan
        ▼
[N03 玩家知道車站行程]
        │
        ├── tell reporter ──────────────┐
        │                               ▼
        │                     [N06 庭安改變行程]
        │                               │
        │                               │ arrive station
        │                               ▼
        │                     [N07 庭安遇見柏勳]
        │                               │
        │                               │ delay handoff
        │                               ▼
        │                     [N08 柏勳延後離開]
        │
        └── stop wakaharu ──────────────┐
                                        ▼
                              [N04 若晴沒有去車站]
                                        │
                                        │ no recipient
                                        ▼
                              [N05 柏勳自行帶資料]

[N05] ───────────────┐
                     │
[N08] ───────────────┼──► [N20 18:31 Convergence]
                     │
[N04] ───────────────┘
```

Viewer 預設只顯示：

- Node ID
- Node Title
- Edge effect
- 時間
- 角色
- Path / Worldline 狀態

不要把 Before / After 全部塞在 Graph 上。

---

# 2. Node Detail

點擊 Node 後才打開右側 Inspector。

例如：

```text
N06｜庭安改變行程
時間：17:42
角色：葉庭安
地點：咖啡店 → 舊車站

Trigger
- N03 玩家知道若晴要去車站
- Player Action: tell reporter

Before
1. 17:30 回旅館
2. 整理舊研究所資料
3. 19:50 獨自進研究所

After
1. 取消回旅館
2. 17:50 前往舊車站
3. 嘗試阻止柏勳交資料

Immediate Effects
- reporter.location = road_to_old_station
- reporter.plan = intercept_handoff

Delayed Effects
- research_lab_entry delayed
- reporter exposure risk +1

Affects
→ N07 庭安遇見柏勳
→ N18 研究所行程延後
```

Inspector 下半部才放小說：

```text
Scene
────────────────────
庭安沒有立刻回答。
她只是把咖啡杯推遠了一點。

「妳說若晴現在要去哪？」

……
```

因此一個 Node 同時具有：

```text
Causal Data
+
Character State
+
Novel Scene
```

---

# 3. Edge 是第一級故事資料

Edge 不能只是箭頭。

例如：

```text
N01 ── trust +1 ──> N02
N02 ── reveal: station_plan ──> N03
N03 ── tell reporter ──> N06
N06 ── arrive station ──> N07
N07 ── delay handoff +7m ──> N08
```

Edge Types 建議固定：

```text
relationship
knowledge
route
schedule
state
delay
choice
observation
memory
convergence
```

常見 label：

```text
trust +1
trust -1
reveal: station_plan
hide: medical_record
route → old_station
delay +7m
follow doctor
stop wakaharu
tell reporter
memory_residue +1
```

這樣作者能直接看懂「到底改了什麼」。

---

# 4. 第一日 Story DAG

第一天不再是一條線。
它是由多個小因果節點逐步匯到 18:31。

## Phase A｜回鄉 14:20～15:30

```text
[N001 回到灰潮鎮]
       │
       ├── enter shop ──> [N002 店家錯認成知夏]
       │                     │
       │                     ├─ correct ──> [N003 店家知道主角回鎮]
       │                     └─ stay silent ──> [N004 產生知夏目擊傳聞]
       │
       └── old house ──> [N005 與予安重逢]
                              │
                              ├─ talk house sale ──> [N006 予安房仲線被揭露]
                              └─ talk zhixia ──> [N007 予安避開 17:58 話題]
```

### Story Meaning

這一段不改死亡。
它只決定：

- 主角回鎮消息何時傳出去
- 予安願意談多少五年前的事
- 晚上志遠是否提前注意主角

---

# 5. 姊姊房間 Search DAG

玩家第一次不應該一次看完所有東西。
時間只夠深入查其中 1～2 個方向。

```text
                     [N010 進入知夏房間]
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
 [N011 查書桌]        [N012 查床底]       [N013 查舊鐘]
          │                  │                  │
          ▼                  ▼                  ▼
 [研究所合照]        [若晴攝影照片]       [18:31 手錶]
          │                  │                  │
          ▼                  ▼                  ▼
 提前認出庭安       提前知道若晴很熟      建立 18:31 Mystery
```

另有：

```text
[N014 查衣櫃]
        │
        ▼
[發現知夏原本準備離鎮的行李]
        │
        ▼
[Knowledge: zhixia_planned_to_leave]
```

這個節點要到後面才與「知夏故意逼妹妹離開」產生呼應。

---

# 6. 若晴 DAG｜第一個高密度人物節點

```text
                     [N020 16:10 遇見若晴]
                              │
       ┌──────────────────────┼─────────────────────────┐
       │                      │                         │
       ▼                      ▼                         ▼
[N021 直接問知夏]      [N022 聊攝影]            [N023 出示第七封信]
       │                      │                         │
 trust -1               trust +1                  fear +1
       │                      │                         │
       ▼                      ▼                         ▼
[N024 若晴防備]        [N025 若晴談離鎮]          [N026 若晴提前聯絡柏勳]
       │                      │                         │
 hide route             reveal school             doctor schedule shift
       │                      │                         │
       │                      ▼                         │
       │              [N027 若晴透露車站行程] ◄────────┘
       │                      │
       └────────────可能錯過──┘
```

`N027` 是第一個重要 Information Node。
但它本身不是世界線分支結果。
它只是給玩家新的 Action。

---

# 7. 玩家知道車站行程後

```text
[N027 知道若晴要去車站]
          │
          ├── do nothing ───────────> [N030 Baseline]
          │
          ├── follow wakaharu ──────> [N031 玩家跟若晴去車站]
          │
          ├── stop wakaharu ────────> [N032 若晴取消車站]
          │
          ├── tell yuan ────────────> [N033 予安加入調查]
          │
          ├── tell reporter ────────> [N034 庭安得知若晴行程]
          │
          └── visit doctor ─────────> [N035 玩家提前找柏勳]
```

這才是世界線真正開始大幅分叉的地方。

---

# 8. 庭安傳播鏈

```text
[N034 告訴庭安]
        │
        │ knowledge: wakaharu_station
        ▼
[N040 庭安取消回旅館]
        │
        │ route → old_station
        ▼
[N041 17:50 庭安抵達車站]
        │
        ▼
[N042 庭安遇見柏勳]
        │
        ├── confront ──────> [N043 交付延後]
        │
        └── observe ───────> [N044 庭安取得交付資訊]
```

其中 `N043` 會反過來影響若晴：

```text
[N043 交付延後]
        │
        │ wakaharu observes conflict
        ▼
[N045 若晴開始懷疑所有人都隱瞞她]
        │
        │ trust protagonist -1
        ▼
[N046 18:18 不透露完整警告]
```

也就是：

```text
玩家告訴庭安一句話
→ 庭安改行程
→ 柏勳被攔
→ 若晴看到爭執
→ 若晴降低信任
→ 玩家少拿一條情報
→ 下一輪決策再改變
```

---

# 9. 予安傳播鏈

```text
[N033 玩家叫予安加入]
        │
        ├── assign post office ──> [N050 郵局調查]
        │                            │
        │                            └─ reveal: no postal record
        │
        └── bring to station ────> [N051 予安前往車站]
                                      │
                                      │ exposure at 18:31
                                      ▼
                             [N052 memory_residue +1]
                                      │
                                      ▼
                             [N053 下一輪出現 Déjà vu]
```

同時：

```text
[N051 予安前往車站]
        │
        │ miss personal schedule
        ▼
[N054 20:00 錯過房仲]
        │
        ▼
[N055 鐘錶店出售延期]
```

這條線很重要：
Chapter 5「記得的人」不是突然發生。
它在早期 Loop 就由玩家把予安拖進異常區逐步造成。

---

# 10. 柏勳 DAG

Baseline：

```text
[N060 17:40 柏勳離院]
        │
        ▼
[N061 18:05 交付資料給若晴]
        │
        ▼
[N062 18:10 離開車站]
```

但前置資訊可以改掉這條路。

```text
[N035 玩家提前找柏勳]
        │
        ├── mention zhixia ──> [N063 柏勳警戒]
        ├── mention wakaharu ─> [N064 柏勳提前聯絡若晴]
        └── show letter ──────> [N065 柏勳取消原交付方式]
```

如果若晴沒出現：

```text
[N032 若晴取消車站]
        │
        │ no recipient
        ▼
[N066 柏勳自行帶走資料]
        │
        │ route → maintenance corridor
        ▼
[N067 柏勳進維修通道]
```

---

# 11. 18:31 Convergence

18:31 不是單一事件結果，而是多條因果鏈匯入。

```text
[N030 Baseline] ─────────────────┐
[N043 交付延後] ────────────────┤
[N032 若晴取消車站] ────────────┤
[N051 予安進異常區] ────────────┤
[N067 柏勳進維修通道] ──────────┤
[N046 若晴隱瞞警告] ────────────┤
                                ▼
                    [N100 18:31 Convergence]
                                │
          ┌─────────────────────┼──────────────────────┐
          │                     │                      │
          ▼                     ▼                      ▼
 [V101 若晴死亡]        [V102 柏勳死亡]         [V103 無人死亡]
```

後期還可出現：

```text
[V104 予安受傷 / residue 大幅上升]
[V105 庭安失蹤]
[V106 車站設備異常但無直接傷亡]
```

Variant 不是玩家直接選。
是前面 State 累積後由 Convergence resolve。

---

# 12. 第一輪 Baseline Path

Viewer 可以選：`Worldline → Loop 01`
然後只高亮這條 Path：

```text
N001 回鄉
 ↓
N005 與予安重逢
 ↓
N010 知夏房間
 ↓
N011 研究所照片
 ↓
N020 遇見若晴
 ↓
N021 問知夏
 ↓
N024 若晴防備
 ↓
N030 Baseline
 ↓
N060 柏勳離院
 ↓
N061 柏勳交付資料
 ↓
N100 18:31 Convergence
 ↓
V101 若晴死亡
 ↓
N110 五年前也是 18:31
 ↓
N120 手錶後蓋留言
 ↓
N130 23:59 不存在的鐘聲
 ↓
N140 00:00 Reset
```

其他未走過 Node 灰化。

---

# 13. Loop 02 Path

```text
N020 遇見若晴
 ↓
N022 聊攝影
 ↓ trust +1
N025 若晴談離鎮
 ↓ reveal
N027 知道車站行程
 ↓ stop wakaharu
N032 若晴取消車站
 ↓ no recipient
N066 柏勳自行帶資料
 ↓ route
N067 維修通道
 ↓
N100 18:31 Convergence
 ↓
V102 柏勳死亡
```

Viewer 此時可以把 Loop 01 與 Loop 02 疊在同一圖上。

不同 Path 用 Worldline selector 切換，不需要把 Graph 複製兩份。

---

# 14. Loop 03 / No Death Path

不是直接按「救所有人」。
而是需要玩家已經知道多條前置因果鏈。

```text
若晴 route changed
+
柏勳 route changed
+
庭安 schedule stabilized
+
予安 not exposed
+
player possesses warning knowledge
        │
        ▼
N100 18:31 Convergence
        │
        ▼
V103 無人死亡
        │
        ▼
23:59 鐘聲仍響
        │
        ▼
00:00 Reset
```

這一輪才證明：

```text
death != cause_of_loop
```

---

# 15. Graph 與小說如何結合

Node 不只是 Event ID。
每個重要 Node 都要有 Novel Scene。

例如 `N022 聊攝影`：

```text
Node
N022

Graph Label
與若晴聊攝影

Edge In
player chooses photography topic

Edge Out
trust +1

Novel Scene
────────────────
我原本只是等咖啡。

桌角壓著幾張照片。
不是觀光客會拍的那種灰潮鎮。

……

若晴把照片翻過去。

「不要看啦，還沒挑完。」

我問她：「妳拍的？」

她停了一下。

那是她第一次沒有先問我姊姊。
```

也就是：

```text
Graph View
→ 看因果

Node Inspector
→ 看狀態

Read Scene
→ 讀小說
```

---

# 16. Author View vs Player View

同一張 Graph 需要兩種權限。

## Author View

看全部：

```text
所有 Node
所有 Edge
Hidden State
Future Node
Convergence Variant Conditions
```

## Player View

只看玩家已經走過 / 知道的部分。

```text
已走過 Node = 完整顯示
知道存在但未走 = silhouette / ?
完全未知 = 不顯示
```

例如第一輪結束後：

```text
[N022 ???]
    │
    ?
    ▼
[未知分支]
```

Loop 2 真正走過後才解鎖。

這可以讓 Event Graph 本身成為玩家的世界線閱讀器。

---

# 17. Viewer Interaction

必要功能：

1. Pan / Zoom
2. 點 Node 開 Inspector
3. Worldline selector
4. Highlight current Path
5. Compare two Worldlines
6. Toggle Author / Player mode
7. 搜尋角色
8. 搜尋時間
9. 只看某角色影響鏈
10. 從任一 Node 選 `Show downstream effects`

例如點：

```text
N022 與若晴聊攝影
```

選：

```text
Show downstream effects
```

Viewer 應只高亮：

```text
N022
 ↓
N025
 ↓
N027
 ├─ N032
 └─ N034
      ↓
     ...
      ↓
N100
```

作者就能直接回答：

> 「我改這一句對話，後面到底會壞掉哪些地方？」

---

# 18. Layout 原則

時間預設由左到右或由上到下固定一個方向。

建議玩家閱讀模式採 **Top → Bottom**：

```text
14:20
 ↓
15:00
 ↓
16:10
 ↓
17:20
 ↓
18:31
 ↓
23:59
 ↓
00:00
```

同一時間的不同角色分支橫向展開。

例如：

```text
                    17:50

    若晴 lane       庭安 lane       柏勳 lane       予安 lane
       │                │               │               │
       ▼                ▼               ▼               ▼
    回家             去車站           去車站          郵局
       │                │               │               │
       └──────────────┬─┴───────────────┘               │
                      ▼                                 │
                  18:31 Convergence ◄───────────────────┘
```

這樣能同時讀時間與人物因果。

---

# 19. Canon Rule

從此以後新故事必須先加入 Graph，才能寫小說。

順序固定：

```text
Canon Truth
↓
Node
↓
Edge
↓
State Change
↓
Downstream Effects
↓
Worldline Path
↓
Novel Scene
```

禁止：

```text
先寫一段很酷的劇情
↓
之後才硬補它為什麼發生
```

這就是目前故事前後容易對不上的主要來源。

---

# 20. 下一階段故事工作

第一階段優先把 Day 01 做成完整 DAG：

```text
14:20 Return
→ 15:00 Zhixia Room
→ 16:10 Wakaharu
→ 16:40 Reporter
→ 17:20 Route Knowledge
→ 17:40 Doctor
→ 18:05 Handoff Variants
→ 18:31 Convergence
→ 19:00 Aftermath
→ 20:00 Personal Life Fallout
→ 20:30 Five-years-ago clue
→ 22:40 Watch Message
→ 23:59 Bell
→ 00:00 Reset
```

每一段至少建立：

- 2～4 個可偏移 Node
- 至少 1 條 delayed consequence
- 至少 1 條人物自己的生活線
- 至少 1 個 information-only Node
- 不要求每個選擇都改死亡

完成 Day 01 DAG 後，再依 Graph 寫完整視覺小說場景。

---

# Success Criteria

玩家或作者看到 Graph 時，應能直接回答：

1. 為什麼若晴這一輪去了車站？
2. 為什麼另一輪沒有去？
3. 為什麼庭安會出現在車站？
4. 是哪一個早期選擇讓柏勳 18:31 還留在異常區？
5. 為什麼予安在 Chapter 5 開始記得？
6. 一個 16:10 的小選擇，最遠影響到哪些晚間事件？
7. 這條 Worldline 與上一輪到底差在哪？

如果 Graph 無法回答，就代表故事因果還沒寫完整。