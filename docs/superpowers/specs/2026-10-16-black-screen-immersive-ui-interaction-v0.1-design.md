# 黑幕沉浸式 UI / Interaction Spec v0.1

> Status：**Active design + initial playable vertical slice implemented in Draft PR #25**（CI 驗證中；正式網站及瀏覽器視覺驗收尚未完成）
>
> Scope：正式 Player UI（`player.html`）的文字場景、旁支聲音、主線字詞互動、單一 Attention、基本選擇、物件演出與可及性。
>
> Inspiration：Type Help 式「看不見場景，但從文字知道場景正在發生」的沉浸感。**參考體驗，不複製特定作品的內容或素材。**
>
> Precedence：`core-gameplay-spec-v0.1.md` > Story Canon > 本 active subsystem spec > `docs/superpowers/**` 的歷史文件。遇到衝突以此順序判定。

## 0. 一句話定位

**全黑的舞台沒有畫出完整場景：文字的位置、浮現、消失、聲音與震動就是場景；玩家可以在主線句子中自行發現能點擊的字詞，也可以轉向邊緣浮現的聲音，但當輪所有事情仍持續發生，且一次只能真正觀察一件事。**

目標不是把網站換成黑色主題，而是從「文件閱讀器 / 任務按鈕 / 卡片選項」換成「會呼吸、有視線方向與機會成本的文字世界」。

### 玩家感受（必須成立）

1. 初見只看到黑暗、一小段主線文字與極弱的時間／地點；不是綠色格線、像素天空或中間的大閱讀卡。
2. 場景不靠圖片填滿。文字可能在左後方、遠處、靠窗、腳邊浮現：「沙沙——」「廣播……」「喀」。
3. 主線句子裡「**紙張**」本身可能可互動；沒有「發現線索」圖示提醒它比其他詞重要。
4. 專注其中一個來源，其他文字降低亮度，但其他人與事件的**世界時間不暫停**。
5. 玩家可以忽略、誤判、錯過；再次輪迴可能看見不同細節。遊戲不替玩家自動辨別哪些資訊重要。
6. 可見選項一定可操作，按後有對應的 Attention、Choice、Action 或 World State 結果；不存在「看起來能按，按下無反應」的假互動。

## 1. 視覺設計：黑暗優先

### 1.1 視覺 Token（v0.1 預設）

| 用途 | 預設 | 限制 |
| --- | --- | --- |
| Stage | `#050506`（接近黑） | 全視窗單一底色；不使用大面積綠色／漸層／網格 |
| Main Narration | `#D9D9D6` | 高可讀，避免純亮白整屏 |
| Peripheral Cue | `#88898D`／較低亮度 | 不代表不重要，只代表不在主 Focus |
| Focus | `#F0F0EC` | 同時最多一個 |
| Echo / past line | `#67686C` | 時限後正常淡出，非永久日誌 |
| HUD | `#666970` | 小且淡，只表示 Loop / 地點 / 時間與狀態 |
| Accent | 極少的冷灰或暗琥珀 | 只在確實需要呈現特殊物件時使用；不能把重要線索系統性標成特殊顏色 |

**刪除／停用舊舞台視覺**：綠色天空、像素地平線、整面規則格線、明顯的玻璃卡片邊界、中央大面積框線、常駐「新消息／抓線索」列表，以及占用場景的 debug Action UI。保留作者工具與推理桌的功能，但預設隱藏於可開啟層，而非覆蓋遊戲現場。

### 1.2 舞台構成

```text
┌──────────────────────────────────────────────────────────────┐
│ LOOP 01                                            06:12    │
│                                                              │
│       ……遠方的廣播，停了一拍。                               │
│                                                              │
│                        你是在列車顛簸時醒來的。              │
│                        信封背面沾著一點潮氣。                │
│                                                              │
│                                      沙沙——                  │
│                                                              │
│  喀。                                                        │
│                                                              │
│                                             [極淡的地點]     │
└──────────────────────────────────────────────────────────────┘
```

此圖只表示**分布與層次**，不是所有文字同時顯示，也不是固定 UI 清單。主敘事塊可在偏左／偏中位置緩慢移動，避免永遠固定在同一個對話框；重要台詞要有穩定閱讀區，不要每個字跳動。

### 1.3 層級與遮擋

```text
0  BlackCanvas       全黑、極淡非互動噪點
1  AmbientText       遠方聲音／環境碎片／事件 Echo
2  MainNarration     當前主線 beats、內文互動字詞
3  FocusSurface      唯一高亮觀察目標（原區域展開、不是巨型 modal）
4  ObjectManifest    信件／車票／手機等短時物件演出
5  MinimalHUD        Loop、時間、地點、可開啟的工具入口
6  OptionalDrawer    玩家主動開啟的 Memory Wall／設定
```

所有純裝飾層一律 `pointer-events: none`；可互動的字詞、聲音 Cue 與選項必須擁有實際 pointer/keyboard hit target、正確 z-index。不得用全屏隱形遮罩攔截點擊。

