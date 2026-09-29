# Core Gameplay Spec v0.1

> Status: Draft / confirmed design rules are canonical; implementation parameters remain tunable.
>
> Scope: Core player loop, interaction, attention, perception, memory, dialogue, and investigation behavior.
>
> Precedence rule: this document describes the current design only. Superseded discussion history is not normative. If an example conflicts with a rule, the rule wins and the example must be corrected.

---

## 1. Core Fantasy

遊戲不告訴玩家什麼是線索。

玩家透過「注意什麼、錯過什麼、記住什麼、何時介入」，逐漸理解一個不會等待他的世界。

玩家真正累積的不是角色等級，而是自己對這座小鎮、人物與不同 Worldline 的理解。

核心感受：

> 我記得一些這個世界已經忘記的事情。

以及：

> 這一次，我知道那個時間點會發生什麼。

核心循環：

```text
World continuously moves
        ↓
Scene / Dialogue / Ambient / Opportunity
        ↓
Player Attention
        ↓
Perception
        ↓
Memory Capture
        ↓
Memory Library
        ↓
Investigation Wall
        ↓
Player-created hypothesis
        ↓
Choice / Memory Input / Different Action
        ↓
Different Event / Worldline
        ↓
New World State
```

---

## 2. Canonical Invariants

以下規則優先於任何後續範例或 UI 實作細節。

1. **World Never Waits**：世界時間持續流動，不因玩家猶豫、離線、閱讀或整理注意力而停止。
2. **Single Main Action**：玩家同一時間只能親自執行一個主要 Action。
3. **Single Focus**：任何時刻只能有一個主要 Attention Focus。
4. **Faded ≠ Paused**：被淡化的內容仍然繼續發生。
5. **Attention Shift Takes Time**：把注意力轉向另一處不是零時間 UI 切換。
6. **Perception Boundary**：只有主角實際感知到的資訊，才能成為可記住的內容。
7. **Memory Is Player-selected**：系統不替玩家決定什麼值得保存。
8. **No Auto Deduction**：系統不自動標記重要、矛盾、因果或正確推理。
9. **Finite Information**：同一時間、同一地點的事件集合有限，不因 Grinding 無限產生線索。
10. **Loop Persistence Is Asymmetric**：主角側的 Memory / Investigation 持續；NPC 關係、NPC 記憶與該輪世界狀態不自動持續。

---

## 3. World Time — The World Never Waits

世界時間不因玩家離線而停止。

例如玩家 17:00 離開、20:00 回來，17:00–20:00 間原本會發生的事件仍然發生。

重要事件不因玩家沒有在線而等待。

玩家可能因此：

- 錯過事件
- 只看到事件結果
- 從 NPC 或環境得知後果
- 在下一輪利用已掌握的 Memory 提前介入

「錯過」是 Gameplay，不是系統錯誤。

### 3.1 Real time is not a spendable UI resource

遊戲不應把時間主要表達成：

```text
翻報紙 → -45 秒
```

而是玩家真的經歷這 45 秒。

```text
走向病房
   ↓
注意到報紙
   ↓
停下來翻閱
   ↓
世界仍持續變化
   ↓
45 秒自然經過
   ↓
繼續原本行程
```

### 3.2 No narrative fast-forward

重複對話、已知內容、文字顯示速度都不能偷偷改變 World Time。

若 NPC 原本需要 2 秒說完一句話，那 2 秒仍然存在於世界中。

---

## 4. Single Main Action

玩家同一時間只能親自處理一個主要 Action，例如：

- 前往某處
- 跟蹤角色
- 搜查房間
- 調查文件
- 與 NPC 深入談話
- 等待特定事件

Main Action 表示主角當下真正正在做的事情。

短暫把 Attention 拉向別處，不等於啟動第二個 Main Action。

```text
Main Action: 與護士談話
        ↓
短暫看向門口
        ↓
回到護士
```

整段仍然只有一個 Main Action。

### 4.1 Delegation

玩家可在合理故事情境下請 NPC 處理另一件事情，但這不是獨立的 Idle Dispatch System。

