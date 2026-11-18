const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { root, trollgen, game, between: cut } = require('./source.cjs');
const between = (start, end) => cut(start, end, 'animation');

class Transform {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  setScalar(v) { return this.set(v, v, v); }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Transform(this.x, this.y, this.z); }
}
class Joint {
  position = new Transform();
  rotation = new Transform();
  scale = new Transform(1, 1, 1);
  userData = {};
}
const ctx = vm.createContext({
  THREE: { Object3D: Joint },
  lerp: (a, b, t) => a + (b - a) * t,
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
});
// Execute the shipped clips and game adapter, not a second implementation.
vm.runInContext(between('const easeOutCubic = t =>', '/* ---------------------------------------------------------- kombinatorika'),
  ctx);
vm.runInContext('this.TrollGen = { anim };', ctx);
vm.runInContext(between('function motionRig(m)', 'const ATK = {\n  gruntSmash'), ctx);
vm.runInContext(between('function fxSteps(owner', 'const trailPoint='), ctx);

function monster(caste = 'grunt', weapon = 'club') {
  const pair = () => ({ L: new Joint(), R: new Joint() });
  const gen = {
    g: new Joint(), pelvis: new Joint(), torso: new Joint(), head: new Joint(), jaw: new Joint(),
    legs: pair(), knees: pair(), ankles: pair(), arms: pair(), elbows: pair(), fists: pair(),
    genome: { caste, weapon, atk: 'overhead', lean: 0.1, asym: 0.1, torsoW: 1, wraith: caste === 'wisp' },
  };
  gen.pelvis.position.y = 0.95;
  gen.torso.position.y = 1.3;
  return Object.assign({}, gen, {
    gen, typeId: caste, type: {}, seed: 42, hp: 100, maxHp: 100, speed: 2, scale: 1,
    walkPhase: 0, atkPhase: 0, atkT: 0, atkDur: 1,
  });
}
function walk(fps, speed = 2) {
  const m = monster();
  ctx.motionRig(m);
  for (let i = 0; i < fps * 2; i++) {
    m.g.position.z += speed / fps;
    ctx.animateMonster(m, 1 / fps);
  }
  return m;
}

test('gait follows travelled distance at 30, 60 and 120 fps, including reverse and slow movement', () => {
  for (const fps of [30, 60, 120]) {
    const m = walk(fps);
    assert.ok(Math.abs(m._motion.phase - 12.4) < 1e-8);
    assert.ok(Math.abs(m.g.position.z - 4) < 1e-8, 'clip must not overwrite world position');
    assert.ok(Math.abs(m.knees.L.rotation.x - walk(60).knees.L.rotation.x) < 0.08);
    assert.ok(Math.abs(walk(fps, 0.5)._motion.phase - 3.1) < 1e-8);
    assert.ok(Math.abs(walk(fps, -2)._motion.phase + 12.4) < 1e-8);
  }
});

test('standing still stops the gait; teleport corrections are bounded without moving the world root', () => {
  const m = walk(60), phase = m._motion.phase;
  for (let i = 0; i < 180; i++) ctx.animateMonster(m, 1 / 60);
  assert.equal(m._motion.phase, phase);
  assert.ok(m._motion.weight < 1e-8);
  m.g.position.set(100, 4, -200);
  ctx.animateMonster(m, 1 / 60);
  assert.deepEqual([m.g.position.x, m.g.position.y, m.g.position.z], [100, 4, -200]);
  assert.ok(Math.abs(m._motion.phase - phase) < 0.5);
});

test('freeze preserves every articulated pose even when legacy AI writes an arm rotation', () => {
  const m = walk(60), pose = Array.from(m._motion.pose);
  m.frozenSolid = 1;
  m.arms.R.rotation.x = 2;
  ctx.animateMonster(m, 1 / 30);
  assert.deepEqual(Array.from(m._motion.pose), pose);
  m._motion.nodes.forEach((n, i) => {
    assert.deepEqual([n.rotation.x, n.rotation.y, n.rotation.z, n.position.x, n.position.y, n.position.z],
      pose.slice(i * 6, i * 6 + 6));
  });
});

test('all melee clips reach weapon impact on the existing damage fraction, not the demo timing', () => {
  for (const [caste, weapon, kind, hit, style] of [
    ['grunt', 'club', 'gruntSmash', 0.55, 'overhead'],
    ['brute', 'maul', 'bruteSlam', 0.5, 'slam'],
    ['scout', 'daggers', 'scoutClaw', 0.3, 'claw'],
    ['shard', 'spear', 'shardJab', 0.45, 'thrust'],
    ['wisp', 'none', 'wispBite', 0.45, 'bite'],
  ]) {
    const m = monster(caste, weapon), reference = monster(caste, weapon);
    m.g.position.set(3, 0, -8);
    m.g.rotation.y = 1.2;
    m.atkPhase = hit;
    m.atkKind = kind;
    if (caste === 'brute') { m.rooted = 0.5; m.atkHit = true; }
    ctx.animateMonster(m, 1 / 60);
    reference.genome.atk = style;
    ctx.TrollGen.anim.attack(reference, (caste === 'brute' ? 0.6 : 0.53) + 0.125);
    for (const side of ['L', 'R']) {
      assert.equal(m.fists[side].rotation.x, reference.fists[side].rotation.x, kind);
      assert.equal(m.elbows[side].rotation.x, reference.elbows[side].rotation.x, kind);
    }
    assert.deepEqual([m.g.position.x, m.g.position.z, m.g.rotation.y], [3, -8, 1.2]);
    assert.equal(m.hp, 100);
    assert.equal(m.atkT, 0);
  }
});

