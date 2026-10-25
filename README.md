# 灰潮鎮：第七封信

主角看不見。畫面是純黑的，中間是正在聽的那句話，周圍八個方位是聲音。

她收到一封署名已故姊姊的點字信，信上只有一句「不要回來」。她照原定行程回到灰潮鎮，然後發現這座小鎮困在同一個十月三日。

請戴上耳機。

## 玩

```bash
cd game
npm install
npm run dev
```

開啟 Vite 顯示的網址。

- 點畫面：讓這句話快一點
- 點擬聲字：轉過去聽那個聲音
- 長按一句話：記住它，最多帶十句過午夜
- 右下角小圓點：記憶與設定

測試用網址參數：`?reset` 清除存檔、`?chapter=4` 從第四章開始（自動補上前面章節學到的事）、`?fast=20` 加速、`?mute` 靜音。

## 專案結構

```text
story/        劇本：ch01.yaml … ch07.yaml、final.yaml
game/         遊戲（Vite + React + TypeScript）
  src/engine/   導演：時間、注意力、感知、等待、記憶、輪迴
  src/script/   劇本解析與驗證
  src/audio/    空間音效（錄音素材 + 程序合成備援）
  src/ui/       舞台畫面
  tests/        劇本驗證、隨機遊玩可達性、結局路徑、引擎與音效測試
docs/         story.md（故事）、design.md（體驗與劇本格式）、style.md（文風）、canon/（背景設定）
```

## 開發

```bash
cd game
npm test        # 劇本驗證 + 每一章都能玩到下一章 + 三個結局都到得了
npx playwright install chromium webkit # 第一次跑手機瀏覽器測試前安裝
npm run test:mobile # 另開終端以 npm run dev -- --port 5180 啟動遊戲；檢查手機 Chromium / WebKit
npm run build   # 輸出到 game/dist，GitHub Pages 的網址根目錄就是遊戲
```

改劇本前先讀 [`docs/story.md`](docs/story.md) 的知識 id 表和 [`docs/style.md`](docs/style.md)。格式在 [`docs/design.md`](docs/design.md) §11。

開發時 `/audio-lab.html` 可以逐一試聽每個聲音。音效素材的來源與授權列在 `game/public/audio/CREDITS.md`。

### 遊戲字體

正文使用 [霞鶩文楷 TC v1.530](https://github.com/lxgw/LxgwWenkaiTC/releases/tag/v1.530) Regular，採 SIL OFL 1.1 授權；授權全文隨網站發佈於 `fonts/OFL.txt`。
遊戲內嵌的是涵蓋劇情與介面文字的 WOFF2 裁切字庫，正式建置前會檢查缺字。新增文字若檢查失敗，請下載該版本的 `LXGWWenKaiTC-Regular.ttf`，再於 `game/` 執行：

```bash
python3 -m venv /tmp/loop-font-tools
/tmp/loop-font-tools/bin/pip install fonttools brotli
/tmp/loop-font-tools/bin/python tools/subset-font.py /path/to/LXGWWenKaiTC-Regular.ttf
npm run build
```

更新字體版本時，也請同步更新 `game/public/fonts/OFL.txt` 與本節版本紀錄。
