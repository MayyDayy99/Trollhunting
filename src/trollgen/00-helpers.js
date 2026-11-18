/* =============================================================================
   MOHÁS ROHAM — PROCEDURÁLIS TROLL-GENERÁTOR  (troll-gen.js, v1)
   -----------------------------------------------------------------------------
   Mit ad:
     TrollGen.describe(seed, opts) -> GENOM (sima objektum, szerializálható, co-op-barát)
     TrollGen.build(genom)         -> { g, legs, arms, head, torso, jaw, eyes, ... }
     TrollGen.make(seed, opts)     -> describe + build egy lépésben
     TrollGen.stickArrow(m, worldPos, worldDir)  -> a nyíl BENNE marad a trollban
     TrollGen.anim                 -> járás / támadás / halál pózok (a demóhoz)

   A rig ANCHOR-jai szándékosan azonosak a játék makeMonster()-ével:
     csípő y0.62 · váll y1.5 · fej y1.95+neckLen · ököl y-0.78 (kar-lokális)
   -> a meglévő walkAnim / ATK / deathStyle kód VÁLTOZATLANUL működik rajta.

   Drop-in a mohas-roham.html-be:
     1) ezt a fájlt betölteni (vagy a tartalmát bemásolni a nagy IIFE-be)
     2) window.TROLLGEN_HOST = { mesh, jitter, mergeGeos, gradTint, radialTint,
          mottleTint, std, GLOW, SKIN_N, MOSS_T, enableBloom, scene };
        (opcionális — ha nincs, a modul saját, azonos paraméterű másolatot épít)
     3) makeMonster(type,...) belsejét kiváltani:
          const gen = TrollGen.make(seed, { caste:type, el, tier });
        majd a meglévő m={...} mezőket a gen handle-jeivel feltölteni.
   ============================================================================= */
const T3 = global.THREE;
const H  = global.TROLLGEN_HOST || {};

/* ---------------------------------------------------------------- helpers -- */
const std = H.std || ((o) => new T3.MeshStandardMaterial(Object.assign({ roughness: .9, metalness: 0, flatShading: true }, o)));

const mesh = H.mesh || function (geo, mat, x, y, z, sx, sy, sz) {
  const m = new T3.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
  if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
  m.castShadow = true; m.receiveShadow = true; return m;
};

const jitter = H.jitter || function (geo, axz, ay) {
  const p = geo.attributes.position, seen = Object.create(null);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = Math.round(x * 1e3) + '_' + Math.round(y * 1e3) + '_' + Math.round(z * 1e3);
    let o = seen[key]; if (!o) o = seen[key] = [(Math.random() - .5) * axz, (Math.random() - .5) * ay, (Math.random() - .5) * axz];
    p.setX(i, x + o[0]); p.setY(i, y + o[1]); p.setZ(i, z + o[2]);
  }
  geo.computeVertexNormals(); return geo;
};

const gradTint = H.gradTint || function (geo, cBot, cTop, yMin, yMax, pow, axis) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  const A = new T3.Color(cBot), B = new T3.Color(cTop), C = new T3.Color();
  const get = axis === 'z' ? (i) => p.getZ(i) : (i) => p.getY(i);
  for (let i = 0; i < n; i++) {
    let t = (get(i) - yMin) / (yMax - yMin); t = Math.min(1, Math.max(0, t)); if (pow) t = Math.pow(t, pow);
    C.copy(A).lerp(B, t); col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b;
  }
  geo.setAttribute('color', new T3.BufferAttribute(col, 3)); return geo;
};

const radialTint = H.radialTint || function (geo, cIn, cOut, rMax, cx, cz) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  const A = new T3.Color(cIn), B = new T3.Color(cOut), C = new T3.Color();
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.hypot(p.getX(i) - (cx || 0), p.getZ(i) - (cz || 0)) / rMax);
    C.copy(A).lerp(B, t); col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b;
  }
  geo.setAttribute('color', new T3.BufferAttribute(col, 3)); return geo;
};

const mottleTint = H.mottleTint || function (geo, colors, blend, rnd) {
  const p = geo.attributes.position, seen = Object.create(null), W = new T3.Color(0xffffff);
  const has = !!geo.attributes.color;
  const col = has ? geo.attributes.color.array : new Float32Array(p.count * 3).fill(1);
  const C = new T3.Color(), R = rnd || Math.random;
  for (let i = 0; i < p.count; i++) {
    const key = Math.round(p.getX(i) * 1e3) + '_' + Math.round(p.getY(i) * 1e3) + '_' + Math.round(p.getZ(i) * 1e3);
    let c = seen[key];
    if (!c) { C.setHex(colors[(R() * colors.length) | 0]).lerp(W, blend || 0); c = seen[key] = [C.r, C.g, C.b]; }
    col[i * 3] *= c[0]; col[i * 3 + 1] *= c[1]; col[i * 3 + 2] *= c[2];
  }
  geo.setAttribute('color', new T3.BufferAttribute(col, 3)); return geo;
};

const mergeGeos = H.mergeGeos || function (items) {
  const pos = [], col = [], m4 = new T3.Matrix4(), e = new T3.Euler(), q = new T3.Quaternion(),
    v = new T3.Vector3(), sv = new T3.Vector3(), pv = new T3.Vector3();
  for (const it of items) {
    const g = it.geo.index ? it.geo.toNonIndexed() : it.geo;
    e.set(it.rx || 0, it.ry || 0, it.rz || 0); q.setFromEuler(e);
    pv.set(it.x || 0, it.y || 0, it.z || 0); sv.set(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1);
    m4.compose(pv, q, sv);
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m4); pos.push(v.x, v.y, v.z);
      if (c) col.push(c.getX(i), c.getY(i), c.getZ(i)); else col.push(1, 1, 1);
    }
  }
  const out = new T3.BufferGeometry();
  out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
  out.computeVertexNormals(); return out;
};

const enableBloom = H.enableBloom || function () {};

