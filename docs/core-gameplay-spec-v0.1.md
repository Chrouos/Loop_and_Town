# Core Gameplay Spec v0.1

> Status: Draft / latest confirmed gameplay rules take precedence
>
> Scope: Core player loop only. Story-specific reactions and chapter content are intentionally excluded.

## 1. Core Principle

遊戲不告訴玩家什麼是線索。

玩家透過「記住什麼、忽略什麼、何時行動」，逐漸理解一個不會等待他的世界。

```text
現實時間 / 世界持續運行
        ↓
玩家一次只能處理一個主要行動
        ↓
觀察 / 等待 / 被環境雜訊干擾
        ↓
決定是否中斷、忽略或繼續
        ↓
玩家自行保存 Memory
        ↓
Memory Cards 跨輪迴累積
        ↓
在 Investigation Wall 自行建立關聯
        ↓
把特定 Memory 帶回事件 / 對話使用
        ↓
改變世界線
```

---

## 2. World Never Waits

世界時間不因玩家離線而停止。

玩家 17:00 離開、20:00 回來，17:00–20:00 間原本會發生的事件仍然發生。

重要事件不應因為玩家沒有在線而自動等待玩家。

玩家可能因此：

- 錯過事件
- 只看到事件結果
- 從其他角色口中得知事件
- 在下一輪利用記憶提前介入

「錯過」是玩法的一部分，不是系統錯誤。

---

## 3. Single Active Action

玩家同一時間只能親自處理一個主要行動。

例如：

- 調查病歷
- 跟蹤角色
- 與 NPC 深入談話
- 前往某個地點
- 等待特定事件
- 搜查房間

當多個事件同時發生時，玩家仍只有一個主要 Action；但可透過 Elastic Attention 暫時偏離目前 Action 去感知短暫事件。這種短暫感知不等同於啟動第二個主要 Action。

玩家可在合理情境下委託 NPC 處理另一件事情，但這不是獨立的「派遣系統」。

委託必須由故事情境自然產生，例如：

- 玩家已掌握足夠資訊
- NPC 本來就會經過該地點
- 玩家與 NPC 的關係足以提出要求
- 玩家同時面臨兩個無法親自完成的行動

---

## 4. Ambient Narrative

主要行動進行期間，畫面仍持續存在內容。

Ambient Narrative 可以包含：

- 環境聲音
- 主角雜念
- NPC 訊息
- 無關日常
- 世界正在發生的事件
- 尚無法判斷的重要異常

系統不得用視覺效果直接告訴玩家「這是重要線索」。

```text
[正在翻閱舊病歷……]

沙沙——

「這個名字好像在哪裡看過。」

窗外開始下雨。

        嗚——嗚——

一輛救護車快速駛過。

「……這個方向不是急診入口。」
```

雜訊可能真的毫無意義，也可能在數個 Loop 後才被理解。

---

## 5. Interrupt and Attention Diversion

需要區分「Attention 暫時偏離」與「真正中斷 Action」。

### 5.1 Attention Diversion

短暫注意 Ambient / Opportunity 時，預設使用 Elastic Attention：

```text
Original Action
      ↓
Attention Shift
      ↓
Observe
      ↓
Auto Return
      ↓
Resume Original Action
```

例如主角正在和護士談話，聽到門發出「……喀。」後轉頭看一眼。只要 Observation 自然結束，Attention 會回到護士；這不等同於終止整段談話。

### 5.2 True Interrupt

只有當玩家的介入需要真正放下目前 Action，例如離開房間、追出去、改做另一個主要行動，才視為 Interrupt。

一般可恢復 Action 可以保存進度；例如調查病歷進行約 70% 時離開，之後可從接近原進度繼續。

但 Action 可以自行定義：

- 可直接繼續
- 中斷後部分進度流失
- 中斷即失敗
- 特定階段不可中斷

系統不必直接顯示代價。玩家應從情境理解「現在能不能放下這件事」。


---

## 6. Missed Noise / Residual

玩家不需要注意到所有 Ambient Narrative。

錯過的重要事件可以只留下模糊的 Residual（殘留印象）。

例如：

```text
18:14  ——砰。

玩家正在進行不可中斷的談話。

18:31

「……剛才外面是不是有什麼聲音？」
```

Residual 不需要告訴玩家真正發生了什麼。

