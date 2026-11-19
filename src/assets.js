// Generated 3D props (see src/assets/props/README.md). In the single-file build Vite inlines
// them as data: URLs; the game (src/game/07-troll-idol.js) reads them from window.GAME_ASSETS.
import trollIdol from './assets/props/troll_idol.glb?url';
import fireBurst from './assets/vfx/fire_burst.webp?url';   // Blender flipbooks (tools/vfx)
import smokePuff from './assets/vfx/smoke_puff.webp?url';
import poisonPool from './assets/vfx/poison_pool.webp?url';
import dustPoof from './assets/vfx/dust_poof.webp?url';
import zapBurst from './assets/vfx/zap_burst.webp?url';

// Generated sound effects (see src/assets/sfx/README.md): every src/assets/sfx/<name>[_<n>].mp3,
// imported with ?url and grouped by name -> { hit: [url, url, url], growl: [...], ... }.
// The AUD object (src/game/20-audio-input.js) decodes them after the first user gesture.
const sfxFiles = import.meta.glob('./assets/sfx/*.mp3', { query: '?url', import: 'default', eager: true });
const sfx = {};
for (const file of Object.keys(sfxFiles).sort()) {
  const name = file.replace(/^.*\//, '').replace(/\.mp3$/, '').replace(/_\d+$/, '');
  (sfx[name] || (sfx[name] = [])).push(sfxFiles[file]);
}

window.GAME_ASSETS = { trollIdol, fireBurst, smokePuff, poisonPool, dustPoof, zapBurst, sfx };
