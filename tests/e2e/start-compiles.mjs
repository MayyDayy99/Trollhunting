// Which shader programs get compiled when a run starts (after the loading-screen warm-up)?
// CLI: node tests/e2e/start-compiles.mjs [--dir dist] [--gfx high|medium|low]
import { chromium } from 'playwright-core';
import { serveDir } from './run-scenario.mjs';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const { server, port } = await serveDir(arg('--dir') || 'dist');
const channel = process.env.E2E_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chrome');
const browser = await chromium.launch({ channel, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/mohas-roham.html#dev`);
  await page.waitForFunction(() => window.__MR && document.getElementById('loading').classList.contains('hide'), null, { timeout: 180000 });
  if (arg('--gfx')) await page.evaluate(g => document.querySelector(`.gfxbtn[data-gfx="${g}"]`).click(), arg('--gfx'));
  const before = await page.evaluate(() => window.__MR.renderer.info.programs.map(p => p.id));
  await page.click('#startBtn');
  await page.waitForTimeout(1500);
  const added = await page.evaluate(ids => window.__MR.renderer.info.programs.filter(p => !ids.includes(p.id))
    .map(p => ({ name: p.name, key: String(p.cacheKey).slice(0, 400) })), before);
  console.log(JSON.stringify({ before: before.length, added }, null, 1));
} finally { await browser.close(); server.close(); }