玩家可能在下一輪主動等待 18:14，才第一次看清事件。

---

## 7. Memory Cards

遊戲不存在「系統認證的線索列表」。

玩家可以透過 Memory Capture，主動讓主角記住自己當下真正感知到的 Moment，形成 Memory Card / Memory Record。

Memory 可以來自：

- Text：NPC 對話、文件文字、主角觀察
- Visual：人影、動作、場景瞬間
- Sound：撞擊聲、腳步聲、遠處談話
- Composite Moment：同一瞬間實際感知到的文字、畫面與聲音組合
- 玩家認為重要、但實際可能無關的資訊

時間、地點、Loop、來源人物 / 場景等作為來源 metadata 保存。遊戲不得主動提示哪一個 Moment 值得 Capture，也不得補上主角當時沒有感知到的資訊。

### 7.1 Persistence

所有 Memory Cards 跨 Loop 保留。

每張 Memory 應保留基本來源 metadata，例如：

- Loop
- 發生時間
- 來源人物 / 場景
- 當時實際 Capture 到的原始感知內容

因此不同 Loop 的資訊可以並存，甚至互相矛盾。

```text
Loop 01｜若晴：「18:00 我還在店裡。」

Loop 03｜17:52 看到若晴離開店裡。
```

系統不自動提示「矛盾」。

---

## 8. Memory Library

Memory Cards 首先存在於可檢索的 Memory Library。

Memory Library 的目標是「找到我記得的東西」，不是替玩家推理。

允許提供中性的檢索工具，例如：

- 搜尋
- Loop 篩選
- 時間篩選
- 人物 / 場景 metadata 篩選

不得提供：

- 自動重要度
- 自動矛盾偵測
- 自動因果分類
- 自動推理結論

---

## 9. Investigation Wall

Investigation Wall 是獨立於 Memory Library 的 Infinite Canvas（無邊界推理牆）。

概念：

> Memory Cards = 我記得什麼  
> Investigation Wall = 我認為這些事情之間有什麼關係

玩家從 Memory Library 將 Card 貼到 Wall。

牆上的 Card 是原 Memory 的 Reference，不是複製資料。

因此從牆上移除 Card，不會刪除原始 Memory。

### 9.1 Core interactions

v0.1 必須支援：

- 自由擺放
- 拖曳
- 縮放 / 平移
- Memory Card 貼上
- Card 與 Card 自由連線
- 玩家自行寫備註
- 框選 / 群組

連線沒有系統語意。

玩家不需要選擇：

- 因果
- 矛盾
- 同一人物
- 時間關係

只是一條玩家自己理解的線。

```text
[若晴：18:00 在店裡]
          │
          │
[17:52 監視器畫面]
          │
      「說謊？」
```

「說謊？」只是玩家自己寫的備註，遊戲不判定它是否正確。

---

## 10. Memory as Input

特定 Dialogue / Event 可以接受特定 Memory 作為輸入。

玩家不是從系統預設的 A/B/C 選項選擇問題，而是從自己的 Memory Library / Wall 找出一段記憶帶回當下。

```text
若晴：「我六點一直都在店裡。」

Memory
[17:52 監視器畫面]
        ↓
拖入當前對話
        ↓
觸發對應事件
```

底層不需要 LLM 判斷任意語意。

Dialogue / Event 可以明確定義：

```ts
acceptedMemoryIds: ["memory_station_cctv_1752"]
```

只有設計好的 Memory 可以觸發該反應。

### 10.1 Invalid Memory

無關 Memory：

- 無法 Drop
- 回到原位置
- v0.1 不產生代價

這是 UI 試錯，不視為角色行動。

### 10.2 Actual narrative action

如果 Memory 成功觸發一個真正的質問 / 行動，後續劇情可以產生代價，例如 Trust 下降。

代價屬於「角色行動」，不是拖曳操作失誤。

---

## 11. Loop Persistence

輪迴後：

保留：

- 玩家 Memory Cards
- Investigation Wall 排版
- 玩家連線
- 玩家備註
- 玩家對過去世界線的資訊

不因輪迴自動保留：

- NPC 對主角的關係
- NPC 對上一輪事件的記憶
- 已改變世界的狀態

NPC 是否察覺主角知道不該知道的事情，屬於 Story / Narrative Rule，不是 Core Gameplay 必備規則。

---

## 12. Design Guardrails

