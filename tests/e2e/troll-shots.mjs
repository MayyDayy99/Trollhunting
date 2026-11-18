// Visual check: puts one troll of every type in front of the camera, lets them walk / attack for a moment
// and saves screenshots. CLI: node tests/e2e/troll-shots.mjs --dir dist --out shots/new [--gpu]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { serveDir } from './run-scenario.mjs';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const dir = arg('--dir') || 'dist', out = arg('--out') || 'shots', gpu = process.argv.includes('--gpu');
fs.mkdirSync(out, { recursive: true });
const { server, port } = await serveDir(dir);
const channel = process.env.E2E_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chrome');
const browser = await chromium.launch({ channel, headless: true,
  args: gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto(`http://127.0.0.1:${port}/mohas-roham.html#dev`);
  await page.waitForFunction(() => window.__MR && document.getElementById('loading').classList.contains('hide'), null, { timeout: 180000 });
  await page.click('#startBtn');
  await page.evaluate(() => {
    const M = window.__MR; window.__mrHold = true; window.__E2E = { t: 100 };
    M.monsters.forEach(m => M.killMonster(m, false)); M.startWave(3);
    const types = ['grunt', 'scout', 'brute', 'shaman', 'spitter', 'wisp'];
    M.player.pos.set(0, 1.7, 0); M.player.yaw = 0; M.player.pitch = -0.05;
    types.forEach((ty, i) => { const m = M.makeMonster(ty, 1.0, 400, 1.2, ['fire', 'ice', 'poison', 'lightning', null, 'ice'][i]);
      m.g.position.set(-6.5 + i * 2.6, 0, -7.5 - (i % 2) * 1.5); M.monsters.push(m); });
  });
  const step = n => page.evaluate(n => { const M = window.__MR, E = window.__E2E;
    for (let i = 0; i < n; i++) { E.t += 1 / 60; M.player.hp = M.player.maxHp; M.player.pos.set(0, 1.7, 0); M.update(1 / 60, E.t); M.renderFrame(); } }, n);
  for (const [i, n] of [[0, 2], [1, 40], [2, 50]]) {
    await step(n);
    await page.screenshot({ path: path.join(out, `trolls-${i}.png`) });
  }
  console.log('saved', out);
} finally { await browser.close(); server.close(); }