## 2. 場景是多軌的，不是一頁文章

| 軌道 | 來源 | 玩家通常看到的東西 | 互動 |
| --- | --- | --- | --- |
| `main` | 當輪正在發生的主線 Action / 對話 | 2–4 句或更少的 beat、間隔、短時 Echo | 讀、選擇、點句內字詞 |
| `ambient` | NPC、環境、遠處聲響、機械訊號 | 1–2 個短 Cue（如「沙沙——」） | Focus → Attend → Observe |
| `inline` | 主線內的特定詞／片語 | 與正常文字一致，無永久下劃線或「＋」 | 同樣走 Attention，不直接給真相 |
| `object` | 信件、手機、票、照片 | 某個物件從黑暗裡短暫浮出 | Examine、收回、可能產生可觀察文字 |
| `hud` | Player 可合法得知的時空資訊 | LOOP / 地點 / 時間（可很淡） | 工具開啟，無 Editor 權限 |

畫面邊緣是**聲音或遠近的感受**，不是雷達，不能用精準座標與亮度自動透露重要事件或人物的真正位置。

### 2.1 主線演出規則

- 以短 `NarrationBeat` 推進，按語意段落與劇情事件時間顯示；**不能在畫面上一口氣攤開整封信**。
- 逐字／逐句只是一種**呈現進度**，不是 World Time 的時鐘。NPC 說完一句話的世界時間由事件排程決定，不因調整字速縮短。
- 長文字可以點擊或按 Enter 使**已在世界中發生的當前內容立即完整可讀**；不可藉此讓尚未發生的台詞或事件提前到來。
- 主線在 `choice` 時呈現自然語意選項；其他軌道仍會存在與到期。普通對話不必每句都顯示選項，只有具有因果或關係意義的時刻才進入選擇。
- 主線延續不應依賴一個永遠常駐的「繼續」按鈕。可由節奏自然推進、明確的場景句尾 affordance 或可存取鍵盤操作推進已產生的 beat。
- 可保留最近 1–2 個已發生 beat 的極淡 `Text Echo`，短時淡出，不是讓角色對話永久留下的 transcript。

### 2.2 旁邊的聲音

例如左後方出現 `沙沙、沙沙……`：

1. Cue 依當輪時間／NPC 位置出現，優先依 authored `anchor` 分布於邊緣；不是每次 render 隨機變換。
2. 不點時只是淡淡浮現，過期自行消失；可依已感知的程度留下模糊 Residual，不保證玩家知道來源。
3. Hover / keyboard focus / 觸控預覽只讓它成為唯一注意點並使其他內容淡化；不立刻授予完整資訊。
4. Click / Enter / Tap 才是 `Attend`：支付既有 Attention Shift 時間、開始 Observation。
5. Observation 完成且仍可感知，才展開例如「像是紙張摩擦的聲音。不是你手上的信。聲音從座位後方傳來。」
6. 短暫觀察自然返回原 Main Action / Focus，除非玩家進一步選擇 `True Interrupt`（真的轉身離席、追出去、開始另一個主要 Action）。

**重點：**即使旁邊有三件事情同時發生，玩家同一時刻仍只會在其中一件上真正建立 Perception。未選的聲音／人／物不等待觀察結束。

## 3. 新增核心：主線字詞 Inline Discovery

### 3.1 玩家體驗

內文例子（此段是**互動示範稿**，不是新 Story Canon）：

```text
像是紙張摩擦的聲音。
不是你手上的信。

聲音從座位後方傳來。
```

其中 `紙張` 不是一般超連結或底線標籤；玩家可能因為好奇**滑過、聚焦、點一下**。字詞可反映很弱的亮度／細微游標變化，不能把所有關鍵字變成彩色「線索」。

```text
main text: 「像是 [紙張] 摩擦的聲音。」
                         │
                         └─ Hover / Focus：只有這個詞稍明，其餘漸暗
                                 │
                                 └─ Click / Attend（World Time 繼續）
                                         │
                                         ├─ 聽出紙質不對 → 小彩蛋
                                         ├─ 注意到信上折痕 → 可感知觀察
                                         ├─ 當輪特定先決條件成立 → 暫時的追問機會
                                         └─ 時機已過 → 無法得到清晰資訊
```

這個 `紙張` 在當輪可以只是彩蛋；另一個篇章的同一介面可以藏著關鍵 Observation。玩家不能從 UI 外觀知道哪一個重要。

### 3.2 Inline Target 不是自動取得線索