Core Gameplay 應避免退化成：

### Checklist adventure

遊戲不主動標記：

> 你發現了重要線索。

### Dispatch idle game

NPC 委託不是：

> 選角色 → 選任務 → 等待 → 領獎勵。

### Database management game

Investigation Wall 不自動整理玩家的推理。

### Brute-force dialogue inventory

Memory 的目的不是讓玩家把所有 Card 依序塞進每個 NPC。

v0.1 暫不對錯誤拖曳加入懲罰；若 playtest 出現大量 brute-force 行為，再另外設計限制。

---

## 13. Player Fantasy

最終希望玩家產生的感受不是：

> 我把所有任務解完了。

而是：

> 我記得一些這個世界已經忘記的事情。

以及：

> 這一次，我知道 18:14 會發生什麼。

玩家真正累積的不是角色等級，而是自己對這座小鎮的理解。


---

## 14. Scene-driven Action System

主要 Action 應盡可能由場景互動自然開始，而不是從 Action List 或任務選單開始。

例如玩家位於醫院走廊時，場景本身可能包含：

- 病歷
- 窗戶
- 報紙
- 護士
- 飲水機
- 走廊盡頭的人影

玩家直接與世界中的物件或人物互動，才自然進入對應 Action。

場景中可互動的東西不代表一定重要，也不代表一定會產生線索。

### 14.1 Weak Affordance

可互動物件只提供非常弱的 Affordance（可互動暗示），例如：

- 游標些微變化
- 極輕微的 focus
- 微小視差
- 細微動態或聲音反應

目的只是在避免 Pixel Hunting。

系統不得透過高亮、發光、圖示等方式暗示「這個東西很重要」。

---

## 15. Action Stream

遊戲中的時間不是一個被 UI 扣除的資源。

玩家做任何事情時，現實中的遊戲世界時間都持續流逝。

例如玩家翻閱報紙 45 秒，不應顯示：

```text
翻報紙 → -45 秒
```

而是玩家真的經歷翻閱過程：

```text
走向病房
   ↓
看到報紙
   ↓
停下來翻閱
   ↓
讀到幾則可能完全無關的新聞
   ↓
世界自然經過約 45 秒
   ↓
重新接回走向病房
```

因此 Action 應視為持續流動的 Action Stream。

短暫互動可以插入目前 Action，結束後再自然恢復原本 Action。

---

## 16. Opportunity Window

場景不是靜態互動地圖。

玩家移動、等待或執行 Action 時，可互動內容可能只短暫存在。

例如：

```text
10:31:04  經過護理站，桌上放著一份病歷
10:31:11  護士回來，病歷被收走
10:31:18  玩家已經走過護理站
```

這類短暫互動稱為 Opportunity Window。

玩家可以：

- 注意並互動
- 看見但忽略
- 完全沒有察覺
- 因正在進行其他 Action 而錯過

Opportunity 消失後，不應為了等待玩家而停留。

### 16.1 Interaction is not free

每次互動都可能對世界造成細微影響，例如：

- 花費實際經過的時間
- 得到資訊
- 錯過另一件事情
- 被某個 NPC 注意
- 改變角色所在位置
- 產生後續事件

但系統不直接顯示這些隱藏效果。

玩家需要自行理解自己的行動可能存在代價。

---

## 17. Attention Shift

玩家點擊短暫 Opportunity 時，不應跳出 Modal、任務頁或確認視窗。

應透過 Attention Shift（注意力轉移）自然改變主角目前關注的事物。短暫 Observation 預設採 Elastic Attention，完成後自動回到原 Action；只有玩家進一步離開、追逐或改做另一個主要行動時，才形成真正 Interrupt。

例如：

```text
主角正在走路
    ↓
「……窗外是不是有人？」
    ↓ 玩家注意
腳步逐漸放慢
    ↓
鏡頭 / 文字 / 聲音把注意力帶向窗戶
    ↓
觀察窗外
    ↓
得到或沒有得到資訊
    ↓
注意力自然回到原本方向
    ↓
重新開始腳步
    ↓
繼續原本 Action
```

底層可以是：

```text
Walking → Attention Shift → ObserveWindow → Auto Return → Resume Walking
```

但玩家不需要看見這些 State。

---

## 18. Ambient Presentation

Ambient Narrative 與 Opportunity 不應固定出現在單一 UI 區域。

