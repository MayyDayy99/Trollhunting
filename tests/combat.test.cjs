const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { between: cut } = require('./source.cjs');
const between = (start, end) => cut(start, end, 'combat');
class Vec {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  clone() { return new Vec(this.x, this.y, this.z); }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
}
class Mesh {
  position = new Vec();
  rotation = new Vec();
  scale = new Vec(1, 1, 1);
  constructor(geometry, material) { this.geometry = geometry; this.material = material; }
}
class Material {
  color = { setHex() {} };
  constructor(values) { Object.assign(this, values); this.color = { setHex() {} }; }
}
function harness() {
  const ctx = vm.createContext({
    THREE: { Vector3: Vec, Mesh, ConeGeometry: class {} },
    std: p => new Material(p), scene: { add() {} }, enableBloom() {},
    // The pooled shader VFX kit is presentation-only: every call is a no-op here.
    VFX: new Proxy({ PAL: {} }, { get: (t, k) => (k in t ? t[k] : () => null) }),
    FIREBURST: { spawn() {}, update() {}, reset() {} },   // the Blender flipbooks are presentation-only too
    POISONPOOL: { spawn() {}, update() {}, reset() {} }, poisonPool() {}, DUSTPOOF: { spawn() {}, update() {}, reset() {} }, ZAPBURST: { spawn() {}, update() {}, reset() {} },
    GROUND_Y: 0, SLAM_R: 9, SOLIDS: [], monsters: [], coop: false,
    player: { pos: new Vec(0, 1.7, 0), feet: 0, alive: true, witherT: 0 },
    camera: { position: new Vec(0, 1.7, 0), getWorldDirection: v => v.set(0, -0.1, -1) },
    STATUS_CFG: { fire: {}, poison: {} }, currentElement: 'fire', perfectShot: false,
    STATS: { hits: 0 }, AUD: {}, bowKick: 0, bowKickRot: 0, relTwang: 0,
    callout() {}, tr: p => p, buzz() {}, renderShop() {}, setHp() {},
    coopIsRemote: m => !!m.remote, absorbTell() {},
    elementMechanic: () => false, applyStatus: (m, el) => { m.statusEl = el; },
    killMonster: m => { m.alive = false; }, nearestTrolls: () => [],
    EFX: { bolt() {}, ring() {}, flash() {} }, RP: { spawn() {} }, SMK: { spawn() {} },
    EL: { fire: { glow: 0xff7a3d }, ice: { glow: 0xbfe6ff }, poison: { glow: 0x9fdc4a }, lightning: { glow: 0xb48cff } },
    rand: (min, max) => (min + max) / 2,
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    pushMob: (x, z) => ({ x, z }), meleeBase: () => 10,
    document: { querySelector: () => null },
    damagePlayerFrom: (m, d) => { ctx.damageTaken += d; }, damageTaken: 0,
  });
  vm.runInContext(between('let running=false, wave=0', 'function sightBlocked('), ctx);
  vm.runInContext(between('function sightBlocked(', 'function startWave('), ctx);
  vm.runInContext(between('const playerMotion=', 'function updateTurboHud('), ctx);
  vm.runInContext(between('function segDist(', 'function motionRig('), ctx);
  vm.runInContext(between('function tacticalHeading(', 'function trollAI('), ctx);
  vm.runInContext(between('function buyUpgrade(', 'function openShop('), ctx);
  vm.runInContext(`
    function dressBow() {}
    function addScore(n) { score+=n; }
    running=true; shopOpen=true; wave=15; score=20000; applyUpgrades();
    this.game={RUN,RUNM,spellEvents,bossHazards,playerMotion,ownedBows,
      get score(){return score},get bow(){return equippedBow},get cd(){return spellCd}};
  `, ctx);
  return ctx;
}
function boss() {
  const g = new Mesh();
  return { g, alive: true, boss: true, hp: 1000, maxHp: 1000, bodyR: 1.5, bodyCY: 2, bossPhase: 1 };
}

