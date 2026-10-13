# Story Canon｜18:31 Cascade、00:00 Recovery 與 Ending C（v0.1）

> **Status：Active Mechanism Canon（敘事／系統高層因果已定案；Runtime 尚未實作）**
>
> Ending A、C 的 `00:01` 為設計驗收目標，不代表既有故事模擬器已能執行該狀態。
>
> 本文件承接 `story-canon-rewrite-anchor.md` 的 Reality Rewrite、Causal Pivot、Fixed Anchor，不重新解釋血緣、記憶或物理本質。
>
> 此處的 Sync Epoch、Lease、Bridge、Forward Seal 是**小說世界內系統的概念介面**，不是宣稱現實電腦技術能改寫真實世界。設備型號、Reality State Coupling 的物理原理、底層演算法仍為 TBD。
>
> 若其他 active story document 將 18:31 的高層失敗因果、00:00 為何 Retry、Ending C 為何停止 Retry **整體**寫成 TBD，以本文件為準；細部硬體與執行方式不得被作者自行補成已知。

## 1. 一句話的核心答案

**18:31 不是系統要求有人死，而是舊災害同步網路重新收束因果時，Simulation 的目標狀態被當成可以直接寫回 Reality；若這個 Correction Session 到午夜仍未正確結束，Recovery Controller 會將世界退回 06:12 再試一次。Ending C 不是找出更好的結果，而是撤銷所有自動 Write-back 通道的權限、驗證真的失去作用，最後將「當前現實」封存為唯一能繼續前進的狀態。**

```text
10/3 06:12  Last Clean Causal State (bounded operational graph)
  ↓
Prediction / Simulation（本來只是建議）
  ↓
Intervention Plan 取得錯誤 Reality Write-back 權限
  ↓
18:31  舊站／防災備援同步窗口收束多個因果路徑
  ↓
Sensor Feedback ≠ 同一 Epoch 的 Observed State
  ↓
Correction Session 無法被可信地結案
  ├─ 存活／無已知死者──┐
  └─ 不同 Failure Path ─┤ 兩者都可能未結案
                       ↓
23:59  Recovery 最終結案檢查／鐘聲（感知現象）
  ├─ 未結案 + Write-back 仍授權 → 00:00 Rollback → 06:12
  ├─ 單次合法 Forward Seal        → 00:00 → 10/4（Ending A）
  └─ 全面撤銷自動 Write-back + Forward Seal → 10/4（Ending C）
```

以上是故事中可驗證的**因果方向**，不是保證每個異常都伴隨電力故障、受傷或死亡。

## 2. 六個系統角色（與人物角色不同）

| 概念元件 | 正常工作 | 出錯後的風險 |
| --- | --- | --- |
| `Causal Baseline Store` | 保存 06:12 當輪可信的 Bounded Causal Graph State | 成為錯誤 Recovery 的回復點 |
| `Prediction / Simulation` | 推估災害、時刻表、應變方案；可繼續存在 | 模擬 Target 被誤認成已發生的 Observed Reality |
| `Sync Ledger` | 用 Sync Epoch 區分「預測」「實測」「已執行」的證據 | 跨 Epoch 的資料、回授與寫入確認不一致 |
| `Reality Write-back Bridge` | 故事設定中允許受控 Correction 的主執行路徑 | Target State 取得改寫 Reality 的效力 |
| `Recovery Bridge` | 主路徑異常時接手的備援／舊制復原路徑 | 主路徑被關閉後，備援仍可能偷偷重新開通 |
| `Recovery Controller` | 比對完成情形、結案或 Recovery Retry | 誤將「沒有更好結果」當成「Session 尚未完成」 |

**Policy、Ledger、Bridge 是不同責任：**不能用「關掉螢幕上的模型」冒充撤銷 Bridge 權限，也不能只切斷一條線後忽略舊 Recovery Bridge。

這是灰潮鎮的本地 Operational Causal Graph。其他 Pilot Site 可能還有獨立 Writer；Ending C 不得無證據宣稱全球 Rewrite 全部消失。

## 3. 為什麼是 18:31？

灰潮鎮原本整合舊車站訊號、醫療與警消調度、電網備援以及地方災害預警。舊系統保有一個**每日 18:31 的集中同步／交接窗口**，由同一個歷史上的排程與 Epoch 規則形成。