它們應像主角腦中、視野中、環境中的短暫雜訊。

呈現可以包含：

- Fade in / Fade out 文字
- 不固定的畫面位置
- 輕微不同的角度
- 不同停留時間
- 聲音
- 圖像
- Pixel Animation
- 輕微畫面震動
- 視覺 focus / blur
- 短暫的人影或物件

例如：

```text
                「……那個人是不是看了我一眼？」

     沙沙——

                              窗外似乎有人跑過

「好像忘了什麼……」
```

有些內容可以互動，有些只是環境的一部分。

重要與不重要的資訊不應有明顯不同的視覺語言。

---

## 19. Immersive Interaction Principle

能用世界本身表達的資訊，就不要額外建立 UI。

世界層主要由以下元素構成：

```text
文字
+ 場景
+ 圖像
+ 聲音
+ 動態
+ 震動
        ↓
玩家直接感受 / 操作
```

應盡量避免把體驗拆成：

- Dialogue Box
- Quest Panel
- Action List
- Notification
- Progress Modal
- Action Complete
- 大量 HUD

文字不是單純 UI 元件。

文字本身可以是場景、意識、聲音與敘事的一部分。

### 19.1 Two-layer interaction model

遊戲可以明確區分兩個層次：

```text
World Layer
文字 + 場景 + 圖像 + 聲音 + 動態
        ↓
體驗世界

Memory Layer
Memory Cards + Investigation Wall
        ↓
整理自己的記憶與推理
```

World Layer 追求沉浸與連續性。

Memory Layer 才允許較明確的管理型介面，因為它代表玩家主動整理自己的思考。

---

## 20. Text Presentation Direction

文字呈現已不再是 Deferred 項目。v0.1 已確立以下方向，詳細規則見 §21–§36：

- Spatial Typography：文字位置承擔方位與空間資訊
- Spatial Dialogue：角色文字繼承角色在場景中的相對位置
- Text Echo：舊句留下極淡殘影後自然消失
- Rhythmic Text：依 Speech Rhythm 分段出現，不採固定逐字速度
- Attention Presentation：單一 Focus，其他內容淡化但仍持續發生
- Ambient Text：可在不同位置、角度與時間短暫出現
- Memory Capture：玩家可抓住正在消失的 Perceived Moment

仍未鎖死的是實作參數，例如具體字體、字級、Fade 秒數、Hold Duration、動畫曲線與各裝置輸入細節。這些應由 Prototype / Playtest 決定，而不是視為核心規則未定。

核心原則仍是：

> 文字屬於世界體驗的一部分，而不是被限制在傳統對話框中。


---

## 21. Spatial Typography / Spatial Dialogue

文字不只負責傳遞句子的語意。

文字在畫面中的位置本身，也可以負責傳遞：

- 說話者的相對方位
- 聲音來源
- 人物距離
- 注意力方向
- 人物移動
- 場景中的空間關係

因此遊戲應盡可能讓「文字的位置」取代部分額外旁白說明。

### 21.1 Position can replace explanation

傳統寫法可能需要：

```text
門那邊傳來聲響。

護士從右邊向我問話：
「你找誰？」

我小聲回答：
「……柏勳。」
```

Spatial Dialogue 可以直接呈現：

```text
              ……喀。


                              「你找誰？」


「……柏勳。」


                              「柏勳？」
```

玩家透過畫面位置自然理解：

- 中間偏上的「……喀。」來自另一個方向
- 右側文字屬於護士
- 左下文字屬於主角
- 兩個聲音存在於同一個空間

不需要額外顯示：

```text
護士：
主角：
門那邊：
```

只要空間關係足夠清楚，就應優先讓玩家自己感知。

### 21.2 The screen is a stage

每個畫面可以視為一個固定的文字舞台。

例如護士位於右上、主角位於左下：

```text
┌──────────────────────────────────────┐
│                              護士    │
│                         「你找誰？」 │
│                                      │
│                                      │
│                                      │
│ 「……柏勳。」                        │
│ 我                                   │
└──────────────────────────────────────┘
```

這不是傳統聊天紀錄。

文字的位置繼承人物在當下場景中的相對位置。

### 21.3 Dialogue replaces itself instead of stacking

對話不應預設一直向下累積。

上一句完成後，可以自然 Fade out，再讓下一句從人物目前的位置出現。

例如：

