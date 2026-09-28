# Player Immersive UI Design v0.1

## Status

Design draft for human review.

This document defines the Player-facing UI direction for `Loop_and_Town`.

It is a **design spec only**. It does not claim implementation is complete.

The visual direction takes inspiration from the quiet, restrained, emotionally weighted presentation associated with narrative games such as *彼方的她 - Aliya*, but does not copy its assets, layouts, or exact visual treatment.

---

# Goal

把目前 Player 畫面從「網站式閱讀介面」改成「場景驅動的沉浸式放置敘事遊戲」。

核心不是增加更多 UI，而是讓 UI 退後，讓玩家感覺自己仍然待在灰潮鎮裡。

玩家應感受到：

```text
Scene
  ↓
Narrative
  ↓
Player intention
  ↓
World progression
  ↓
Memory / consequence
```

而不是：

```text
Page
→ Card
→ Button
→ Modal
→ Next page
```

---

# Product Position

Player UI 與 Author Viewer 使用同一套世界觀詞彙，但目的不同。

```text
Author Viewer
→ 理解世界線因果
→ Causal Timeline / Inspector / Diff

Player UI
→ 感受世界線因果
→ Scene / Dialogue / Waiting / Reset
```

Player 不需要看到 runtime debug field。

Player 應看到：

- Loop
- Worldline
- Simulation Time
- 世界正在發生什麼
- 自己是否可以介入
- 自己留下了哪些記憶

---

# Existing Runtime to Keep

本設計不重寫既有 Player Runtime。

保留目前 `src/player` 中已存在的責任：

```text
clock.ts
runtime.ts
model.ts
knowledge.ts
eventScheduler.ts
storage.ts
narrativeRecords.ts
```

這些仍負責：

- Loop state
- Simulation clock
- save / load
- action confirmation
- worldline progression
- knowledge persistence
- reset boundary
- offline reconciliation

這次主要重構的是 **Presentation Layer**。

Canonical dependency direction：

```text
Story / Runtime
      ↓
Player State
      ↓
Presentation Projection
      ↓
Scene Components
```

UI 不應反向修改或重新定義 runtime 規則。

---

# Design Principles

## 1. Scene first

畫面主體永遠優先是場景。

資訊層級：

```text
1. Scene / atmosphere
2. Narrative text
3. Player interaction
4. Minimal HUD
5. Secondary tools
```

不要讓 Header、Button、Card 成為第一視覺焦點。

---

## 2. Text has weight

文字不是 static label，而是演出的一部分。

重要文字應支援：

- typewriter reveal
- punctuation pause
- fade in / fade out
- cursor blink
- intentional silence

例如：

```text
若晴

「你真的還記得……
昨天發生過的事嗎？」▌
```

不是一次將整段 DOM 直接顯示。

---

## 3. Interaction as intention

玩家不應感覺自己在操作 Web CTA。

避免：

```text
[ 確認 ]
[ 下一步 ]
[ 繼續 ]
```

優先使用語意化互動：

```text
「今晚，我陪你留下來。」

「予安，幫我去醫院。」

將記憶交還給世界

靜靜等待
```

HTML 底層仍可使用 `<button>` 保留 accessibility，但視覺上不要像一般矩形按鈕。

---

## 4. Waiting is gameplay

放置等待不是 loading state。

Waiting Scene 必須回答：

```text
現在世界正在做什麼？
誰正在行動？
玩家目前能不能介入？
大約還要多久？
結果是否可預測？
```

ETA 可以是：

```text
exact
approximate
unknown
```

未知等待不應被強迫顯示假精準倒數。

---

## 5. Reset is ritual

Reset 不是 route change，也不是 mode-selection modal。

玩家必須先經歷：

```text
Convergence
→ World settling
→ Handoff
→ Fade
→ 00:00
→ Memory transition
→ Next loop
```

設定或模式選擇只能出現在情緒過場完成之後。

---

## 6. Minimal HUD is diegetic

Loop / Worldline / Time 是世界線儀表，而不是網站 header。

基本形態：

