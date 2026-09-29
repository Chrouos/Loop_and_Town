# Chapter 2｜活下來的人

這章的功能不是讓玩家「救成功」，而是第一次證明：

> 改變死者，不等於改變事件。

本章 Player-facing 資訊必須遵守目前 Core Gameplay：

- World Event ≠ Player Knowledge
- 只有實際 Perceive 的內容才能被玩家記住
- persistent gameplay record 由玩家自己 Memory Capture
- 系統不自動發 Event / Truth / Invariant Card
- 玩家自己在 Investigation Wall 比較不同 Loop

---

# 玩家進入這一輪時知道什麼

玩家能帶進這輪的，不是系統自動整理出的完整答案，而是上一輪主角真的經歷 / Capture 的內容。

可能包含：

```text
17:40 左右 柏勳離院
18:05 左右 柏勳與若晴碰面
18:31 若晴死亡
```

具體精度依上一輪實際 Perception / Memory Capture 決定。

玩家最自然的實驗是：

> 不讓若晴去舊車站。

---

# 讓若晴改變行程的方法

玩家不能直接按「阻止若晴」。

必須先理解她為什麼會去。

若晴前往車站有三個原因：

1. 柏勳說有知夏留下的資料
2. 她覺得自己欠知夏一個答案
3. 她已經決定今天要辭職，把這次會面當成離開前最後一件事

玩家只能透過人物與情境影響她。

## 路徑 A｜取得當輪信任

```text
理解攝影作品集
→ 不拿知夏逼她
→ current-loop trust >= threshold
→ 若晴在 17:20 左右主動說出車站計畫
→ 玩家才有機會進一步影響她
```

重要：

若晴「說出車站計畫」是 World / Dialogue Event。

玩家當下如果把 Attention 移去別處，可能只聽到一部分；它不應因劇情重要而強制加入 Memory Library。

## 路徑 B｜改變現實條件

```text
幫若晴處理母親臨時狀況
→ 若晴必須留在家中
→ 無法按照原計畫去車站
```

這條路不需要高 Trust，但若晴不一定理解玩家真正的目的。

---

# 世界線改寫

Baseline：

```text
17:40 柏勳離院
→ 18:05 柏勳把資料交給若晴
→ 18:18 若晴仍在車站
→ 18:31 若晴死亡
```

Chapter 2：

```text
17:20 若晴行程被改變
→ 18:05 柏勳抵達車站，若晴沒出現
→ 柏勳嘗試聯絡若晴
→ 柏勳決定自己保留資料並返回醫院
→ 18:24 經過舊維修通道
→ 18:31 因果收束事件發生
→ 柏勳死亡
```

這是 Author Canon。

Player 是否知道每個中間步驟，取決於玩家這一輪實際在哪裡、Focus 什麼、感知到什麼。

---

# 18:31 現場

死亡方式不要像另一個普通謀殺。

現場應同時容許「事故」與「異常」解釋：

```text
舊站電力短暫恢復
→ 維修門誤鎖
→ 線路異常放電 / 設備啟動
→ 柏勳倒下
```

Author 可以知道兩輪具有：

```text
死者變了
時間沒變
局部停電沒變
鐘聲沒變
某個舊設備啟動沒變
```

但遊戲不能直接把這份比較結果發給玩家。

玩家必須先各自感知 / Capture 足夠資訊，才有材料自己比較。

---

# 若晴活下來之後

18:31 之後不要讓若晴只負責哭或提供線索。

她仍然有原本的人生。

## 20:30｜辭職

如果玩家沒有另外干預：

若晴回到咖啡店。

她把早就寫好的辭職信拿出來。
店長其實早就知道她在準備作品集。

她可以說：

> 我本來以為今天做完那件事，就可以走了。

停一下：

> 結果好像還是得走。

「走」同時指離開咖啡店、離開灰潮鎮，也讓玩家聯想到知夏。

這是一條人物自己的生活線，不是救人後的獎勵動畫。

---