Delegation 必須自然來自情境，例如：

- NPC 本來就會經過該地點
- 玩家與 NPC 的關係足以提出要求
- 玩家已掌握足夠資訊能說明要做什麼
- 兩件事情同時發生，玩家不可能親自完成兩邊

避免：

```text
選角色 → 選任務 → 等待 → 領獎勵
```

---

## 5. Scene-driven Interaction

主要互動應從場景本身自然產生，而不是依賴 Action List、Quest Panel 或任務選單。

例如醫院走廊可能同時存在：

- 護士
- 病歷
- 報紙
- 窗戶
- 飲水機
- 遠處腳步聲
- 一閃而過的人影

玩家與世界互動後，結果可能只是 Attention / Observation，也可能進一步變成新的 Main Action。

因此：

> **Interactable ≠ Action。**

看一眼門口通常只是 Attention Diversion；追出去才可能成為 True Interrupt 並改變 Main Action。

### 5.1 Weak Affordance

場景可以提供非常弱的可互動暗示，例如：

- 游標些微變化
- 微小視差
- 細微動態
- 很弱的空間聲音反應

Weak Affordance 只表示「這裡可以互動」，不能表示「這裡很重要」。

禁止用：

- 發光線索
- 驚嘆號
- Quest Marker
- 特殊顏色代表重要性
- 系統主動高亮真相

---

## 6. Opportunity Window

場景不是靜態互動地圖。

物件、人物、聲音與互動機會可能只存在短暫時間。

```text
10:31:04  經過護理站，桌上有一份病歷
10:31:11  護士回來，病歷被收走
10:31:18  主角已離開護理站範圍
```

玩家可能：

- Notice 到它但不進一步 Attend
- Attend 並看清部分內容
- 進一步互動
- 忽略
- 因 Attention 在其他地方而錯過
- 因 Opportunity Window 已關閉而來不及

Opportunity 不會為玩家停留。

### 6.1 Interaction is not free

任何互動都可能造成自然後果：

- 真實時間經過
- NPC 位置改變
- 被 NPC 看見
- 錯過其他事件
- 改變後續世界狀態

這些後果不需要全部顯示成 UI 數值。

---

## 7. Attention System

Attention 不是獨立資源條。

不要顯示：

- Attention 70/100
- Focus Bar
- 鎖定框
- 眼睛 Icon

玩家直接透過游標 / 觸控與場景操作主角的當下感知方向。

### 7.1 Single Focus Rule

任何時刻只能有一個主要 Focus。

當玩家 Hover 新目標時，Focus 轉向該目標；其他內容會被淡化。

```text
目前 Focus：護士

                              「後來柏勳——」

           ……喀。                  （較淡的 peripheral cue）

                                         …………（遠處動靜）
```

玩家 Hover 門聲：

```text
                              「後來……」
                              （淡化）

           ……喀。
           ↑ Focus

                                         …………
                                         （淡化）
```

這不是暫停其他事件，只是主角沒有把主要注意力放在它們上面。

### 7.2 Hover → Notice / Focus

Hover 表示主角把注意力偏向一個目標，開始 Notice 它。

Hover 本身：

- 只允許一個 Focus
- 不切換 Main Action
- 不停止 World Time
- 不保證來得及取得完整資訊
- 不會讓已經錯過的內容重新出現

玩家快速把游標掃遍畫面，不會免費得到所有資訊。

### 7.3 Click → Attend

Click 表示主角真正投入感知該目標。

這可能涉及：

```text
Notice source
    ↓
realize direction
    ↓
turn head / change listening direction
    ↓
focus eyes / body
    ↓
Observe
```

Attention Shift 是世界中的真實行為，因此需要時間。

```text
護士 ───────────────── 門
 ↑                       ↑
Current Focus           Click

護士：「後來柏勳就——」

        [主角正在轉頭]

                         門關上。
```

玩家可能只看到門關上的最後一瞬間。

### 7.4 Elastic Attention

短暫 Observation 預設採 Elastic Attention。