```text
LOOP 02                         09:14
WORLDLINE 02-B
```

低優先狀態可以進一步縮成：

```text
02                              09:14
```

HUD 應低對比、退到角落、避免大容器與大邊框。

---

# Visual Language

## Mood

關鍵詞：

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

中文定位：

- 安靜
- 孤獨
- 潮濕
- 記憶感
- 低飽和
- 微顆粒
- 緩慢
- 溫柔但壓抑

---

## Color

主體不使用純黑純白作為唯一語言。

方向：

```text
Deep blue gray
Muted green gray
Cold charcoal
Mist cyan
Old-paper white
Dim warm lamp
```

避免：

- 高飽和 neon
- 強烈 app gradient
- 大面積純白 panel

---

## Texture

允許非常輕的：

- film grain
- vignette
- soft fog
- rain / dust particles
- low-opacity scan texture
- light leak

特效必須保持克制。

目標是讓畫面「有觸感」，不是做復古濾鏡展示。

---

# Component Architecture

建議將 Player Presentation 拆成：

```text
src/player/
├─ PlayerApp.tsx
│
├─ scenes/
│  ├─ OpeningScene.tsx
│  ├─ DialogueScene.tsx
│  ├─ IdleProgressScene.tsx
│  └─ ResetTransitionScene.tsx
│
├─ ui/
│  ├─ SceneFrame.tsx
│  ├─ WorldlineHud.tsx
│  ├─ TypewriterText.tsx
│  └─ AmbientPrompt.tsx
│
├─ presentation/
│  ├─ model.ts
│  └─ deriveScene.ts
│
├─ player.css
├─ runtime.ts
├─ clock.ts
├─ model.ts
├─ knowledge.ts
└─ ...
```

---

# PlayerApp Responsibility

`PlayerApp` 保留 orchestration，但移除具體視覺 composition。

它負責：

```text
load story
read / write save
refresh clock
derive runtime state
handle player actions
open secondary tools
```

不再直接負責：

```text
reset animation layout
typewriter timing
scene fade
ambient prompt styling
HUD composition
```

Target：

```tsx
<SceneFrame scene={scene}>
  <WorldlineHud ... />
  <PlayerScene scene={scene} ... />
</SceneFrame>
```

---

# Presentation Projection

UI 不應自行解析大量 runtime condition。

新增純函式 projection：

```text
Runtime State
    ↓
deriveScene()
    ↓
PlayerScene Model
```

建議 union：

```ts
PlayerScene =
  | OpeningSceneModel
  | DialogueSceneModel
  | IdleSceneModel
  | ResetSceneModel
```

Base information：

```ts
SceneBase = {
  loop: number
  worldline?: string
  time: string
  background?: SceneBackground
}
```

`deriveScene()` 應該是 deterministic pure function，方便測試。

---

# SceneFrame

`SceneFrame` 是 Player UI 的視覺外殼。

它負責：

```text
background
ambient movement
overlay
mist
grain
vignette
scene crossfade
content slot
```

概念 API：

```tsx
<SceneFrame
  background="station-rain"
  mood="night"
  dim={0.42}
  grain
  vignette
>
  ...
</SceneFrame>
```

Scene transition：

```text
Scene A opacity ↓
       +
Scene B opacity ↑
       ↓
Scene B
```

建議正常 crossfade 約 `700–1200ms`。

---

# WorldlineHud

取代 gameplay 中目前網站式的大 Header 主導感。

主要資訊：

```text
LOOP
WORLDLINE
Simulation Time
optional world status
```

例如：

```text
LOOP 02                         14:22
WORLDLINE 02-B
```

`案卷 / 推理桌 / 世界線 / 存檔` 保留，但降為 secondary tools。

建議：

```text
Scene
  ↓
corner affordance
  ├─ 案卷
  ├─ 推理桌
  ├─ 世界線
  └─ 存檔
```

不要常駐一排大型 navigation buttons。

---

# TypewriterText

共用敘事 primitive。

建議 API：

```ts
{
  text: string
  speed?: number
  punctuationDelay?: number
  cursor?: boolean
  onComplete?: () => void
}
```