- `Hover / Focus` ≠ `Attend` ≠ `Observed` ≠ `Captured Memory` ≠ `Deduction`。
- 點擊**不自動增加 Evidence Card、不自動 Pin、不自動提交 Hypothesis、不改寫玩家記憶**。
- 只有真正完成 Observation 的片段進入 `Perceived Moment`；是否 Capture 由玩家主動決定。
- 有些 Target 是純風味細節，完成後沒有任何 Card 或系統獎勵，這是刻意的。
- 有些 Target 只解鎖後續「問一個問題」或「回頭看」的選擇，還不能直接改變 World State。
- 只有作者明確指定且玩家主動選擇的 Main Action 才能造成實質 Worldline 變動，避免點單字直接改變人物命運。
- 不能把同一個句子全做成隱形 hitbox；只有有限、敘事有理由的詞組有可操作範圍。普通字詞維持正常閱讀／文本選取。

### 3.3 出現／過期條件

- Inline Target 依 `beatId + spanId` 保持穩定身份，並繼承原句的世界時序與 Perception Boundary。
- 只有**字詞完整呈現**後才可點，不能點尚未打出來的字。Reveal 只是 UI gate，不會延長世界機會。
- 句子 Text Echo 期間若作者設定可觀察窗口仍有效，可以操作；**過了窗口就不能為了點擊把劇情倒回來**。
- 若玩家按下後 Attention Shift 還沒完成，事件已離開／物件被帶走，當次 Observe 可能只得到微弱 Residual，不能給完整答案。
- 若 Redirect 到另一個 Inline Target，前一個 Observation 被中止；原 Main Action 並沒有因此 True Interrupt。
- 同一個 Target 在同一輪的重覆點擊不會重播失去的時間或加倍產生 Memory。

### 3.4 Accessibility 不是洩漏真相

- 主線內可互動的詞要用真正可聚焦的 button/span-with-button semantics，具有 Enter/Space 等價操作，不可只有 hover 事件。
- 螢幕閱讀器提供**中性**標籤，如「聚焦：紙張」，不能說「重要線索：紙張」。
- 鍵盤使用者可透過 Tab 或中性「可觀察項目」導航尋找詞句；導航不提供真正意義或隱藏結局條件。
- 觸控要有足夠觸控範圍（建議至少 44×44 CSS px 的有效目標），不能要求精準點中文字的幾個像素。
- 可讀性與可及性優於完全無提示的極端藏物；降低動態效果、對比或字幕設定只影響呈現，不能改變線索機率與世界時間。

## 3.5 記憶流程精簡（2026-10-16 確認）

- **移除「留下你認為重要的句子」與句尾「＋」摘錄列表。** 它和 Attention → Memory Capture 重複，會讓主線變成「每句都點」的網頁操作。
- 統一玩家路徑：正常閱讀／點擊主線字詞／點周邊聲音 → **完成感知** → 可選擇是否 Capture → 需要推理時才打開記憶庫與推理牆。
- **不要自動幫玩家判斷重要性。** 能點的文字可能只是彩蛋；完成觀察也不自動保存。只有玩家真正 Capture 的片段才能跨輪保留。
- 當輪回想已感知的內容仍應可行；推理牆是整理工具，不應要求玩家在每個句子上作一次多餘的「重要性」選擇。
- **舊存檔相容：**保留 `knowledge.pins`、其 `connections`、`positions` 與舊 `pinExcerpt` 相容函式；舊摘錄仍可在推理牆查看、連線與移除。但新 UI 不再新增 pins，新調查以 Captured Memory → `wallRefs` 為準。
- 將來資料遷移只能在不遺失舊註記與玩家連線的前提下進行，不把舊 `pins` 當作新的跨輪 Memory Capture。

## 4. Single Focus、Main Action 與時間

本 Spec **不新造第二套 Focus**。全部互動由現有 `attention.ts` 與 `knowledge.ts` 驗證。

```text
Normal:
  Main Action = read sister's letter
  Focus = current narration

World (simultaneously):
  ambient paper rustle
  train announcement
  seat vibration
  letter inline target "紙張"

Hover one target:
  Focus = that target's preview
  all other channels visually faded (NOT stopped)

Click / Attend:
  Shift (currently ~650ms) → Observation (~900ms default)
  original Main Action still running, if physically plausible
  if completed and target still observable → Perceived Moment
  default Elastic Return → Main Action / original Focus

Explicit "turn around and follow":
  request True Interrupt → validate action state + time
  Main Action changes only after valid transaction
```

- Hover 最多讓**一個**目標變亮；不會疊加多個 focus 卡片。
- `Faded ≠ Paused`：即使主線或其他 Cue 被淡化，排程仍繼續，沒有被 Focus 的對話不會自動補發全文。
- `World Never Waits`：閱讀、打字、Focus、物件展開、選擇、記憶整理與離線都不暫停世界。
- 可等待的 Action 仍有世界時長；觀察只佔 Attention，不算免費同時執行第二個 Main Action。
- 事件若在一個 Focus 尚未完成時到期，過去那段不會因 UI 展開而重生。
- 兼容 `LIVE_SYNC` 與 `ACCELERATED`：這是呈現層，不在兩種時鐘下採不同推理規則。

### 4.1 選擇語意分類

