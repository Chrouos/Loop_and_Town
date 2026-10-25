# Exploration Exhaustion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 重複探索每次提供新內容，三次後停用。

**Architecture:** 使用既有 flags/if 保存劇情進度；選項增加 disabled_if，Director 計算停用狀態並拒絕選取，Stage 顯示變暗的原生 disabled 按鈕。

**Tech Stack:** TypeScript、React、YAML、Vitest。

**Spec:** `docs/superpowers/specs/2026-10-25-exploration-exhaustion-design.md`

## Global Constraints

- 不覆寫工作區中其他未提交變更；不變更存檔格式。
- 房間保留線索分支；終章聆聽不消耗拜訪時段。

## Review Focus

- 數字鍵及直接呼叫 choose 不能繞過停用。
- 逾時不能選到已停用的 default 或最後一項。
- 聽完房間仍能摸物件或離開。
- 終章訪問別人再回來不能重播，且保留拜訪選項。
- Stage 使用原生 disabled，停用樣式不被 hover 覆蓋。

### Task 1: Conditional disabled choices

**Files:** `game/src/script/types.ts`, `game/src/script/parse.ts`, `game/src/engine/director.ts`, `game/src/ui/Stage.tsx`, `game/src/ui/game.css`, `game/tests/exploration.test.tsx`

- [x] 新增測試：disabled_if 解析、choose 拒絕停用、逾時跳過停用、Stage 原生 disabled。
- [x] 執行新測試，確認預期失敗。
- [x] 新增 `ChoiceOption.disabledCond?: Cond` 與 View 選項 `disabled?: boolean`，解析 YAML `disabled_if`；選取與逾時以可用選項為準；UI 套用 disabled 與樣式。
- [x] 執行測試確認通過。

### Task 2: Exhaustible story exploration

**Files:** `story/ch01.yaml`, `story/final.yaml`, `game/tests/exploration.test.tsx`

- [x] 新增實際腳本測試：三段依序出現、房間的兩種第一段心聲、耗盡後出口可用、終章返回保留進度。
- [x] 確認測試失敗後，以兩個階段 flags 與一個完成 flag 實作各三段。
- [x] 執行完整測試、build、git diff --check，審查變更。

## Verification

- `npm test`：10 個測試檔、94 個測試通過。
- `npm run build`：TypeScript 與 Vite 建置通過。
- `git diff --check`：通過。
- 獨立唯讀審查：本次範圍未發現正確性問題。
