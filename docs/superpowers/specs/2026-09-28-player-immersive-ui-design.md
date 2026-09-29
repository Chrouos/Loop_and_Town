# Player Immersive UI Design v0.2

## Status

Canonical Player-facing presentation design aligned with `Core Gameplay Spec v0.1`.

This document supersedes earlier Player UI assumptions wherever they overlap with the current Core Gameplay rules.

In particular, the following older assumptions are no longer normative:

- foreground narrative reading freezes Story Time
- fixed per-character typewriter timing is the primary dialogue mechanic
- generic `Continue` / `AmbientPrompt` interaction drives dialogue
- Evidence / Event / Truth cards are automatically granted because the system considers information important
- repeated dialogue can be skipped by changing world speed

The Player UI must never redefine runtime truth or weaken the canonical gameplay invariants.

---

# 1. Goal

把 Player 畫面從「網站式閱讀介面」改成「持續活著的場景」。

玩家不是在操作頁面，而是在一個不會等待自己的世界裡決定：

```text
注意什麼
→ 感知什麼
→ 記住什麼
→ 何時介入
→ 因此錯過什麼
```

Target feeling:

```text
World continuously moves
        ↓
Scene / Dialogue / Ambient / Opportunity
        ↓
Attention
        ↓
Perception
        ↓
Memory / Choice / Action
        ↓
Worldline consequence
```

避免：

```text
Page
→ Card
→ Button
→ Modal
→ Next page
```

---

# 2. Canonical dependency

`Core Gameplay Spec v0.1` is authoritative for gameplay semantics.

```text
Story / Runtime Truth
        ↓
World Time + Event State
        ↓
Player Perception State
        ↓
Presentation Projection
        ↓
Scene / Text / Sound / Motion
```

Presentation may stage or reduce information only according to what the protagonist can actually perceive.

Presentation must not:

- pause World Time because the player is reading
- fabricate knowledge
- fabricate ETA
- automatically mark an event as a clue
- reveal an event outside the protagonist's Perception Boundary
- replay missed dialogue simply because Focus returns
- infer contradiction / causality for the player

---

# 3. Player UI invariants

Every Player-facing component must preserve these rules:

1. **World Never Waits** — reading, dialogue, Hover, Capture, Choice and overlays do not stop world progression unless a story/runtime rule explicitly freezes the whole world.
2. **Single Main Action** — the protagonist performs one primary action at a time.
3. **Single Focus** — only one Attention target is foregrounded at a time.
4. **Faded ≠ Paused** — unfocused content keeps happening.
5. **Attention Shift Takes Time** — changing sensory direction is a world action, not a zero-time UI toggle.
6. **Perception Boundary** — only perceived information may become remembered information.
7. **Memory Is Player-selected** — any perceived moment may be captured; the system does not rank importance.
8. **No Auto Deduction** — UI never announces contradiction, lie, cause or correct answer.
9. **Finite Information** — loops reveal authored events, not infinite generated clue drops.
10. **Loop Persistence Is Asymmetric** — protagonist-side Captured Memory / Investigation persist; normal NPC relationships and memories reset.

---

# 4. Scene first

畫面第一層永遠是世界本身：

```text
Scene
+ Character position
+ Spatial text
+ Sound
+ Motion
+ Ambient events
```

第二層才是玩家的感知操作：

```text
Hover / Notice
Click / Attend
Observe
Memory Capture
Choice
True Interrupt
```

第三層才是管理工具：

```text
Memory Library
Investigation Wall
Worldline History
Save / Settings
```

不要讓 Header、Card、Button、Drawer 成為 gameplay 的第一視覺焦點。

---

# 5. Spatial Typography

文字是 World Layer，不是固定在底部 Dialogue Box 的內容。

文字位置可以承擔：

- 說話者方位
- 聲音來源
- 距離
- 人物移動
- Attention 方向
- 場景空間關係

Example:

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

角色移動時，文字 Blocking 也跟著移動。

```text
右上角     「你找誰？」
              ↓
右側       「柏勳？」
              ↓
右下附近   「你認識他？」
```