```text
Original Main Action
        ↓
Hover / Notice
        ↓
Click / Attend
        ↓
Attention Shift
        ↓
Observe
        ↓
Observation ends naturally
        ↓
Auto Return
        ↓
Resume original Focus / Action
```

Observation 結束後，主角會自然把 Attention 拉回原本 Main Action。

玩家不需要再點一次原目標。

### 7.5 Attention Redirect is not True Interrupt

如果 Observation 尚未結束，玩家可以 Click 另一個目標，把 Attention 改向別處。

這稱為 **Attention Redirect**，不要和 Main Action 的 True Interrupt 混用。

```text
Observe Door
    ↓
Redirect Attention
    ↓
Attend Nurse
```

結果可能是：重新聽到護士，但沒有看清門後的人。

### 7.6 True Interrupt

只有當玩家真的放下目前 Main Action，才叫 True Interrupt，例如：

- 離開談話現場
- 追出去
- 放下文件去做另一件事
- 改走另一條路

Action 可以自行定義：

- 可直接恢復
- 恢復時保留部分進度
- 中斷後進度流失
- 中斷即失敗
- 某些階段不可中斷 Main Action

「不可中斷 Main Action」不等於「完全不能短暫改變 Attention」。

### 7.7 Faded does not mean paused

最重要的底層規則之一：

> **被淡化 ≠ 沒有發生。世界永遠不等待玩家。**

玩家 Focus 門時：

```text
Foreground
    ……喀。
    門正在關上。

Background / Faded
                              護士：「他後來去了港口。」
```

護士仍然真的把那句話說完。

玩家之後回到護士，不會重新播放「他後來去了港口」。

### 7.8 Rapid scanning has natural cost

```text
────────────── Real Time ──────────────→

護士    A────B────C────D
門           喀───關上
窗戶              人影──→消失
```

玩家快速 Focus：

```text
護士 → 門 → 窗戶 → 護士
```

可能得到的不是更多資訊，而是：

> 每件事情都感知到一點，但沒有任何一件事情真正看完整。

這就是 Attention 的成本，不需要額外扣除 Attention Point。

---

## 8. Ambient Narrative

Main Action 進行期間，世界仍然持續產生內容。

Ambient Narrative 可以包含：

- 環境聲音
- NPC 閒聊
- 無關日常
- 主角雜念
- 世界事件
- 尚無法判斷意義的異常
- 短暫人影或物件

它們不是 Notification Feed。

Ambient 應存在於場景與感知空間內，而不是固定右上角跳通知。

### 8.1 Ambient Presentation

可使用：

- Fade in / Fade out 文字
- Spatial Text
- 圖像
- Pixel Animation
- 聲音
- 微小震動
- 視差
- Blur / Focus
- 短暫移動物件

重要與不重要資訊不能有固定不同的視覺語言。

### 8.2 Ambient obeys Single Focus

多個事件可以同時存在，但不代表玩家能同時清楚讀取所有事件。

目前 Focus 之外的內容可以只以 peripheral cue、淡化文字、聲音方向或模糊動態存在。

一旦 Hover 某一項，它成為唯一主要 Focus，其餘內容進一步退到背景，但仍持續變化。

---

## 9. Perception Boundary

核心規則：

> **World Event ≠ Player Knowledge。**

世界中發生某件事，不代表主角已經知道。

資訊必須真的進入主角感知，才可能被記住。

概念鏈：

```text
World Event
    ↓
Peripheral cue / Notice opportunity
    ↓
Attention
    ↓
Perception
    ↓
Memory Capture
    ↓
Persistent Memory
```

如果主角始終 Focus 護士、沒有真正看向窗戶，就不能事後得到清楚的「窗外人影」Memory。

### 9.1 Perception fidelity

Memory 不能比原始感知更清楚。

若主角只看到：

```text
雨中的模糊人影
```

Memory 不可以事後變成：

```text
清楚的人臉 + 身分
```

### 9.2 Residual must still come from perception

Residual（殘留印象）不能憑空知道未感知的 World Event。

允許的是：主角雖然沒有完整 Attend，但真的聽到或感受到一個很弱的 sensory fragment。

例如：

