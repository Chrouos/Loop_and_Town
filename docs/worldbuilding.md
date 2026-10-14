# 世界觀與核心設定｜快速導覽

> Status：Active Summary；本頁只供快速理解，不獨立覆蓋 `core-gameplay-spec-v0.1.md` 和 `story-canon-*.md`。
> 特別是 Rewrite / Pivot / Anchor 以 `story-canon-rewrite-anchor.md` 為準。

## 故事起點

五年前，林知夏死在灰潮鎮舊車站周邊，案件以意外結案。

五年後，灰潮鎮進行地方更新。主角因林家老屋的產權、整理與出售，**早已安排好返鄉行程**；出發前才收到一封實體警告信：

```text
寄件人署名：林知夏
郵戳：昨天
核心內容：不要回來
```

信不是召喚，信如何在知夏過世五年後寄達仍 TBD；信在 Hard Reset 後存在，只因 `06:12` checkpoint 本就包含它，不會隨輪迴自動增加文字。

同一波地方更新也重新使用舊研究系統，使五年前被隔離的 Reality Write-back 路徑再次具有危險的連線條件。**返鄉本身不是啟動 Loop 的超自然開關。**

## 小鎮

名稱：**灰潮鎮**。下圖是概念方位，不是已確認的可走地圖。

```text
                舊研究所
                    │
山區 ── 水庫 ── 舊車站
                    │
學校 ── 商店街 ── 醫院
 │          │        │
住宅區 ── 鐘樓 ── 警察局
                    │
                   河岸
```

這裡不是詛咒小鎮；地方衰退、就業、公共安全、保存過去與是否離開，各自構成人物可以理解的選擇。

## 時間與記憶

```text
10/3 06:12  Last Clean Causal State（未封存時的 Retry 路線）
→ 當日 Prediction / Intervention / Correction
→ 18:31  Causal Convergence（不是固定死亡）
→ 23:59  鐘聲 / Recovery 最後階段
→ 00:00  Hard Reset（未解決 Correction）
→ 10/3 06:12  Recovery Retry
```

- 世界不因玩家離線、閱讀、對話或觀察而等待。
- 主角自然記得跨 Loop 主觀經歷；Player 可檢索的持久記錄仍須自行 Perceive 並選擇 Capture。
- 一般 NPC 不會跨 Loop 保留完整記憶、累積關係或人格污染。
- 極少數 Rewrite-sensitive people 可能有弱 `Rewrite Echo`（夢、Déjà vu），**不等於跨輪完整記憶**。
- Author Worldline History 是後台完整因果；玩家不會自動得到真相、卡片或完整 Worldline Diff。

## 系統與 Anchor

研究原本是跨多個 Pilot Site 的 **Urban / Disaster Digital Twin**，用於災害預測、模擬和決策建議，不是時間旅行。

```text
Real-world Data → Prediction → Simulation → Intervention
                                              ↓
                                    Reality Write-back（越界）
```

其他 Pilot Site 的 Reality Correction 在灰潮鎮事故前就可能已成功，只是連歷史資料、人的記憶都被 Rewrite，因此研究團隊把成功當作模型 False Positive。

正常 Correction 會輪替 Causal Pivot；**Pivot 重複命中 + Repeat Prevention 失效**，才可能形成 `Fixed Anchor / Persistent Reference`：

- 五年前知夏成為 Fixed Anchor，得以追查被 Rewrite 的 Reality。
- 五年後主角因同類 Bug 成為 Fixed Anchor，並非血緣繼承，也不是系統把她認成知夏。
- `Anchor death ≠ Loop stop`；18:31 Feedback Mismatch、未結案 Session、00:00 Retry 與 Ending C 的雙路隔離＋Forward Seal 已有高層機制（`story-canon-mechanism.md`）；實體設備、數值閾值、信件來源與 Runtime 仍 TBD。

## 核心人物

- **主角**：返鄉處理老屋，逐漸成為新 Fixed Anchor。
- **林知夏**：已故姊姊；地方史／圖書館資料協力者、舊 Fixed Anchor。原以為存在所有人都能活下來的 Worldline。
- **許若晴**：咖啡店員、攝影愛好者；第一輪 18:31 死於舊車站周邊，但她本來就有自己的行程。
- **陳柏勳**：醫師，保留醫療異常紀錄；第一輪可疑人物，不是已認定兇手。
- **周志遠**：刑警，五年前有未正式登錄的異常證物。
- **葉庭安**：對外進行地方調查，曾參與舊研究計畫，掌握研究與資料公開的缺口。
- **周予安**：鐘錶店主與主角舊識，有自己留下／離開的人生問題；**多輪後不會逐漸記起上一輪**。

詳細人物設定見 `character-bible.md`、`relationship-map.md`。

## 主線認知轉折

```text
誰殺了若晴？
→ 換行程，為什麼會走向不同 Failure Path？
→ 沒有已知死者，為什麼仍然 Reset？
→ 五年前的知夏為什麼記得被覆寫的世界？
→ Reality Rewrite 為什麼早已成功卻沒人發現？
→ 如何不再替別人追求「最完美」的人生？
→ 如何真正停止 autonomous Reality Write-back？
```

「前六封／第七封」仍是 Mystery 與可能的象徵結構，並非已證實的跨線傳輸技術。

## 進一步閱讀

- `main-story.md`：章節主線
- `story-canon-background.md`：地方與研究背景
- `story-canon-return-and-reactivation.md`：返鄉與系統重新連線
- `story-canon-rewrite-anchor.md`：**Rewrite / Pivot / Anchor 最高優先的故事機制**
- `story-canon-time.md`：時間與 Hard Reset
- `story-canon-memory.md`：記憶與 Perception
- `core-gameplay-spec-v0.1.md`：Player Gameplay 規則
