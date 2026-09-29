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
予安：今天重新依照這一輪的狀態認識主角
主角：仍記得 Loop A 的共同經歷
```

對 Loop B 的予安而言，Loop A 那段關係沒有發生。

因此：

- `trust`
- `closeness`
- `respect`
- `pressure`

都屬於當前 Loop 關係狀態，不應透過 `memory_residue` 偷偷延續。

一般 NPC 不存在：

```text
yuan.residue += 1
→ 下一輪記起 17:58
```

---

# 3. 主角記得 ≠ 系統自動建立完整 Memory

主角作為角色可以有跨 Loop 的主觀記憶，但 Core Gameplay 中可被系統保證：

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
Memory Capture
    ↓
Persistent Memory
```

未實際 Perceive 的事件不能因為 Reset 後「主角應該知道」而補進來。

未 Capture 的內容也不能事後自動生成一張完整 Evidence / Fact Card。

---

# 4. Perception Boundary

主角只能記得自己真的感知到的資訊。

例如：

```text
護士正在說話
+
窗外有人跑過
```

若主角一直 Focus 護士，根本沒有看向窗戶：

```text
World Event: 窗外有人
Player Knowledge: none
```

不能下一輪突然得到：

```text
17:52 窗外人物照片
```

若只看到模糊人影，Memory 也只能保留模糊程度。

---

# 5. Residual

Residual 不是 NPC 跨 Loop 記憶。

Residual 是主角在同一輪中，對自己真的微弱感知過的 sensory fragment 留下模糊印象。

例如：

```text
18:14 ——砰。

主角沒有轉頭，
但聲音確實進入周邊聽覺。

稍後：
「……剛才外面是不是有什麼聲音？」
```

若主角完全沒有感知到，就不能生成 Residual。

Residual 不透露真相，只保留模糊感受。

---

# 6. Character Insight 的新定位

Character Insight 不是自動解鎖的超能力，也不是系統認證的真相。

它比較接近：

> 主角因為多次真正相處、觀察、Capture，而逐漸形成的人物理解。

例如玩家曾真正經歷：

```text
予安談到賣店
→ 嘴上說想清掉東西
→ 卻保留父親留下的壞零件
```

玩家可以 Capture 這段 Moment，之後自己形成：

```text
「他似乎很難真的丟掉父親的東西。」
```

這可以成為：

- 玩家自己的 Investigation Wall Note
- 劇本接受的特定 Memory Input
- 主角短暫 Memory Resonance 的來源

但不能直接變成：

```text
[Insight Unlocked]
予安絕對不會丟東西
→ 自動排除嫌疑
```

---

# 7. Character Insight 不能替玩家推理

禁止：

```text
若晴整理相機背帶
→ 系統：她在說謊 100%
```

允許：

```text
若晴整理相機背帶

主角曾經 Perceive / Capture 過類似習慣
↓
Memory Resonance：
「……她上次緊張時，也一直碰背帶。」
```

到這裡停止。

玩家要不要認為她在說謊，是玩家自己的 hypothesis。

Character Insight 不提供：

- truth score
- lie detector
- automatic contradiction
- automatic correct question
- automatic route unlock purely because system classified behavior

若故事要開啟新的追問，應該由具體 Narrative Node / Memory Input 條件定義。

---

# 8. 穩定人格 ≠ 固定劇本

NPC 人格可跨 Loop 保持一致，例如：

- 價值觀
- 喜好
- 恐懼來源
- 習慣
- 思考方式

但角色每輪行動仍受到：

```text
當下資訊
位置
時間
當前 Relationship State
玩家介入
其他 NPC 行動
```

影響。

所以玩家可以利用自己對人物的理解預測可能性，但不能把角色當 deterministic function。

---

# 9. 主角與知夏的鏡像

真正危險的不是 NPC 被輪迴污染，而是記憶持有者逐漸產生：

```text
我認識所有人
→ 我知道他們會怎麼選
→ 我知道怎樣能改變他們
→ 我覺得自己比他們更了解今天
→ 我開始替他們安排人生
```

知夏與主角的主題鏡像仍成立：

> 我很了解你，不代表我有權替你做決定。

---

# 10. 知夏是 Story Exception，不是一般 NPC Rule

如果主線 Canon 確立知夏曾是上一個「記憶持有者」，這是劇情核心例外。

它不代表所有靠近 18:31 的 NPC 都會逐漸產生 residue。

```text
Normal NPC
→ Reset 後不記得

Zhixia（story-specific exceptional mechanism）
→ 曾經跨 Worldline 持有資訊
→ 最終透過第七封機制交接給主角
```

此例外必須由 Story Canon 明確解釋，不能被抽象成一般 `residue` 關係數值。

---

# 11. 第七封

第七封的核心是「資訊交接」，不是讓 NPC 群體開始記得。

```text
五年前的知夏
→ 特殊跨世界線資訊載體
→ 五年後的主角
```

它讓上一個記憶持有者留下的資訊抵達下一個記憶持有者。

---

# 12. Canon summary

```text
World Event
  ↓
Player Attention
  ↓
Perception
  ↓
Capture（玩家選擇）
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
World State                → 依 Loop 規則 Reset
```

核心原則：

> **只有主角承受被世界忘記、自己卻仍記得的重量。**
