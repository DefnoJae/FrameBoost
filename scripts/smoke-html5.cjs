// Optional real-browser smoke test: pass a path to an installed Playwright module.
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<canvas id="source" width="320" height="180"></canvas><div style="position:relative;width:640px;height:360px"><video muted playsinline style="width:100%;height:100%;object-fit:contain"></video></div>');
    const source = readFileSync(require('node:path').join(__dirname, '../html5/frameboost.js'), 'utf8').replace(/^export /gm, '');
    await page.addScriptTag({ content: source });
    await page.evaluate(async () => {
      const source = document.querySelector('#source');
      const ctx = source.getContext('2d');
      let frame = 0;
      window.timer = setInterval(() => {
        ctx.fillStyle = frame++ % 2 ? '#ff0000' : '#0000ff'; ctx.fillRect(0, 0, 320, 180);
      }, 1000 / 24);
      const video = document.querySelector('video');
      video.srcObject = source.captureStream(24);
      await video.play();
      window.cleanup = mountFrameBoostControls(video);
    });
    await page.getByRole('button', { name: 'FrameBoost: off', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-frameboost]').style.display === 'block');
    const pixel = await page.evaluate(() => Array.from(document.querySelector('[data-frameboost]').getContext('2d').getImageData(10, 10, 1, 1).data));
    assert.ok(pixel[0] > 0 || pixel[2] > 0, 'Canvas must contain decoded video pixels');
    await page.getByRole('button', { name: 'FrameBoost: blend 60', exact: true }).click();
    assert.equal(await page.locator('[data-frameboost]').evaluate(c => c.style.display), 'none');
    await page.evaluate(() => {
      window.cleanup(); clearInterval(window.timer);
      const video = document.querySelector('video'); video.srcObject.getTracks().forEach(t => t.stop());
    });
    assert.equal(await page.locator('[data-frameboost]').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Real Edge smoke passed: video capture, visible output, toggle, cleanup, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
