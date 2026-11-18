// Browser playthrough of the BUILT game (run `npm run build` first; E2E_DIR overrides the folder).
// Needs an installed Edge (Windows) or Chrome; set E2E_CHANNEL to pick another Playwright channel.
// Software WebGL (SwiftShader) is used by default so the result does not depend on the GPU;
// E2E_GPU=1 uses the real GPU for performance numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScenario } from './run-scenario.mjs';

const dir = process.env.E2E_DIR || 'dist';

test('scripted playthrough: no errors, no shader compiles after warm-up, no runaway allocations', { timeout: 30 * 60 * 1000 }, async () => {
  assert.ok(fs.existsSync(path.join(dir, 'mohas-roham.html')), `${dir}/mohas-roham.html missing (npm run build)`);
  const res = await runScenario({ dir, gpu: process.env.E2E_GPU === '1', log: s => process.stdout.write(`# ${s}\n`) });
  if (process.env.E2E_JSON) fs.writeFileSync(process.env.E2E_JSON, JSON.stringify(res, null, 2));

  assert.deepEqual(res.errors, [], 'page errors / console errors / failed requests');
  for (const p of res.phases) assert.equal(p.loopErr, null, `game loop error in ${p.phase}`);
  assert.equal(res.runtimePrograms, 0,
    'shaders compiled after the warm-up (each is a visible hitch): ' + JSON.stringify(res.phases.flatMap(p => p.compiles.map(c => ({ phase: p.phase, ...c })))));
  const boss = res.phases.find(p => p.phase.startsWith('boss-spawn'));
  assert.ok(boss && boss.monsters > 0, 'the boss wave spawned trolls');
  const last = res.phases[res.phases.length - 1];
  assert.ok(last.geometries - res.afterWarmup.geometries < 400, `geometry count keeps growing (${res.afterWarmup.geometries} -> ${last.geometries})`);
});
