// Static world batching (src/game/12-world-batch.js): runs the shipped code on a real three.js r128 scene.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const THREE = require('three');
const { between } = require('./source.cjs');

const LIB = ['skinMat', 'skinDark', 'bellyMat', 'hairMat', 'tuskMat', 'clothMat', 'woodMat', 'woodDark', 'rockMat', 'mossMat', 'rockDark',
  'stemMat', 'capMat', 'glowCapM', 'eyeMat', 'arrowWood', 'featherMat', 'metalMat', 'mossMatV', 'rockMatV', 'woodDarkV', 'tuskMatV'];

function world(hash = '') {
  const ctx = vm.createContext({ THREE, window: {}, location: { hash }, performance, console, Math,
    scene: new THREE.Scene(), swayers: [], skyGroup: null, treeCasters: [], NOBLOOM_LAYER: 2 });
  for (const n of LIB) ctx[n] = new THREE.MeshStandardMaterial();
  vm.runInContext(between('const WIND_U=', '// A canvas-textúra sRGB-ben'), ctx);           // applyWind
  vm.runInContext(between('const STY_NOISE=[', '/* levél-fürt alfa-textúra'), ctx);        // applyStylized
  vm.runInContext(between('const WB_CELL=', 'try{ batchWorldMeshes(); }'), ctx);
  ctx.info = () => vm.runInContext('worldBatchInfo', ctx);
  return ctx;
}
const box = () => new THREE.BoxGeometry(1, 2, 3).toNonIndexed();   // vertex colours are added where a material needs them
const colored = g => { g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.5), 3)); return g; };
function add(ctx, geo, mat, x, z, opts = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, opts.y || 0, z);
  if (opts.rot) m.rotation.set(...opts.rot); if (opts.scale) m.scale.set(...opts.scale);
  m.castShadow = opts.cast !== false; m.receiveShadow = true;
  (opts.parent || ctx.scene).add(m); return m;
}
const batches = ctx => ctx.scene.children.filter(o => o.userData && o.userData._worldBatch);
const v3 = (a, i) => new THREE.Vector3().fromBufferAttribute(a, i);

test('same material in one cell becomes one mesh: world-space vertices, normals and front faces preserved (mirrored parts too)', () => {
  const ctx = world(), mat = new THREE.MeshStandardMaterial();
  const a = add(ctx, box(), mat, 1, 2, { rot: [0.3, 1.1, -0.2] });
  const b = add(ctx, new THREE.BoxGeometry(1, 1, 1), mat, 5, 6, { scale: [-1.5, 0.7, 1.2] });   // indexed + mirrored
  ctx.scene.updateMatrixWorld(true);
  const want = [a, b].flatMap(o => { const p = o.geometry.attributes.position; return Array.from({ length: p.count }, (_, i) => v3(p, i).applyMatrix4(o.matrixWorld)); });
  ctx.batchWorldMeshes();
  const [m] = batches(ctx);
  assert.equal(batches(ctx).length, 1); assert.equal(m.userData._worldBatch, 2);
  assert.equal(m.material, mat, 'plain materials are shared, not cloned (same shader program)');
  assert.ok(!ctx.scene.children.includes(a) && !ctx.scene.children.includes(b), 'originals leave the scene');
  const pos = m.geometry.attributes.position, nrm = m.geometry.attributes.normal, idx = m.geometry.index.array;
  assert.equal(pos.count, want.length);
  want.forEach((w, i) => assert.ok(v3(pos, i).distanceTo(w) < 1e-5, `vertex ${i}`));
  for (let t = 0; t < idx.length; t += 3) {   // every triangle still faces where its normal points (three flips front faces of mirrored meshes)
    const p0 = v3(pos, idx[t]), face = v3(pos, idx[t + 1]).sub(p0).cross(v3(pos, idx[t + 2]).sub(p0));
    assert.ok(face.dot(v3(nrm, idx[t])) > 0, `triangle ${t / 3} winding`);
  }
  assert.equal(ctx.info().merged, 2);
});

test('animated, referenced, transparent, glowing, instanced and troll-shared objects are left alone', () => {
  const ctx = world(), mat = new THREE.MeshStandardMaterial(), keep = [];
  const sway = new THREE.Group(); ctx.scene.add(sway); ctx.swayers.push(sway);
  keep.push(add(ctx, box(), mat, 0, 0, { parent: sway }), add(ctx, box(), mat, 0.5, 0, { parent: sway }));
  const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 });
  keep.push(add(ctx, box(), glass, 1, 0), add(ctx, box(), glass, 1.5, 0));
  const glow = add(ctx, box(), mat, 2, 0); glow.layers.enable(1); const glow2 = add(ctx, box(), mat, 2.5, 0); glow2.layers.enable(1); keep.push(glow, glow2);
  keep.push(add(ctx, box(), ctx.skinMat, 3, 0), add(ctx, box(), ctx.skinMat, 3.5, 0));
  const custom = new THREE.MeshStandardMaterial(); custom.onBeforeCompile = sh => { sh.vertexShader += '//obj-space'; };
  keep.push(add(ctx, box(), custom, 4, 0), add(ctx, box(), custom, 4.5, 0));
  const hidden = new THREE.Group(); hidden.visible = false; ctx.scene.add(hidden);
  keep.push(add(ctx, box(), mat, 5, 0, { parent: hidden }), add(ctx, box(), mat, 5.5, 0, { parent: hidden }));
  const im = new THREE.InstancedMesh(box(), mat, 2); ctx.scene.add(im); keep.push(im);
  const far = add(ctx, box(), mat, 200, 200); keep.push(far);   // alone in its cell: nothing to merge with
  const before = keep.map(o => o.parent);
  ctx.batchWorldMeshes();
  assert.equal(batches(ctx).length, 0);
  keep.forEach((o, i) => { assert.equal(o.parent, before[i]); assert.equal(o.layers.mask & 1, 1); });
});

