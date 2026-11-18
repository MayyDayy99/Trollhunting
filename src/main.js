// Entry point. The import order IS the start-up order (it matches the old <script> order):
//   1. three.js r128 + post-processing add-ons -> window.THREE
//   2. procedural troll generator               -> window.TrollGen
//   3. the game (one shared scope built from src/game/*.js, see src/game/README.md)
//   4. co-op client loader (only does anything when served by mp-server with ?room=CODE)
import './three-setup.js';
import 'virtual:trollgen';
import 'virtual:game';
import './coop-loader.js';
