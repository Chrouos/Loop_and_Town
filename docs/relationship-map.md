# Relationship Map｜灰潮鎮人物關係

人物關係不是背景設定，而是 Event Graph 的輸入條件。

```text
當前 Loop 的信任 / 壓力 / 尊重 / 義務
→ 改變角色選擇
→ 改變 Schedule
→ 改變 Event Variant
→ 延遲影響其他角色
```

重要 Canon：

> Relationship State 只屬於當前 Loop。Reset 後 NPC 不保留上一輪關係與記憶。

主角可以記得曾經建立過的關係，但 NPC 不會因為「residue」逐輪記起來。

---

# 核心關係圖

```text
                         林知夏
                    ┌─────┼─────┐
                    │     │     │
                 主角   若晴   庭安
                  │      │      │
                予安─────┘      柏勳
                  │               │
                  └───────────志遠
```

這張圖只代表高影響關係，不代表單純好感。

---

# Relationship State

不要使用單一 `friendship = 70`。

目前通用維度：

```text
trust       願不願意相信主角提供的資訊
closeness   當前 Loop 的相處深度
respect     是否感到自己的選擇權被尊重
pressure    是否感到被秘密、預知或情緒壓迫
```

故事需要時可增加局部 state，例如：

```text
availability
obligation
fear
exposure
promise_pressure
```

但它們都必須有具體敘事意義。

禁止作為一般 NPC Relationship State：

```text
residue
memory_residue
previous_loop_memory
```

不能出現：

```text
yuan.residue >= 3
→ 記起上一輪 17:58 的電話
```

如果主角下一輪知道 17:58 的電話，來源應是主角自己上一輪的 Perception / Captured Memory，而不是予安記得。

---

# 主角 ↔ 林知夏

## 表面

姊妹。

## 真正關係

```text
依賴
→ 主角想獨立
→ 知夏開始控制
→ 主角離開
→ 死亡前半年疏遠
→ 主角留下愧疚
```

這條關係主要影響主角後期選擇，而不是一個簡單 Trust meter。

知夏若曾經作為上一代特殊記憶持有者，屬於 Story Canon exception，不是普通 Relationship State。

---

# 主角 ↔ 周予安

## 表面

高中同學、老朋友。

## 深層

予安知道主角離開灰潮鎮之後的人生。
主角則知道予安一直沒有真正離開。

核心衝突：

> 妳每次都想走，我每次都留下。

## 當前 Loop State

建議使用：

```text
trust
closeness
respect
pressure
availability
```

`availability` 表示玩家是否正在佔用他原本的人生行程，例如房仲約、鐘錶店工作。

Reset 後這些回到當輪基準。

### Cross-loop asymmetry

Loop A 即使主角與予安建立很深的友誼：

```text
主角 → 記得
予安 → Loop B 不記得
```

這才是兩人關係真正的情感成本。

---

# 林知夏 ↔ 許若晴

近似非血緣姊妹。

知夏曾經認真支持若晴離開灰潮鎮，因此若晴現在的矛盾：

```text
想離開
vs
留下照顧母親
vs
覺得自己辜負知夏
```

如果玩家只拿知夏壓若晴：

```text
pressure +1
trust -1
```

如果玩家先理解若晴自己的選擇：

```text
trust +1
respect +1
```

兩條路都可能取得資訊，但後續行為不同。

---

# 許若晴 ↔ 周予安

若晴遇到壓力時，可能先聯絡予安，而不是主角。

```text
wakaharu.trust low
+ wakaharu.pressure high
→ 若晴找予安
→ 予安 Schedule 改寫
→ 玩家失去 / 延遲另一條調查線
```

這是同一 Loop 內的 delayed consequence，不是跨 Loop 關係累積。

---

# 林知夏 ↔ 葉庭安

過去是調查搭檔。

核心決裂：

```text
知夏：只要繼續試，就可能找到所有人活下來的線
庭安：每一次試驗都是真實的人在承擔結果
```

庭安仍在履行知夏要求她保密的承諾，所以她對主角隱瞞不等於敵對。

局部 State 可使用：

```text
trust
exposure
promise_pressure
```

例如：

```text
exposure high
+ trust low
→ 庭安提前獨自行動
```

---

# 葉庭安 ↔ 陳柏勳

兩人五年前都藏過資料。

```text
共同秘密
→ 互相保護
→ 互相猜忌
```

如果其中一人的秘密被公開，另一人的 Schedule 也會變化。

這是 Event Graph 應呈現的角色因果，不應只寫成數值變化。

---

# 陳柏勳 ↔ 周志遠

核心是鏡像：

```text
柏勳藏醫療紀錄
志遠藏證物
```

兩人都認為對方不該替別人決定真相，卻都曾經以「保護」為名做過類似選擇。

---

# Relationship effect 必須改變行為

任何關係條件都必須能回答：

```text
誰受到影響
→ 為什麼
→ 改變哪個決定
→ Schedule 哪一段因此不同
→ 哪個 Event Variant 被打開 / 關閉
```

Example：

```text
wakaharu.trust >= 2
AND wakaharu.pressure <= 1
→ 17:20 主動說出要去車站

reporter.exposure >= 2
AND reporter.trust < 0
→ 提前進研究所
```

不要只有：

```text
trust +1
→ 台詞比較友善
```

若數值完全不影響人物決策，就不屬於核心 Relationship System。

---

# Player Knowledge 與 Relationship 必須分離

玩家跨 Loop 保存的是主角側資訊：

```text
Captured Memory
Investigation Wall
主角自己的經歷
```

NPC 關係狀態則 Reset。

因此玩家可能知道：

> 上一輪這樣說會讓予安生氣。

但這一輪仍必須重新建立情境，不能把上一輪的 Trust 直接帶過來。

---

# 設計原則

1. NPC 有自己的人生與 Schedule，不是 clue dispenser。
2. 玩家只能影響資訊與情境，不能直接控制角色最終選擇。
3. Relationship State 是當輪狀態，不是永久好感度。
4. 普通 NPC 不存在跨 Loop memory residue。
5. 主角可以利用跨 Loop 的人物理解，但系統不能自動替玩家判斷「誰在說謊」。
6. 所有跨 Loop 的可檢索資訊必須遵守 Perception Boundary / Memory Capture 規則。