```text
右上：

「你找誰？」
     ↓ fade out

「柏勳？」
     ↑ fade in
```

因此玩家閱讀的是「正在發生的當下」，而不是持續增加的對話紀錄。

### 21.4 Position follows movement

如果人物在場景中移動，後續文字位置也可以跟著改變。

例如護士逐漸走近：

```text
右上角     「你找誰？」
              ↓
右側       「柏勳？」
              ↓
右下附近   「你認識他？」
```

即使沒有完整角色動畫或立繪，玩家也可以從文字位置感受到：

> 她正在靠近我。

這種呈現方式可視為文字版的 Blocking（舞台走位）。

### 21.5 Spatial properties carry meaning

目前確立的視覺語意方向：

```text
位置       → 方位 / 說話者所在位置
大小       → 距離 / 感知強度
透明度     → 清晰程度 / 注意力
出現速度   → 語氣 / 節奏
輕微抖動   → 衝擊 / 不穩定
Fade       → 注意力離開 / 句子退出當下
位置移動   → 人物或聲音來源正在移動
```

這些規則應保持克制。

系統的目的不是替每一句話增加特效，而是讓文字本身承擔原本需要 UI、旁白或立繪才能表達的空間資訊。

### 21.6 Relationship with Ambient Narrative

Spatial Typography 不只用於角色對話。

Ambient Narrative 也可以使用相同空間：

```text
              ……喀。


                              「你找誰？」


「……柏勳。」
```

此時「……喀。」與護士的問話可以同時競爭玩家注意力。

因此文字舞台同時也是 Opportunity 與 Attention Gameplay 的一部分。

玩家需要自己決定：

- 繼續注意正在說話的人
- 注意另一個方向的聲音
- 忽略它
- 中斷目前 Attention 並轉向 Opportunity

### 21.7 Exit behavior

上一句文字退出時採用 Text Echo：先留下短暫、極淡的殘影，再逐漸消失。它不是 Chat History；完整規則見 §22。

---

## 22. Text Echo

Spatial Dialogue 的上一句不應立刻完全消失，也不應累積成 Chat History。文字說完後進入 Text Echo（文字殘響）：

    「你找誰？」
         ↓
    「你找誰？」（逐漸變淡）

「……柏勳。」

    「柏勳？」

越舊的文字越淡，最後自然消失。Text Echo 表達的是「剛剛發生的事情仍短暫停留在主角的感知與意識中」，不是聊天紀錄。不同內容可以有不同殘留時間，但不等同線索重要度；例如「他三年前就死了。」可以因心理衝擊多停留一些，而不是因為系統判定它是重要線索。

## 23. Rhythmic Text

文字不採固定逐字 Typewriter Speed，而依角色真正說話的節奏，以 Phrase / Beat 為單位出現。

    「你……」
        （短暫停頓）
    「你怎麼會知道這件事？」

另一例：

    「我不是——」
        （停住）
    「……算了。」

劇本節奏接近 `Phrase → Pause → Phrase → Pause → Phrase`。Pause 期間仍是 World Time，聲音、人物動作、Ambient Narrative、Opportunity 都可以發生。若一句話需要 2 秒說完，那 2 秒真的存在於世界中：

    13:42:10  「你……」
    13:42:11  「你找誰？」
    13:42:12  說完

玩家不能靠加速文字讓 NPC 在 0.5 秒內完成原本需要 2 秒的說話，否則會破壞 Real-time World。

## 24. Repeated Dialogue and Attention Release

輪迴後重新遇到已知內容時，不快轉 World Time。所謂 Skip 更接近「我已經知道這段內容，因此不再把全部注意力放在它上面」。

    「柏勳那天確實有來……」      ← 已知主對話退到背景

          ……兩個護士正在小聲說話。

    「昨天 307 又……」

              ……藥不是已經停了嗎？

    「後來他就離開了。」

主對話仍正常發生並消耗真實時間，只是玩家的 Attention 被釋放，可以注意同一時間原本就存在的其他資訊。

### 24.1 Information is finite

重複場景不應因玩家反覆進入而無限生成新線索。同一時間、同一地點存在有限事件集合：

    13:42:10 ～ 13:42:50 / 護理站
    ├─ 主對話：護士說明柏勳來院時間
    ├─ Ambient A：兩名護士談論 307 病房
    ├─ Ambient B：推車經過
    ├─ Ambient C：門發出「……喀。」
    └─ Opportunity D：窗外短暫出現人影

