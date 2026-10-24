# 音效素材處理腳本

`public/audio/` 裡的錄音都是用這些腳本做出來的。來源全部是 Freesound 的 CC0 音檔，清單與授權在 `public/audio/CREDITS.md`。

需要 python3 + numpy，以及 macOS 內建的 `afconvert`。

```bash
python3 fs.py search "church bell" --sort dl   # 只搜 CC0
python3 fs.py page 426642                      # 確認授權、看標籤
python3 fs.py get 426642                       # 下載 HQ 預覽到 dl/
python3 build.py bell_toll                     # 依 spec.py 裁切、正規化、編碼，更新 samples.ts 與 CREDITS.md
```

- `spec.py`：每個聲音用哪個來源、怎麼裁、音量目標
- `build.py`：處理與輸出；會重新產生 `src/audio/samples.ts` 的 manifest 區塊，手動改過的 gain/rate 會被覆蓋，要改就改 `spec.py`
- `ana.py`、`proc.py`、`events.py`：量測與處理工具
- `meta.json`：每個來源音檔的標題、作者、網址、授權（產生 CREDITS.md 用）
- `dl/`、`cache/`、`out/` 是下載與中間檔，不進版控
