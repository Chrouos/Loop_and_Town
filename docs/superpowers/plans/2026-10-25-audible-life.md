# Audible Life Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 補上所有無聲的環境擬聲事件並防止遺漏重現。

**Architecture:** 保留原本混音管線；將既有 AMBIENT_EVENTS 與新增 LIFE_SFX_RECIPES 組成公開 SFX_RECIPES。事件明確綁定 SfxId；型別、解析及測試保障完整性。

**Tech Stack:** TypeScript、Web Audio、YAML、Vitest、離線瀏覽器 AudioContext。

**Spec:** `docs/superpowers/specs/2026-10-25-audible-life-design.md`

## Global Constraints

- 不變更背景對話、既有事件頻率與方向。
- 新配方節點必須由 Graph 管理、時間有限、音量適當。
- 不包含工作區中並行的時鐘修改；既有可用錄音／環境音不被替換。

## Review Focus

- 每筆字幕觸發對應音效，沒有漏掉無 src 的資料或劇本自訂 life。
- 公開音效名稱／配方完全相符，沒有循環初始化錯誤。
- 不同播放速率、立體方位下排程有限且可釋放。
- 新合成聲實際非零且不爆音，動物與機械音可區分。
- CI 的獨立版本不依賴未提交工作。

### Task 1: Inventory and coverage

- [x] 完整盤點 LIFE、劇本 life 及缺 sfx 的 cue；新增完整播放測試並確認現況失敗。

### Task 2: Audible definitions and bindings

- [x] `lifeSounds.ts` 製作缺少的三十五種配方（獨立音效製作代理）。
- [x] `catalog.ts` 註冊事件聲；`sounds.ts` 組合原有、環境及新增配方；`life.ts` 明確綁定全部擬聲事件。
- [x] 更新自訂劇本事件與解析規則，維持對話 cue 原本語義。

### Task 3: Verification and delivery

- [x] 完整測試、建置、離線渲染配方與獨立審查。
- [x] 選擇性加入本次變更，獨立版本再驗證後提交、推送與 CI/CD。

## Verification

- 內建 193 筆擬聲事件，其中 100 筆原本漏綁，現皆會觸發對應音效；另補 3 筆劇本自訂事件。31 個正式劇本 cue 原已有音效。
- 35 種新配方、21 種既有環境配方公開成事件音效；個別校準，保留背景層原混音。
- 原資料完整播放測試曾出現 100 個預期失敗；補綁後通過。新增解析拒絕測試曾抓到遺漏 sfx 未被拒絕；已改為型別與解析必填。
- 171 次真實 OfflineAudioContext 渲染（56 個新增／接通配方加腳步參考，各三速率），均有波形、無爆音、無殘留尾音；測量結果在 docs/audio/2026-10-25-life-sfx-check.json。
- 離線檢查曾抓到共用原始配方物件在模組重載時重複套用音量，已改為分離副本並新增回歸測試。
- 工作區完整測試 325 個通過，含另行開發中功能；正式建置通過。獨立審查與音量隔離複查無剩餘問題。
- 僅含音效修改的獨立 Git index 副本：310 個測試與正式建置通過。