```text
18:14  ——砰。

主角仍在談話 Main Action。
Attention 沒有轉向聲音來源，
但撞擊聲本身進入了周邊聽覺。

18:31

「……剛才外面是不是有什麼聲音？」
```

若主角連聲音都沒有實際聽到，就不應事後生成 Residual。

Residual 只保留模糊感受，不替玩家揭露真正事件。

---

## 10. Spatial Typography / Spatial Dialogue

文字不是傳統 Dialogue Box 的內容而已。

文字位置本身可以傳達：

- 說話者相對方位
- 聲音來源
- 人物距離
- 人物移動
- Attention 方向
- 場景空間關係

例如：

```text
              ……喀。


                              「你找誰？」


「……柏勳。」
```

不需要額外顯示：

```text
護士：
主角：
門：
```

只要空間關係足夠清楚，就讓玩家自己理解。

### 10.1 Screen as stage

文字位置繼承人物在場景中的位置。

如果護士逐漸靠近：

```text
右上角     「你找誰？」
              ↓
右側       「柏勳？」
              ↓
右下附近   「你認識他？」
```

這是文字版 Blocking。

### 10.2 Spatial properties

```text
位置       → 方位 / 來源
大小       → 距離 / 感知強度
透明度     → 清晰度 / Attention
出現節奏   → 語氣 / Speech Rhythm
輕微抖動   → 衝擊 / 不穩定
Fade       → Attention 離開 / 句子離開當下
位置移動   → 人物或聲音來源移動
```

效果應保持克制，不能把每一句話都變成特效展示。

---

## 11. Text Echo

對話不應像 Chat History 一樣一路往下堆。

一句話完成後，文字進入 Text Echo：

```text
「你找誰？」
     ↓
「你找誰？」（逐漸變淡）

「……柏勳。」
```

Text Echo 表示剛才的內容仍短暫停留在感知中，之後自然消失。

不同內容可以因角色心理狀態有不同殘留時間，但：

> Echo 長度不能代表「系統判定的重要程度」。

Text Echo 也是 Memory Capture 的主要入口之一。

---

## 12. Rhythmic Text

文字不採固定 `30ms / character` 的 Typewriter Speed。

角色說話應依 Phrase / Beat / Pause 呈現。

```text
「你……」
    （停頓）
「你怎麼會知道這件事？」
```

或：

```text
「我不是——」
    （停住）
「……算了。」
```

Speech Rhythm 就是 World Time 的一部分。

Pause 期間：

- NPC 可以移動
- Ambient Event 可以發生
- Opportunity Window 可以關閉
- 玩家可以轉移 Attention

---

## 13. Dialogue Is Continuous Gameplay

Dialogue 不是 Gameplay 的暫停區。

一般台詞可以依主角既定性格自然回答，不需要每一句都要求玩家選 A/B/C。

```text
                              「你找誰？」

「……柏勳。」

                              「柏勳？」
```

玩家在 Dialogue 中仍可：

- 保持 Focus 在說話者
- Hover 另一個 cue → Notice
- Click → Attend / Observe
- Capture 自己實際感知到的 Moment
- 使用 Memory Input
- 在重大時刻做 Choice
- True Interrupt 對話 / 離開現場

### 13.1 Meaningful Choice only

只有真正涉及下列內容時才需要明確 Choice：

- 主角意圖
- 行動方向
- 關係變化
- 風險承擔
- Worldline 分歧

Choice 應盡量存在於主角 Spatial Area，而不是突然跳出傳統 Menu。

### 13.2 Choice and Memory Input are different

Choice 與 Memory Input 不互相取代。

```text
一般對話
  → 主角自然回答

重大決策
  → Choice

特定可介入節點
  → Memory Input
```

---

## 14. Attention Release for Repeated Dialogue

輪迴後再次遇到已知內容，不使用傳統 Fast-forward 改變世界速度。

已知對話可以使用 **Attention Release**：讓玩家降低對已知內容的視覺注意，而不是讓 NPC 加速說完。

```text
                              「柏勳那天確實有來……」
                              （已知內容退到背景）

          ……兩個護士正在小聲說話。
```