test('healing does not trigger a hit reaction, and hit recoil decays instead of accumulating', () => {
  const m = walk(60);
  m.hp -= 20;
  ctx.animateMonster(m, 1 / 60);
  assert.ok(m._motion.hit > 0);
  for (let i = 0; i < 120; i++) ctx.animateMonster(m, 1 / 60);
  assert.ok(m._motion.hit < 1e-8);
  m.hp = 100;
  ctx.animateMonster(m, 1 / 60);
  assert.ok(m._motion.hit < 1e-8);
});

test('death blends from the last living pose and relaxes articulated joints', () => {
  const m = walk(60), nodes = m._motion.nodes;
  m._deathPose = nodes.map(n => n.rotation.clone());
  m._deathPelvis = m.pelvis.position.clone();
  m._deathElbows = { L: m.elbows.L.rotation.x, R: m.elbows.R.rotation.x };
  m._deathKnees = { L: m.knees.L.rotation.x, R: m.knees.R.rotation.x };
  m._deathWrists = { L: m.fists.L.rotation.x, R: m.fists.R.rotation.x };
  m.deathStyle = 'crumple';
  nodes.forEach(n => n.rotation.set(1, 1, 1));
  ctx.animateDeathJoints(m, 0);
  nodes.forEach((n, i) => assert.deepEqual(n.rotation, m._deathPose[i]));
  ctx.animateDeathJoints(m, 0.6);
  assert.equal(m.knees.L.rotation.x, 1.9);
  assert.equal(m.elbows.L.rotation.x, -1.1);
  assert.equal(m.pelvis.position.y, 0.95);
});

test('FX emission count is frame-rate independent and catch-up is bounded', () => {
  for (const rate of [30, 60]) {
    for (const fps of [20, 30, 60, 120, 144]) {
      const owner = {};
      let total = 0;
      for (let i = 0; i < fps * 3; i++) total += ctx.fxSteps(owner, 'acc', 1 / fps, rate);
      assert.equal(total, rate * 3, `${rate} particles/sec at ${fps} fps`);
    }
  }
  const owner = {};
  assert.equal(ctx.fxSteps(owner, 'acc', 10, 60), 6);
  assert.equal(ctx.fxSteps(owner, 'acc', 0, 60), 0);
});

test('boss states drive full slam follow-through, charge coil, and deep exhausted crouch', () => {
  const m = monster('brute', 'maul');
  m.boss = true;
  ctx.motionRig(m);
  // Windup raises arms high
  m.bossState = { kind: 'slam', t: 0.9, wind: 1.0 };
  for (let i = 0; i < 15; i++) ctx.animateMonster(m, 1 / 60);
  const raisedArmX = m.arms.R.rotation.x;
  assert.ok(raisedArmX < -1.0, 'slam windup raises weapon overhead');
  // Strike follow-through swings past impact instead of freezing mid-air
  m.bossState = { kind: 'slam', t: 1.08, wind: 1.0 };
  for (let i = 0; i < 15; i++) ctx.animateMonster(m, 1 / 60);
  assert.ok(m.arms.R.rotation.x > 0.5, 'slam completes downward smash');
  // Exhausted recovery drops pelvis into a clear staggered crouch
  m.bossState = { kind: 'recover', t: 0.5, duration: 1.7 };
  for (let i = 0; i < 20; i++) ctx.animateMonster(m, 1 / 60);
  assert.ok(m.pelvis.position.y < 0.82 && m.knees.L.rotation.x > 0.5, 'exhausted boss visibly crouches');
});

test('the concatenated troll generator and game each compile as one module body', () => {
  // Mirrors the build: each folder becomes one module, so it must be valid as a single scope.
  // (Wrapped in a function so vm can parse it as a script; modules are always strict.)
  new vm.Script('(function(){"use strict";const global=this;\n' + trollgen + '\n})');
  new vm.Script('(function(){"use strict";\n' + game + '\n})');
  const served = path.join(root, 'mp-server', 'public', 'mohas-roham.html');
  assert.ok(!fs.existsSync(served) || !/src\/main\.js/.test(fs.readFileSync(served, 'utf8')),
    'mp-server/public/mohas-roham.html must be a built file (npm run build), never the source entry');
});