五年前事故在該窗口附近發生；五年後地方更新重新接上防災備援網路，保留了同一個有缺陷的交接時窗。它不是神秘的「宇宙規定死亡時間」，也不表示每天其他時間不能出現局部 Soft Rewrite。

```text
17:xx  醫院、舊站、電力、人物行程各自更新
    \              |              /
     \     真實資料與方案結果不同   /
                ↓
18:31  Convergence Window
        ├─ 計畫中的 Target State
        ├─ 當前真實 Observed State
        ├─ 已生效 Intervention
        └─ 先前 Epoch 的 Correction Confirmation
                ↓
        Ledger 發現不一致卻錯誤嘗試再次 Write-back
                ↓
        實際損害由「誰在什麼路線、碰到什麼設備」決定
```

### Cascade 的具體錯誤

1. 數個部門本來就可能將同一個人、站區與事故視作不同的作業物件。
2. 舊同步介面在新舊 Epoch 交接時，未嚴格隔離 `Forecast Target`、`Observed Reality`、`Write-back Ack`。
3. 一份應只用於比較的 Target 在 `Reality Write-back Bridge` 得到執行能力。
4. 執行後回傳的 Ack 對不上當前 Observed State；Recovery Controller 嘗試再次收斂，卻使用舊 Epoch 的參照，產生持續 Feedback Mismatch。
5. 系統的多次 Correction 不必以傷亡為目標；它只是不能接受沒有「已完成」標記的 Reality。當人員恰好走過局部故障設備，傷亡才出現。
6. 重複 Correction 同時可能觸發 Pivot Repeat Protection Failure；同一人再次成為 Pivot 並被固定為 Persistent Reference / Fixed Anchor。**Anchor 是並發 Bug 的結果，不是 Cascade 事故的燃料或死亡代價。**

上述「狀態邊界污染 → 回授失配 → 無法結案」是鎖定的故事機制。哪個晶片或物理場使 Reality 受影響，仍 TBD。

## 4. 五年前知夏、五年後主角：同一錯誤的兩次不同發生

```text
五年前：研究介入 → 18:31 附近同步失配
      → 知夏高 Causal Weight + 同 Pivot 再次命中
      → Repeat Prevention 失效 → Fixed Anchor
      → 她記得被 Rewrite 的 Reality
      → 最後設法隔離灰潮鎮主 Write-back 同步聯結

五年後：地方更新重新整合備援防災／舊站通訊
      → 曾被隔離的本地 Recovery Bridge 再次可用
      → 06:12 建立當日可信 Baseline
      → 18:31 同一類失配再次發生
      → 主角已在 Causal Prediction Horizon，並被重複選為 Pivot
      → 新 Fixed Anchor；未結案 Correction 導致 Hard Reset
```

知夏五年前隔離的是**灰潮鎮通往現實執行層的主同步聯結**，使地方 Writer 沉寂；她沒有銷毀全球模型或所有 Pilot Site，也沒有證據證明她已查到未接通的備援路徑。

地方更新復接的是**舊站周邊防災通訊與復原接入點**；它讓恢復路徑繞過原來的主隔離。實際施工位置、斷線設備型號、知夏行動與死亡的先後順序仍 TBD。

警告信「不要回來」與技術通道的關係仍未知，**不能**直接定為 Watchdog 第七階段或一封可變字的跨世界線訊息。

## 5. 三種 18:31 結果：共同 Bug，不同事故

### Loop 01｜若晴死亡（Failure Path A）

```text
17:40 柏勳離開醫院
→ 17:58 到舊站
→ 18:05 若晴完成資料交接，仍在舊站影響範圍
→ 18:31 回授／設備異常
→ 若晴因當輪位置與暴露情形死亡
→ Correction Session 仍未結案
```

### Loop 02｜若晴存活、柏勳死亡（Failure Path B）

```text
若晴自行決定改變行程
→ 18:05 柏勳抵達但無法交付資料
→ 18:12 柏勳因施工改走舊維修通道
→ 18:24 進入暴露範圍
→ 18:31 設備異常使柏勳死亡
→ Correction Session 仍未結案
```