test('bows charge only on first purchase and equipping never stacks multipliers', () => {
  const c = harness(), g = c.game;
  assert.equal(c.buyBow('bone'), true);
  assert.equal(g.score, 19000);
  assert.equal(g.RUNM.dmgMul, 1.35);
  assert.equal(g.RUNM.pierce, 1);
  c.buyBow('starter'); c.buyBow('bone'); c.applyUpgrades();
  assert.equal(g.score, 19000);
  assert.equal(g.RUNM.dmgMul, 1.35);
  assert.equal(g.RUNM.pierce, 1);
  c.buyBow('moss');
  assert.equal(g.RUNM.multishotN, 1);
  assert.equal(g.RUNM.pierce, 0);
  assert.equal(g.RUNM.reloadMul, 0.72);
});

test('purchases enforce wave, wallet, shop and single-player gates', () => {
  const c = harness();
  vm.runInContext('wave=4', c);
  assert.equal(c.buyBow('bone'), false);
  assert.equal(c.buyUpgrade('awakening'), false);
  vm.runInContext('wave=5', c);
  assert.equal(c.buyUpgrade('awakening'), true);
  assert.equal(c.buyUpgrade('awakening'), false);
  vm.runInContext('wave=10', c);
  assert.equal(c.buyUpgrade('awakening'), true);
  assert.equal(c.buyUpgrade('awakening'), false);
  vm.runInContext('wave=15;score=0', c);
  assert.equal(c.buyBow('rune'), false);
  vm.runInContext('score=20000;shopOpen=false', c);
  assert.equal(c.buyBow('bone'), false);
  assert.equal(c.buyUpgrade('awakening'), false);
  vm.runInContext('shopOpen=true', c);
  c.coop = true;
  assert.equal(c.buyBow('bone'), false);
  assert.equal(c.buyUpgrade('awakening'), false);
});

test('full draw replaces arrows only with learned, ready single-player elemental spells', () => {
  const c = harness(), g = c.game;
  assert.equal(c.castElementSpell(1), false);
  g.RUN.awakening = 1;
  assert.equal(c.castElementSpell(0.7), false);
  c.currentElement = 'base';
  assert.equal(c.castElementSpell(1), false);
  c.currentElement = 'fire';
  c.coop = true;
  assert.equal(c.castElementSpell(1), false);
  c.coop = false;
  vm.runInContext('running=false', c);
  assert.equal(c.castElementSpell(1), false);
  vm.runInContext('running=true', c);
  assert.equal(c.castElementSpell(1), true);
  assert.equal(c.castElementSpell(1), false);
  assert.equal(g.cd, 6);
  assert.equal(g.spellEvents.length, 3);
  c.updateSpells(6);
  assert.equal(g.cd, 0);
  assert.equal(c.castElementSpell(1), true);
});

test('mastery expands actual attack shapes and poison pulses instead of just arrow damage', () => {
  const cast = (el, rank) => {
    const c = harness();
    c.currentElement = el; c.game.RUN.awakening = rank;
    c.castElementSpell(1);
    return c.game.spellEvents;
  };
  const fire1 = cast('fire', 1), fire3 = cast('fire', 3), ice2 = cast('ice', 2);
  assert.equal(fire1.length, 3);
  assert.equal(fire3.length, 15);
  assert.ok(fire3.some(e => e.x !== 0), 'third-tier flame wave has side lanes');
  assert.equal(ice2.length, 12);
  assert.ok(ice2.some(e => e.x > 0) && ice2.some(e => e.x < 0));
  assert.equal(cast('poison', 1).length, 4);
  assert.equal(cast('poison', 3).length, 6);
  assert.ok(cast('lightning', 3)[0].r > cast('lightning', 1)[0].r);
});