第一輪可能只聽主對話；第二輪注意到門聲；第三輪去聽 307 病房談話。全部探索後，這段時間就可能真的沒有更多內容。系統不為 Grinding 隨機製造情報。

## 25. Memory Resonance

再次經歷已知內容時，主角偶爾可以產生極短的內心記憶反應。這稱為 Memory Resonance（記憶共鳴）。

    「柏勳那天確實有來……」

          ……又是這句。
          上次她也是這麼說的。

若主角確實曾在另一輪感知到不同版本：

    「柏勳那天確實有來……」

          ……等等。
          她上次說的是「沒有見過」。

到這裡停止。系統不得繼續替玩家推論「她在說謊」「發現矛盾」「應該拿監視器質問她」。Memory Resonance 只表示主角想起自己確實經歷過的事情，不是 Hint System，也不保證有用。例如「最近真的很冷。」也可能引出「……她上次也抱怨過天氣。」

## 26. Dialogue as Continuous Gameplay

Dialogue 不是 Gameplay 的暫停區。一般故事對話由主角依既定性格自然回答，不需要每一句都要求玩家選 A / B / C：

                              「你找誰？」

    「……柏勳。」

                              「柏勳？」

只有真正涉及主角意圖、行動方向、關係變化、風險承擔或 Worldline 分歧時，才需要明確 Choice。

                              「你跟柏勳是什麼關係？」

            ……

    「朋友。」
    「我只是來找人的。」
    「……」

選項也應盡量存在於主角所在的 Spatial Area，而不是突然跳出傳統 A / B / C Menu。

### 26.1 Player activity during dialogue

一般對話自動回答不代表玩家只能看小說。對話期間世界持續發生：

                              「柏勳那天確實有來……」

            ……喀。

    「我記得他大概六點左右——」

                        走廊有人經過。

玩家可以繼續專注護士、Hover 門聲形成 Notice、Click 後 Attend / Observe、Capture 已實際感知到的 Moment、使用 Memory 介入、真正中斷對話或離開現場。Dialogue 的核心 Gameplay 是「我現在注意什麼、記住什麼、忽略什麼，以及什麼時候介入」。

## 27. Memory Capture

Memory 不透過傳統收藏按鈕取得。玩家主動抓住正在從當下消失的感知，稱為 Memory Capture。

### 27.1 Capturing a spoken sentence

一句話說完進入 Text Echo：

    「我六點一直都在店裡。」
             ↓
    「我六點一直都在店裡。」（逐漸淡去）

玩家若認為值得記住，可以在消失前 Hold：

    「我六點一直都在店裡。」
             ↑
           HOLD

呈現可以是 `Hold → 文字 Focus → 周圍感知稍降 → 文字凝固 → 輕微紙張/快門式感知聲 → 像從當下被抽出 → 成為 Memory`。不顯示「已加入收藏」或「發現重要線索」。

### 27.2 Capture does not pause the world

Memory Capture 也需要 Attention，世界不會停止：

    「我六點一直都在店裡。」 ← 玩家正在 Capture

                         ……喀。

                              「後來柏勳就——」

玩家可能因為記住上一句而漏掉下一句或 Ambient Event。記住什麼，本身就是時間與注意力選擇。Capture 不要求 Pixel-perfect Input；靠近可 Capture 的 Echo / Moment 時只給非常弱的 Focus，Hold 時長由 Playtest 決定。

## 28. Memory captures perceived Moments, not only text

Memory Capture 的核心不是收藏句子，而是「玩家主動決定讓主角記住某個自己真正感知到的 Moment」。Memory 至少可來自 Text / Visual / Sound / Composite Moment。

### 28.1 Visual Memory example

17:52，玩家真的轉頭看到窗外有人跑過：

            雨中的窗戶

                    ── 人影跑過 ──→

        ……誰？

Capture 後可形成：

    17:52 · Loop 02 · 醫院
    ┌────────────────────┐
    │   模糊的雨中窗戶     │
    │          → 人影      │
    └────────────────────┘
    「窗外有人跑過。」

Memory 只保存主角當時真正看清楚的程度。若只看到模糊人影，不能事後神奇地得到清楚的臉。

### 28.2 Sound Memory example

    18:14

              砰——