行為：

```text
character reveal
→ punctuation pause
→ completion
→ cursor blink
```

建議預設：

- normal character: 20–40ms
- comma / short pause: +60–120ms
- sentence punctuation: +120–240ms
- completed cursor: ~700ms blink

實際速度未來可由 accessibility / player preference 調整。

---

# AmbientPrompt

`AmbientPrompt` 取代一般 CTA。

例如：

```text
將記憶交還給世界
          ◇
```

或：

```text
點擊繼續
      ▌
```

底層可以是大範圍互動 target，避免要求玩家精準點小文字。

Keyboard 支援：

- Enter
- Space
- Escape 僅用於可取消 secondary overlay

---

# OpeningScene

第一輪仍保留 canonical opening：

```text
06:12
返鄉列車
→ 灰潮鎮
→ 第七封信
```

第一輪不應因玩家現實時間而跳過故事起點。

Opening Scene 應以場景與信件本身作為主要互動，而不是一般按鈕。

例如：

```text
列車窗外
雨
信封
林知夏　寄

        拆開信
```

---

# DialogueScene

目標是把「文件閱讀」與「角色現場對話」拆成不同語言。

Dialogue Scene：

```text
┌────────────────────────────────────────────┐
│                                            │
│                 Scene                      │
│                                            │
│                         Character          │
│                                            │
│ 若晴                                       │
│                                            │
│ 「你真的還記得……                          │
│ 昨天發生過的事嗎？」▌                      │
│                                            │
│                                  · · ·     │
└────────────────────────────────────────────┘
```

對話預設不使用大型 opaque dialogue box。

可使用：

- bottom gradient
- subtle text shadow
- local dimming

以保持文字可讀性。

---

# Player Decisions

Decision 仍然是 gameplay interaction，但不使用 Web button language。

例如：

```text
「今晚，我陪你留下來。」

                         或

「予安，幫我去醫院。」
```

Hover / keyboard focus 使用：

- underline
- slight luminance increase
- subtle marker

不要使用：

- large rounded rectangle
- primary / secondary SaaS button hierarchy

底層仍維持 semantic `<button>`。

---

# IdleProgressScene

這是放置玩法核心畫面。

Presentation model 至少包含：

```ts
{
  actor?: string
  activity: string
  canIntervene: boolean
  etaKind: 'exact' | 'approximate' | 'unknown'
  etaMinutes?: number
  expectedAt?: string
}
```

Example：

```text
             世界仍然在前進

       庭安正在調查五年前的紀錄

             還需要一點時間

                約 5 分鐘
                 14:27
```

Unknown：

```text
庭安還沒有回來。

              ...... ▌
```

禁止使用：

```text
Loading...
Processing...
任務進行中
請稍後
```

---

# ResetTransitionScene

Reset 是 v0.1 第一個應完成的完整 cinematic scene。

## State Machine

```text
settling
   ↓
message
   ↓
handoff
   ↓
fade
   ↓
midnight
   ↓
nextLoop
```

Suggested type：

```ts
ResetPhase =
  | 'settling'
  | 'message'
  | 'handoff'
  | 'fade'
  | 'midnight'
  | 'nextLoop'
```

---

## Reset Sequence

### 1. settling

上一個場景仍存在。

- ambient audio / visual remains
- saturation decreases
- brightness decreases
- actors disappear
- rain / fog may continue briefly

### 2. message

HUD 顯示：

```text
23:59
```

逐字出現：

```text
世界接手了這一輪。
```

### 3. handoff

短暫停頓後顯示：

```text
將記憶交還給世界
```

玩家 click / Space / Enter。

### 4. fade

Scene → black。

### 5. midnight

只顯示：

```text
00:00
```

### 6. nextLoop

依 runtime 決定下一輪進入模式。

如果下一輪 canonical start 是 accelerated：

```text
LOOP 04
06:12
```

如果需要玩家選擇 Live Sync / Accelerated，選擇介面只能在 Reset ritual 完成後出現。

---

# Reset and Entry Mode Choice

