import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { concatModules, stripDevOnly } from './build/concat-modules.js';

// numbers shared with the co-op server, visible to the game code as `SHARED`
const sharedConfig = JSON.stringify(fileURLToPath(new URL('./src/shared/config.js', import.meta.url)).replace(/\\/g, '/'));

// `npm run dev`   -> http://localhost:5175/mohas-roham.html (source maps point at src/**)
// `npm run build` -> dist/mohas-roham.html, ONE self-contained file (JS + CSS inlined),
//                    published to GitHub Pages and copied into the co-op server image.
export default defineConfig({
  plugins: [
    concatModules({
      'virtual:trollgen': { dir: 'src/trollgen', header: 'const global = window;\n' },
      'virtual:game': { dir: 'src/game', header: `import * as SHARED from ${sharedConfig};\n` },
    }),
    stripDevOnly(),
    viteSingleFile(),
  ],
  server: { port: 5175, strictPort: true },
  preview: { port: 5176, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: { input: 'mohas-roham.html' },
  },
});
