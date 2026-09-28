# Player Narrative UI v0.2 Design

Date: 2026-09-28
Status: Approved design
Scope: Player-facing narrative presentation only; no implementation in this document

## 1. Goal

把 Player Narrative 從「一次顯示一整段文字的閱讀網站」改成具有時間感的即時演出介面：

```text
網頁式小說
    ->
Visual Novel / Diegetic UI
```

玩家閱讀故事時，文字逐字出現；點擊、Space 或 Enter 在打字期間完成目前 beat，完成後推進下一個 beat。場景切換、等待中的活動，以及人物記憶卡都要使用同一套以玩家理解為中心的呈現原則。

## 2. Existing context

目前 `PlayerNarrativeApp` 已經具備：

- narrative scene queue 與 scene consumption
- foreground freeze / world resume
- `ActivityRun` 的 duration、consumed、remaining 與 status
- player-known `knownFactIds`
- artifact、choice 與 ambient activity flow

因此 v0.2 不重做 Narrative Runtime。主要改動集中在 player presentation state、activity projection，以及 character memory data contract。

目前的主要問題是：

1. `visibleCount` 只控制完整 block 的數量，沒有逐字播放狀態。
2. `NarrativeSurface` 會累積所有已顯示文字，視覺上仍是文章。
3. `ActivitySurface` 只顯示時間、活動名稱與 ambient prose，沒有利用 ActivityRun 的進度資料。
4. `CharacterDrawer` 直接使用 character background summary；`character_insights.yaml` 也尚未進入 player StoryBundle。

## 3. Design principles

1. **故事狀態與播放狀態分離**：逐字游標是 UI state，不是故事進度。
2. **目前 beat 優先**：畫面只保留有限的近期上下文，避免回到閱讀器形態。
3. **時間由 projection 提供**：component 不自行推算 story time 或 ETA。
4. **玩家知道多少就顯示多少**：player drawer 不可暴露 author truth。
5. **沿用既有 runtime**：scene eligibility、choice effect、activity advancement 與 foreground freeze 保持原責任邊界。

## 4. Alternatives considered

### 4.1 Presentation-layer player (selected)

保留 `reconcilePlayerRuntime` 與現有 session schema 的世界狀態，由 `PlayerNarrativeApp` 管理暫存播放游標，新增純 projection 函式供 Activity 與 Character UI 使用。

優點：改動範圍小、避免把動畫與故事 runtime 耦合、可直接沿用既有 persistence 與 acceptance tests。

### 4.2 Runtime-owned beat cursor

由 runtime 直接產生目前 beat 與播放 phase，並將游標納入 session。

此方案較適合需要跨裝置或完整恢復未完成文字的產品，但會把逐字動畫與持久化綁進故事 runtime，v0.2 不採用。

### 4.3 Full narrative timeline rebuild

建立持續的 narrative history、presentation events、memory events 與 scene transition events。

此方案是長期可能方向，但目前會把 UI 改造升級成新的 runtime 工程，超出 v0.2 的交付範圍。

## 5. Architecture

```text
reconcilePlayerRuntime
        |
        v
PlayerNarrativeApp
  |             |
  |             +--> projectActivityPresentation -> ActivitySurface
  |
  +--> PlaybackState -> NarrativeSurface -> Typewriter Renderer
  |
  +--> projectCharacterMemory -> CharacterDrawer
```

### 5.1 Playback state

`PlayerNarrativeApp` 管理只存在於當前前端 session 的狀態：

```ts
type PlaybackPhase = 'typing' | 'waiting';

type PlaybackState = {
  sceneId: string;
  beatIndex: number;
  phase: PlaybackPhase;
  revealedCharacters: number;
};
```

`NarrativeSurface` 不再接收 `visibleCount`，改接收目前 scene、active beat 與 advance callback。scene 改變時，`beatIndex`、`phase` 與 rolling history 都重設。

播放 state 不寫入 `PlayerSessionV2`。故事是否已消費仍由 `consumedSceneIds` 決定；因此重新載入不會因為動畫中斷而重複或跳過 scene。

### 5.2 Typewriter renderer

新增可測試的 typewriter 播放邏輯，責任包括：

- 依字元 reveal text
- 對 `，、` 增加約 100ms pause
- 對 `。！？……` 增加約 180–250ms pause
- 文字完成後進入 `waiting`
- click / Space / Enter 在 `typing` 時直接完成當前 beat
- click / Space / Enter 在 `waiting` 時推進下一個 beat

字元速度目標為每字 30–45ms。`prefers-reduced-motion` 時跳過動畫並直接進入 `waiting`。

advance hint 不使用「繼續」文字按鈕，而是以低調的閃爍游標／省略號呈現。整個 narrative surface 可點擊；artifact、choice 與其他互動控制必須阻止事件冒泡。

## 6. Rolling narrative

畫面最多保留最近三個已完成 beat：

```text
previous-2  opacity .28
previous-1  opacity .52
active      opacity 1
```

新 beat 進入時，舊 beat 向上移動並降低透明度；更舊的 beat 從 DOM 移除。active beat 是唯一會逐字 reveal 的內容。

narration、monologue 與 dialogue 共用同一 playback flow。dialogue 保留 speaker name，但不因 block type 產生另一套推進機制。

## 7. Scene transition

一般 scene id 改變時使用：

```text
250ms fade out
-> 清除 rolling beats
-> 切換 scene
-> 400ms fade in
-> 播放第一個 beat
```

`kind: transition` 的 scene 使用較強的 fade-to-black，黑畫面停留約 500ms。v0.2 不新增複雜的 transition event runtime。