| UI 動作 | Runtime 語意 | 時間／副作用 |
| --- | --- | --- |
| 聚焦主線詞「紙張」 | Notice → Attend → Observe | Attention shift / observation；無自動 Memory |
| 聚焦角落「沙沙——」 | Notice → Attend → Observe | 同一套 Attention；來源可到期 |
| 「繼續讀／回主線」 | Release / Present next **already authored** beat | 不強制改變 World Time，不倒轉 NPC 行程 |
| 「抬頭／回頭看」 | 可短暫 Observe 或明確 True Interrupt，依作者行為語意 | 若 True Interrupt 必須處理 Main Action 中斷與位置 |
| 「把句子記下來」 | Player-selected Capture | 只有已 Perceive 內容，且 Capture 需要自己的時間 |
| 「陪若晴留在家裡」 | Choice → validated Main Action | 改變事件因果；不可假按鈕 |

## 5. 動效、音訊與物件

### 5.1 動效使用表

| 效果 | 觸發 | 建議預設 | 禁止 |
| --- | --- | --- | --- |
| Text fade / drift | 環境聲、Text Echo、事件消退 | 0.3–1.5 秒淡入淡出，位移很小 | 永續亂飄、閱讀區位移造成找不到字 |
| Type reveal | 主線已發生的語意 beat | 節奏由段落、停頓、標點控制 | 調整字速改變事件時序 |
| Focus dim | Hover/keyboard Focus/Attend | 其他內容淡到仍能察覺變化 | 把其他世界事件暫停或直接刪掉 |
| Screen shake | 列車一晃、撞擊、異常 | 小幅 2–5px，約 150–300ms | 長時間高頻震動、讓 hitbox 跑掉 |
| Object emerge | 信封、手機、票根、照片 | 短時由黑暗浮現／收回 | 固定大卡片遮住整個遊戲 |
| Audio cue | 腳步、紙聲、震動 | 可選音訊 + 必須有字幕／文字 Cue | 音效作為唯一取得關鍵線索的途徑 |
| Cursor | 內容停頓或等待下個可讀 beat | 微弱閃爍 | 假裝輸入框／讓玩家以為要打命令 |

- 物件是 **Scene Prop**，不是 Card List。信封可以短時間遮到少量文字，不能遮住當輪仍在出現的全部 Peripheral Cues。
- `prefers-reduced-motion` 關閉 shake / drift / 打字動畫後，仍要呈現相同完整內容與可點詞句，保持相同 World Event / Action timing。
- 音量、字幕、亮度與輸入方式是玩家設定；不能被故事角色理解成 Worldline 操作。
- 不在 v0.1 引入完整 Three.js 場景、角色立繪、粒子物理場或大型音效資產；先把純文字體驗做對。

## 6. 可實作的 Story Script Schema（**proposal；尚未在 Runtime 生效**）

目標是把文案、定位、可點 span、作者事件與 UI 呈現解耦。下面的資料是**演出示例**，紙聲來源與後排人物都不是已定案的故事事實。

```yaml
schema: loop-town-immersive-scene-v0.1
scene_id: demo_inbound_train_0612
at: { day: 0, time: "06:12" }
location: inbound_train
main_action: inspect_letter
beats:
  - id: b01
    channel: main
    anchor: center-left
    text: "你是在列車顛簸時醒來的。"
    presentation: { reveal: phrase, echo_ms: 1800 }
  - id: b02
    channel: main
    anchor: center-left
    segments:
      - { text: "像是" }
      - { text: "紙張", target_id: paper_word }
      - { text: "摩擦的聲音。不是你手上的信。" }
    targets:
      paper_word:
        kind: inline_observation
        perceptual_source: letter_or_seat_sound
        available_while: b02_visible
        preview: neutral
        attend_observation_id: obs_paper_word
  - id: a01
    channel: ambient
    anchor: lower-right
    text: "沙沙、沙沙——"
    target_id: rustle_near_seat
    available_from: "06:12"
    available_until: "06:13"
    attend_observation_id: obs_rustle
  - id: a02
    channel: ambient
    anchor: upper-left
    text: "廣播聲……"
    available_from: "06:12"
    available_until: "06:14"
observations:
  obs_paper_word:
    body: ["紙邊似乎還有另一道折痕。"]
    result: perceptual_moment_only
  obs_rustle:
    body: ["聲音不像來自你手上的信。"]
    result: perceptual_moment_only
choices:
  - id: look_back
    label: "回頭看向聲音來源"
    kind: request_true_interrupt
    preconditions: [player_at_seat, available_rustle]
```

**Schema 約束：**

