// Entry point. The import order IS the start-up order (it matches the old <script> order):
//   1. three.js r128 + post-processing add-ons -> window.THREE
//   2. generated 3D props (inlined GLB data URLs)  -> window.GAME_ASSETS
//   3. procedural troll generator               -> window.TrollGen
//   4. the game (one shared scope built from src/game/*.js, see src/game/README.md)
//   5. co-op client loader (only does anything when served by mp-server with ?room=CODE)
import './three-setup.js';
import './assets.js';
import 'virtual:trollgen';
import 'virtual:game';
import './coop-loader.js';