柏勳的死亡不是系統指定「替死」，而是**原交付失敗 → 自主改路 → 真正接觸風險**的下游因果。目前 Runtime 有部分路線與旗標，應驗證全程 Schedule 及 Exposure 才能視為實作完成。

### Loop 03｜沒有確認到已知死者（Failure Path C）

```text
主角促使自己知道的高風險人物避開站區
→ 18:31 Convergence 仍發生（可能只有可觀測的資料／設備失配）
→ 沒有已知死者被確認
→ Ledger 的未完成 Correction 仍存在
→ 23:59 / 00:00 一樣 Retry
```

「沒有已知死者」不等於全鎮保證零傷亡；更不等於成功結案。

## 6. 午夜 Recovery 判定｜不是死人計數器

18:31 當下不直接 Reset。Recovery Controller 保留一段當日窗口，讓資料、設備與 Correction Session 自行結束。**23:59** 做最後結案檢查，**00:00** 是實際 Rollback / Forward boundary。

這版鎖定的是一個**有狀態、可由玩家線索驗證的判定方向**：

```text
CurrentCorrectionSession:
  baseline: 10/3 06:12
  syncEpoch: current/reused
  feedbackMismatch: true | false
  pendingCorrection: true | false
  sessionState: OPEN | FAILED | FORWARD_SEALED
  primaryWriteAuthority: GRANTED | REVOKED
  recoveryWriteAuthority: GRANTED | REVOKED
  writerIsolationVerified: true | false
```

### Recovery 優先序（敘事層決策表）

| 23:59 的有效條件 | 00:00 的結果 |
| --- | --- |
| `FORWARD_SEALED` + 當輪最終確認成立 | 向 10/4 前進，不再回 06:12 |
| 未結案；Primary 或 Recovery 仍有 Rewrite 執行權；Mismatch／Pending 未解 | `Recovery Retry → 06:12` |
| 僅阻止某人死亡、但 Session 未結案 | `Recovery Retry → 06:12` |
| 僅拔掉主路徑、備援仍有權且 Session 未結案 | `Recovery Retry → 06:12` |
| 「看起來無異常」卻沒有可驗證的 Forward Seal | **不宣告通關**；不可用成功幻覺偷渡 00:01 |

控制邏輯的小說層示意：

```text
if verifiedForwardSeal:
    AdvanceCurrentReality()
else if unresolvedCorrection and anyWriteAuthorityActive:
    RestoreBaseline(10/3 06:12)
else:
    HoldForSafetyResolution()  # 未確認隔離時，不可聲稱已永久結束
```

`unresolvedCorrection` 至少意味著 `feedbackMismatch || pendingCorrection || recoverySessionNotClosed`。具體數值閾值、超時和投票／簽核演算法是 Runtime 與世界觀底層 TBD；**角色死亡、Anchor 生死或 NPC 記憶均不得出現在 Retry Predicate 中**。

### 23:59 鐘聲

可作為 Recovery 決策前的同步感知現象；鐘樓無鐘。其聲音如何由裝置／環境產生仍 TBD，不可設定成獲得跨線記憶的訊號。

## 7. Ending C｜永久停止本地自主 Write-back

核心不是拔一條線，也不是主角下達「不要重來」。

### 必須同時完成的五個 Gate

**G1｜辨識兩條執行路徑：**證據確認主 `Reality Write-back Bridge` 與 `Recovery Bridge` 可能互相接手，而 Prediction / Simulation 是獨立的唯讀輸出。

**G2｜隔離現實執行：**在不取消一般醫療、電力、警消正常服務的前提下，將本地 Writer 的**主、備援**自動 Correction 權限撤銷；失效時必須 Fail-closed，不能由備援自行恢復。

**G3｜Epoch Fencing：**舊 Correction Lease / Sync Epoch 的確認不得被當成新一輪可執行的指令。更新後的 Relay 若重新上線也只可報告資料，不能重新申請自主 Write-back。

**G4｜獨立驗證：**當輪參與者以不同來源比對「Bridge 沒有可用寫入權」「兩條路徑皆停止發送／接受 Rewrite Ack」「預測仍可唯讀運作」。只有 UI 出現停用字樣、主角記得前一輪、或一輪無人死亡都不夠。

**G5｜Forward Seal：**Recovery Controller 在 23:59 前**正式放棄重算本輪的權利**，將「當前已實際發生的 Reality」作為可以繼續走向 10/4 的事實。不得再用「未達最優結果」重新開 Session。