若主角確實聽見並 Capture，可形成：

    18:14 · Loop 03 · 醫院走廊
    Sound Memory
    「不明撞擊聲」

### 28.3 Composite Moment example

某些 Moment 同時包含畫面、聲音與文字：

    18:14:03

    護士：「後來柏勳——」

                    砰——

    右側病房門輕微震了一下。

如果玩家的 Attention 足以真正感知整個瞬間，Capture 可保存為 Composite Moment；但不能補上玩家當時沒有感知到的資訊。

## 29. Perception Boundary

核心規則：**主角只能記住自己當下實際感知到的東西。**

例如同一時間左側護士正在說話，右側窗外有人跑過。如果玩家始終把 Attention 放在護士身上、根本沒有轉頭，就不能事後 Capture「窗外人影」，Memory Library 也不能自動得到人影照片。World Event 與 Player Knowledge 是兩件不同的事。

    World Event
        ↓
    Attention
        ↓
    Perception
        ↓
    Memory Capture
        ↓
    Memory

只有真正通過 Perception 的內容，才可能成為主角 Memory。

## 30. Attention → Memory → Investigation Gameplay Loop

目前核心互動鏈：

    World continuously moves
            ↓
    Opportunity / Dialogue / Ambient Event
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
    Player-created relationships / hypotheses
            ↓
    Memory Input in future situations
            ↓
    Different Action / Event / Worldline
            ↓
    New World State

### 30.1 Full example

    Loop 01
    17:52 玩家在醫院 → 注意窗外 → 看到模糊人影 → Capture
    Memory：「17:52 醫院窗外的人影」

    Loop 02
    得知：「柏勳 17:50 已經離開醫院。」 → Capture
    將兩張 Memory 放到 Investigation Wall
    玩家自己連線並寫：「同一個人？」

    Loop 03
    再次遇到相關 Dialogue Node
    拖入「17:52 醫院窗外的人影」
    主角用自己的記憶介入
    → 新 Dialogue / Action / Worldline

遊戲不需要顯示「恭喜，發現矛盾！」；真正的推理存在於玩家自己對 Memory 的選擇、整理與使用。

## 31. Text & Attention System — Current Principles

1. 文字是 World Layer 的一部分，不只是 UI。
2. Spatial Typography 用位置傳達方位與人物空間。
3. Dialogue 文字位置跟隨角色 Blocking。
4. 新句取代舊句，不累積成傳統聊天紀錄。
5. 舊句以 Text Echo 短暫留下，再自然消失。
6. 文字依 Speech Rhythm 分段出現，而不是固定逐字速度。
7. Speech / Pause 真正占用 World Time。
8. Real-time World 不允許透過文字加速改變事件時間。
9. 重複內容可以退到 Attention 背景，但世界不快轉。
10. 同一時空的可探索資訊有限，不因 Grinding 無限生成。
11. Memory Resonance 只喚起已知經驗，不替玩家做推理。
12. Dialogue 期間 Gameplay 持續進行。
13. 一般台詞由主角自然回答，重大意圖才要求玩家 Choice。
14. Memory Capture 是主動抓住正在消失的 Perceived Moment。
15. Capture 不暫停世界。
16. Memory 可以是 Text / Visual / Sound / Composite Moment。
17. 只能 Capture 主角真正感知過的內容。
18. Attention → Perception → Memory 是核心因果鏈。

---

## 32. Attention Interaction Model

Attention 不應顯示為數值、Focus Bar、鎖定框或眼睛 Icon。玩家直接透過游標與世界互動，像是在操縱主角當下的感官。

### 32.1 Hover → Notice / Focus

Hover 代表主角開始注意某個目標，但還沒有正式中斷目前 Action。任何時刻只能 Focus 一個目標。

例如：

                             護士：「後來柏勳——」

            ……喀。

                                          窗外有人經過

玩家 Hover「……喀。」後：

                             護士：「後來……」
                                   （淡化）

            ……喀。
            ↑ 清晰

                                          …………
                                          （淡化）

其他內容不是消失，也不是暫停，而是因主角沒有專心感知而降低存在感。

### 32.2 Click → Attend

Click 代表主角真的把 Attention 轉向該目標。這不是瞬間 UI 切換，而是存在於 World Time 中的感知行為。

例如：

    護士 ───────────────────── 門
      ↑                         ↑
    Current                  Click
    Attention