目前 runtime 有：

```text
LIVE_SYNC
ACCELERATED
```

這個功能保留。

但 presentation sequence 必須改成：

```text
Reset cinematic
→ memory transition complete
→ optional entry mode choice
→ createNextLoop()
```

而不是：

```text
reset pending
→ immediately show two large mode buttons
```

Entry Mode Choice 仍需清楚，不必故意做成神秘選項。

可用敘事化描述：

```text
跟著現在走
從此刻的灰潮鎮進入

回到記憶開始的地方
從 06:12 的返鄉列車開始
```

---

# Evidence / Case / Worldline Tools

以下現有功能必須保留：

- Case records
- Evidence Board
- Worldline Notebook
- Save import / export

但這些是 secondary tool layer。

它們可以使用 drawer / overlay，但打開之前不能主導 gameplay screen。

建議：

```text
Gameplay Scene
     ↓
small corner affordance
     ↓
secondary overlay / drawer
```

Evidence Board 本身可以保留較高資訊密度，因為那是玩家主動切換到「調查模式」。

---

# Scene Background Model

第一版不需要建立複雜 3D Scene Engine。

最低模型：

```ts
SceneBackground = {
  id: string
  image?: string
  mood?: 'morning' | 'day' | 'evening' | 'night' | 'memory'
  ambient?: 'rain' | 'fog' | 'dust' | 'none'
  dim?: number
}
```

未來可以擴充：

- character layer
- parallax layer
- WebGL / Three.js effect
- weather simulation

但 v0.1 不應因此阻塞。

---

# CSS Strategy

目前維持既有 plain CSS。

不新增 Tailwind / CSS-in-JS / component library。

`player.css` 先按 responsibility 整理：

```text
00 Tokens
10 Player Shell
20 Scene Frame
30 Ambient / Texture
40 HUD
50 Narrative Typography
60 Dialogue
70 Idle
80 Reset
90 Secondary Tools
100 Accessibility
```

Design tokens：

```text
--player-bg-deep
--player-bg-mist
--player-text-primary
--player-text-secondary
--player-text-faint
--player-accent-cold
--player-accent-warm

--player-motion-fast
--player-motion-normal
--player-motion-slow

--player-story-size-lg
--player-story-size-md
--player-meta-size-sm
```

---

# Motion Rules

Motion 應該：

- slow
- subtle
- predictable
- narrative-driven

Recommended：

```text
fade in              300–800ms
fade out             400–900ms
scene crossfade      700–1200ms
ambient pulse        1800–2500ms
cursor blink         ~700ms
reset dim            600–1200ms
```

Avoid：

- bounce
- large scale pop
- aggressive slide
- card flip
- SaaS-style hover elevation

---

# Accessibility

沉浸感不能建立在不可操作之上。

必須支援：

## Keyboard

- Space / Enter advance narrative
- Tab can reach actual decisions and tools
- Escape closes secondary drawer

## Reduced Motion

尊重 `prefers-reduced-motion`。

Reduced motion 下：

```text
typewriter → immediate / very fast reveal
crossfade → short opacity transition
ambient drift → disabled
pulse → disabled or static
```

## Readability

背景場景不能犧牲文字對比。

允許局部 gradient / blur / dim 以保證閱讀。

---

# Sound Boundary

v0.1 可以保留 sound integration point，但不要求立即建立完整 sound engine。

需要留出：

```text
scene enter cue
text cue optional
reset ambience fade
midnight cue
next-loop ambience
```

聲音不能成為 UI state machine 的唯一 timing source。

Animation / state transition 必須在 mute 狀態仍可正常執行。

---

# Testing Strategy

## Unit

### `deriveScene`

確認 runtime state → scene model deterministic。

至少測：

- unopened first letter → Opening
- active narrative → Dialogue
- pending timed action → Idle
- reset boundary → Reset

### `TypewriterText`

使用 fake timers 測：

- character progression
- punctuation pause
- completion callback once
- skip / complete behavior

### Reset state machine

測：

```text
settling
→ message
→ handoff
→ fade
→ midnight
→ nextLoop
```

