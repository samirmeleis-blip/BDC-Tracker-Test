const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const FRAMES = path.join(DIR, 'frames');
const FPS = 20;
const DUR = 60;

(async () => {
  fs.mkdirSync(FRAMES, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });
  await page.goto('file://' + path.join(DIR, 'animation.html'));
  await page.waitForFunction('typeof window.frameData === "function"');

  const total = FPS * DUR;
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    const dataUrl = await page.evaluate(tt => window.frameData(tt), t);
    const b64 = dataUrl.slice('data:image/png;base64,'.length);
    fs.writeFileSync(path.join(FRAMES, `f${String(i).padStart(4, '0')}.png`), Buffer.from(b64, 'base64'));
    if (i % 100 === 0) console.log(`frame ${i}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`);
  }
  console.log(`done: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await browser.close();
})();
