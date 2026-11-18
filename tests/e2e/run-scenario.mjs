// Scripted browser playthrough + performance probe for Troll Hunting.
//
// Serves a directory over HTTP, opens mohas-roham.html#dev in a headless Chromium-family browser
// (installed Edge on Windows, Chrome elsewhere; override with E2E_CHANNEL), waits for the
// shader warm-up, starts a run and then drives the game frame by frame through the `#dev` hook
// (window.__MR + window.__mrHold): waves, every element, shop purchases, Elemental Awakening
// spells, freezes, kills, the Troll King's attacks, VIHAR, dash and melee.
//
// It records page errors, console errors and per-phase metrics:
//   - update() CPU time and renderFrame() time per frame,
//   - shader programs compiled AFTER the warm-up (each one is a visible hitch on a real GPU),
//   - geometry/texture counts (growth = allocations that never get reused).
//
// CLI:  node tests/e2e/run-scenario.mjs [--dir dist] [--json out.json] [--gpu]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

export function serveDir(dir) {
  const base = path.resolve(ROOT, dir);
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'mohas-roham.html';
    const file = path.resolve(base, rel);
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

const PHASES = [
  // [name, frames, setup run in the page before the frames]
  ['wave1', 240, M => {}],
  ['arrows-per-element', 0, M => {}],          // handled specially below (draw + release per element)
  ['status-and-zones', 180, M => {
    const els = ['fire', 'ice', 'poison', 'lightning'];
    M.monsters.forEach((m, i) => { if (m.alive !== false) { M.applyStatus(m, els[i % 4], 1, 3); M.elementalImpact(m.g.position, els[i % 4], true); } });
    for (const k of ['gas', 'fire', 'frost', 'steam', 'puddle']) M.spawnZone(k, M.player.pos.x + 4, M.player.pos.z - 6, {});
  }],
  ['freeze-and-kill', 180, M => {
    const live = M.monsters.filter(m => m.hp > 0);
    if (live[0]) M.freezeFull(live[0]);
    if (live[1]) M.freezeEncase(live[1]);
    live.slice(2).forEach(m => M.killMonster(m, true));
  }],
  ['shop', 30, M => {
    M.startWave(15); M.addScore(30000); M.openShop();
    for (const b of ['bone', 'moss', 'rune']) M.buyBow(b);
    for (let i = 0; i < 3; i++) M.buyUpgrade('awakening');
    M.closeShop(false);
  }],
  ['spells', 0, M => {}],                      // handled specially (cast each element when ready)
  ['vihar-dash-melee', 240, M => { M.gainUlt(100); M.fireVihar(); M.tryDash(); M.meleeSwing(); }],
  ['boss-wave', 0, M => {}],                   // handled specially (spawn boss + each attack)
  ['cleanup-kill-all', 180, M => { M.monsters.filter(m => m.hp > 0).forEach(m => M.killMonster(m, false)); }],
];

// Runs inside the page: step the game manually and collect timings.
function pageStep({ n, phase, renderEvery }) {
  const M = window.__MR, E = window.__E2E, ri = M.renderer.info;
  const out = { phase, frames: 0, upd: [], ren: [], compiles: [] };
  for (let i = 0; i < n; i++) {
    E.t += 1 / 60;
    M.player.hp = Math.max(M.player.hp, M.player.maxHp * 0.6); M.player.alive = true;   // keep the run going
    const a = performance.now(); M.update(1 / 60, E.t); const b = performance.now();
    out.upd.push(b - a);
    if (!out.worst || b - a > out.worst.ms) out.worst = { frame: i, ms: +(b - a).toFixed(1) };
    if (i % renderEvery === 0) {
      const p0 = ri.programs.length; M.renderFrame(); const c = performance.now();
      out.ren.push(c - b);
      if (ri.programs.length > p0) out.compiles.push({ frame: i, ms: +(c - b).toFixed(1),
        programs: ri.programs.slice(p0).map(p => p.name + ' ' + String(p.cacheKey).slice(0, 160)) });
    }
    out.frames++;
  }
  const s = arr => arr.length ? { max: +Math.max(...arr).toFixed(2), avg: +(arr.reduce((x, y) => x + y, 0) / arr.length).toFixed(2),
    p95: +[...arr].sort((x, y) => x - y)[Math.floor(arr.length * 0.95)].toFixed(2) } : null;
  return { phase, frames: out.frames, worstUpdate: out.worst || null, update: s(out.upd), render: s(out.ren), compiles: out.compiles,
    programs: ri.programs.length, geometries: ri.memory.geometries, textures: ri.memory.textures,
    monsters: M.monsters.length, wave: M.wave, running: M.running, loopErr: window.__loopErr || null };
}

// Collapse a CDP CPU profile into the most expensive functions (self time and inclusive time).
function summariseProfile(profile) {
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const hits = new Map(); profile.samples.forEach((id, i) => hits.set(id, (hits.get(id) || 0) + (profile.timeDeltas[i] || 0)));
  const key = n => `${n.callFrame.functionName || '(anon)'}@${n.callFrame.lineNumber + 1}`;
  const self = new Map(), total = new Map();
  for (const [id, us] of hits) {
    const n = byId.get(id); self.set(key(n), (self.get(key(n)) || 0) + us);
    const seen = new Set();
    for (let cur = id; cur != null; cur = parent.get(cur)) { const k = key(byId.get(cur)); if (!seen.has(k)) { seen.add(k); total.set(k, (total.get(k) || 0) + us); } }
  }
  const top = m => [...m].filter(([k]) => !/^\((program|idle|root|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 25)
    .map(([k, us]) => { const [fn, line] = k.split('@'); return { fn, line: +line, ms: +(us / 1000).toFixed(1) }; });
  const gc = [...self].filter(([k]) => k.startsWith('(garbage collector)')).reduce((s, [, us]) => s + us, 0);
  return { self: top(self), total: top(total), gcMs: +(gc / 1000).toFixed(1) };
}

export async function runScenario({ dir = 'dist', gpu = false, width = 640, height = 360, renderEvery = 1, profile = [], log = () => {} } = {}) {
  const { server, port } = await serveDir(dir);
  const channel = process.env.E2E_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chrome');
  const args = gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const browser = await chromium.launch({ channel, headless: true, args: [...args, '--autoplay-policy=no-user-gesture-required'] });
  const errors = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
    // net-client.js (co-op) only exists when mp-server serves the game; favicon.ico does not exist at all
    page.on('response', r => { if (r.status() >= 400 && !/\/(favicon\.ico|net-client\.js)$/.test(new URL(r.url()).pathname)) failed.push(`http ${r.status()} ${r.url()}`); });
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      if (/^Failed to load resource/.test(msg.text())) return;   // real failures are collected from responses above
      errors.push('console: ' + msg.text());
    });
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${port}/mohas-roham.html#dev`);
    await page.waitForFunction(() => window.__MR && document.getElementById('loading').classList.contains('hide'), null, { timeout: 180000 });
    const warmupMs = Date.now() - t0;
    const afterWarmup = await page.evaluate(() => { const i = window.__MR.renderer.info; return { programs: i.programs.length, geometries: i.memory.geometries, textures: i.memory.textures, bloomOn: window.__MR.bloomOn }; });
    log(`warm-up ${warmupMs} ms, ${afterWarmup.programs} programs`);

    await page.click('#startBtn');
    await page.evaluate(() => { window.__mrHold = true; window.__E2E = { t: 100 }; });
    const phases = [];
    // optional CPU profile of chosen phases (prefix match), summarised as self / total time per function
    const cdp = profile.length ? await page.context().newCDPSession(page) : null;
    if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); }
    const step = async (n, name) => {
      const prof = cdp && profile.some(p => name.startsWith(p));
      if (prof) await cdp.send('Profiler.start');
      const r = await page.evaluate(pageStep, { n, phase: name, renderEvery });
      if (prof) r.cpu = summariseProfile((await cdp.send('Profiler.stop')).profile);
      phases.push(r);
      log(`${name}: ${JSON.stringify({ upd: r.update, worst: r.worstUpdate, ren: r.render, programs: r.programs, compiles: r.compiles })}`);
      if (r.cpu) log('  cpu self: ' + r.cpu.self.slice(0, 12).map(f => `${f.fn}@${f.line} ${f.ms}ms`).join(', ') + '\n  cpu total: ' + r.cpu.total.slice(0, 14).map(f => `${f.fn}@${f.line} ${f.ms}ms`).join(', '));
      return r;
    };

    for (const [name, frames, setup] of PHASES) {
      if (name === 'arrows-per-element') {
        for (const el of ['fire', 'ice', 'poison', 'lightning']) {
          await page.evaluate(e => { window.__MR.setElement(e); window.__MR.startDraw(); }, el);
          await step(70, `draw-${el}`);
          await page.evaluate(() => window.__MR.releaseDraw());
          await step(50, `release-${el}`);
        }
        continue;
      }
      if (name === 'spells') {
        for (const el of ['fire', 'ice', 'poison', 'lightning']) {
          const cast = await page.evaluate(e => { const M = window.__MR; M.setElement(e); return M.castElementSpell(M.RUNM.drawCap); }, el);
          await step(170, `spell-${el}${cast ? '' : '(not-ready)'}`);
        }
        continue;
      }
      if (name === 'boss-wave') {
        // clearing the field can end the wave and open the Forge (which pauses the run) -> close it, then start wave 10
        await page.evaluate(() => { const M = window.__MR; M.monsters.forEach(m => M.killMonster(m, false)); });
        await step(30, 'wave-clear');
        // a full field (split shards) can hold back spawning, so the Troll King is spawned directly
        await page.evaluate(() => { const M = window.__MR; if (!M.running) M.closeShop(false); M.startWave(10); M.spawnMonster(); });
        await step(240, 'boss-spawn');
        for (const kind of ['slam', 'charge', 'rocks', 'roots']) {
          const ok = await page.evaluate(k => { const M = window.__MR, b = M.monsters.find(m => m.boss && m.hp > 0); if (!b) return false; M.beginBossAttack(b, k); return true; }, kind);
          await step(150, `boss-${kind}${ok ? '' : '(no-boss)'}`);
        }
        continue;
      }
      await page.evaluate(`(${setup.toString()})(window.__MR)`);
      await step(frames, name);
    }
    const end = phases[phases.length - 1];
    return { dir, channel, gpu, viewport: { width, height }, warmupMs, afterWarmup, phases,
      runtimePrograms: end.programs - afterWarmup.programs, errors: [...errors, ...failed],
      gpuRenderer: await page.evaluate(() => { const gl = window.__MR.renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }) };
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const res = await runScenario({ dir: arg('--dir') || 'dist', gpu: process.argv.includes('--gpu'),
    width: +(arg('--width') || 640), height: +(arg('--height') || 360),
    profile: (arg('--profile') || '').split(',').filter(Boolean), log: s => console.log(s) });
  const json = arg('--json');
  if (json) fs.writeFileSync(json, JSON.stringify(res, null, 2));
  console.log(`runtime shader programs after warm-up: ${res.runtimePrograms}; errors: ${res.errors.length}`);
  for (const e of res.errors) console.log('  ' + e.slice(0, 300));
}
