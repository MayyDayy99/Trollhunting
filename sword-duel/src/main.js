// ============================================================================
// main.js — belépő. Összeköti a modulokat, kezeli a belépő képernyőt, a
// secure-context ellenőrzést, és futtatja az egyetlen render-ciklust.
// ============================================================================

import { GameScene } from './scene.js';
import { HandTracking } from './handTracking.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { AudioManager } from './audio.js';
import { P1, P2, STATE } from './config.js';

const canvas = document.getElementById('gl');
const video = document.getElementById('cam');
const startScreen = document.getElementById('start');
const startBtn = document.getElementById('startBtn');
const startMsg = document.getElementById('startMsg');
const loading = document.getElementById('loading');
const errEl = document.getElementById('err');
const dbgEl = document.getElementById('dbg');

// ?mock az URL-ben: szintetikus kezek kamera nélkül (renderelés/feel teszt)
const MOCK = location.search.includes('mock');

// minden hiba látszódjon (ne csak némán fagyjon le a játék)
function showErr(msg) {
  if (!errEl) return;
  errEl.style.display = 'block';
  errEl.textContent = '⚠ ' + msg;
}
window.addEventListener('error', (e) => showErr((e.error && e.error.stack) || e.message));
window.addEventListener('unhandledrejection', (e) => showErr('Promise: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));

// 'D' = debug overlay ki/be (DIAGNÓZIS: most alapból BE van kapcsolva)
let debugOn = true;
if (dbgEl) dbgEl.style.display = 'block';
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'd') { debugOn = !debugOn; dbgEl.style.display = debugOn ? 'block' : 'none'; } });

const scene = new GameScene(canvas);
const ui = new UI();
const game = new Game();
const audio = new AudioManager();
const tracking = new HandTracking();

window.addEventListener('resize', () => scene.resize());

function checkSecure() {
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    startMsg.innerHTML =
      '⚠️ A kamera csak <b>HTTPS</b>-en vagy <b>localhost</b>-on érhető el.<br>' +
      'Nyisd meg így: <code>https://&lt;cím&gt;</code> vagy <code>http://localhost</code>.';
    startBtn.disabled = true;
    return false;
  }
  return true;
}

let started = false;
async function start() {
  if (started) return;
  audio.unlock(); // user-gesztusból
  if (!MOCK) {
    if (!checkSecure()) return;
    startBtn.disabled = true;
    loading.style.display = 'block';
    loading.textContent = 'Kamera és kéz-modell betöltése…';
    try {
      await tracking.init(video);
    } catch (e) {
      loading.style.display = 'none';
      startBtn.disabled = false;
      startMsg.innerHTML =
        '❌ Nem indult a kamera/modell:<br><code>' +
        (e && e.message ? e.message : String(e)) +
        '</code><br>Engedélyezd a kamerát, majd próbáld újra.';
      return;
    }
  }
  started = true;
  startScreen.style.display = 'none';
  prevMs = performance.now();
  requestAnimationFrame(loop);
}
startBtn.addEventListener('click', start);
checkSecure();

function mockHands(ts) {
  const a = ts * 1.6;
  const mk = (cx, dirx) => {
    const wx = cx + Math.sin(a) * 0.12;
    const wy = Math.sin(a * 2.1) * 0.25;
    return {
      wrist: { x: wx, y: wy },
      indexTip: { x: wx + dirx * 0.28, y: wy + 0.12 },
      present: true, visible: true, score: 1, justAcquired: false,
    };
  };
  return { rawCount: 2, [P1]: mk(-0.35, 1), [P2]: mk(0.35, -1) };
}

let lastWhoosh = 0;
function audioCues(gs, swords, nowSec) {
  for (const ev of gs.events) {
    if (ev.type === 'clash') audio.clash();
    else if (ev.type === 'hit') audio.hit(Math.min(1.5, ev.damage / 18));
    else if (ev.type === 'countTick') audio.tick(ev.n);
    else if (ev.type === 'fightStart') audio.fightStart();
    else if (ev.type === 'victory') audio.victory();
  }
  if (gs.state === STATE.FIGHTING) {
    const sp = Math.max(swords[P1].speed, swords[P2].speed);
    if (sp > 11 && nowSec - lastWhoosh > 0.22) { audio.whoosh(sp); lastWhoosh = nowSec; }
  }
}

let prevMs = performance.now();
async function loop() {
  // A teljes test try/catch-ben: egy hibás frame NE ölje meg a ciklust.
  try {
    const now = performance.now();
    let dt = (now - prevMs) / 1000;
    prevMs = now;
    dt = Math.min(dt, 0.05); // frame-tüske ellen
    const nowSec = now / 1000;

    const trk = MOCK ? mockHands(nowSec) : await tracking.update(now);
    const swords = scene.updateSwords(trk, dt, nowSec);
    const gs = game.update(swords, dt, nowSec);

    scene.applyEvents(gs);
    audioCues(gs, swords, nowSec);
    ui.render(gs, dt);
    scene.render(dt);

    // a kamera-előnézet a harc alatt halványan látszik (lássák, követi-e a kezük)
    video.style.opacity = gs.state === STATE.FIGHTING || gs.state === STATE.ROUND_OVER ? '0.3' : '0.8';

    if (debugOn) {
      const g1 = swords[P1].guard, g2 = swords[P2].guard;
      const vid = tracking.video ? `${tracking.video.videoWidth}x${tracking.video.videoHeight}` : 'n/a';
      const kp = tracking.dbgKp;
      const kpStr = kp ? `keys=${kp.keys} x=${kp.x} y=${kp.y}` : 'none';
      dbgEl.textContent =
        `state=${gs.state} t=${gs.timer.toFixed(1)} KEZEK=${trk.rawCount} det=${tracking.ready} vid=${vid} halfW=${scene.view.halfW.toFixed(1)}\n` +
        `P1 pres=${swords[P1].present} vis=${swords[P1].visible} sp=${swords[P1].speed.toFixed(1)} g=(${g1.x.toFixed(1)},${g1.y.toFixed(1)}) hp=${gs[P1].hp}\n` +
        `P2 pres=${swords[P2].present} vis=${swords[P2].visible} sp=${swords[P2].speed.toFixed(1)} g=(${g2.x.toFixed(1)},${g2.y.toFixed(1)}) hp=${gs[P2].hp}\n` +
        `kp0 ${kpStr}`;
    }
  } catch (e) {
    showErr((e && e.stack) || String(e));
    console.error('[loop]', e);
  }
  requestAnimationFrame(loop); // MINDIG újraütemez, hibától függetlenül
}

if (MOCK) {
  // diagnosztika: kézi léptetés rAF nélkül (rejtett tab / headless teszthez)
  window.__sd = {
    step(ts, dt = 1 / 30) {
      const trk = mockHands(ts);
      const swords = scene.updateSwords(trk, dt, ts);
      const gs = game.update(swords, dt, ts);
      scene.applyEvents(gs);
      ui.render(gs, dt);
      scene.render(dt);
      return { state: gs.state, p1: swords[P1], p2: swords[P2] };
    },
    scene, game, ui, mockHands,
  };
  start(); // ?mock: azonnal indul kamera nélkül (minden deklaráció után)
}