---

# 6. Rhythmic Text, not fixed Typewriter

舊版 `TypewriterText(speed, punctuationDelay)` 不再是核心設計。

角色說話依 Phrase / Beat / Pause 演出：

```text
「你……」
    ↓ pause
「你怎麼會知道這件事？」
```

或：

```text
「我不是——」
    ↓ stop
「……算了。」
```

重要規則：

> Speech Rhythm 是 World Time 的一部分。

若 NPC 原本需要 2 秒說完一句話，不能因玩家設定「高速文字」就讓這句在 0.5 秒內完成並改變世界事件時間。

Implementation 可以逐片段 reveal，但 timing source 應該是 authored Beat / Phrase，而不是固定 ms-per-character。

Reduced Motion 可以降低視覺動畫，但不能改變事件語意或 World Time。

---

# 7. Text Echo

完成的句子不立即消失，也不累積成 Chat History。

```text
「你找誰？」
     ↓
「你找誰？」（逐漸變淡）
```

Text Echo：

- 短暫留在空間中
- 最後自然消失
- 可成為 Text Memory Capture 的入口
- Echo 長度可反映角色心理衝擊
- Echo 長度不得代表「系統認定的重要程度」

---

# 8. Attention Surface

Player UI 必須支援真正的 Attention Gameplay。

## 8.1 Peripheral Cue

未被 Focus 的事件只以弱訊號存在：

```text
聲音
人影
局部文字
動作
震動
光線變化
```

它只代表「主角可能注意到這裡有東西」，不代表已經取得完整資訊。

## 8.2 Hover → Notice / Focus

任何時刻只有一個主要 Focus。

玩家 Hover 新目標時：

```text
Target → clearer
Other perception → fades
World → keeps moving
```

例如：

```text
                              護士：「柏勳那時候……」
                              （淡化）

           ……喀。
           ↑ Focus
```

## 8.3 Click → Attend

Click 表示主角真正投入感知。

```text
Click
 ↓
Attention Shift
 ↓
turn / listen / look
 ↓
Observe
```

Attention Shift 需要 World Time。

玩家可能因此只看到門關上的最後一瞬間。

## 8.4 Elastic Attention

Observation 自然完成後：

```text
Original Main Action
→ Notice
→ Attend
→ Observe
→ Auto Return
→ Resume original Attention
```

玩家不需要再點一次原目標。

## 8.5 Attention Redirect

Observation 尚未完成時，玩家可把 Focus 移到其他目標。

這叫 **Attention Redirect**，不是 True Interrupt。

## 8.6 True Interrupt

只有主角真的放下目前 Main Action，例如：

- 離開談話
- 追出去
- 停止搜查去另一地點
- 改做另一個主要行動

才叫 True Interrupt。

---

# 9. Dialogue is continuous gameplay

Dialogue 不是暫停畫面。

一般台詞由主角既定性格自然回應，不需要每一句都顯示 A/B/C。

玩家在 Dialogue 中仍然可以：

- 保持 Focus 在說話者
- Notice 其他 Peripheral Cue
- Attend / Observe 另一個方向
- Capture 一個已感知 Moment
- 使用 Memory Input
- 在真正重要的時刻做 Choice
- True Interrupt / 離開

Example:

```text
                              「柏勳那天確實有來……」

           ……喀。

                              「我記得他大概六點——」

                                          走廊有人經過
```

三件事可以同時發生，但玩家只能完整 Focus 其中一個。

---

# 10. Meaningful Choice

Choice 只在真的涉及下列內容時出現：

- 主角意圖
- 行動方向
- 關係變化
- 風險承擔
- Worldline 分歧

Choice 不使用大型 SaaS CTA。

可存在於主角 Spatial Area：

```text
「今晚，我陪你留下來。」

            ……

「我先去車站。」
```

底層仍可使用 semantic `<button>` / keyboard interaction。

Choice 與 Memory Input 是不同機制，不互相取代。

---

# 11. Attention Release for repeated dialogue

舊版 `Skip` / complete text 不得改變 World Time。

已知內容可以視覺退到背景：