世界時間照常。

Attention Release 不代表玩家能同時完整讀取所有內容；**Single Focus Rule 仍然成立**。

玩家仍必須決定要 Focus 哪一個事件。

### 14.1 Information is finite

同一時間、同一地點具有有限事件集合。

```text
13:42:10 ～ 13:42:50 / 護理站
├─ 主對話
├─ Ambient A：307 病房談話
├─ Ambient B：推車經過
├─ Ambient C：門發出聲音
└─ Opportunity D：窗外短暫人影
```

第一輪可能只聽主對話；下一輪轉向其他內容。

全部探索後，這段時間可能真的沒有更多資訊。

系統不得為 Grinding 無限隨機製造線索。

---

## 15. Memory Capture

Memory 不是系統自動建立的線索列表。

玩家主動決定：

> **我要讓主角記住這個自己真正感知到的 Moment。**

這稱為 Memory Capture。

### 15.1 Text Capture

一句話完成並進入 Text Echo：

```text
「我六點一直都在店裡。」
          ↓ fade
```

玩家可 Hold 該 Echo：

```text
「我六點一直都在店裡。」
          ↑
        HOLD
```

感覺可以是：

```text
Hold
 → Target becomes Focus
 → Other perception fades
 → Text freezes briefly
 → subtle sensory sound
 → Moment is pulled out of the present
 → Memory
```

不顯示：

- 已加入收藏 ✓
- 發現重要線索
- Rare Clue

### 15.2 Capture obeys Single Focus

Capture 本身會占用 Attention。

當玩家 Hold 一段 Text Echo / Visual / Sound Moment 時，它成為主要 Focus，其餘內容淡化但持續發生。

```text
玩家正在 Capture：
「我六點一直都在店裡。」

                              ……喀。

                              「後來柏勳就——」
```

玩家可能因 Capture 上一句而漏掉下一句。

Memory Capture 不暫停世界。

### 15.3 Input tolerance

Capture 不應要求 Pixel-perfect Input。

Hover / Hold 的實際命中範圍與 Hold Duration 由 Prototype / Playtest 決定。

這是 Implementation Parameter，不是核心玩法規則。

---

## 16. Memory Types

Memory 保存的是 Perceived Moment，而不只是文字。

至少支援：

- Text Memory
- Visual Memory
- Sound Memory
- Composite Moment

### 16.1 Visual Memory

```text
17:52 · Loop 02 · 醫院
┌────────────────────┐
│  模糊的雨中窗戶      │
│        → 人影        │
└────────────────────┘
```

若當時只看到模糊人影，就只能保存模糊人影。

### 16.2 Sound Memory

```text
18:14 · Loop 03 · 醫院走廊
Sound Memory
「不明撞擊聲」
```

### 16.3 Composite Moment

Composite 只能組合主角在同一 Moment 真正感知到的元素。

它不能把同時發生、但主角沒有感知到的事件一起打包。

例如主角當時確實同時感知到：

```text
護士：「後來柏勳——」

        砰——

右側病房門在視野邊緣震了一下。
```

才可以形成包含這些元素的 Composite Moment。

---

## 17. Memory Persistence Across Loops

輪迴後，明確持續的是：

- Captured Memory
- Memory metadata
- Investigation Wall 排版
- 玩家建立的連線
- 玩家備註

不自動持續：

- NPC 對主角的關係
- NPC 對上一輪的記憶
- NPC 人格上的「累積傷害」
- 上一輪已改變的世界狀態

只有主角側承受跨輪迴資訊累積。

### 17.1 Captured Memory is the guaranteed persistent record

玩家可能在遊玩中自己記得很多事情，但 Core System 保證可檢索、可帶入未來節點的 diegetic record 是 Captured Memory。

未 Capture 的內容：

- 不會事後自動生成完整 Memory Card
- 不會補回玩家當時沒看到的細節
- 是否留下非常模糊的故事性印象，屬於 Residual / Narrative Rule

這避免 Memory Capture 被「系統其實全部都幫你記住」架空。

---

## 18. Memory Resonance

