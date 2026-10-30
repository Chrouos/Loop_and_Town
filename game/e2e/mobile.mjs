import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

// Run against the Vite server, or set GAME_URL to test a deployed build.
const url = process.env.GAME_URL ?? 'http://127.0.0.1:5180/';
let failures = 0;
for (const [name, engine] of Object.entries({ chromium, webkit })) {
  if (process.env.BROWSER && process.env.BROWSER !== name) continue;
  const browser = await engine.launch(name === 'chromium' ? { channel: 'chromium' } : {});
  try {
    for (const [width, height] of [[320, 568], [390, 664], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(url);
        await page.locator('.lt-title').tap();
        await page.waitForFunction(() => window.__game?.audio.ready);
        await page.evaluate(() => {
          const { director: d, setScreen } = window.__game;
          setScreen('play'); d.setPaused(true);
          Object.assign(d.view, { phase: 'scene', center: null, echo: null, choice: null, periph: [], ripples: [] });
          d.updateSettings({ fontSize: 'extraLarge' });
        });
        await page.getByRole('button', { name: '選單' }).tap();
        await page.getByRole('button', { name: '設定', exact: true }).tap();
        const overlay = page.locator('.lt-overlay');
        assert(await overlay.evaluate(el => el.scrollWidth <= el.clientWidth), 'settings overflow horizontally');
        await page.getByRole('button', { name: '回到故事', exact: true }).tap();
        for (const [type, cells] of [['touch', ['？', '？', '你', '？', '？', '二', '？']], ['punch', [[3, 4, 5, 6], [1, 4, 5]]]]) {
          await page.evaluate(({ type, cells }) => {
            const d = window.__game.director;
            d.view.interact = { type, key: Date.now(), cells, style: 'braille' };
            d.updateSettings({});
          }, { type, cells });
          const region = page.locator(type === 'touch' ? '.lt-touch-strip' : '.lt-punch-row');
          await region.waitFor();
          const bounds = await region.boundingBox();
          assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${type} clipped horizontally: ${JSON.stringify(bounds)}`);
          assert(bounds.y >= 0 && bounds.y + bounds.height <= height, `${type} clipped vertically: ${JSON.stringify(bounds)}`);
          const note = await page.locator('.lt-interact-note').boundingBox();
          assert(note.y + note.height <= height, `${type} feedback clipped: ${JSON.stringify(note)}`);
          if (type === 'touch') {
            for (let i = 0; i < cells.length; i++) await page.locator('[data-cell]').nth(i).tap();
            assert.equal(await page.locator('.lt-touch-cell.clear').count(), cells.length, 'touch cells cannot all be read');
          } else {
            await page.locator('.lt-punch-cell.active .needed').first().tap();
            assert.equal(await page.locator('.lt-punch-dot.punched').count(), 1);
          }
        }
        await page.screenshot({ path: `/tmp/loop-mobile-${name}-${width}-verified.png` });
        assert.deepEqual(errors, []);
        console.log(`PASS ${name} ${width}x${height}: audio unlock, settings, touch reading, punch slate`);
      } catch (error) {
        failures++;
        console.error(`FAIL ${name} ${width}x${height}: ${error.message}`);
        await page.screenshot({ path: `/tmp/loop-mobile-${name}-${width}.png` });
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
}
assert.equal(failures, 0, `${failures} mobile browser checks failed`);