主角需要經歷：

    聽見聲音
       ↓
    意識到來源
       ↓
    轉頭 / 改變聆聽方向
       ↓
    看向門
       ↓
    Observe

這個 Attention Shift 可能只需要不到一秒，也可能因距離、角色狀態或正在執行的 Action 而更久，但它不是零時間。

例如：

                             ……喀。

                    [玩家 Click]

    護士：「後來柏勳就——」

                    [主角正在轉頭]

                             門關上。

玩家可能因為晚了一點，最後只看到門關上的瞬間。

## 33. Elastic Attention

Attention 是暫時偏離，而不是進入另一個永久模式。

預設流程：

    Original Action：聽護士說話
             ↓
          Hover
             ↓
          Notice
             ↓
          Click
             ↓
      Attention Shift
             ↓
          Observe
             ↓
    Observation 完成
             ↓
       Return Attention
             ↓
    Resume Original Action

Observation 自然完成後，主角會自動把 Attention 拉回原本 Action。玩家不需要再次點擊原 Action。這種『被拉出去，再自然彈回』的行為稱為 Elastic Attention。

### 33.1 Interrupting an Observation

玩家可以在 Observation 尚未完成時，再 Click 其他目標來中斷。

例如玩家原本在看門：

            門正在慢慢打開……

    護士：「等等，柏勳那天其實——」

玩家此時 Click 護士：

    Observe Door
         ↓
      Interrupt
         ↓
    Attention Shift
         ↓
    Attend Nurse

結果可能是玩家重新聽到護士，但沒有看到門後到底是誰。

Attention 可以形成：

    護士 → 門 → 窗外 → 護士

每一次轉移都是真實發生的感知行為，因此可能造成只看到一半、漏聽半句、或來不及看清楚。

## 34. Single Focus Rule

任何時刻只能有一個主要 Focus。Hover 新目標就代表主角的注意力正在偏向新目標，因此其他感知內容應被淡化。

這條規則同時防止玩家用滑鼠快速掃過整個畫面來無成本取得所有資訊。

例如玩家快速掃：

    護士 → 門 → 窗戶 → 護士

世界仍然按照原本時間持續：

    ────────────── Real Time ──────────────→

    護士    A────B────C────D
    門           喀───關上
    窗戶              人影──→消失

玩家掃到門時，護士仍在從 B 說到 C；掃到窗戶時，門仍然會關上；重新回到護士時，她可能已經說到 D。

因此到處 Hover 的結果可能不是取得更多資訊，而是：

> 每件事情都感知到一點，但沒有任何一件事情真正看完整。

## 35. Faded Does Not Mean Paused

Attention System 的重要底層規則：

> **被淡化 ≠ 沒有發生。世界永遠不等待玩家。**

例如玩家正在 Focus 門：

    Foreground
        ……喀。
        門正在打開。

    Background / Faded
        護士：「他後來去了港口。」

即使護士文字被淡化，她仍然真的把這句話說完。玩家稍後把 Attention 移回護士時，不會重新播放這句話。

這也適用於：

- Dialogue
- Ambient Narrative
- Opportunity Window
- NPC Movement
- Environmental Sound
- Visual Event

除非特定事件本身具有持續狀態，否則錯過就是錯過。後續只能透過 Residual、下一輪、其他人物資訊或玩家自己的推理重新接近真相。

## 36. Attention System Example

完整例子：玩家正在醫院護理站與護士交談。

    13:42:10

                             護士：「我記得大概六點——」

    13:42:12

            ……喀。

                             護士：「柏勳那時候……」

    玩家 Hover「……喀。」
    → 門聲變清晰
    → 護士淡化，但仍繼續說

    13:42:13

    玩家 Click 門
    → 主角開始轉頭

                             護士：「……去了港口。」

    13:42:14

            門正在關上。
            玩家只看到一隻手離開門框。

    13:42:16

    Observation 完成
    → Elastic Attention 自動 Return

    13:42:17

                             護士：「之後我就沒看到他了。」

此時玩家確實知道：

- 門在 13:42 左右有異常
- 看到了離開門框的一隻手
- 護士最後說「之後我就沒看到他了」

但玩家可能沒有真正聽清楚被淡化期間的「去了港口」。

這不是系統扣除 Attention Point 的結果，而是玩家在同一段真實流動的時間裡選擇了自己的感知方向。