```text
                              「柏勳那天確實有來……」
                              （已知內容淡化）

        ……兩個護士正在低聲說話。
```

這叫 **Attention Release**。

規則：

- NPC 仍用原時間說完
- 世界仍正常運行
- Single Focus 仍成立
- 不代表可以同時完整讀取所有 Ambient Event
- 同時間地點的資訊是有限 authored set

---

# 12. Memory Capture UI

Memory 不是自動收藏的 clue card。

玩家主動決定：

> 我要讓主角記住這個已經真正感知到的 Moment。

## 12.1 Text

Text Echo 可被 Hold：

```text
「我六點一直都在店裡。」
          ↑
        HOLD
```

感覺：

```text
Hold
→ target becomes Focus
→ surroundings fade
→ Moment freezes perceptually
→ subtle sensory cue
→ becomes Memory
```

World Time 不停止。

## 12.2 Visual / Sound / Composite

同一機制也可用於：

- Visual Memory
- Sound Memory
- Composite Moment

Memory 不可比原始 Perception 更清楚。

## 12.3 No clue confirmation

Capture 後不要顯示：

```text
✓ 發現重要線索
Rare Clue
矛盾 +1
```

玩家甚至可以 Capture：

```text
「最近真的好冷。」
```

---

# 13. Waiting / Idle presentation

Waiting is gameplay，但不能退化成倒數頁。

畫面仍然是一個活著的 Scene。

可以呈現：

- 玩家目前 Main Action
- NPC 正在做什麼（僅限玩家合理知道）
- Ambient Narrative
- Opportunity Window
- 當前 World Time

ETA 只有在角色 / runtime /世界內真的可知道時才顯示。

```text
預計約 14:27 回來
```

如果不知道：

```text
庭安還沒有回來。
```

不要為了 UI 製造假精準數字。

更重要的是：等待期間世界仍發生事情，玩家仍能 Observe / Capture / Interrupt。

---

# 14. Reset is ritual

Reset 仍然是 cinematic boundary，不是 route switch modal。

```text
Convergence
→ World settling
→ 23:59
→ Fade / Bell
→ 00:00
→ Next loop
```

Reset presentation 不應暗示主角「把記憶交還出去」或失去 Captured Memory，因為 protagonist-side Memory 是跨 Loop persistent。

如果 runtime 提供 `LIVE_SYNC / ACCELERATED` entry mode，模式選擇應在 Reset ritual 完成後出現。

---

# 15. Opening Scene

第一輪 canonical opening 保留其故事起點，例如：

```text
06:12
返鄉列車
→ 灰潮鎮
→ 第七封信
```

Opening 應直接與場景物件互動：

```text
列車窗外
雨
信封
林知夏　寄

      [信封本身可互動]
```

避免 generic `Continue`。

---

# 16. Memory / Investigation tools

Secondary tool layer 應以目前 Core Gameplay 詞彙為主：

```text
Memory Library
Investigation Wall
Worldline History
Save / Settings
```

## Memory Library

只負責找「我 Captured 過什麼」。

允許中性 filter：Loop / time / character / scene / type。

## Investigation Wall

Infinite Canvas：

- free placement
- pan / zoom
- Memory reference
- free connection
- note
- grouping

系統不替連線指定：

- 矛盾
- 因果
- 說謊
- 時間關係

如果現有 UI 名稱仍叫 Evidence Board，可先保留 compatibility alias，但 gameplay semantics 必須是 Investigation Wall。

---

# 17. Minimal HUD

Loop / Worldline / World Time 可存在，但不得成為網站 Header。

```text
LOOP 02                         14:22
WORLDLINE 02-B
```

低對比、角落、沒有大 Card container。

不要用 HUD 顯示 Attention meter / clue count / Focus points。

---

# 18. Visual language

Mood:

```text
quiet
lonely
humid
memory
mist
night
soft decay
slow breathing
```

可使用克制的：

- pixel animation
- grain
- vignette
- fog / rain
- subtle parallax
- local blur / dim
- sound direction
- Three.js / WebGL effect when it materially improves scene presence

