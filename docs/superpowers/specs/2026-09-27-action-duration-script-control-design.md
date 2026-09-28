# Action Duration 與完整玩家腳本控制設計

日期：2026-09-27  
狀態：待 review

## 背景

目前事件模擬器可以載入玩家 action，但 canonical action 資料只有會直接改變 18:31 結果的兩個介入。玩家的日常行動，例如「泡咖啡」，即使沒有立即效果，也應該是世界線中的實際行動，具有開始時間、消耗時間與可追蹤的 history。

這次變更的目標是讓劇本控制回到 story YAML 與 deterministic simulator：任何 action 是否存在、何時開始、花多久、改變什麼，都由資料定義；UI 只負責呈現與選擇，不為特定 action 寫分支。

## 目標與非目標

### 目標

- 支援 `effects: []` 的無效果玩家 action。
- 支援 action 的持續時間，並使持續時間影響下一個可執行的玩家 action。
- action 進行期間，排定事件仍照正常時間執行。
- 在 Worldline History、Timeline 與 Worldline Diff 中保留玩家 action 的開始／結束時間。
- UI 顯示 story YAML 中所有 action，不再過濾成只有關鍵分歧選項。
- 讓既有沒有 `duration_minutes` 的 action 維持原本行為。

### 非目標

- 本次不建立自由輸入 YAML 的瀏覽器內編輯器。
- 本次不改變事件 variant 的 priority、condition 或 delayed effect 規則。
- 本次不引入完整 NPC schedule scheduler；保留現有 event queue 邊界。

## 資料模型

`ActionDefinition` 新增可選欄位：

```yaml
- id: make_coffee
  at: "18:20"
  duration_minutes: 5
  label: 泡咖啡
  effects: []
```

- `at` 是 action 開始時間，維持既有 `HH:MM` 格式。
- `duration_minutes` 是非負整數，缺省值為 `0`。
- `effects` 可以是空陣列；空陣列不代表 action 不存在，只代表它沒有直接 state mutation。
- `id` 必須唯一；action 的資料來源仍是 `story/actions/*.yaml`。

`WorldlineHistoryEntry` 新增：

```ts
durationMinutes?: number;
endTime?: string;
```

只有 `kind: 'player-action'` 需要填入這兩個欄位；其他 history entry 維持現有結構。

## 模擬語意

### 執行流程

`applyAction(action)` 的語意固定為：

1. 解析 `action.at` 為開始分鐘。
2. 若開始時間早於目前 simulation cursor，拒絕 action。
3. 在 action 開始前，先執行所有嚴格早於 `action.at` 的排定事件；同一分鐘的 event 保留在 queue，讓同一分鐘的玩家 action 先全部套用。
4. 在開始時間立即套用 action effects。
5. 寫入一筆 player-action history，記錄開始時間、duration 與 `endTime`。
6. 將 simulation cursor 推進到 `start + duration_minutes`；action 佔用的區間是 `[start, end)`，期間嚴格早於 `end` 的 queue 事件照常執行，剛好在 `end` 的事件留給下一個同分鐘 action 之後處理。

因此 `make_coffee` 在 18:20、持續 5 分鐘後，下一個可執行的 action 最早是 18:25；若 18:22 有事件，該事件會在泡咖啡期間發生並進入 history；若 18:25 有事件，則會等 18:25 的玩家 action 都套用後才執行。

### 行動排序與衝突

- `simulate()` 會依呼叫端提供的 action 順序執行，不偷偷重排玩家意圖；每個 action 開始前會先消化嚴格早於它的 queue 事件。
- UI 產生的 action sequence 會依 `at` 與原始資料順序排序，確保 deterministic；同一分鐘的 action 依 story YAML 順序執行。
- 若同一世界線中下一個 action 的開始時間早於 cursor，simulation 拋出明確錯誤，錯誤訊息包含 action id、要求時間與目前時間。
- duration 為 `0` 的 action 可共享同一開始分鐘，因此目前「同一時間阻止若晴與阻止醫生」的既有情境仍可運作；同分鐘 event 會在這些 action 之後處理。

### 世界時間

action duration 只代表玩家 action 佔用的時間；世界不會暫停。事件 queue 在 action 的 `[start, end)` 區間內持續被消化。所有 action 的結束時間必須落在同一個模擬日的 `23:59` 以前；跨日行動需另建 multi-day time model。若未來需要更精細地表達「action 完成時才套用效果」，應新增另一種明確的 effect timing，而不是改寫本規則。

## UI 設計

### 玩家 action 編輯區

世界線 A/B 會列出 action YAML 中所有 action。每張 action card 顯示：

- 開始時間，例如 `18:20`。
- 持續時間，例如 `花費 5 分鐘`；duration 為 0 時顯示 `立即`。
- label。
- effects 的人類可讀摘要；空 effects 顯示 `沒有立即世界狀態變化`。
- 若選取後造成後續時間衝突，顯示衝突訊息。

UI 不根據 `action.id` 判斷它是否「有用」。新增 YAML action 後，無需修改 React 元件即可出現在兩條世界線的編輯區。

### Timeline

玩家 action 顯示為帶有區間的 history item：

```text
18:20–18:25  泡咖啡
18:31        車站事件 → 若晴死亡
21:14        延遲後果 → 記者失蹤
```

同一分鐘可以有多筆 action；Timeline 必須以有序清單保留同一世界線同一時間的所有 entry，不得以單一 `time` key 覆蓋。無效果 action 仍顯示，但使用較低視覺權重，避免壓過事件結果。跨世界線比較時，action 的時間區間與事件結果都保留。

### Event Graph

因果檢視會把玩家 action 當成時間流中的節點；無效果 action 仍可被看見，但與後續事件之間使用「時間流逝」語意，不畫成造成 state mutation 的因果箭頭。action duration 若跨越事件，分支中以時間區間表示。

## 錯誤處理與驗證

### 資料驗證

- `duration_minutes` 必須是非負整數。
- `at + duration_minutes` 必須不晚於同一模擬日的 `23:59`。
- `at` 必須符合既有 `HH:MM` 格式。
- `effects` 必須存在且為陣列；空陣列合法。
- 維持既有 action id 唯一性與 effect path 驗證。

### 測試案例

需新增或修改以下測試：

1. 沒有 `duration_minutes` 的舊 action 仍在原開始時間執行。
2. `effects: []` action 產生 player-action history。
3. duration 會產生正確 `endTime` 並推進 cursor。
4. duration 期間到期的事件仍會執行；剛好在 end time 的事件晚於同分鐘 action。
5. 跨過前一個 event 後仍可執行合法的後續 action。
6. 下一個 action 早於 cursor 時被拒絕。
7. 同一分鐘的零 duration action 仍可連續執行。
8. 負數、分數、非數字 duration 與缺失／非陣列 effects 會被拒絕。
9. Timeline 顯示 action 區間與無效果 action，並保留同時間多筆 entry。
10. Worldline Diff 收到並顯示 player actions，不只顯示 event resolution。
11. UI 會顯示 YAML 中新增的 action，而不需新增 component 分支。
12. 相同輸入 action sequence 重複 simulation 仍產生完全相同 history。

## 實作邊界

第一階段會修改：

- `story/actions/day_01_actions.yaml`：加入至少一個 `make_coffee` 代表 action。
- simulator types、validation、simulation cursor/history。
- projection 與 Timeline / Worldline Diff / ScenarioSimulator 顯示。
- simulator、scenario、App 與 projection 測試。

事件定義、世界初始狀態與事件 queue 的公開 API 維持向後相容；沒有 duration 的既有 story 不需遷移。