test('cells keep frustum culling: far-apart meshes of one material are merged per cell', () => {
  const ctx = world(), mat = new THREE.MeshStandardMaterial();
  for (const [x, z] of [[1, 1], [2, 3], [101, 1], [102, 2]]) add(ctx, box(), mat, x, z);
  ctx.batchWorldMeshes();
  const b = batches(ctx); assert.equal(b.length, 2);
  for (const m of b) { m.geometry.computeBoundingSphere(); assert.ok(m.geometry.boundingSphere.radius < 10); }
});

test('tree shadow casters stay switchable by the graphics tier; emptied groups leave the scene', () => {
  const ctx = world(), bark = new THREE.MeshStandardMaterial();
  const trees = [0, 1, 2].map(i => { const g = new THREE.Group(); g.position.set(i * 3, 0, 0); ctx.scene.add(g); return g; });
  const trunks = trees.map(g => add(ctx, box(), bark, 0, 0, { parent: g }));
  ctx.treeCasters.push(trunks[0], trunks[1]);   // the third tree is outside the clearing: never casts on a tier switch
  ctx.batchWorldMeshes();
  const b = batches(ctx); assert.equal(b.length, 1, 'caster and non-caster trunks are not mixed');
  assert.deepEqual(ctx.treeCasters, [b[0]]);
  assert.ok(trees.slice(0, 2).every(g => !g.parent), 'empty tree groups removed');
  assert.equal(trunks[2].parent, trees[2]);
});

test('wind canopy: baked height + sway direction give the same displacement as the per-mesh shader', () => {
  const ctx = world(), can = ctx.applyWind(new THREE.MeshStandardMaterial({ vertexColors: true }), 'canopy');
  const g = new THREE.Group(); g.position.set(3, 0.2, -4); g.rotation.y = 0.8; g.scale.set(1.3, 1.1, 1.3); ctx.scene.add(g);
  const a = add(ctx, colored(box()), can, 0, 0, { parent: g, y: 4.8 });
  const b = add(ctx, colored(box()), can, 2, 1, { parent: g, y: 5.1, rot: [0, 0.4, 0.1] });
  ctx.scene.updateMatrixWorld(true);
  ctx.batchWorldMeshes();
  const [m] = batches(ctx), geo = m.geometry;
  assert.equal(m.material.customProgramCacheKey(), 'wind-canopy-b'); assert.ok(m.material.vertexColors);
  let k = 0;
  for (const o of [a, b]) { const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++, k++) {
      const local = v3(p, i), s = 0.37;   // any sway amount sw*k
      const ref = local.clone().add(new THREE.Vector3(1, 0, 0.6).multiplyScalar(s)).applyMatrix4(o.matrixWorld);   // three: modelViewMatrix * (transformed + offset)
      const got = v3(geo.attributes.position, k).add(v3(geo.attributes.aSD, k).multiplyScalar(s));
      assert.ok(got.distanceTo(ref) < 1e-5, `vertex ${k}`);
      assert.equal(geo.attributes.aOH.getX(k), local.y);
    } }
  const sh = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: '' }; m.material.onBeforeCompile(sh);
  assert.match(sh.vertexShader, /attribute float aOH; attribute vec3 aSD;/); assert.match(sh.vertexShader, /clamp\(aOH-3\.1/); assert.match(sh.vertexShader, /mvPosition\.xyz \+= aSD\*\(sw\*k\)/);
  const orig = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: '' }; can.onBeforeCompile(orig);
  assert.match(orig.vertexShader, /clamp\(transformed\.y-3\.1/); assert.doesNotMatch(orig.vertexShader, /aOH|aSD/);
});

test('plank wood: the object-space pattern position travels in aOP', () => {
  const ctx = world(), wood = ctx.applyStylized(new THREE.MeshStandardMaterial(), 'wood');
  const a = add(ctx, box(), wood, 1, 1, { rot: [0, 0.5, 0] }), b = add(ctx, box(), wood, 4, 2, { scale: [2, 1, 1] });
  ctx.batchWorldMeshes();
  const [m] = batches(ctx), op = m.geometry.attributes.aOP;
  assert.equal(m.material.customProgramCacheKey(), 'sty-wood-b');
  let k = 0; for (const o of [a, b]) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++, k++) assert.ok(v3(op, k).distanceTo(v3(p, i)) === 0); }
  const sh = { uniforms: {}, vertexShader: '#include <defaultnormal_vertex>\n#include <begin_vertex>', fragmentShader: '#include <color_fragment>' };
  m.material.onBeforeCompile(sh); assert.match(sh.vertexShader, /^attribute vec3 aOP;/); assert.match(sh.vertexShader, /vOP=aOP;/);
});

test('#dev A/B switch builds the batches but leaves the scene as it was', () => {
  const ctx = world('#dev'); ctx.window.__noWorldBatch = true;
  const mat = new THREE.MeshStandardMaterial(), a = add(ctx, box(), mat, 0, 0), b = add(ctx, box(), mat, 1, 0);
  ctx.batchWorldMeshes();
  assert.equal(batches(ctx).length, 0); assert.equal(a.parent, ctx.scene); assert.equal(b.parent, ctx.scene);
});