再次經歷已知內容時，主角可以偶爾產生很短的內在反應。

```text
「柏勳那天確實有來……」

      ……又是這句。
```

如果存在主角可合理回想的 persistent Memory：

```text
「柏勳那天確實有來……」

      ……等等。
      上次她說的是「沒有見過」。
```

到這裡停止。

系統不得繼續說：

- 她在說謊
- 發現矛盾
- 應該拿哪張 Memory 質問
- 這是重要線索

Memory Resonance：

- 不保證出現
- 不保證有用
- 不應依 hidden clue importance 觸發
- 不能引用主角從未感知過的事件
- 不能替玩家完成推理

---

## 19. Memory Library

Memory Library 的目的：

> 找到「我記得什麼」。

允許中性工具：

- 搜尋
- Loop 篩選
- 時間篩選
- 人物 metadata
- 場景 metadata
- Memory Type

不得提供：

- 自動重要度
- 自動矛盾偵測
- 自動因果分析
- 自動正確答案
- AI 自動整理真相

不同 Loop 的 Memory 可以互相矛盾而並存。

```text
Loop 01｜若晴：「18:00 我還在店裡。」
Loop 03｜17:52 看見若晴離開店附近。
```

系統不顯示「矛盾！」。

---

## 20. Investigation Wall

Investigation Wall 是 Infinite Canvas。

```text
Memory Library     = 我記得什麼
Investigation Wall = 我認為這些事情可能有什麼關係
```

Wall 上的 Memory 是原 Memory 的 Reference，不是資料複製。

從 Wall 移除 Card，不會刪除 Memory Library 中的原 Memory。

### 20.1 Required interactions

v0.1 支援：

- 自由擺放
- Drag
- Zoom / Pan
- Memory Reference
- Card-to-Card 自由連線
- 玩家自行寫 Note
- 框選 / Group

連線沒有預設系統語意。

不要要求玩家選：

- 因果
- 矛盾
- 同一人物
- 時間關係

玩家可以自己寫：

```text
[若晴：18:00 還在店裡]
          │
          │
[17:52 看見若晴離開]
          │
      「說謊？」
```

「說謊？」只是玩家 hypothesis，不是遊戲結論。

---

## 21. Memory as Input

特定 Dialogue / Event 可以接受特定 Memory 作為介入。

```text
若晴：「我六點一直都在店裡。」

Memory
[17:52 看見她離開]
        ↓
帶入當前節點
        ↓
觸發對應 Narrative Action
```

v0.1 不需要 LLM 任意判斷語意。

底層可以明確定義：

```ts
acceptedMemoryIds: ["memory_station_1752"]
```

### 21.1 Invalid Memory

錯誤或無關 Memory：

- 無法完成 Drop / Use
- 回到原位置
- 不產生 Trust 懲罰

這只是 UI 試錯，不是角色真的做了某件蠢事。

### 21.2 Successful Memory action can have consequences

如果 Memory 成功觸發真正 Narrative Action，例如質問、揭露或改變行動，後續當然可以造成：

- Trust 下降
- NPC 防備
- Worldline 改變
- 新 Opportunity 出現 / 消失

代價來自「角色真的做了這件事」，不是拖曳錯誤。

---

## 22. Immersive Interaction Principle

能用世界本身表達的資訊，就不要額外建立 UI。

World Layer：

```text
Text
+ Scene
+ Image
+ Sound
+ Motion
+ Vibration
```

應盡量避免：

- Dialogue Box
- Quest Panel
- Action List
- Notification Feed
- Progress Modal
- Action Complete Popup
- 大量 HUD

### 22.1 Two interaction layers

```text
World Layer
Text + Scene + Image + Sound + Motion
        ↓
Live / perceive the world

Memory Layer
Memory Library + Investigation Wall
        ↓
Organize remembered information
```

World Layer 追求沉浸、時間連續與 Attention Gameplay。

Memory Layer 才允許比較明確的管理型 UI，因為它代表主角主動整理記憶。

---

## 23. Design Guardrails

### 23.1 No Checklist Adventure

不要顯示：

