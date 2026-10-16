# 黑幕沉浸式 UI v0.1｜實作順序與 PR 切分

> Status：Active implementation plan（Draft PR #25 已有第一段可玩切片，瀏覽器驗收與擴充待完成）
>
> Spec：`docs/superpowers/specs/2026-10-16-black-screen-immersive-ui-interaction-v0.1-design.md`
>
> Goal：**先修畫面與互動；再讓編劇插入敘事 beat / inline target / ambient cue。**

## 優先級

```text
P0 可點／狀態有效
    ↓
P1 全黑舞台與少量主敘事
    ↓
P2 主線文字節奏與選擇
    ↓
P3 Ambient Cue + Inline Discovery（共用 Single Focus）
    ↓
P4 晃動／物件／聲音的短演出
    ↓
P5 開場 vertical slice 驗收，才大量擴充 Story
```

## P0｜真正修復「點不到 / 按了沒用」

優先修改：`src/player/PlayerApp.tsx`、`ui/PlayerSceneStage.tsx`、`ui/PlayerAmbientLayer.tsx`、`ui/playerSceneStage.css`。

- 用瀏覽器重現目前讀信「＋」、側邊 Cue、Opening 信封、Choice、Memory Capture 等操作。
- 逐個確認 button hitbox、z-index、pointer-events、disabled 原因、handler、State/History 是否變更。
- 禁止只改顏色不修 handler；也禁止為修 click 而關閉 World Time。
- 添加 Playwright / Testing Library 等符合現有環境的互動回歸測試：真實 click → command → valid State；blocked reason 可回饋。
- **Exit**：開場每個可見互動都有可驗證的結果、滑鼠鍵盤觸控等價、CI Green。

## P1｜黑幕舞台骨架

優先修改：`playerSceneStage.css`、`player.css`、`PlayerSceneStage.tsx`、`SceneAtmosphere.tsx`、`PlayerPresentationHud.tsx`。

- 統一接近黑色的背景；移除綠色天空、像素格線、地平線、框線與文件讀卡視覺。
- 保留極淡 HUD；推理桌／工具獨立展開，不壓住主線。
- 舞台改為可容納四周文字 anchor 的空間；維持可及性、mobile safe area。
- **Exit**：開場與讀信兩個截圖皆是黑幕、可讀、無大片綠色背景，且互動沒有回歸。

## P2｜NarrationBeat / 可用 Choice

優先修改：`TypewriterText.tsx`、`PlayerApp.tsx`，新增可復用的 `NarrationStage`、`ChoiceList`（可依現有元件改造）。

- 主線按 authored beat 出現；不要再用一整頁 `document-lines`。
- 狀態分類 `narration` / `choice`，按鈕只提交合法 action；一般文字不需泛用「繼續」。
- 快速顯示已發生的文字不會加速 NPC、等待或 World Time。
- **Exit**：開場 2–4 句流暢出現，至少一個 Choice 變更合法 State / History，所有 input parity tests Green。

## P3｜最重要：Ambient Cue 與 Inline Text Target

優先新增／改造：`AmbientTextLayer`、`InlineTextTarget`、`FocusSurface` 與 Story scene projection。

- 讓外側「沙沙——」是可點世界事件，不是固定 footer status。
- 讓主線「紙張」是普通句子中的互動段落（`segments[]`），不另開一張卡或讓整句發亮。
- 兩者都呼叫**現有** Attend / Attention Shift / Observation / Perception；共用 Focus，不產生新平行系統。
- 明確包含 `flavor_only`（彩蛋）與可能 `unlock_followup_choice` 的差異，**不能**按一下就永久記住或看到 Author Truth。
- 存在期限、Expired、Redirect、自然回 Main Action；其他 Cue 持續走自己的排程。
- **Exit**：同一畫面兩種互動都能點、都佔用單一 Focus、另一路 Cue 可到期，Capture 仍由玩家控制。

## P4｜短演出／物件

- 信封／票根僅在必要時浮現，平時不保留文件卡片 UI。
- 列車「喀」等小 shake 約 150–300ms；環境聲有文字 Cue，音效可關。
- 套用 Reduced Motion：禁震動／位移但語意、Action、Clock 不變。
- **Exit**：演出不會吞按鍵，不會移走 hitbox，也不遮住被選中的 Inline Target。