- `segments[]` 不使用脆弱的 `substring-index`／全文字 offset 或事後以 regex 插入 button；標點與中文字重排後仍能穩定找到 target。
- `target_id` 對應唯一、穩定的 Beat Span，並可掛 authored Observation。
- `available_from/until` 由 World Clock 裁決，不能使用 React render time 來延長可互動時限。
- `channel: ambient` 與 `kind: inline_observation` **共享** Runtime `AttentionTarget`，不共享表面 CSS。
- `result` 允許 `flavor_only`、`perceptual_moment_only`、`unlock_followup_choice`；不可有 `auto_capture` 或 `auto_deduction`。
- `preconditions` 和 `choice` 需由 World State／Player Knowledge 驗證，不能由 CSS 表面是否可點決定。
- 事件之間的 provenance / scene reference 必須可以追到 Story authoring event；不可憑 GUI 新增一條「正確真相」。
- Cue 位置採 `anchor` 而不是每次 render 隨機座標；小螢幕可投射到不同位置但順序與事件身份保持不變。

## 7. React / Runtime 建議切分（先修可用，才上劇情）

```text
PlayerApp (single source of truth)
  ├─ PlayerSceneStage / BlackCanvas          (presentation)
  ├─ MinimalHUD                              (presentation)
  ├─ NarrationStage / TypewriterText          (presentation of authored beats)
  │    └─ InlineTextTarget                   (focusable span + Attend request)
  ├─ AmbientTextLayer
  │    └─ AmbientCue                          (focusable peripheral text)
  ├─ FocusSurface                            (single active observation)
  ├─ ChoiceList                              (validated Choice / Action requests)
  ├─ ObjectManifest                          (envelope / phone / ticket)
  └─ Optional Memory Wall Drawer             (existing player-owned Capture)

                         ↓ requests
       player/attention.ts + knowledge.ts + runtime.ts
                         ↓ validated transitions
               Story Simulation / World State
```

現有程式具備 `PlayerSceneStage`、`TypewriterText`、`SpatialTextLayer`、`attention.ts`、`knowledge.ts`、`OpeningScene` 與 `PlayerApp`，因此**優先重用**，不是再做一個 `playerNarrative` Runtime。

已知問題需正面處理：

- `playerSceneStage.css` 現在仍畫出綠色背景／天空／地平線，與黑幕要求衝突。
- `PlayerAmbientLayer` 把多個 event 濃縮成 status，且 ambience 層設成 `pointer-events: none`；新 Cue 要拆出真正可點的元素，而純裝飾仍保持不可點。
- `PlayerApp` 還有 `reading-scene`、`document-top`、`document-lines` 與固定閱讀按鈕；開場信件要改成短 beat + Scene Prop，而非整頁閱讀器。
- 現有 `TypewriterText` 是線性時間打字；後續至少要支援分段 segment target，不可只把完整字串用 regex 轉成 clickable link。
- 世界時間、Memory Capture、Real-time Anchor / Offline Report / Recovery 等邏輯**不因 UI 改版重寫**。

## 8. 「看得到卻按不了」的工程驗收

這是此 PR 下一階段實作的 **P0 blocker**，不接受用「看起來有反應」代替：

1. **語意事件**：每個 clickable target 都有實際 `onAttend` / `onChoose` 命令、固定 id、前置條件與成功／失敗回饋；沒有空 handler。
2. **Hit-testing**：舞台噪點、HUD、純文字 Echo 與過場特效不阻擋 clickable target；Overlay 打開時則遵循真正 modal focus trap。
3. **狀態測試**：同一個 cue 由 Available → Focus → Shifting → Observing → Perceived / Expired → Elastic Return 可重現，且只成功一次。
4. **主線**：選擇被接受後真的造成 Action / Scene / Worldline 的明確狀態變動，不只是按鈕字色變化。
5. **期限**：已過期的目標即使殘留在畫面也不可憑舊 handler 取得完整感知或原本已錯過的 Choice。
6. **可及性**：滑鼠、鍵盤 Tab/Enter/Space、觸控均可觸發同一語意；獨立測試 Reduced Motion。
7. **無雙擊誤觸**：一次 Attend 開始後依有效狀態處理連點，避免產生多個 Focus／重覆 Capture。
8. **Story reload / Reset**：刷新與下一輪保留玩家真正 Capture 的內容，但不讓已過期 Cue 憑 cache 被重播。

## 9. Responsive / Accessibility

- 大螢幕：主線在中央偏左，Ambient 於外緣 4–6 個 authored anchor；**同時活躍最多建議兩個強可見 Cue**，其餘以弱雜訊或不顯示呈現。這是視覺密度建議，不代表世界只有兩件事。
- 手機：主線優先 60–75% 可讀區，Cue 集中於安全可點邊緣，不與系統手勢／畫面底部重疊。不可將每一個 Cue 變成整屏通知。
- 文字可放大、調整對比與暫停純打字效果；世界時間不因此停止。
- UI 避免無限重排、過度文字搖晃、閃爍頻率敏感動畫。
- Screen reader：提供與視覺等價的主線順序及 Focus target，但不把其他未感知的 Hidden Author Truth 放進 live region。
- 所有互動文本在 focus 與滑鼠 hover 都有足夠可辨識的狀態，不能因「追求隱藏」犧牲實際可操作性。

