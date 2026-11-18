// Headless check: open the built game (#dev), click to unlock audio, then wait until AUD.status()
// reports every sound decoded. Also decodes every GAME_ASSETS.sfx URL with an OfflineAudioContext
// to report duration, peak and onset as the browser sees them, and calls every AUD method once.
//   npm run build && node tools/sfx/check-decode.mjs .
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = path.resolve(process.argv[2]);
const { chromium } = await import(pathToFileURL(path.join(repo, 'node_modules/playwright-core/index.mjs')).href);
const { serveDir } = await import(pathToFileURL(path.join(repo, 'tests/e2e/run-scenario.mjs')).href);

const { server, port } = await serveDir('dist');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });   // favicon / net-client.js 404s, as in the e2e test
  await page.goto(`http://127.0.0.1:${port}/mohas-roham.html#dev`);
  await page.waitForFunction(() => window.__MR && document.getElementById('loading').classList.contains('hide'), null, { timeout: 180000 });
  await page.mouse.click(10, 10);                                   // a real user gesture
  const before = await page.evaluate(() => window.__MR.AUD.status());
  await page.evaluate(() => window.__MR.AUD.unlock());
  await page.waitForFunction(() => { const s = window.__MR.AUD.status(); return Object.keys(s).length && Object.values(s).every(Boolean); }, null, { timeout: 30000 }).catch(() => {});
  const status = await page.evaluate(() => window.__MR.AUD.status());
  const files = await page.evaluate(async () => {
    const out = {};
    for (const [name, urls] of Object.entries(window.GAME_ASSETS.sfx)) {
      out[name] = [];
      for (const u of urls) {
        const ab = await (await fetch(u)).arrayBuffer(), bytes = ab.byteLength;
        const ctx = new OfflineAudioContext(1, 44100, 44100);
        const b = await ctx.decodeAudioData(ab);
        const d = b.getChannelData(0); let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v));
        let on = 0; while (on < d.length && Math.abs(d[on]) < peak * 0.1) on++;
        out[name].push({ dataUrl: u.startsWith('data:audio/mpeg'), bytes, dur: +b.duration.toFixed(3), sr: b.sampleRate,
          peakDb: +(20 * Math.log10(peak)).toFixed(2), onsetMs: +(on / b.sampleRate * 1000).toFixed(1) });
      }
    }
    return out;
  });
  // every AUD method once (sample path), then the synth-only ones; must not throw
  const calls = await page.evaluate(() => { const A = window.__MR.AUD, r = [];
    const run = (n, ...a) => { try { A[n](...a); r.push(n + ':ok'); } catch (e) { r.push(n + ':' + e.message); } };
    for (const n of ['perfect', 'dashS', 'storm', 'slam', 'zap', 'bowDraw', 'bowStop', 'whoosh', 'rasp', 'tap', 'nock', 'heal', 'hit', 'head', 'growl', 'growl', 'die', 'hurt', 'wave', 'over']) run(n);
    run('combo', 3); run('twang', 0.5); run('twang', 1.75); for (const el of ['fire', 'ice', 'poison', 'lightning']) { run('spell', el, 2); run('hitEl', el, 1); }
    A.setVol(0.2); return r; });
  console.log(JSON.stringify({ before, status, allDecoded: Object.values(status).every(Boolean), files, calls, errors }, null, 1));
} finally { await browser.close(); server.close(); }