## P5｜開場實機驗收

在 **同一組** Playable Story Data 上驗收：

```text
06:12 main narration appears
  ↘ 06:12 ambient rustle appears (can expire)
     ↘ player notices / attends sound
  ↘ main contains interactive "紙張"
     ↘ player can choose it *instead* of sound
       ↘ only actually observed moment may be player-captured
  ↘ normal choice accepted
     ↘ event history / action changes
  ↘ paper/letter object emerges
     ↘ Story Canon warning unchanged
```

必測：
- 滑鼠、觸控、Tab/Enter/Space；
- 空間 cue 同時存在、只能 Focus 一個；Hover 淡化其他內容；
- 動效進行時點擊成功且只觸發一次；
- 點字詞、離開又回來，不應重播過期世界事件；
- 加速文字 / Reduced Motion 不改世界時間；
- Offline catch-up 與 Reset 保留獨立玩家記憶；
- 本地 `npm test` + `npm run build`、PR Actions 驗證均通過；
- **瀏覽器** 以桌機＋手機實測開場、選擇、Focus、Capture 的截圖和操作，而不只 Vitest 通過。

## 實作 PR 建議

- **PR A｜P0–P1：Click fixes + Black Stage**：最小範圍先把畫面和按鈕修到能玩。
- **PR B｜P2–P3：Narration + Inline/Ambient Attention**：定義可擴充資料 schema、語意狀態機及整合測試。
- **PR C｜P4–P5：Effects + opening scene integration**：短演出與可用劇情段落。

各 PR 只改 Presentational / Player runtime necessary surfaces；Story Canon 若需調整另提討論。保持 `main` Pages 僅在 Merge 後部署。沒有真實經瀏覽器驗證不得宣稱「畫面與按鈕已修復」。

## Scope Guard

本輪最先的價值不是寫更多篇章，也不是堆技術，而是先保證：

**黑幕有場景感、普通文字可讀、旁邊聲音可點、句子裡的字可點、只有一個 Focus、選擇真的改變世界。**

## Implementation progress (PR #25)

**已提交／具自動測試：**
- P0：修正 `PlayerApp` 每次 rerender 可能重載故事的預設 callback identity；可點項目接實際 Attend handler，失敗有回饋；回歸測試包含信件打開與玩家選擇性記憶保存。
- P1：舞台改成黑底、拿掉綠色像素天空／地平線，弱化文件與狀態面板；Minimal HUD 仍在。
- P2：開場第一個 NarrationBeat 已使用真正的 `TypewriterText`；信件警語採短分步顯示。**整套長篇 Narrative beat authoring 尚未實作完成**。
- P3：主線 `紙張` 的 `InlineTextTarget`、旁邊 `沙沙、沙沙——`／`喀。`／廣播的有限 `AmbientCue` 共用既有 Attention／Perception／選擇性 Capture；同時事件可 Redirect，過期不補發。
- P4：列車極小晃動、信封與新訊息短時浮現、Reduced Motion；未依賴大型美術資產。
- P5：Unit／React integration tests + TS／Vite CI。**尚未完成真人瀏覽器桌機＋手機視覺/手感驗收，不宣稱全遊戲 UI 重做完成。**

**刻意延後：**一般對話／其他章節全部改成語意 NarrationBeat、通用 YAML `segments[]` parser、全篇彩蛋作者工具、完整空間音效、不同解析度的實機截圖，以及更細的 NPC 場景演出。

**請勿將示範用紙聲推導為幕後新人物／跨 Loop 傳訊。** 目前只描述當輪列車上可能實際感知的摩擦、車輪與廣播。

### Interaction Simplification：取消重複的「重要句子」收集

- 移除 Player 的 `excerpts`「留下你認為重要的句子」與每句 `＋` UI，不刪 Story 裡作為資料來源的 excerpt 文本。
- 唯一玩家記憶機制：`Attention → Perceived Moment → optional Memory Capture → Memory Library / Investigation Wall`。
- 歷史 `knowledge.pins` 保留並照常顯示於推理牆；支援連線與移出，不把它們強制轉成已 Capture 的記憶。
- 回歸測試確認：讀信不會額外要求選句、不會自動新增 pins；舊 pins / 連線 / 座標重載後仍在，移除 pin 時清理依賴連線。
