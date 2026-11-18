/* ============================================================================
   MOHA-AKKUMULÁCIÓ  (ref: threejs-procedural-materials / model-moss-accumulation)
   Ugyanaz a szabály, csak CPU-oldalon, lapos-árnyalt vertex-színes geometrián:
     felfelé néző lap  ×  foltos lefedettség-zaj  ->  moha
   A réteg VALÓDI vastagságot kap (a vertexet a normálja mentén kitolja), és a
   vertex-színt a moha felé húzza. A koincidens vertexek KÖZÖS maszkot kapnak,
   így a nem-indexelt (flat) geometria lapjai nem szakadnak szét.
   ========================================================================== */
function hash2(x, y) {                                  // determinisztikus 2D hash
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y) {                                 // érték-zaj simított interpolációval
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (hash2(xi, yi) * (1 - u) + hash2(xi + 1, yi) * u) * (1 - v)
       + (hash2(xi, yi + 1) * (1 - u) + hash2(xi + 1, yi + 1) * u) * v;
}
function fbm2(x, y) {
  let a = .5, f = 1, sum = 0;
  for (let i = 0; i < 4; i++) { sum += a * vnoise(x * f, y * f); f *= 2; a *= .5; }
  return sum;
}
const smoothstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/**
 * @param geo      nem-indexelt BufferGeometry (mergeGeos vagy primitív)
 * @param o.rel    [r,g,b] szorzó, ami a bőr-színt a moha felé viszi
 * @param o.cov    0..1 lefedettség · o.thick vastagság · o.flat felfelé-küszöb
 * @param o.sx/sz  seed-eltolás · o.scale zaj-frekvencia
 */
function mossify(geo, o) {
  const p = geo.attributes.position;
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  if (!geo.attributes.color) geo.setAttribute('color', new T3.BufferAttribute(new Float32Array(p.count * 3).fill(1), 3));
  const c = geo.attributes.color;
  const cov = o.cov, thick = o.thick, flat = (o.flat !== undefined) ? o.flat : .30, sc = o.scale || 2.2;
  const rel = o.rel, sx = o.sx || 0, sz = o.sz || 0;
  const key = (i) => Math.round(p.getX(i) * 1e3) + '_' + Math.round(p.getY(i) * 1e3) + '_' + Math.round(p.getZ(i) * 1e3);
  /* 1) koincidens vertexek: átlagolt normál (a lapos normál kilépcsőzné a réteget) */
  const acc = Object.create(null);
  for (let i = 0; i < p.count; i++) {
    const k = key(i); let a = acc[k];
    if (!a) a = acc[k] = { nx: 0, ny: 0, nz: 0, x: p.getX(i), z: p.getZ(i) };
    a.nx += n.getX(i); a.ny += n.getY(i); a.nz += n.getZ(i);
  }
  /* 2) per-pont moha-mennyiség */
  for (const k in acc) {
    const a = acc[k], len = Math.hypot(a.nx, a.ny, a.nz) || 1;
    a.nx /= len; a.ny /= len; a.nz /= len;
    const top = smoothstep(flat, 1, Math.max(0, a.ny));
    const patch = fbm2(a.x * sc + sx, a.z * sc + sz);
    const thr = 1 - cov;
    a.m = top * smoothstep(thr - .20, thr + .20, patch);
  }
  /* 3) kitolás + színezés */
  for (let i = 0; i < p.count; i++) {
    const a = acc[key(i)], m = a.m;
    if (m <= .002) continue;
    p.setXYZ(i, p.getX(i) + a.nx * thick * m, p.getY(i) + a.ny * thick * m, p.getZ(i) + a.nz * thick * m);
    c.setXYZ(i, c.getX(i) * (1 + (rel[0] - 1) * m), c.getY(i) * (1 + (rel[1] - 1) * m), c.getZ(i) * (1 + (rel[2] - 1) * m));
  }
  geo.computeVertexNormals();
  return geo;
}
/** a bőr -> moha szorzó (a vertex-szín a material.color-ral SZORZÓDIK) */
function mossRel(skinHex, mossHex) {
  const a = new T3.Color(skinHex), b = new T3.Color(mossHex);
  return [Math.min(2.6, b.r / Math.max(.03, a.r)), Math.min(2.6, b.g / Math.max(.03, a.g)), Math.min(2.6, b.b / Math.max(.03, a.b))];
}

/* ------------------------------------------------------------ RUGÓ (spring) ---
   ref: threejs-procedural-animation — másodlagos mozgás rugóval, dt-alapon.
   Kritikusan csillapított követés; a dt-t a hívó vágja le. */
function springStep(st, target, k, dampRatio, dt) {
  const d = 2 * dampRatio * Math.sqrt(k);
  st.v += (-k * (st.x - target) - d * st.v) * dt;
  st.x += st.v * dt;
  return st.x;
}

/* ------------------------------------------------------------ seed / RNG --- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function RNG(seed) {
  const r = mulberry32(typeof seed === 'string' ? hashStr(seed) : (seed >>> 0));
  const f = {
    next: r,
    range: (a, b) => a + (b - a) * r(),
    int: (a, b) => a + ((b - a + 1) * r() | 0),
    chance: (p) => r() < p,
    pick: (arr) => arr[(r() * arr.length) | 0],
    /* súlyozott: [[érték,súly],...] */
    weighted(list) {
      let tot = 0; for (const it of list) tot += it[1];
      let x = r() * tot;
      for (const it of list) { x -= it[1]; if (x <= 0) return it[0]; }
      return list[list.length - 1][0];
    },
    /* n db különböző elem a listából */
    some(arr, n) { const c = arr.slice(), out = []; while (out.length < n && c.length) out.push(c.splice((r() * c.length) | 0, 1)[0]); return out; },
  };
  return f;
}
const hsl = (h, s, l) => new T3.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l).getHex();

