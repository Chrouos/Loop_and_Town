# Core Gameplay Spec v0.1

> Status: Draft / gameplay rules frozen from design discussion
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

當多個事件同時發生時，玩家必須選擇把自己的注意力放在哪裡。

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

## 5. Interrupt

部分 Ambient Narrative 可以被玩家注意或互動。

玩家可以選擇：

```text
繼續目前行動
      │
      └── 注意到某個異常
                 ↓
             中斷行動
```

### 5.1 Default behavior

一般可中斷 Action：

- 保存目前進度
- 例如 70% 中斷，之後從約 70% 繼續

### 5.2 Action-specific behavior

中斷規則由 Action 自己定義。

可能包括：

- 可隨時繼續
- 中斷後部分進度流失
- 中斷即失敗
- 特定時間點不可中斷

系統不應總是直接標示代價。

玩家應從情境判斷：

> 這件事情現在能不能放下？

每次選擇後面都可能存在代價。

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

玩家可以主動保存自己認為值得記住的內容，形成 Memory Card。

可保存內容可以包含：

- NPC 對話
- 主角觀察
- 時間
- 地點
- Ambient Narrative
- 文件內容
- 玩家認為重要、但實際無關的資訊

遊戲不得主動提示哪一句值得保存。

### 7.1 Persistence

所有 Memory Cards 跨 Loop 保留。

每張 Memory 應保留基本來源 metadata，例如：

- Loop
- 發生時間
- 來源人物 / 場景
- 原始內容

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

應透過 Attention Shift（注意力轉移）自然改變主角目前關注的事物。

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
Walking → Pause → ObserveWindow → Resume Walking
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

## 20. Deferred: Text Presentation

文字是遊戲最主要的資訊與沉浸媒介，但具體的文字呈現方式尚未在 v0.1 定案。

後續需獨立設計：

- 文字如何進場 / 離場
- 打字速度
- 位置與排版
- Dialogue 與 Thought 的差異
- Ambient Text 的生命週期
- 可互動文字的 Weak Affordance
- 多段文字同時存在時的視覺層級
- 文字、聲音、圖片、震動之間的同步

本 Spec 目前只確立：

> 文字應屬於世界體驗的一部分，而不是被限制在傳統對話框中。


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

### 21.7 Current open question

尚未定案：

> 上一句文字退出後，應完全消失，還是留下短暫、極淡的殘影？

這會影響閱讀節奏、記憶感與畫面資訊密度，需後續獨立討論。