```text
Evidence from 5 characters + player's compared observations
                       ↓
             G1 identify bridges
                       ↓
       G2 revoke primary + recovery writer
                       ↓
            G3 fence old epochs
                       ↓
        G4 externally verify no write authority
                       ↓
      G5 Forward Seal (observed state, not ideal target)
                       ↓
           23:59 final Recovery check
                       ↓
             00:00 → 10/4 00:01
```

### Failure / Counterexample

- **只拔主線：**備援恢復 Write-back → Retry。
- **只刪掉模型：**Recovery Bridge 與持久權限仍在，Simulation 消失不等於 Rewrite 消失。
- **只讓 Anchor 忘記／死亡：**Writer 依然有權，Retry 仍可能發生。
- **只救下所有目前知道的人：**Ledger 尚未結案，Retry。
- **只通過軟體上「成功」畫面：**沒有外部核實，不能保證是真正的 Writer Isolation。
- **不經人物知情而強制切斷公共基礎設施：**可能讓傷亡增加，不符合 Ending C 的主題與驗證要求。
- **把 Prediction / Simulation 也摧毀：**與 Ending C 的倫理和研究方向相反。

### 為什麼不是一顆「關閉輪迴」按鈕

Ending C 的可達性應受多條 **Evidence / Consent / Causal Preparation** 約束，角色選擇可改變誰提供資料／留守／撤離；不要求每人都親自同意同一個指令，不把 NPC 自主權變成完美路線的硬性數值鎖。

| 人物 | 能提供什麼、能拒絕什麼 |
| --- | --- |
| 庭安 | 研究 Objective、權限流向與舊備援紀錄；決定公開範圍 |
| 柏勳 | 傷亡／醫療時間交叉查核；可拒絕拿原件冒險 |
| 志遠 | 未登錄證物與正式保全鏈；決定是否承認 |
| 若晴 | 改建前後影像與真實站區暴露情形；決定拍攝／撤離 |
| 予安 | 老設備接口、無鐘的鐘樓與站區設備知識；可選擇留下或外部支援 |
| 主角 | 跨 Loop 比較與風險說明；**不能替 NPC 指定最終人格／意志** |

玩家必須由 Perception → optional Capture 建立自己可用的證據。Author Event Graph 可以知道全貌，但 Player UI 不得自動給出完整 Bridge 圖或封存答案。

## 8. 三個 Ending 的技術與倫理差異

| Ending | 主角的態度 | 系統動作 | 00:00 / 之後 |
| --- | --- | --- | --- |
| **A 接受單一世界** | 不再重算這一天 | 當輪以**一次性、知情的 Forward Seal／人工終止 Session**接受現在，但**未永久撤銷所有 Write-back 權限** | 本次 00:00 可前進；未來自主 Correction 風險仍存在，不能宣稱根治 |
| **B 再一次** | 希望最佳化結果 | Session 未封存、Writer 仍授權 | 00:00 Retry 至 06:12 |
| **C 停止改寫** | 不再替他人決定最優人生 | G1–G5 成立：本地兩路權限撤銷、Epoch 被 Fence、隔離驗證、不可自動重啟 + Forward Seal | 00:00 前進；灰潮鎮**本地自主 Reality Write-back**永久失去權限（除非人為重新建立一套新的違規路徑） |

**A 與 C 都可能到明天，但 A 只結束「這個 Session」，C 拆掉「系統替人修改現實的權力」。**

不可把 A 寫成主角決心改變就自動停 Loop；至少需要合法的一次性 Seal，也不能宣稱它和 C 一樣永久消除了下一次 Rewrite 風險。

「永久」的工程意義是：灰潮鎮既有 Primary/Recovery 執行權均被不可由程式自動恢復的隔離措施撤銷；不表示宇宙已失去物理改寫可能性，亦不保證全球其他 Pilot Site 全部安全。

## 9. 時序驗收用事件圖（Author Truth；不是 Player UI）

