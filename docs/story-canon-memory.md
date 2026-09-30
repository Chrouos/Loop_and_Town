# Story Canon｜跨 Loop 記憶與 Perception

本文件定義《灰潮鎮：第七封信》的跨 Loop 記憶 Canon。

若其他舊文件與本文件或 `Core Gameplay Spec v0.1` 衝突，以最新 Core Gameplay 規則為準。

---

# 1. Hard Reset 後誰記得？

正常規則：

```text
主角
→ 保留自己跨 Loop 的主觀記憶
→ 保留 Captured Memory
→ 保留 Investigation Wall / 玩家筆記

其他 NPC
→ 不保留上一輪記憶
→ Relationship State Reset
→ 不知道自己曾經活過其他版本的今天
→ 人格、價值觀、喜好、習慣仍維持角色一致性
```

輪迴不傷害 NPC 人格，也不靠「多輪累積」改寫 NPC 的人格。

情感代價集中在唯一承受記憶累積的人。

---

# 2. NPC 的友誼不跨 Reset 累積

```text
Loop A
主角與予安一起調查
→ 一起吃飯
→ 談到父親
→ 建立信任

00:00 Reset

Loop B
予安：只知道 Loop B 真正發生的關係
主角：仍記得 Loop A 的共同經歷
```

因此：

- `trust`
- `closeness`
- `respect`
- `pressure`

都屬於當前 Loop Relationship State。

一般 NPC 不存在：

```text
yuan.residue += 1
→ 下一輪逐漸想起來
```

---

# 3. 主角記得 ≠ 系統自動建立完整 Memory

主角作為角色可以有跨 Loop 主觀記憶。

但 Core Gameplay 中可被系統保證：

- 檢索
- 放到 Investigation Wall
- 作為 Memory Input
- 跨 Loop persistent

的 diegetic record 是 **Captured Memory**。

```text
World Event
    ↓
Attention
    ↓
Perception
    ↓
optional Memory Capture
    ↓
Persistent Memory
```

未實際 Perceive 的事件不能在 Reset 後自動補進主角知識。

未 Capture 的內容也不能事後自動生成完整 Evidence / Fact Card。

---

# 4. Perception Boundary

主角只能記得自己真的感知到的資訊。

例如：

```text
護士正在說話
+
窗外有人跑過
```

若主角一直 Focus 護士、沒有看到窗戶：

```text
World Event: 窗外有人
Player Knowledge: none
```

若只聽到模糊撞擊聲，Memory 也只能保留當時真正感知到的模糊程度。

---

# 5. Residual

Residual 不是 NPC 跨 Loop 記憶。

Residual 是主角在同一輪中，對自己真的微弱感知過的 sensory fragment 留下模糊印象。

例如：

```text
18:14 ——砰。

主角沒有轉頭，
但聲音確實進入周邊聽覺。
```

稍後可以有很弱的 Memory Resonance：

> 「……剛才是不是有什麼聲音？」

如果完全沒有感知，就不能生成 Residual。

---

# 6. Character Insight 的定位

Character Insight 不是 Player-facing 自動解鎖系統。

它比較接近：

> 主角因為多次真正相處、觀察、Capture，而逐漸形成的人物理解。

Canonical flow：

```text
角色行為 / Dialogue
→ Attention
→ Perception
→ optional Capture
→ Memory Library / Investigation Wall
→ 玩家自己的 hypothesis
→ 玩家採取下一步
```

它可以成為：

- Investigation Wall Note 的背景
- 玩家形成 hypothesis 的素材
- 特定 Narrative Node 接受的 Memory Input
- 很弱的 Memory Resonance 來源

但不能直接：

- 宣告角色正在說謊
- 自動排除嫌疑
- 自動解鎖「正確問題」
- 把人格傾向當客觀證據

---

# 7. 穩定人格 ≠ 固定劇本

NPC 人格可跨 Loop 保持一致，例如：

- 價值觀
- 喜好
- 恐懼來源
- 習慣
- 思考方式

但每輪行動仍受到：

```text
當下資訊
位置
時間
當前 Relationship State
玩家介入
其他 NPC 行動
```

影響。

所以主角可能越來越會預測一個人，但那不代表這個人變成 deterministic function。

---

# 8. 主角與知夏的鏡像

真正危險的不是 NPC 被輪迴污染。

而是記憶持有者逐漸形成：

```text
我認識所有人
→ 我知道他們可能怎麼選
→ 我知道怎樣能改變他們
→ 我開始相信自己比他們更了解今天
→ 我開始替他們安排人生
```

知夏與主角的核心鏡像：

> 我很了解你，不代表我有權替你做決定。

---

# 9. 知夏是 Story Exception，不是一般 NPC Rule

目前 Story Canon 允許知夏曾經是上一個「特殊記憶持有者」。

但她為什麼能保留 Soft Rewrite 前後資訊，仍需由後續 Anchor / Observer / Reference 機制定案。

目前只能固定：

```text
Normal NPC
→ Reset / Rewrite 後不自然保留另一條 Worldline 的完整主觀記憶

Zhixia
→ 五年前曾保留跨 Rewrite 資訊
→ Story-specific exceptional mechanism

Protagonist
→ 現在 Hard Reset 中保留跨 Loop 主觀記憶
→ precise mechanism TBD
```

不能把知夏的例外抽象成一般 `memory_residue` 數值。

---

# 10. 警告信不是目前已定案的跨線記憶裝置

舊文件曾直接寫成：

```text
五年前的知夏
→ 第七封信
→ 五年後主角
→ 已確定的跨世界線資訊交接
```

目前這個技術因果**不再視為已定案 Canon**。

目前固定的是：

```text
主角返鄉行程已確定
↓
出發前收到知夏名義寄出的實體信
↓
郵戳：昨天
↓
核心訊息：不要回來
```

而以下仍是 TBD：

- 是誰／什麼機制讓信在五年後寄出
- 是否使用 Watchdog / delay trigger
- 是否涉及 Worldline transmission
- 是否真的存在「前六封 → 第七封」的技術實驗序列
- 信件內容能否在 Hard Reset 後動態改變

因此章節不能為了方便，直接讓信在每輪自動長出新文字。

---

# 11. 為什麼 Reset 後信還在？

因為 06:12 checkpoint 發生在主角收到信之後。

所以：

```text
00:00 Hard Reset
→ 10/3 06:12
→ 信仍在主角外套口袋
```

這是 World State restore，不是信件自身的特殊持久化能力。

這個區分很重要：

```text
物件在 checkpoint 本來就存在
≠
物件能跨 Reset 抵抗世界重置
```

---

# 12. Canon summary

```text
World Event
  ↓
Player Attention
  ↓
Perception
  ↓
optional Capture
  ↓
Persistent Memory
  ↓
Investigation / Memory Input
```

Reset：

```text
主角 Captured Memory       → 保留
Investigation Wall         → 保留
主角自己的主觀經歷         → 故事上記得
NPC Relationship State     → Reset
NPC 上一輪記憶             → Reset
NPC personality            → 穩定
World State                → 回到 canonical checkpoint
警告信                     → 因 checkpoint 已存在而再次存在
```

核心原則：

> **只有主角承受被世界忘記、自己卻仍記得的重量。**
