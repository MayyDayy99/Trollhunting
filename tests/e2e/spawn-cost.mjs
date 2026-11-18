// How long does building one troll take (makeMonster), per type? CLI: node tests/e2e/spawn-cost.mjs [--dir dist]
import { chromium } from 'playwright-core';
import { serveDir } from './run-scenario.mjs';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const { server, port } = await serveDir(arg('--dir') || 'dist');
const channel = process.env.E2E_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chrome');
const browser = await chromium.launch({ channel, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(`http://127.0.0.1:${port}/mohas-roham.html#dev`);
  await page.waitForFunction(() => window.__MR && document.getElementById('loading').classList.contains('hide'), null, { timeout: 180000 });
  const measure = () => page.evaluate(() => {
    const M = window.__MR, out = {};
    for (const ty of ['grunt', 'scout', 'brute', 'shaman', 'spitter', 'wisp']) {
      const t = [];
      for (let i = 0; i < 8; i++) { const a = performance.now(); const m = M.makeMonster(ty, 1, 100, 2, null); t.push(performance.now() - a); M.scene.remove(m.g); M.disposeMonster(m); }
      t.sort((x, y) => x - y); out[ty] = { median: +t[4].toFixed(1), max: +t[7].toFixed(1) };
    }
    return out;
  });
  console.log('merged  ', JSON.stringify(await measure()));
  await page.evaluate(() => { window.__noTrollBatch = true; });
  console.log('unmerged', JSON.stringify(await measure()));
} finally { await browser.close(); server.close(); }