> 你發現了重要線索。

### 23.2 No Clue Highlight Language

線索與垃圾資訊使用相同設計語言。

玩家甚至可以 Capture：

> 最近真的好冷。

它可能重要，也可能完全沒有用。

### 23.3 No Database Auto-deduction

Investigation Wall 不替玩家整理關係。

### 23.4 No Brute-force Dialogue Inventory

Memory Input 不是讓玩家把所有 Card 依序塞給每個 NPC。

v0.1 暫不對 Invalid Memory 加懲罰；若 Playtest 顯示 brute-force 成為主流，再另行設計限制。

### 23.5 No Infinite Clue Grinding

重複進入相同時間與地點不能無限生成新情報。

### 23.6 No Attention Cheat

快速 Hover 全畫面不能凍結其他資訊，也不能把所有事件一次完整解讀。

Single Focus + World Time 自然形成成本。

---

## 24. End-to-end Example

玩家正在醫院護理站與護士交談。

```text
13:42:10

                              護士：「我記得大概六點——」

13:42:12

           ……喀。      ← peripheral cue

                              護士：「柏勳那時候……」
```

玩家 Hover 門聲：

```text
13:42:12.4

                              護士：「柏勳那時候……」
                              （淡化，但仍繼續說）

           ……喀。
           ↑ Focus
```

玩家 Click：

```text
13:42:13

主角開始轉頭。

                              護士：「……去了港口。」

13:42:14

           門正在關上。
           只看到一隻手離開門框。
```

玩家沒有 Redirect，Observation 自然完成：

```text
13:42:16
Elastic Attention → Auto Return

13:42:17

                              護士：「之後我就沒看到他了。」
```

玩家此時真的感知到：

- 13:42 左右門口有動靜
- 門關上的瞬間
- 一隻手離開門框
- 護士最後一句話

玩家可能沒有真正聽清楚被淡化期間的：

> 「去了港口。」

世界不重播那句話。

下一輪玩家可以選擇不要轉頭，而是專心聽護士；也可以更早 Focus 門口。

這就是 Loop 的知識累積，而不是 Checklist 的任務累積。

---

## 25. Implementation Vocabulary

為避免工程實作再次出現語意衝突，統一使用以下名詞：

| Term | Meaning |
|---|---|
| Main Action | 主角當下唯一主要行動 |
| Opportunity | 有時間窗的世界互動機會 |
| Peripheral Cue | 尚未成為主要 Focus 的弱感知訊號 |
| Hover / Notice | 把唯一 Focus 偏向某目標，不切 Main Action |
| Click / Attend | 真正投入感知並開始 Observation |
| Attention Shift | Focus 在世界內轉移，需要時間 |
| Observation | 主角正在感知某目標的短暫過程 |
| Elastic Attention | Observation 完成後自動回到原 Main Action |
| Attention Redirect | Observation 途中改 Focus 到其他目標 |
| True Interrupt | 真正放下 / 離開目前 Main Action |
| Text Echo | 已說完文字留下的短暫淡化殘影 |
| Attention Release | 已知內容降低視覺主導性，但 World Time 不加速 |
| Perception | 主角實際取得到的感知資訊 |
| Residual | 實際感知過但極模糊的殘留印象 |
| Memory Capture | 玩家主動保存一個已 Perceive 的 Moment |
| Memory | 跨 Loop 可檢索的 persistent remembered record |
| Investigation Wall | 玩家自行建立關係與 hypothesis 的無邊界空間 |
| Memory Input | 在設計好的 Narrative Node 使用特定 Memory 介入 |

---

## 26. Tunable, Not Yet Frozen

以下屬於 Prototype / Playtest 參數，不應和核心玩法規則混在一起：

- Hover 命中範圍
- Hover 進入 Focus 的 debounce / delay
- Attention Shift 的具體秒數
- Hold Capture 時長
- Text Echo Fade 秒數
- Font / font size
- Blur 強度
- 音效音量
- 動畫 easing
- Mouse / touch / controller 的具體 mapping

調整這些數值不能破壞 §2 Canonical Invariants。