```text
[06:12 trusted baseline] ───────────────┐
                                         │
[17:40 doctor departs]                   │
  ├─ [18:05 handoff] → [station exposure]├─ [18:31 sync window]
  └─ [18:05 no recipient]                │          │
         → [18:12 alternate route]       │          ▼
         → [18:24 maintenance exposure] ─┘   [feedback mismatch]
                                                    │
                                    [23:59 final recovery adjudication]
                                         ├─ [unsealed] → [00:00 retry]
                                         ├─ [A: one-time seal] → [00:01 forward; risk remains]
                                         └─ [C: G1–G5] → [00:01 forward; local writer disabled]
```

以上的「18:05」是劇情中交付／未交付的觀察點；Runtime 的後結算事件可以在 18:06 判定，不改寫故事時刻。所有分支的 Event Graph 必須呈現中間因果，不准在 18:31 根據行動標籤直接換死者。

## 10. Implementation Boundary（本 PR 先定案機制，不聲稱 Runtime 已完成）

現有 `story/**/*.yaml` / Viewer 可播放原本輪次、示範不同 Failure Path；本文件**不是**已經落地的完整 Recovery Runtime。

後續實作需有明確 State / Transition 而非文字設定：

```text
CorrectionSession:
  state: OPEN | UNRESOLVED | FORWARD_SEALED
  epoch: ...
  feedbackMismatch: boolean
  pendingCorrection: boolean
  primaryWriteAuthority: boolean
  recoveryWriteAuthority: boolean
  isolationVerified: boolean
  sealMode: NONE | ONE_TIME | PERMANENT
```

**最小驗收矩陣：**

1. Loop 01 的若晴死亡與 Loop 02 的柏勳死亡，都走不同前因，但 Reset Predicate 與死者無關。
2. Loop 03 沒有已知死者仍 Retry；若 G1–G5 成立可 Forward，即使當輪有傷亡也不必「自動重算」。
3. 只有主 Bridge 失效且 Recovery Bridge 有權時，系統不能認為 C 已完成。
4. 有權但尚未 Seal 時，不能憑主角說「接受」進入 00:01。
5. Ending A 有一次性有效 Seal 才到明天，接下來仍可能受 Writer 影響；Ending B 繼續 Retry。
6. Ending C 兩路權限被持續 Fence 且經獨立驗證，才能 Final Forward；Prediction / Simulation 仍可在非寫入模式使用。
7. Anchor 記憶不因 C 成功被刪除；普通 NPC 不保留上一 Loop 關係。
8. 玩家未 Perceive / Capture 的 Bridge 線索，不能自動變成 Investigation Wall 的真相。
9. Offline / Live Sync 不停世界；23:59、00:00 判定不能等待玩家按下一步。
10. Story DAG 的 History、Node / Edge、Replay 必須與上述 State Transition 對得上。

## 11. 尚待決定的底層事項（不影響本版因果 Canon）

- Reality State Coupling 如何在小說物理中真正作用；不應偽裝成一般電網 PLC 能改寫宇宙。
- 具體舊站設備型號、位置、現場危險與兩條隔離路徑的實體操作細節。
- Epoch / Lease / Forward Seal 的資料結構、Recovery 門檻與安全簽核實作。
- 五年前知夏精確切斷聯結、知夏死亡與斷線的先後時間。
- 五年後真正是哪一段地方更新工程造成復接。
- 23:59 無鐘鐘聲的具體產生方式。
- 五年前和五年後 Pivot Selection 演算法及 Reference Cache bug 的底層實作。
- 「不要回來」信件的寄出／送達原因；不得倒推出七階段跨線裝置。
- 其他 Pilot Site 如何發現／治理 Rewrite，以及灰潮鎮之外的長期世界結局。

## 12. 禁止推翻的邊界

```text
18:31 ≠ mandatory death
No known deaths ≠ successful Recovery
Death / Anchor death ≠ Reset / Loop stop trigger
Reference Lock ≠ inherited bloodline
A one-time Forward Seal ≠ permanent disarmament
Single severed cable ≠ verified shutdown
Ending C ≠ erase memory
Ending C ≠ kill Prediction / Simulation
Ending C local success ≠ global Rewrite eliminated
Author mechanism truth ≠ Player automatic discovery
```

References：`story-canon-rewrite-anchor.md`、`story-canon-time.md`、`story-canon-return-and-reactivation.md`、`final-1831.md`、`event-graph-spec.md`、`core-gameplay-spec-v0.1.md`。