避免：

- neon SaaS gradient
- large white panel
- card-grid first layout
- aggressive hover elevation
- every sentence having animation effects

---

# 19. Component architecture

Recommended direction:

```text
src/player/
├─ PlayerApp.tsx
├─ scenes/
│  ├─ OpeningScene.tsx
│  ├─ DialogueScene.tsx
│  ├─ LiveWorldScene.tsx
│  └─ ResetTransitionScene.tsx
├─ world/
│  ├─ SceneFrame.tsx
│  ├─ SpatialTextLayer.tsx
│  ├─ RhythmicText.tsx
│  ├─ TextEcho.tsx
│  ├─ AttentionSurface.tsx
│  ├─ WorldInteractionCue.tsx
│  └─ MemoryCaptureTarget.tsx
├─ presentation/
│  ├─ model.ts
│  └─ deriveScene.ts
└─ player.css
```

These names are architectural guidance, not frozen implementation API.

Do not preserve `TypewriterText` merely for compatibility if it encourages the old fixed-character timing model.

---

# 20. Accessibility

Immersion cannot require inaccessible interaction.

Keyboard / controller equivalents must exist for:

- move Focus among currently perceivable targets
- Attend
- Memory Capture
- meaningful Choice
- open / close secondary tools

Reduced Motion:

- removes unnecessary motion
- may render phrase transitions with simpler fades
- does **not** fast-forward World Time
- does **not** reveal missed content

Screen-reader presentation must avoid reading every simultaneous ambient event as if all were perceived; accessibility implementation should preserve Perception Boundary semantically.

---

# 21. Testing requirements

## Attention

Must test:

```text
only one Focus
Hover new target → old content fades
faded content continues progressing
Click → Attention Shift → Observe
Observation completion → Auto Return
Redirect ≠ True Interrupt
```

## World Time

Must test:

```text
reading does not pause world
dialogue does not pause world
Memory Capture does not pause world
repeated dialogue Attention Release does not accelerate world
```

## Perception

Must test:

```text
unperceived World Event cannot become Memory
partial Perception produces only partial Memory
missed dialogue does not replay on Focus return
```

## Memory

Must test:

```text
Capture accepts Text / Visual / Sound / Composite
Capture itself takes Focus
Captured Memory persists across loop reset
NPC relationship state does not
```

## Dialogue

Must test:

```text
ordinary response can flow automatically
meaningful Choice is explicit
Memory Input is separate from Choice
ambient events continue during conversation
```

## Accessibility

Must test keyboard Focus / Attend / Capture equivalents and Reduced Motion without altering World Time semantics.

---

# 22. Success criteria

Player Immersive UI is aligned only when:

1. first impression is a world, not a webpage
2. dialogue is spatial and rhythmic, not a chat log
3. reading never freezes Story Time
4. one Focus visually dominates while everything else keeps happening
5. Attention Shift has perceptual time cost
6. Observation naturally returns through Elastic Attention
7. Memory is captured by the player, not auto-awarded by clue importance
8. missed information remains missed
9. repeated dialogue releases attention without fast-forward
10. Waiting remains a live scene, not a progress modal
11. Reset preserves protagonist Memory semantics
12. Investigation tools do not auto-deduce
13. keyboard / reduced-motion modes preserve gameplay semantics
14. runtime truth remains authoritative

---

# 23. Non-goals

This design does not require v0.1 to ship:

- complete 3D town renderer
- full audio engine
- final character art
- procedural ambient generation
- LLM semantic clue matching
- automatic deduction
- infinite randomized clues

---

# 24. Design summary

```text
World never waits
        ↓
Scene continuously lives
        ↓
Peripheral cues compete
        ↓
Hover → Notice / Single Focus
        ↓
Click → Attend / Attention Shift
        ↓
Observe
        ↓
Capture / Choice / Redirect / True Interrupt
        ↓
Elastic return when observation ends
        ↓
Worldline continues
```

Core presentation principle:

> 能用世界本身表達的資訊，就不要額外建立 UI。

Core gameplay principle:

> 被淡化，不代表沒有發生。