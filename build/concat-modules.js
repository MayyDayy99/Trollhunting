// Vite plugin: serve a directory of ordered source fragments as ONE ES module.
//
// The game core used to be a single 6800-line IIFE whose ~300 functions, ~300 constants and 60
// mutable variables all share one scope and initialise top to bottom. Splitting it into real ES
// modules would make the import graph decide the evaluation order (and forward imports would
// break it), so instead each folder is concatenated, in file-name order, into one virtual module:
// the code text and its semantics stay exactly what they were, but every area lives in its own file.
//
//   import 'virtual:game'      -> src/game/*.js     (00-core.js, 01-settings-stats.js, ...)
//   import 'virtual:trollgen'  -> src/trollgen/*.js (behind `const global = window;`)
//
// A source map points every line back to its fragment file, and each fragment is watched, so
// `npm run dev` reloads on edits and the browser devtools show the real file names.
import fs from 'node:fs';
import path from 'node:path';
import MagicString, { Bundle } from 'magic-string';

export function listFragments(dir) {
  return fs.readdirSync(dir).filter(f => /^\d\d-.+\.js$/.test(f)).sort().map(f => path.join(dir, f));
}

export function concatModules(modules) {
  const PREFIX = '\0';
  return {
    name: 'concat-modules',
    enforce: 'pre',
    resolveId(id) {
      if (Object.hasOwn(modules, id)) return PREFIX + id;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const cfg = modules[id.slice(PREFIX.length)];
      if (!cfg) return null;
      const bundle = new Bundle({ separator: '' });
      for (const file of listFragments(path.resolve(cfg.dir))) {
        this.addWatchFile(file);
        bundle.addSource({ filename: file, content: new MagicString(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')) });
      }
      if (cfg.header) bundle.prepend(cfg.header);
      return { code: bundle.toString(), map: bundle.generateMap({ hires: true, includeContent: true }) };
    },
  };
}

// Removes <!--dev-only-->...<!--/dev-only--> blocks from the HTML entry in production builds.
export function stripDevOnly() {
  return {
    name: 'strip-dev-only',
    apply: 'build',
    transformIndexHtml: { order: 'pre', handler: html => html.replace(/<!--dev-only-->[\s\S]*?<!--\/dev-only-->\n?/g, '') },
  };
}
