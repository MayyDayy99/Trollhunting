// Where do the draw calls go? Starts a busy fight (wave 15, every element, spells, the boss)
// and reports, for one frame, draw calls per render pass and visible meshes per category.
// CLI: node tests/e2e/draw-calls.mjs [--dir dist] [--gpu] [--gfx high|medium|low]
import { chromium } from 'playwright-core';
import { serveDir } from './run-scenario.mjs';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const dir = arg('--dir') || 'dist', gfx = arg('--gfx') || null, gpu = process.argv.includes('--gpu');
const { server, port } = await serveDir(dir);
const channel = process.env.E2E_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chrome');
const browser = await chromium.launch({ channel, headless: true,
  args: gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  // deterministic run (same trolls, same positions) so two builds can be compared
  await page.addInitScript(seed => { let t = seed >>> 0; Math.random = () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }, +(arg('--seed') || 12345));
  await page.goto(`http://127.0.0.1:${port}/mohas-roham.html#dev`);
  await page.waitForFunction(() => window.__MR && document.getElementById('loading').classList.contains('hide'), null, { timeout: 180000 });
  if (gfx) await page.evaluate(g => { const b = document.querySelector(`.gfxbtn[data-gfx="${g}"]`); if (b) b.click(); }, gfx);
  await page.click('#startBtn');
  const out = await page.evaluate(() => {
    const M = window.__MR; window.__mrHold = true; let t = 100;
    const step = n => { for (let i = 0; i < n; i++) { t += 1 / 60; M.player.hp = M.player.maxHp; M.update(1 / 60, t); M.renderFrame(); } };
    M.startWave(15); M.addScore(30000); M.openShop(); M.buyBow('rune'); for (let i = 0; i < 3; i++) M.buyUpgrade('awakening'); M.closeShop(false);
    for (let k = 0; k < 12; k++) M.spawnMonster();
    step(240);
    for (const el of ['fire', 'ice']) { M.setElement(el); M.castElementSpell(M.RUNM.drawCap); step(20); }
    const r = M.renderer, info = r.info, orig = r.render.bind(r), passes = [];
    info.autoReset = false; info.reset();
    r.render = (scene, cam) => { const c0 = info.render.calls, t0 = info.render.triangles; orig(scene, cam);
      passes.push({ target: r.getRenderTarget() ? 'rt' : 'screen', obj: scene.type || scene.constructor.name, calls: info.render.calls - c0, tris: info.render.triangles - t0 }); };
    M.renderFrame();
    r.render = orig; info.autoReset = true;
    // visible meshes per category (what the main pass can draw before frustum culling)
    const cat = { trolls: 0, trollMeshesMax: 0, effects: 0, world: 0, camera: 0 }, troll = new Set(M.monsters.map(m => m.g));
    const vis = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    M.scene.traverse(o => {
      if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine) || !vis(o)) return;
      let p = o; while (p && !troll.has(p) && p !== M.camera) p = p.parent;
      if (p === M.camera) cat.camera++; else if (p) cat.trolls++;
      else if (o.material && (o.material.blending === 2 || o.material.transparent)) cat.effects++; else cat.world++;
    });
    for (const m of M.monsters) { let n = 0; m.g.traverse(o => { if ((o.isMesh || o.isSprite) && vis(o)) n++; }); cat.trollMeshesMax = Math.max(cat.trollMeshesMax, n); }
    // per-troll structure: meshes, distinct parents, distinct (parent, material) pairs = the floor batching could reach
    const per = M.monsters.slice(0, 4).map(m => { let n = 0; const par = new Set(), pm = new Set(), batched = []; m.g.traverse(o => { if (o.isMesh && vis(o)) { n++; par.add(o.parent.uuid); pm.add(o.parent.uuid + o.material.uuid); if (o.userData._trollBatch) batched.push(o.userData._trollBatch); } }); return { type: m.typeId, meshes: n, parents: par.size, parentMat: pm.size, batched }; });

    return { gfx: document.querySelector('.gfxbtn.on') ? document.querySelector('.gfxbtn.on').dataset.gfx : '?', bloomOn: M.bloomOn,
      monsters: M.monsters.length, passes, totalCalls: passes.reduce((s, p) => s + p.calls, 0), visible: cat,
      per, shadowMap: r.shadowMap.enabled, shadowAuto: r.shadowMap.autoUpdate };
  });
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); server.close(); }