test('spell damage respects absorption, resistance, frozen vulnerability, recovery and remote authority', () => {
  const c = harness(), m = boss(), e = { el: 'fire', dmg: 100, rank: 1 };
  m.hp = 500; m.el = 'fire';
  c.hitWithSpell(m, e, 1);
  assert.equal(m.hp, 520);
  assert.equal(m.statusEl, undefined);
  m.el = 'ice'; m.resist = { fire: 0.5 }; m.frozenSolid = 1; m.bossState = { kind: 'recover' };
  c.hitWithSpell(m, e, 1);
  assert.equal(m.hp, 407.5);
  assert.equal(m.statusEl, 'fire');
  m.remote = true;
  c.hitWithSpell(m, e, 1);
  assert.equal(m.hp, 407.5);
});

test('overlapping eruption lanes damage each enemy once per cast and count one hit', () => {
  const c = harness(), m = boss(), counter = { hit: false }, shared = new Set();
  c.nearestTrolls = () => [m];
  const e = { el: 'fire', x: 0, z: 0, r: 3, rank: 3, dmg: 100, counter, shared };
  c.resolveSpell(e); c.resolveSpell({ ...e });
  assert.equal(m.hp, 900);
  assert.equal(c.STATS.hits, 1);
});

test('LOS respects cylinders, boxes, low obstacles and overhead openings', () => {
  const c = harness();
  c.SOLIDS.push({ kind: 'cyl', x: 0, z: -5, r: 1, bottom: 0, top: 4 });
  assert.equal(c.sightBlocked(0, 1, 0, 0, 1, -10), true);
  assert.equal(c.sightBlocked(3, 1, 0, 3, 1, -10), false);
  c.SOLIDS[0] = { kind: 'box', minX: -2, maxX: 2, minZ: -6, maxZ: -4, bottom: 3, abot: 3, top: 5 };
  assert.equal(c.sightBlocked(0, 1, 0, 0, 1, -10), false);
  assert.equal(c.sightBlocked(0, 4, 0, 0, 4, -10), true);
  c.SOLIDS[0].noArrow = true;
  assert.equal(c.sightBlocked(0, 4, 0, 0, 4, -10), false);
});

test('boss charge locks its direction, is dodgeable, and ends in a real recovery at different frame rates', () => {
  for (const fps of [30, 60, 120]) {
    const c = harness(), m = boss();
    c.player.pos.set(0, 1.7, -12);
    c.beginBossAttack(m, 'charge');
    const fx = m.bossState.fx, fz = m.bossState.fz;
    c.player.pos.set(15, 1.7, -12);
    for (let i = 0; i < fps * 3 && m.bossState.kind !== 'recover'; i++) c.bossTick(m, 1 / fps);
    assert.equal(fx, 0);
    assert.equal(fz, -1);
    assert.equal(m.bossState.kind, 'recover');
    assert.ok(Math.abs(m.g.position.z + 14) < 0.001);
    assert.equal(m.g.position.x, 0, 'must not home toward the moved player');
    assert.equal(c.damageTaken, 0);
    assert.equal(c.bossDamageMultiplier(m), 1.5);
  }
});

test('boss markers lock targets; slams allow jumping and death/freeze cancel hazards', () => {
  const c = harness(), m = boss();
  c.beginBossAttack(m, 'slam');
  c.player.feet = 0.8;
  c.updateBossHazards(1.11);
  assert.equal(c.damageTaken, 0);
  c.clearBossHazards();
  c.player.feet = 0;
  c.beginBossAttack(m, 'slam'); c.updateBossHazards(1.11);
  assert.equal(c.damageTaken, 15);
  c.clearBossHazards();
  c.player.pos.set(0, 1.7, -12); c.beginBossAttack(m, 'rocks');
  const positions = c.game.bossHazards.filter(h => h.active).map(h => h.x);
  c.player.pos.x = 20;
  assert.deepEqual(c.game.bossHazards.filter(h => h.active).map(h => h.x), positions);
  m.alive = false; c.updateBossHazards(2);
  assert.ok(c.game.bossHazards.every(h => !h.active));
  m.alive = true; c.beginBossAttack(m, 'slam'); m.frozenSolid = 1;
  c.bossTick(m, 0.1);
  assert.equal(m.bossState, null);
  assert.ok(c.game.bossHazards.every(h => !h.active));
});

