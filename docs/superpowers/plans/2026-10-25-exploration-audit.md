# Exploration Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 找出其他可反覆播放相同內容的探索，並套用多段內容與耗盡。

**Architecture:** 沿用 disabled_if 和回合 flags，將第六章廣場分成三次；五處入口共享耗盡條件，另留回家的流程出口。

**Tech Stack:** YAML、TypeScript、Vitest。

**Spec:** `docs/superpowers/specs/2026-10-25-exploration-exhaustion-design.md` 追加範圍。

## Global Constraints

- 保留原有調查地點一次性限制與跨回合重置。
- 每次廣場行程仍依原路消耗一個時段；回家保留傍晚事件。
- 不更動其他未提交變更，不新增引擎或存檔格式。

## Review Focus

- 三次廣場依序不同，五個入口一致停用。
- 15:30 仍有流程出口，即使所有短程調查已完成。
- 同回合讀檔保留耗盡，沒有進度的新回合可重新探索。
- 回家會接回既有傍晚，不會跳過庭安會面或卡在選單。
- 未耗盡前仍保留各調查入口和原本時段消耗。

### Task 1: Audit and exhaust the square

**Files:** `story/ch06.yaml`, `game/tests/exploration.test.tsx`。

- [x] 檢查全部選項及跨場景返回路徑，確認追加重複內容在 c6_square。
- [x] 新增測試：從 09:30 連選三次廣場，分別回到 11:00、12:30、14:00；三段各有新內容，接著五處入口均停用，讀檔保留；15:30 所有短程調查已完成仍可回家。
- [x] 執行測試確認因原本重播而失敗。
- [x] 修改廣場三段 flags 與五個入口的 disabled_if，加入回家 goto c6_dusk。
- [x] 執行完整測試、建置及 diff 檢查；請獨立審查本次範圍。

## Verification

- 全部 105 個測試通過（含 18 個探索測試）。
- TypeScript 與 Vite 建置通過；`git diff --check` 通過。
- 完整驗證曾抓到分支內 wait 違反存檔規則，已改為單一最外層 wait，前後依既有進度選擇對應內容；新增腳本驗證斷言防止漏檢。
- 等待途中讀檔的三種情境皆通過：以等待前既有 flags 選擇對應內容，等待結束後才推進進度。
- 獨立審查複查後無剩餘問題。