Loop reset cinematic 保留為未來 extension point；目前 runtime 沒有對外暴露 reset event，因此不在本次實作。

## 8. Activity presentation

新增純函式：

```ts
projectActivityPresentation(
  activityRun,
  activityDefinition,
  worldlineClock
): ActivityPresentationView
```

輸出：

```ts
type ActivityPresentationView = {
  title: string;
  prose?: string;
  remainingLabel?: string;
  etaLabel?: string;
  etaMode: 'exact' | 'approximate' | 'hidden';
};
```

`ActivitySurface` 只 render projection 結果，不使用 `Date.now()`、`remainingMinutes` 加法或自行格式化完成時間。

Activity definition 增加 optional policy：

```ts
eta?: 'exact' | 'approximate' | 'hidden';
```

預設為 `hidden`：

- `exact`：`預計 18:42 完成`
- `approximate`：`大約還要 5 分鐘`
- `hidden`：不顯示 ETA，只顯示活動與 ambient prose

projection 必須透過 `WorldlineClock`／clock adapter 取得完成時間，讓日後 accelerated、live sync 或其他 time scale 不需要修改 component。

## 9. Character Memory Card

### 9.1 Data contract

目前 `character_insights.yaml` 未被 `StoryBundle` 載入，且 `player-known` graph detail 的 `backgroundSummary` 仍可能攜帶 authored truth。v0.2 新增：

- `CharacterInsightDefinition`
- 可選的 `CharacterQuestionDefinition`
- `NarrativeFoundation.characterInsights`
- manifest 對 character insights document 的引用
- `PlayerSessionV3` 的 `knownInsightIds`

舊 `PlayerSessionV2` 讀取時遷移成 `PlayerSessionV3`，保留既有 `knownFactIds`，新欄位預設為空。Insight 只有在被主角保留／取得後才可出現在 player drawer。

### 9.2 Player projection

新增 player-safe memory projection，輸出：

- identity：name、occupation、必要時 hometown
- player-known facts
- cross-loop insights
- unresolved questions
- optional portrait reference

不輸出：

- author-only background
- hidden traits、secrets
- schedule reference
- narrative appearance ids

沒有 portrait asset 時，以角色縮寫與色塊作為 fallback；v0.2 不建立圖片資產管線。

### 9.3 Card layout

```text
姓名
身份
[portrait / monogram]

「主角對他的已知摘要」

MEMORY
● facts
● cross-loop insights

QUESTIONS
◌ unresolved questions
```

當某個 section 沒有資料時整段隱藏，不顯示空的 author/debug placeholder。

## 10. Input and accessibility

- narrative surface 支援 pointer click、Space 與 Enter。
- 所有互動控制保留原生 button semantics。
- advance hint 提供可讀的 `aria-label`，但視覺上不顯示「繼續」。
- typewriter 完整文字必須可被 screen reader 讀取，不應只暴露目前已 reveal 的片段。
- `prefers-reduced-motion` 關閉逐字與 scene transform 動畫。
- focus 在 choice、artifact action 或人物 drawer 開啟時不可被背景 narrative advance 搶走。

## 11. Error handling and compatibility

- 缺少 Activity ETA policy 時使用 `hidden`。
- 缺少 character insight document 時，人物卡仍可顯示既有 player-known facts。
- 缺少 portrait 時使用 monogram。
- 舊 `PlayerSessionV2` 無 `knownInsightIds` 時遷移成 `PlayerSessionV3`，新欄位使用空陣列。
- malformed insight / question data 應在 story loading validation 階段失敗，不在 render 階段靜默暴露 author data。
- 既有 artifact、choice、foreground freeze、activity completion 與 scene consumption semantics 不變。

## 12. Testing and acceptance criteria

### Unit and component tests

1. typewriter 依序 reveal 字元。
2. punctuation pause 使用 fake timers 可驗證。
3. typing phase 的 click / Space / Enter 完成句子。
4. waiting phase 的 click / Space / Enter 推進 beat。
5. rolling window 最多保留三個 beat。
6. scene 變更會 reset playback state 與 transition state。
7. reduced-motion 直接完成 beat。
8. Activity exact / approximate / hidden 三種 policy 輸出正確 label。
9. Activity component 不自行計算 ETA。
10. v2 到 v3 的 session migration 會保留既有 facts 並初始化 insights。
11. Character Card 不洩漏 author-only background 或 secrets。
12. 缺少 insight、question、portrait 時使用正確 fallback。

### Regression checks

- 現有 player narrative UI tests 維持通過。
- 現有 runtime、queue、storage、ambient activity 與 acceptance tests 維持通過。
- `npm run build` 通過 TypeScript 與 Vite build。

## 13. Out of scope

- 聲音與音效系統
- 立繪、Live2D 或角色動畫
- 完整 loop-reset cinematic
- worldline clock 核心重寫
- 故事內容大規模改寫
- portrait image asset pipeline
- 將播放游標跨裝置同步或持久化

## 14. Implementation boundary

預期實作會集中在：

- `src/playerNarrative/PlayerNarrativeApp.tsx`
- `src/playerNarrative/components/NarrativeSurface.tsx`
- `src/playerNarrative/components/ActivitySurface.tsx`
- `src/playerNarrative/components/CharacterDrawer.tsx`
- `src/playerNarrative/playerNarrative.css`
- player narrative 的 typewriter、activity presentation 與 character memory projection modules
- narrative types、story loader、manifest 與 player session migration
- component、projection、storage 與 regression tests

本 spec 不授權直接修改上述檔案；implementation plan 會再拆分具體步驟與驗證順序。