test('tactical enemies flank on stable opposite sides and lead bounded player motion; co-op stays direct', () => {
  const c = harness(), a = boss(), b = boss();
  Object.assign(a, { typeId: 'grunt', seed: 1 });
  Object.assign(b, { typeId: 'grunt', seed: 2 });
  c.player.pos.set(0, 1.7, -12);
  const x = c.tacticalHeading(a, 0.1, 0, -12, 12);
  b.tactics = { side: -a.tactics.side, timer: 0 };
  const y = c.tacticalHeading(b, 0.1, 0, -12, 12);
  assert.ok(x.x * y.x < 0);
  c.samplePlayerVelocity(0.1);
  c.player.pos.x = 100;
  for (let i = 0; i < 10; i++) c.samplePlayerVelocity(0.1);
  assert.ok(c.game.playerMotion.x >= 0 && c.game.playerMotion.x <= 10);
  c.player.pos.x = 0;
  c.game.playerMotion.x = 8;
  Object.assign(b, { typeId: 'brute', tactics: undefined });
  assert.ok(c.tacticalHeading(b, 0.1, 0, -12, 12).x > 0, 'brute intercepts measured movement');
  c.coop = true;
  const direct = c.tacticalHeading(a, 0.1, 0, -12, 12);
  assert.equal(direct.x, 0); assert.equal(direct.z, -1);
});

test('later boss phases add area denial without removing close-range or long-range counters', () => {
  const c = harness(), m = boss();
  m.bossAttacks = 2;
  assert.equal(c.chooseBossAttack(m, 12), 'charge');
  m.hp = 600;
  assert.equal(c.chooseBossAttack(m, 12), 'roots');
  m.hp = 300;
  assert.equal(c.chooseBossAttack(m, 4), 'slam');
  m.bossAttacks = 1;
  assert.equal(c.chooseBossAttack(m, 30), 'rocks');
});

test('stunning boss preserves exhausted +50% window, prevents 0s recast, and keeps erupted roots alive', () => {
  const c = harness(), m = boss();
  m.bossCd = -0.01;
  m.bossState = { kind: 'recover', t: 0.2, duration: 1.7, fxAcc: 0 };
  m.rooted = 1.0;
  c.bossTick(m, 0.25);
  assert.equal(m.bossState && m.bossState.kind, 'recover', 'stun must not cancel vulnerable window');
  assert.equal(c.bossDamageMultiplier(m), 1.5);

  // Interrupting windup sets recovery cooldown instead of instant-chaining on unfreeze
  c.beginBossAttack(m, 'charge');
  m.bossCd = -0.01;
  m.rooted = 0.5;
  c.bossTick(m, 0.1);
  assert.equal(m.bossState, null);
  assert.ok(m.bossCd >= 1.0, 'interrupted windup must enforce cooldown');

  // Already-erupted roots remain active when boss is stunned, while pending windups cancel
  c.clearBossHazards();
  m.rooted = 0; m.frozenSolid = 0;
  c.beginBossAttack(m, 'roots');
  c.updateBossHazards(1.30); // roots erupt (delay <= 0)
  assert.ok(c.game.bossHazards.some(h => h.active && h.delay <= 0));
  m.rooted = 1.0;
  c.updateBossHazards(0.1);
  assert.ok(c.game.bossHazards.some(h => h.active), 'erupted ground thorns persist through brief stun');

  // Ranged tactical heading with clear LOS strafes tangentially without radial boundary creep
  const spitter = Object.assign(boss(), { typeId: 'spitter', seed: 3 });
  const h = c.tacticalHeading(spitter, 0.1, 0, -12, 12);
  assert.ok(Math.abs(h.z) < 1e-6 && Math.abs(Math.abs(h.x) - 1) < 1e-6);
});
