/* ============================================================================
   4b) FEGYVERTÁR — íjak és elemi nyilak (a játék makeArrow-jának cseréje)
   ========================================================================== */
const BOWS = {
  bone:  { name: 'Csontív',  sub: 'agancs + ín',        limb: 0xe6dac2, wrap: 0x5a4030, glow: null },
  rune:  { name: 'Rúnaíj',   sub: 'sötét tölgy + rúna', limb: 0x2f2318, wrap: 0x1c2a3a, glow: 0x36c5ff },
  moss:  { name: 'Élő ág',   sub: 'moha + inda',        limb: 0x4a3826, wrap: 0x55692f, glow: 0x9fe3ff },
};
/* Az íj a -Z (előre) tengelyre merőlegesen, XY síkban feszül; a markolat az origó. */
function makeBow(kind) {
  const B = BOWS[kind] || BOWS.bone;
  const g = new T3.Group();
  const limbMat = std({ color: B.limb, roughness: kind === 'bone' ? .48 : .82, bumpMap: SKIN_N, bumpScale: .015 });
  const wrapMat = std({ color: B.wrap, roughness: 1 });
  const stringMat = new T3.MeshBasicMaterial({ color: 0xd8e2ea, transparent: true, opacity: .9 });

  /* két kar: valódi recurve-ív, GÖRBE mentén fűzött, vékonyodó szegmensekkel */
  const chain = (pts, r0, r1, mat) => {
    const grp = new T3.Group(), curve = new T3.CatmullRomCurve3(pts), N = 16;
    const up = new T3.Vector3(0, 1, 0), a = new T3.Vector3(), b = new T3.Vector3(), mid = new T3.Vector3(), dir = new T3.Vector3();
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      curve.getPointAt(t0, a); curve.getPointAt(t1, b);
      mid.copy(a).add(b).multiplyScalar(.5); dir.copy(b).sub(a);
      const len = dir.length();
      const rr = r0 + (r1 - r0) * t0;
      const c = new T3.Mesh(new T3.CylinderGeometry(r0 + (r1 - r0) * t1, rr, len * 1.06, 6), mat);
      c.position.copy(mid); c.quaternion.setFromUnitVectors(up, dir.normalize());
      c.castShadow = true; c.receiveShadow = true; grp.add(c);
      if (i % 4 === 0) { const j = new T3.Mesh(new T3.SphereGeometry(rr * 1.15, 6, 5), mat); j.position.copy(a); j.castShadow = true; grp.add(j); }
    }
    return grp;
  };
  [-1, 1].forEach(sg => {
    const pts = [
      new T3.Vector3(0, sg * .04, -.24),
      new T3.Vector3(0, sg * .26, -.36),
      new T3.Vector3(0, sg * .50, -.30),
      new T3.Vector3(0, sg * .68, -.10),
      new T3.Vector3(0, sg * .76, .10),
    ];
    g.add(chain(pts, .055, .022, limbMat));
    g.add(mesh(new T3.SphereGeometry(.030, 6, 5), limbMat, 0, sg * .77, .11));    // nock-gomb
  });
  /* markolat + bőrtekercs */
  g.add(mesh(new T3.CylinderGeometry(.062, .068, .36, 7), wrapMat, 0, 0, -.28));
  [-.13, 0, .13].forEach(y => { const t = mesh(new T3.TorusGeometry(.070, .014, 5, 10), M.leather, 0, y, -.28); t.rotation.x = Math.PI / 2; g.add(t); });
  { const sh = mesh(new T3.BoxGeometry(.045, .11, .09), M.leather, .045, .15, -.30); sh.rotation.z = -.2; g.add(sh); }   // nyílpolc

  /* ideg */
  { const p = [new T3.Vector3(0, .77, .11), new T3.Vector3(0, 0, .06), new T3.Vector3(0, -.77, .11)];
    const str = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3(p), 12, .009, 4, false), stringMat);
    g.add(str); g.userData.string = str; }

  if (kind === 'rune') {
    const rm = new T3.MeshStandardMaterial({ color: 0x0d2a38, emissive: B.glow, emissiveIntensity: 1.6, roughness: .5, flatShading: true });
    const rn = [];
    [-1, 1].forEach(sg => { for (let i = 0; i < 4; i++) { const t = .18 + i * .16; rn.push({ geo: new T3.BoxGeometry(.014, .055, .014), x: .052, y: sg * t, z: -.36 + Math.max(0, (t - .5)) * 1.1, rz: .25 }); } });
    const m2 = mesh(mergeGeos(rn), rm, 0, 0, 0); g.add(m2); enableBloom(m2);
    [-1, 1].forEach(sg => { const t = mesh(new T3.OctahedronGeometry(.045, 0), rm, 0, sg * .78, .07); g.add(t); enableBloom(t); });
  } else if (kind === 'moss') {
    [-1, 1].forEach(sg => {
      g.add(mesh(jitter(new T3.IcosahedronGeometry(.085, 0), .025, .02), M.moss, .03, sg * .36, -.34, 1.2, .8, 1));
      const mg = new T3.Group(); mg.position.set(.06, sg * .56, -.24); mg.scale.setScalar(.44); mg.rotation.z = sg * .5; mg.rotation.x = -.5;
      mg.add(mesh(new T3.CylinderGeometry(.035, .05, .2, 6), M.stem, 0, .1, 0));
      mg.add(mesh(new T3.SphereGeometry(.15, 9, 6, 0, 6.28, 0, Math.PI / 2), M.glowCap, 0, .22, 0, 1, .72, 1));
      const sp = new T3.Sprite(new T3.SpriteMaterial({ map: GLOW, color: 0x7fe2ff, transparent: true, opacity: .7, depthWrite: false, blending: T3.AdditiveBlending }));
      sp.scale.setScalar(.6); sp.position.y = .22; mg.add(sp); enableBloom(sp);
      g.add(mg);
    });
  } else {
    [-1, 1].forEach(sg => { const t = mesh(new T3.ConeGeometry(.036, .15, 5), M.tusk, 0, sg * .84, .13); t.rotation.x = sg * .9; g.add(t); });
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* --- NYÍL: a vessző -Z-ben repül (a játék makeArrow konvenciója) --- */
/* jelölő-sáv = --el-<e>-core, tollazat = --el-<e>-mid; az ALAP a fa/acél tokeneket kapja */
const ARROW_EL = {
  base:      { band: dsHex('--el-base-core', 0xbfc6d2), feather: dsHex('--arrow-feather', 0xd64b3a), name: 'ALAP' },
  fire:      { band: EL.fire.core,      feather: EL.fire.mid,      name: EL.fire.label },
  ice:       { band: EL.ice.core,       feather: EL.ice.mid,       name: EL.ice.label },
  poison:    { band: EL.poison.core,    feather: EL.poison.mid,    name: EL.poison.label },
  lightning: { band: EL.lightning.core, feather: EL.lightning.mid, name: EL.lightning.label },
};
function makeArrowMesh(el) {
  el = el || 'base';
  const A = ARROW_EL[el] || ARROW_EL.base;
  const P = EL[el];
  const g = new T3.Group();
  const shaft = mesh(new T3.CylinderGeometry(.011, .014, .86, 7), M.arrowWood, 0, 0, 0); shaft.rotation.x = Math.PI / 2; g.add(shaft);   // --el-base-mid / --arrow-wood
  /* spirál-kötés a vesszőn */
  { const w = []; for (let i = 0; i < 3; i++) w.push({ geo: new T3.TorusGeometry(.0155, .005, 4, 9), z: .10 + i * .07, rx: 0 });
    g.add(mesh(mergeGeos(w), std({ color: A.band, roughness: .6 }), 0, 0, 0)); }
  /* fém nyakgyűrű + penge */
  { const col = mesh(new T3.CylinderGeometry(.013, .017, .04, 7), M.metal, 0, 0, -.39); col.rotation.x = Math.PI / 2; g.add(col); }
  const headMat = new T3.MeshStandardMaterial({ color: dsHex('--el-base-core', 0xbfc6d2), metalness: .7, roughness: .28, flatShading: true });   // --el-base-core: kovácsolt acél
  const tip = mesh(new T3.ConeGeometry(.058, .19, 4), headMat, 0, 0, -.50, 1, 1, .28); tip.rotation.x = -Math.PI / 2; g.add(tip);
  /* szakállas visszahúzó tüskék */
  { const b = [];
    [-1, 1].forEach(sg => b.push({ geo: new T3.ConeGeometry(.022, .09, 4), x: sg * .045, z: -.40, rx: Math.PI / 2, rz: sg * .5 }));
    g.add(mesh(mergeGeos(b), headMat, 0, 0, 0)); }
  /* 3 tollazat, enyhe csavarral */
  [0, 1, 2].forEach(i => { const f = mesh(jitter(new T3.PlaneGeometry(.13, .058, 3, 1), .008, .006), std({ color: A.feather, roughness: .85, side: T3.DoubleSide }), 0, 0, .33);
    f.rotation.y = Math.PI / 2; f.rotation.z = i * (Math.PI * 2 / 3); f.rotation.x = .12; g.add(f); });
  { const nk = mesh(new T3.CylinderGeometry(.013, .010, .022, 7), M.tusk, 0, 0, .435); nk.rotation.x = Math.PI / 2; g.add(nk); }

  /* --- elemi fej-dísz --- */
  const holder = new T3.Group(); holder.position.set(0, 0, -.50); g.add(holder); g.userData.elemHolder = holder;
  if (P) {
    const em = new T3.MeshStandardMaterial({ color: P.deep, emissive: P.core, emissiveIntensity: 1.6, roughness: .4, flatShading: true });   // deep test + core emissive
    if (el === 'fire') {
      for (let i = 0; i < 3; i++) { const f = mesh(new T3.ConeGeometry(.05 - i * .012, .16 + i * .07, 5), em, 0, 0, .06 + i * .05, 1, 1, 1); f.rotation.x = Math.PI / 2; holder.add(f); }
    } else if (el === 'ice') {
      holder.add(mesh(new T3.OctahedronGeometry(.075, 0), em, 0, 0, -.02, 1, 1, 2.1));
      [-1, 1].forEach(sg => holder.add(mesh(new T3.OctahedronGeometry(.04, 0), em, sg * .05, 0, .06, 1, 1, 1.6)));
    } else if (el === 'poison') {
      holder.add(mesh(new T3.IcosahedronGeometry(.062, 1), em, 0, 0, .05));
      holder.add(mesh(new T3.ConeGeometry(.03, .09, 5), em, 0, -.05, .07, 1, 1, 1)).rotation.x = -Math.PI / 2 + 1.1;
    } else if (el === 'lightning') {
      [-1, 0, 1].forEach(i => { const p = mesh(new T3.ConeGeometry(.016, .18, 4), em, i * .045, 0, -.04); p.rotation.x = -Math.PI / 2; p.rotation.z = i * .18; holder.add(p); });
    }
    holder.traverse(o => enableBloom(o));
    const sp = new T3.Sprite(new T3.SpriteMaterial({ map: GLOW, color: P.glow, transparent: true, opacity: .5, depthWrite: false, blending: T3.AdditiveBlending }));   // --el-<e>-glow halo
    sp.scale.setScalar(.34); sp.position.z = -.02; holder.add(sp); enableBloom(sp);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.el = el;
  return g;
}

