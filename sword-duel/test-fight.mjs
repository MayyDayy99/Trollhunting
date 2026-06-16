// Gyors füstteszt: a VALÓDI game.js + collision.js végighajtása kamera nélkül.
// WAITING -> COUNTDOWN -> FIGHTING -> találatok -> KO. Bármilyen kivételt elkap.
// (A pengeváltás hegy-hegy alapú, ezért a hegyeket egymástól távol tartjuk, hogy
//  a támadás találatként és ne blokként regisztrálódjon.)
import * as THREE from 'three';
import { Game } from './src/game.js';
import { P1, P2, STATE } from './src/config.js';

function sword(gx, gy, dirx, diry, speed, present = true) {
  const guard = new THREE.Vector3(gx, gy, 0);
  const dir = new THREE.Vector3(dirx, diry, 0).normalize();
  const tip = guard.clone().addScaledVector(dir, 3.0); // BLADE_LEN
  return { guard, tip, dir, speed, present, visible: present };
}

const dt = 1 / 30;

function runMatch(label, p1of, p2of) {
  const game = new Game();
  let t = 0, last = null;
  const tr = [];
  const step = (a, b) => {
    t += dt;
    const gs = game.update({ [P1]: a, [P2]: b }, dt, t);
    if (gs.state !== last) {
      tr.push(`  ${t.toFixed(2)}s -> ${gs.state}` + (gs.reason ? ` (${gs.reason}, winner=${gs.winner})` : ''));
      last = gs.state;
    }
    return gs;
  };

  // kalibráció + countdown: mindkét kéz nyugton, jelen
  let fighting = false;
  for (let i = 0; i < 200 && !fighting; i++) {
    if (step(sword(-2, 0, 1, 0, 0), sword(2, 0, -1, 0, 0)).state === STATE.FIGHTING) fighting = true;
  }
  if (!fighting) throw new Error(`[${label}] nem ért el FIGHTING-ot`);

  // harc
  let ended = null;
  for (let i = 0; i < 4000 && !ended; i++) {
    const gs = step(p1of(), p2of());
    if (gs.state === STATE.VICTORY) ended = gs;
  }
  console.log(`=== ${label} ===`);
  tr.forEach((x) => console.log(x));
  if (!ended) throw new Error(`[${label}] nem lett vége (találat nem regisztrált?)`);
  console.log(`  EREDMÉNY: reason=${ended.reason} winner=${ended.winner} P1hp=${ended[P1].hp} P2hp=${ended[P2].hp}\n`);
  return ended;
}

try {
  // 1) P1 támad, P2 áll -> P1 győz (találatok regisztrálnak, KO)
  const m1 = runMatch('1. menet: P1 támad', () => sword(-1, 0.5, 1, 0, 12), () => sword(2, 0, 0, -1, 0));
  if (m1.winner !== P1) throw new Error('Várt győztes P1 volt, de: ' + m1.winner);

  // 2) kölcsönös támadás (a dupla-KO ág és a szimmetria próbája)
  runMatch('2. menet: kölcsönös', () => sword(-1, 0.5, 1, 0, 12), () => sword(2, -0.5, -1, 0, 12));

  console.log('✅ NINCS KIVÉTEL, és a TALÁLATOK REGISZTRÁLNAK — a harc-logika rendben.');
} catch (e) {
  console.error('\n❌ HIBA:\n', e);
  process.exit(1);
}
