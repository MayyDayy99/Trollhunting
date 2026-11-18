// The production build must stay ONE self-contained HTML file: GitHub Pages publishes it as
// index.html and the co-op server image serves it next to net-client.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import * as acorn from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('vite build emits a single self-contained mohas-roham.html', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trollhunting-build-'));
  try {
    await build({ root, configFile: path.join(root, 'vite.config.js'), logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    assert.deepEqual(fs.readdirSync(outDir), ['mohas-roham.html'], 'only the HTML file is emitted');
    const html = fs.readFileSync(path.join(outDir, 'mohas-roham.html'), 'utf8');

    // nothing left to fetch except the Google Fonts stylesheet (and net-client.js at runtime, co-op only)
    const external = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(external.filter(u => !/^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(u)), []);
    assert.doesNotMatch(html, /src\/main\.js|virtual:(game|trollgen)|<!--dev-only-->/);

    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1, 'one inline module script');
    assert.match(scripts[0][1], /type="module"/);
    acorn.parse(scripts[0][2], { ecmaVersion: 'latest', sourceType: 'module' });
    for (const marker of ['coop-net-ready', 'net-client.js', 'TrollGen', 'UnrealBloomPass'.length && 'luminosityHighPass'])
      assert.ok(html.includes(marker), `build contains ${marker}`);
    assert.match(html, /<style[^>]*>[\s\S]*#hpwrap[\s\S]*<\/style>/, 'game CSS is inlined');
    assert.match(html, /id="loading"/, 'markup is kept');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