# 本章可被玩家感知 / Capture 的 Moment

舊設計中的：

```text
Worldline Card
Event Card
Invariant Card
```

不再由系統自動發放。

改成提供可感知的 authored Moments。

## Moment A｜若晴仍然活著

如果主角在合理情境下實際確認若晴狀態：

```text
18:31 之後
許若晴仍然活著
位置：依這輪 route
```

玩家可以選擇 Capture，也可以不 Capture。

## Moment B｜柏勳死亡

若主角親眼到現場，可 Capture 自己真的看見的資訊。

例如：

```text
18:31
舊車站維修通道
柏勳倒下
手邊有一份資料
```

若玩家只是之後聽警方說「柏勳死了」，那 Memory 應保存的是：

```text
某人告訴我柏勳死亡
```

而不是自動得到完整現場照片、死因與持有物。

## Moment C｜18:31 再次出現

第二輪如果玩家真的再次感知到 18:31 相關事件，可 Capture：

```text
Loop 02 · 18:31
又發生異常
```

系統不要升級成：

```text
[Invariant Card]
18:31 是核心
```

---

# Investigation Wall 的推理應由玩家建立

玩家可能最後擁有：

```text
[Loop 01 · 若晴死亡 · 18:31]

[Loop 02 · 柏勳死亡 · 18:31]
```

然後自己拉線：

```text
[Loop 01 · 18:31]
        │
        │ 玩家自己連
        ▼
[Loop 02 · 18:31]

Note：「又是 18:31？」
```

這個 Note 才是玩家的 hypothesis。

遊戲不顯示：

```text
恭喜發現 Invariant
18:31 = 關鍵時間
```

---

# 延遲後果

## 19:10｜周志遠

柏勳死亡後，志遠第一次主動懷疑這不是單純謀殺。

因為五年前知夏死亡現場也出現相似電力異常。

但他仍不會立刻交出未登錄錄音設備。

玩家是否知道志遠已經改變想法，仍取決於實際 Perception。

## 19:50｜葉庭安

```text
柏勳存活
→ 庭安 19:50 獨自進研究所

柏勳死亡
→ 庭安先確認醫療資料去向
→ 研究所行程延後
```

玩家救若晴，間接改變庭安晚上的 Schedule。

這是 delayed consequence。

## 20:00｜周予安

如果玩家整天要求予安幫忙，他可能錯過原本和房仲的約。

```text
20:00 店面看屋取消
原因：予安不在場
```

這是當輪生活後果。

它不產生：

```text
memory_residue +1
```

Reset 後予安不記得這輪；只有主角可能記得自己曾讓他錯過什麼。

---

# Chapter 2 結尾

Author Truth：

```text
Loop 01
若晴 → 18:31 死亡
柏勳 → 存活

Loop 02
若晴 → 存活
柏勳 → 18:31 死亡
```

玩家必須靠自己的 Memory / Investigation 逐步接近這個比較。

最重要的疑問應該由玩家自己產生：

> 為什麼又是 18:31？

而不是系統把這句話當成解鎖通知送給玩家。

知夏留下的話此時才可能因玩家已有的記憶產生新的意義：

> 如果你看到 18:31 第二次，不要先救第一個死者。

---

# Event Graph 最小需求

Author Graph 至少需要：

```text
wakaharu_tells_station_plan
→ prevent_wakaharu_station
→ doctor_arrives_without_wakaharu
→ doctor_changes_route
→ convergence_1831_doctor
→ wakaharu_resignation_2030
```

以及 delayed effects：

```text
doctor_dead
→ reporter_replans_institute

yuan_busy_with_player
→ realtor_meeting_missed
```

但還要另外表示 Perception opportunity：

```text
World Event
→ cue available
→ player Attention / Perception
→ optional Capture
```

不要把：

```text
若晴被救 → 柏勳死
```

寫成直接開關。

中間必須保留人物自己的決定，也必須保留「世界發生了，但玩家可能沒有看到」的可能性。