## 10. 初始開場演出驗收（vertical slice）

> 注意：下列 **後排紙聲／折痕只是 UI 測試用示例**。劇情作者確認後才可成為正式 Canon；已定案「林知夏署名、郵戳昨天、警告『不要回來』」不更動。

```text
0s      全黑；極淡 LOOP 01 / 06:12 / 返鄉列車
~1s     主線：你是在列車顛簸時醒來的。
~3s     一下輕微晃動，遠方「喀。」
~5s     主線：膝上的信封，沾了一點潮氣。
~7s     右下浮現「沙沙——」（短時可點）
~9s     主線：像是 [紙張] 摩擦的聲音。不是你手上的信。
        └─ [紙張] 可 Focus / Attend（不顯示成 URL 或「線索」）
~12s    左上浮現「廣播……」並自然消逝
        玩家正在 Focus「紙張」時，廣播照樣可能錯過
稍後    信件 Prop 從暗處浮出：『不要回來。』
        可讀、可收回、可自行 Capture 真正觀察到的內容
```

第一輪只需能證明三種互動彼此不同：

- **普通故事：**主線正常推進，不需不停點「繼續」。
- **可見 Choice：**玩家選擇後有明確狀態回饋；非裝飾按鈕。
- **兩種 Discovery：**邊緣「沙沙——」與句內「紙張」各可 Observe，且**同一時刻只能 Focus 一個**。至少一個結果是非重要彩蛋，證明「能點」不等於「必然關鍵」。

## 11. 驗收矩陣／Done definition

| ID | 測試情境 | 必須成立 |
| --- | --- | --- |
| UI-01 | 進入 `player.html` / 讀信 | 全黑、無綠色大舞台／地平線／大卡片 |
| UI-02 | 主線語意 beat | 有節奏出現、保留可讀性，讀速不改 World Clock |
| UI-03 | 邊緣出現兩個 Cue | 各有內容與 hit target；點任何一個確實 Attend |
| UI-04 | 主線「紙張」Inline Target | 同一句內可互動，沒有永久高亮或自動加卡 |
| UI-05 | Hover / keyboard Focus | 唯一主 Focus，其餘 Faded、世界繼續 |
| UI-06 | 認真觀察並轉換目標 | Attention Shift 消耗時間，Redirect 不算 True Interrupt |
| UI-07 | Cue 到期 / NPC 離開 | 不能補讀錯過的內容，Residual 僅在實際感知後產生 |
| UI-08 | 已完成 Observation | Elastic Return 回原 Main Action，玩家可決定 Capture |
| UI-09 | 一個故事 Choice | Click 產生合法 State／History 改變，按鈕能作用 |
| UI-10 | 列車晃動與物件浮出 | 動效短、不中斷輸入，Reduced Motion 等價 |
| UI-11 | 刷新／離線／Reset | 不篡改世界時間、玩家 Captured Memory、NPC 重置規則 |
| UI-12 | 手機／鍵盤／Reader | 可操作等價，且互動標籤不劇透 Hidden Truth |
| UI-13 | 既有 Simulator / Story | Event Graph、worldline 與 18:31 / 00:00 tests 不回歸 |

**本分支已有黑幕 CSS、可點主線字詞、限時 Ambient、Attention／Capture 交互，以及開場輕微演出。** 上述驗收矩陣仍需逐項通過並由瀏覽器實測後，才可稱完整 UI 修復；不要把 CI Green 說成正式 GitHub Pages 已更新。

## 12. 明確不做（留給後續）

- 不在本次 UI PR 改寫全部主線、五年前知夏真相或 Ending C 機制。
- 不新增一套平行 `playerNarrative` Clock/Save／Attention 資料來源。
- 不新增「關鍵詞都發亮／點一下就通關」的玩家輔助系統。
- 不要求先有美術立繪、完整 Three.js、音效庫或語音辨識，才開始修 UI。
- 不把僅供 UI demo 的紙聲、神秘人物或幕後設備細節自動升格成正式 Story Canon。

## 13. 相關資料

- `docs/core-gameplay-spec-v0.1.md`：World Never Waits、Single Main Action/Focus、Elastic Attention、Perception Boundary、Capture。
- `docs/story-canon-time.md`、`docs/story-canon-return-and-reactivation.md`：06:12、信件與返鄉。
- `docs/superpowers/specs/2026-09-28-player-immersive-ui-design.md`：歷史 immersive UI 方向，可取材但不能覆蓋 Canon。
- `docs/player-final-playable-spec.md`：既有 P0–P4 可玩機制，不隨黑幕重設。
- `tools/event-graph-viewer/src/player/{PlayerApp.tsx,attention.ts,knowledge.ts}`。
- `tools/event-graph-viewer/src/player/ui/{PlayerSceneStage.tsx,PlayerAmbientLayer.tsx,TypewriterText.tsx}`。