並確認重複 input 不會 create multiple next loops。

---

## Integration

`PlayerApp` 至少驗證：

- existing save still loads
- existing actions still work
- evidence / case / worldline tools remain reachable
- reset no longer immediately renders mode-choice buttons
- mode choice still creates correct next loop after ritual
- keyboard navigation remains available

---

## Build gates

每個 implementation slice 完成後：

```text
npm test
npm run build
```

必須保持：

- Vitest green
- TypeScript green
- Vite build green

---

# Planned Implementation Slices

這裡只定義 implementation ordering；詳細 task-by-task coding plan 會在本 spec 經 human review 後另寫。

## Slice 1 — Presentation foundation

新增：

- `presentation/model.ts`
- `presentation/deriveScene.ts`
- `ui/SceneFrame.tsx`
- `ui/WorldlineHud.tsx`
- `ui/TypewriterText.tsx`
- `ui/AmbientPrompt.tsx`

先建立 primitives，不改 narrative canon。

---

## Slice 2 — Reset cinematic

新增：

- `scenes/ResetTransitionScene.tsx`

調整：

- `PlayerApp.tsx`
- `player.css`

讓目前 reset mode-choice 之前先完成完整 ritual。

這是第一個 visual validation checkpoint。

---

## Slice 3 — Dialogue presentation

新增：

- `scenes/DialogueScene.tsx`

將現場人物對話從 document-style presentation 拆出。

保留 document / evidence records 作為另一種 investigation presentation。

---

## Slice 4 — Idle / waiting presentation

新增：

- `scenes/IdleProgressScene.tsx`

把 timed action / NPC investigation / real-time waiting 投影成可理解的世界狀態。

ETA 必須支援 exact / approximate / unknown。

---

## Slice 5 — Opening migration

新增：

- `scenes/OpeningScene.tsx`

將第一封信與返鄉列車 opening 改成 scene-first presentation。

---

## Slice 6 — Secondary UI cleanup

重整：

- Case drawer
- Evidence Board affordance
- Worldline entry
- Save entry

功能保持相容，但從 always-visible navigation 降為 secondary interaction。

---

# Success Criteria

完成 v0.1 後，Player 畫面必須符合：

1. 第一眼先看到世界，而不是 header / card / button。
2. 對話透過時間與動畫被「說出來」，不是靜態貼在頁面。
3. 玩家決策不像 SaaS CTA。
4. Waiting Scene 能讓玩家理解世界仍在前進。
5. 未知事件不會顯示假精準 ETA。
6. Reset 有完整情緒收束，不直接跳設定選單。
7. `00:00 → next loop` 是可感知的 ritual。
8. Loop / Worldline / Time 存在但不搶主畫面。
9. Case / Evidence / Worldline / Save 功能沒有被移除。
10. Existing runtime / save compatibility 不被破壞。
11. `prefers-reduced-motion` 與 keyboard interaction 可正常使用。
12. Tests / TypeScript / Vite build 保持綠燈。

---

# Non-goals

v0.1 不包含：

- 重寫 Story DAG
- 改變 Canon
- 重寫 Worldline runtime
- 建立完整 3D town renderer
- 建立完整 audio engine
- 新增外部 UI framework
- Tailwind migration
- 改寫 Evidence Board gameplay
- 重做 Author Viewer
- 一次完成所有角色美術與背景素材

---

# Architecture Summary

```text
Story / YAML
     ↓
Player Runtime
     ↓
PlayerSave + Clock + Event State
     ↓
deriveScene()
     ↓
PlayerScene Model
     ↓
┌──────────────────────────────┐
│ SceneFrame                   │
│                              │
│  WorldlineHud                │
│                              │
│  OpeningScene                │
│  DialogueScene               │
│  IdleProgressScene           │
│  ResetTransitionScene        │
│                              │
│  AmbientPrompt               │
└──────────────────────────────┘
     ↓
Secondary Investigation Tools
```

核心原則：

> Scene first, text with weight, interaction as intention, waiting as gameplay, reset as ritual.
