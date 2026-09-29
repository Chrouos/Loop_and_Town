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