## 14. 100dvh Game Viewport / 遊戲套件選擇（v0.2 附錄）

> **Decision：保留 React DOM 敘事層，優先採用 Motion for React；需要真實 Sprite/Camera 時再掛 Phaser 4 Canvas。** 保留 `PlayerApp` / `Worldline` / `Attention` / `Save` 的既有資料與語意，不將它們移進 Phaser 的時間系統。本節是接下來的實作規格，不代表套件已安裝或 UI 已完成。

### 14.1 技術責任邊界

```text
Existing Story YAML / Event Graph / World Clock / NPC Schedules
               ↓ (authoritative; no duplicate time engine)
       Player Runtime / Attention / Memory
               ↓
       PlayerPresentationModel (pure)
               ↓
┌──────────────── GameViewport 100dvh ─────────────────┐
│  Phaser 4 Stage, optional lazy-mounted                │
│     black canvas / tiny shake / props / sprites      │
│  (decorative, no narration click handler by default) │
│                                                       │
│  React DOM + Motion                                   │
│     NarrationBeat + InlineTextTarget                  │
│     AmbientCue + FocusSurface                         │
│     IncomingMessageCarousel / ChoiceList             │
│     HUD + accessibility / keyboard / touch           │
└───────────────────────────────────────────────────────┘
               ↘ Player Actions → Runtime validation
```

**採用順序**
- **Motion for React**（`motion` → `motion/react`）：取代散落的 fade、list enter/exit、訊息換頁、物件從黑幕浮出等自製 keyframes／timers。相容現有 React 18（需 18.2+），不用為此升 React 19。以 `AnimatePresence` 與變體動畫呈現已被 Runtime 決定的狀態；效果完成不能當作 World Time 前進條件。
- **Embla Carousel v8**（`embla-carousel-react`）：使用其既有 React 元件/滑動引擎實作「1/N 則新消息」的觸控/左右切頁，不另造 swipe 手勢、carousel physics、索引同步。`loop: false`，不得自動輪播導致沒讀到的內容離開。
- **Radix UI Dialog**（後續按需）：玩家主動展開案卷、存檔或推理牆時，可使用成熟的 focus trap／Escape／focus restore；避免手刻 Modal keyboard/focus 行為。不要把每個短 Cue 變成 modal。
- **Phaser 4**（後續按需載入）：有確實的 2D 場景、鏡頭 shake/fade、遮光、Sprite 等需求再放入 Canvas，優先使用官方 Scale Manager 的 `FIT`／`RESIZE` 和 Camera Effects。**不要用 Phaser 重做中文字排版、原生可點字詞、存檔、NPC clock 或推理牆。** 現有 React 18 無須直接套用以 React 19 為基礎的整套 Phaser 範本；建立小型 Phaser/React adapter 即可。
- **Howler.js**（可選）：真正需要播放雨聲、紙聲、環境音時再加入，並保留等價文字 Cue。Muted / Reduce Motion / autoplay 授權要處理。
- **PixiJS + @pixi/react**：本階段**不採用**；與 Phaser 功能重疊，且目前 `@pixi/react` v8 要求 React 19，不應為了背景渲染先做主框架升級。
- **inkjs / XState**：這輪**不採用**；既有 Event Graph、Worldline/Attention 已是權威狀態，另加故事／狀態引擎會製造雙資料來源。

### 14.2 固定遊戲視窗不是把文字截掉

- `html` / `body` / `#root` / `PlayerShell` 作為全視窗 App shell。舞台以 `height: 100dvh`（備援 `100vh`）及 safe-area inset 維持單屏；`overflow: hidden` 僅對**一般遊戲舞台**，避免整頁捲軸。
- HUD、當前主要 Narration/選擇與 Ambient 的佈局採固定 spatial slots；每個 slot 有最大高度／行數，事件不可讓舞台隨數量往下長。
- **敘事內容絕不能被無聲截斷。** 長台詞按作者 `NarrationBeat` 或頁面段落分段；玩家可以向前／向後查看自己已感知的段落，但不可倒轉 Event Clock 或追回已錯失的 NPC 情報。
- 工具／存檔／推理牆是玩家**主動打開的 Overlay / full-screen subscene**，如內容特別長，可以在工具內局部捲動／Pan；「玩家在遊戲場景中不滾輪」不等於禁止閱讀輔助或拖曳證據板。
- 行動裝置需注意瀏覽器動態工具列，測試 `390×844`、`360×640`、桌機 `1366×768` 和 `1920×1080`，文字放大仍必須完整讀到。
- Phaser Canvas 應在文字 DOM 底下並 `pointer-events: none`，除非某特定 Scene Prop 明確交由 Phaser 接收輸入。不能再出現全屏 hitbox 遮住文字。

### 14.3 「鎮上有新消息」：主事件 + 有限次事件，不再是網頁長列表

目前 `PlayerApp.tsx` 把所有 `incoming` 直接以一連串 `button` 塞到 `.incoming-records`，造成畫面越來越長。**新模型**：

```text
┌──────────────────────────────────────────────┐
│ LOOP 01                            16:10     │
│                                              │
│                                              │
│     你聽見手機震了一下。                     │
│                                              │
│     若晴還活著                                │
│     「這次我沒有去舊站……」                   │
│                                              │
│     讀這段訊息                                │
│                                              │
│                              01 / 05         │
│                  ◂ 上一則    下一則 ▸        │
│                                              │
│     ……腳步聲                                 │
└──────────────────────────────────────────────┘
```

- 以獨立 `IncomingMessageStage` 呈現**當前一則**訊息，最多顯示 2–3 個低對比的同類入口（大螢幕）；手機只呈現 1 則與 `1 / N`。
- `Embla Carousel` 負責真正的橫向捲動、滑動手勢和 `1/N` 索引同步；`Motion AnimatePresence` 只負責訊息本文/文字淡入淡出與切換提示，不與 Embla 重複控制 slide transforms。不要顯示十條長分隔線。一次只有一個主要訊息閱讀操作，並有明確「閱讀／略過」。
- 按 `←/→`、`A/D` 或手指滑動切換訊息候選（避免干擾正在操作的文字或推理牆）；Enter / Tap 執行 `openRecord(id)`。鍵盤 Tab/Screen Reader 仍可找到所有合法命令。
- `IncomingMessageStage` 是**玩家視圖投影**。資料來自現有 `incoming` 與 `records`，切換只改目前顯示哪則；按「閱讀」後仍走已驗證的 `openRecord`，不可因換頁偷偷 Mark Seen。
- 過量訊息可以分群或 `1/N` 換頁，但不能刪除本來合法可存取的訊息。對有真正世界期限的 Cue 而言，切頁或展開不能延長感知期限。
- 黑幕旁的 Ambient Cue 繼續獨立存在；**消息不是 ambient cue**，不能混成玩家只看了一眼就取得完整 Perception。
- Hover 在 `IncomingMessageStage` 中只是 UI 選取／預覽，不應與 Attention 的真實 Observe 混為一談。要觀察世界聲音必須進入現有 `attendPresenceRecord`。

### 14.4 Transition / Behavior 契約

| 場景 | 用何套件 | 必須保障 |
| --- | --- | --- |
| 新消息到來 / 換頁 | Motion `AnimatePresence` | 進退場不丟失未讀訊息；focus management |
| 訊息預覽高亮 | Motion `motion.button` | 不能無聲觸發 Player Attention/World Clock |
| 開場逐句／信件浮現 | Motion + existing Text DOM | 字詞本身仍能 Tab/Click |
| 純黑背景震動／鏡頭 | 可選 Phaser Camera | Reduced Motion；不阻擋輸入 |
| 文本「沙沙——」 | React DOM / Motion | 真正點擊後呼叫 Attend |
| 真實音效 | 可選 Howler | 預設不強制播放、無音效不漏線索 |

### 14.5 Done Definition（後續實作）

- 普通主舞台在桌機與手機皆無 document vertical scroll、也不會因 20 則未讀增高。
- 讀取 1/20 到 20/20 都在同一個 viewport；不重排其他世界事件、不掉字、不偷讀。
- 手機、鍵盤與滑鼠均能切換／閱讀，無 hover-only 操作。
- Motion `prefers-reduced-motion` 時立即完整顯示相同內容；不改 Attention / World Clock。
- 不新增重複的 Gameplay Clock / Event Graph / Save，並完整通過既有 player、first loop 與 final gameplay CI。
- 畫面與實際操作必須經瀏覽器檢查，僅改 spec 或 CI Green 不等於修好。

### 14.6 官方資料
- Motion：`https://motion.dev/docs/react`
- Phaser Scale Manager：`https://docs.phaser.io/phaser/concepts/scale-manager`
- Phaser Camera：`https://docs.phaser.io/api-documentation/class/cameras-scene2d-camera`
- Phaser React TS Template：`https://github.com/phaserjs/template-react-ts`
- Howler：`https://howlerjs.com/`
- Embla v8：`https://www.embla-carousel.com/docs/v8/get-started/react`
- Radix Dialog：`https://www.radix-ui.com/primitives/docs/components/dialog`

### 14.7 已落地與待補限制（P6 partial implementation）

PR #25 已導入 **Motion + Embla**、固定 Player 外層 `100dvh`，以及單一訊息為主的 `IncomingMessageStage`（不限數量的訊息以 1/N 切換，含鍵盤及 Touch）。
**文件文字較長時仍有局部捲動 fallback**，以避免在尚未實作 `NarrationBeatPager` 前遺失文案。這是階段性差距，不能宣稱完全「沒有任何捲動」。真正免捲動的長篇分段閱讀、Phaser/Howler 與桌機/手機實機驗收，留到後續版本。
