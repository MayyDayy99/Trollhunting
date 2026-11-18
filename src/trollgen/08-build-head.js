/* ------------------------------------------------------------------ FEJ ---- */
function buildHead(head, G, R, bodySkin, paleMat, mossTone, eyeM, own, mossPass) {
  const S = G.snout;
  const shade  = own(std({ color: G.skinDeep, bumpMap: SKIN_N, bumpScale: .02 }));       // sötét árnyék-anyag: párkány, orrnyereg, orrlyuk
  const socketMat = own(new T3.MeshBasicMaterial({ color: 0x07090c }));                  // fénytelen gödör -> a szem messziről is kiugrik
  const gumMat = own(std({ color: 0x30140f, roughness: 1 }));

  /* --- koponya --- */
  let cran;
  switch (G.skull) {
    case 'block':   cran = mesh(jitter(new T3.DodecahedronGeometry(.44, 0), .07, .055), bodySkin, 0, 0, -.06, 1.12, .94, .98); break;   // tömbszerű, de nem kocka: szögletes szikla-koponya
    case 'wedge':   cran = mesh(jitter(new T3.IcosahedronGeometry(.40, 1), .026, .02), bodySkin, 0, .01, -.02, .86, .82, 1.25); break;   // előre keskenyedő ék-koponya
    case 'flat':    cran = mesh(jitter(new T3.IcosahedronGeometry(.42, 1), .026, .02), bodySkin, 0, -.02, -.06, 1.3, .68, 1.0); break;
    case 'long':    cran = mesh(jitter(new T3.IcosahedronGeometry(.38, 1), .026, .02), bodySkin, 0, .02, -.04, .90, .95, 1.35); break;
    case 'crested': cran = mesh(jitter(new T3.IcosahedronGeometry(.40, 1), .03, .025), bodySkin, 0, .02, -.06, .94, 1.18, 1.0); break;
    default:        cran = mesh(jitter(new T3.IcosahedronGeometry(.40, 1), .024, .02), bodySkin, 0, 0, -.06, 1, .95, 1);
  }
  gradTint(cran.geometry, G.skinDeep, 0xffffff, -.42, .30); mottleTint(cran.geometry, G.mottle, .42, R.next);
  if (mossPass) mossPass(cran.geometry, 1.4, 1.25);   // MOHA: a koponya teteje a legexponáltabb felület
  head.add(cran);

  /* --- POFA: előrenyúló, hogy legyen arca, ne csak egy gömb --- */
  const mz = .30 * S;
  const muzzle = mesh(jitter(new T3.IcosahedronGeometry(.215, 1), .018, .014), bodySkin, 0, -.10, mz, 1.06, .88, 1.55 * S);
  gradTint(muzzle.geometry, G.skinDeep, 0xffffff, -.25, .18); head.add(muzzle);
  /* orrnyereg: sötét sáv a párkánytól az orrig — ez köti össze az arcot */
  { const b = mesh(jitter(new T3.BoxGeometry(.19, .15, .42 * S, 1, 1, 2), .022, .018), shade, 0, .01, .30 * S); b.rotation.x = -.10; head.add(b); }
  [-1, 1].forEach(k => head.add(mesh(new T3.SphereGeometry(.045, 6, 5), shade, k * .075, -.055, .60 * S, 1, .8, .8)));   // orrlyuk

  /* --- SZEMÖLDÖK-PÁRKÁNY: sötét, kiugró, árnyékot vet a szemre --- */
  if (G.brow === 'plate') {
    const b = mesh(jitter(new T3.BoxGeometry(.60, .16, .30, 3, 1, 2), .035, .022), shade, 0, .155, .18); b.rotation.x = .22; head.add(b);
  } else if (G.brow === 'spiked') {
    const b = mesh(jitter(new T3.BoxGeometry(.54, .13, .26, 2, 1, 2), .032, .02), shade, 0, .15, .19); b.rotation.x = .2; head.add(b);
    const sp = []; for (let i = -2; i <= 2; i++) sp.push({ geo: new T3.ConeGeometry(.032, .14, 4), x: i * .12, y: .24, z: .16, rx: -.55 });
    head.add(mesh(mergeGeos(sp), M.tusk, 0, 0, 0));
  } else if (G.brow === 'ridged') {
    [-1, 1].forEach(k => { const b = mesh(jitter(new T3.BoxGeometry(.27, .13, .27, 1, 1, 2), .03, .02), shade, k * .16, .16, .18); b.rotation.z = -k * .24; b.rotation.x = .22; head.add(b); });
  } else {
    const b = mesh(jitter(new T3.BoxGeometry(.56, .17, .28, 2, 1, 2), .04, .026), shade, 0, .15, .18); b.rotation.x = .18; head.add(b);
  }

  /* --- SZEMEK: fénytelen gödör + izzó gömb + pupilla + halo --- */
  const eyes = [];
  eyeLayout(G.eyeCount).forEach(pt => {
    const es = G.eyeSize * pt.s;
    /* gödör: nagy, fénytelen üreg — a szem BENNE ül, nem rajta */
    head.add(mesh(new T3.SphereGeometry(es * 1.45, 9, 8), socketMat, pt.x, pt.y, pt.z - .01, 1.1, 1.0, .55));
    const e = mesh(new T3.SphereGeometry(es * .95, 9, 8), eyeM, pt.x, pt.y, pt.z + es * .25); head.add(e); eyes.push(e); enableBloom(e);
    if (G.pupil !== 'none') {
      const pm = own(new T3.MeshBasicMaterial({ color: 0x06040a }));
      head.add(G.pupil === 'slit'
        ? mesh(new T3.BoxGeometry(es * .22, es * 1.3, es * .3), pm, pt.x, pt.y, pt.z + es * .95)
        : mesh(new T3.SphereGeometry(es * .38, 7, 6), pm, pt.x, pt.y, pt.z + es * .9));
    }
    const sp = new T3.Sprite(new T3.SpriteMaterial({ map: GLOW, color: eyeM.emissive.getHex(), transparent: true, opacity: .5, depthWrite: false, blending: T3.AdditiveBlending }));
    sp.scale.setScalar(es * 4.2); sp.position.set(pt.x, pt.y, pt.z + .05); head.add(sp); enableBloom(sp);
  });
  head.userData.eyes = eyes;

  /* --- ÁLLKAPOCS (nyitható Group) --- */
  const jaw = new T3.Group(); jaw.position.set(0, -.26, .14); head.add(jaw); head.userData.jaw = jaw;
  const jw = G.jawKind === 'wide' ? 1.45 : G.jawKind === 'lantern' ? 1.22 : 1.12;
  const jd = G.jawKind === 'hanging' ? .92 : .62;
  const jz = .22 * S;
  jaw.add(mesh(jitter(new T3.IcosahedronGeometry(.195, 1), .016, .013), bodySkin, 0, -.02, jz, jw, jd, 1.45 * S));
  jaw.add(mesh(new T3.SphereGeometry(.17, 9, 7), gumMat, 0, .05, jz - .02, jw * .82, .55, 1.15 * S));     // sötét szájüreg
  const low = []; for (let i = -2; i <= 2; i++) low.push({ geo: new T3.ConeGeometry(.036, .13, 4), x: i * .075 * jw, y: .07, z: (.40 - Math.abs(i) * .035) * S });
  jaw.add(mesh(mergeGeos(low), M.tusk, 0, 0, 0));
  const up = []; for (let i = -2; i <= 2; i++) up.push({ geo: new T3.ConeGeometry(.034, .12, 4), x: i * .073 * jw, y: -.185, z: (.50 - Math.abs(i) * .035) * S, rx: Math.PI });
  head.add(mesh(mergeGeos(up), M.tusk, 0, 0, 0));

  addTusks(head, jaw, G, S);

  /* --- FÜLEK --- */
  if (G.ear !== 'none') {
    const L = G.earLen;
    [-1, 1].forEach(k => {
      if (G.ear === 'torn' && k > 0 && G.wounds.indexOf('tornEar') >= 0) return;
      let e;
      if (G.ear === 'bat') {
        e = mesh(new T3.ConeGeometry(.12, .60 * Math.max(.8, L), 6), bodySkin, k * .40, .06, -.06);
        const inner = mesh(new T3.ConeGeometry(.06, .50 * Math.max(.8, L), 5), paleMat, k * .40, .06, -.03);
        inner.rotation.z = -k * 1.3; inner.rotation.x = -.18; head.add(inner);
      } else if (G.ear === 'fin') {
        e = mesh(jitter(new T3.CircleGeometry(.26 * Math.max(.7, L), 5), .045, .03), own(std({ color: G.skinPale, roughness: .9, side: T3.DoubleSide })), k * .40, .09, -.08);
        e.rotation.y = k * 1.2;
      } else if (G.ear === 'droop') {
        e = mesh(new T3.ConeGeometry(.11, .46 * L, 6), bodySkin, k * .38, -.04, -.06); e.rotation.z = -k * 2.2;
      } else if (G.ear === 'stub') {
        e = mesh(jitter(new T3.IcosahedronGeometry(.12, 0), .022, .02), bodySkin, k * .37, .06, -.06, 1, 1.3, .7);
      } else {
        e = mesh(jitter(new T3.ConeGeometry(.11, .38 * L, 5), .035, .025), bodySkin, k * .40, .06, -.06);
      }
      if (G.ear !== 'fin' && G.ear !== 'stub') { e.rotation.z = e.rotation.z || -k * 1.3; e.rotation.x = -.2; }
      head.add(e);
    });
  }

  /* --- moha-sapka + szemölcsök --- */
  if (G.moss > .45) head.add(mesh(jitter(new T3.IcosahedronGeometry(.15, 0), .04, .035), mossTone, R.range(-.2, .2), .25, -.22, 1.2, .7, 1.1));
  for (let i = 0; i < 3; i++) head.add(mesh(new T3.SphereGeometry(.026 + R.range(0, .02), 6, 5), shade, R.range(-.16, .16), R.range(-.14, .0), (.42 + R.range(0, .16)) * S));
}

function eyeLayout(n) {
  if (n === 1) return [{ x: 0, y: .04, z: .33, s: 1.8 }];
  if (n === 3) return [{ x: -.175, y: .03, z: .30, s: 1 }, { x: .175, y: .03, z: .30, s: 1 }, { x: 0, y: .20, z: .28, s: .7 }];
  if (n === 4) return [{ x: -.19, y: .04, z: .29, s: .95 }, { x: .19, y: .04, z: .29, s: .95 }, { x: -.10, y: .21, z: .27, s: .58 }, { x: .10, y: .21, z: .27, s: .58 }];
  return [{ x: -.175, y: .03, z: .30, s: 1 }, { x: .175, y: .03, z: .30, s: 1 }];
}

function addTusks(head, jaw, G, S) {
  const L = G.tuskLen; S = S || 1;
  if (G.tusk === 'none') return;
  if (G.tusk === 'up' || G.tusk === 'sabre') {
    const big = G.tusk === 'sabre' ? 1.85 : 1;
    [-1, 1].forEach(s => {
      const t = mesh(new T3.ConeGeometry(.055 * big, .28 * L * big, 5), M.tusk, s * .155, .08, .30 * S);
      t.rotation.x = -.42; t.rotation.z = s * .16; jaw.add(t);
    });
  } else if (G.tusk === 'down') {
    [-1, 1].forEach(s => { const t = mesh(new T3.ConeGeometry(.042, .21 * L, 5), M.tusk, s * .155, -.16, .42 * S); t.rotation.x = .22; head.add(t); });
  } else if (G.tusk === 'cluster') {
    const c = [];
    [-1, 1].forEach(s => {
      c.push({ geo: new T3.ConeGeometry(.05, .25 * L, 5), x: s * .17, y: .07, z: .28 * S, rx: -.45, rz: s * .22 });
      c.push({ geo: new T3.ConeGeometry(.034, .17 * L, 5), x: s * .09, y: .06, z: .36 * S, rx: -.28, rz: s * .48 });
    });
    jaw.add(mesh(mergeGeos(c), M.tusk, 0, 0, 0));
  } else if (G.tusk === 'broken') {
    const t = mesh(new T3.ConeGeometry(.062, .30 * L, 5), M.tusk, -.155, .08, .30 * S); t.rotation.x = -.45; t.rotation.z = -.18; jaw.add(t);
    jaw.add(mesh(new T3.CylinderGeometry(.055, .062, .08, 5), M.tusk, .155, .05, .30 * S));   // letört csonk
  }
}

/* ---------------------------------------------------------------- SZARVAK -- */
function addHorns(head, G, R, own) {
  const L = G.hornLen;
  const broken = G.wounds.indexOf('brokenHorn') >= 0;
  const items = [];
  const add = (o) => items.push(o);
  switch (G.horn) {
    case 'spike':
      [-1, 1].forEach(s => { add({ geo: new T3.ConeGeometry(.07, .44 * L, 6), x: s * .16, y: .27, z: -.04, rx: -.3, rz: s * .3 }); add({ geo: new T3.ConeGeometry(.04, .21 * L, 6), x: s * .22, y: .46, z: -.11, rx: -.45, rz: s * .52 }); });
      break;
    case 'ram':
      [-1, 1].forEach(s => { for (let i = 0; i < 4; i++) { const a = i / 3; add({ geo: new T3.ConeGeometry(.085 - i * .017, .22 * L, 6), x: s * (.18 + a * .14), y: .26 - a * .16, z: -.06 - a * .12, rx: -.2 + a * 1.5, rz: s * (.5 + a * .7) }); } });
      break;
    case 'antler':
      [-1, 1].forEach(s => {
        add({ geo: new T3.ConeGeometry(.055, .58 * L, 5), x: s * .20, y: .28, z: -.06, rx: -.42, rz: s * .6 });
        add({ geo: new T3.ConeGeometry(.033, .26 * L, 5), x: s * .30, y: .48, z: .06, rx: .45, rz: s * .7 });
        add({ geo: new T3.ConeGeometry(.028, .21 * L, 5), x: s * .28, y: .46, z: -.18, rx: -.6, rz: s * .55 });
        add({ geo: new T3.ConeGeometry(.032, .27 * L, 5), x: s * .36, y: .62, z: -.08, rx: -.25, rz: s * .5 });
      });
      break;
    case 'crown':
      for (let i = 0; i < 6; i++) { const a = -1.2 + i * .48; add({ geo: new T3.ConeGeometry(.045, (.30 + Math.sin(i) * .12) * L, 5), x: Math.sin(a) * .28, y: .30, z: Math.cos(a) * .18 - .08, rx: -.35 + Math.cos(a) * .2, rz: Math.sin(a) * .8 }); }
      break;
    case 'single':
      add({ geo: new T3.ConeGeometry(.085, .52 * L, 6), x: R.range(-.05, .05), y: .30, z: .10, rx: -.18 });
      break;
    case 'backswept':
      [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) add({ geo: new T3.ConeGeometry(.065 - i * .015, .26 * L, 6), x: s * (.15 + i * .04), y: .28 - i * .05, z: -.06 - i * .18, rx: -1.0 - i * .25, rz: s * .18 }); });
      break;
    case 'stub':
      [-1, 1].forEach(s => add({ geo: jitter(new T3.ConeGeometry(.085, .17 * L, 6), .02, .01), x: s * .17, y: .26, z: -.02, rx: -.2, rz: s * .22 }));
      break;
    default: return;
  }
  if (!items.length) return;
  if (broken) items.splice(0, Math.max(1, (items.length / 2) | 0));   // fél szarv letörve
  const mat = own(std({ color: 0xd8ccb4, roughness: .55, vertexColors: true }));
  head.add(mesh(gradTint(mergeGeos(items), 0x6b5a44, 0xffffff, .15, .75), mat, 0, 0, 0));
}

/* ------------------------------------------------------------------ TARAJ -- */
function addCrest(g, torso, G, R, mossTone) {
  if (G.crest === 'none') return;
  const items = [];
  if (G.crest === 'spines') {
    const n = 4 + R.int(0, 4);
    for (let i = 0; i < n; i++) items.push({ geo: new T3.ConeGeometry(.075, .30 + R.range(0, .20), 5), x: R.range(-.05, .05), y: 1.12 + i * (1.05 / n), z: -.38 - R.range(0, .07), rx: -.35 });
    torso.add(mesh(gradTint(mergeGeos(items), 0x5c4c38, 0xffffff, 1.1, 2.2), M.tuskV, 0, 0, 0));
  } else if (G.crest === 'fin') {
    const pts = [];
    for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push({ geo: new T3.CircleGeometry(.11 + Math.sin(t * Math.PI) * .21, 5), y: 1.12 + t * 1.0, z: -.40, ry: Math.PI / 2 }); }
    const finMat = std({ color: 0x7a8f6e, roughness: .95, side: T3.DoubleSide, vertexColors: true });
    torso.add(mesh(gradTint(mergeGeos(pts), 0x3d4c36, 0xffffff, 1.1, 2.2), finMat, 0, 0, 0));
  } else if (G.crest === 'plates') {
    for (let i = 0; i < 5; i++) items.push({ geo: jitter(new T3.IcosahedronGeometry(.32 - i * .04, 1), .06, .05), x: R.range(-.06, .06), y: 2.02 - i * .30, z: -.46 - R.range(0, .09), sx: 1.3, sy: .5, sz: 1.0, rx: -.35 });
    torso.add(mesh(gradTint(mergeGeos(items), 0x6d7787, 0xffffff, .8, 2.2), M.rockV, 0, 0, 0));
  } else if (G.crest === 'bristle') {
    const n = 10 + R.int(0, 8);
    for (let i = 0; i < n; i++) items.push({ geo: new T3.ConeGeometry(.024, .17 + R.range(0, .13), 4), x: R.range(-.15, .15), y: 1.20 + R.range(0, .95), z: -.38 - R.range(0, .1), rx: -.5 + R.range(-.3, .3), rz: R.range(-.4, .4) });
    torso.add(mesh(mergeGeos(items), M.hair, 0, 0, 0));
  } else if (G.crest === 'shroomRow') {
    const n = 3 + R.int(0, 3);
    for (let i = 0; i < n; i++) {
      const y = 1.22 + i * (.9 / n), x = R.range(-.13, .13);
      torso.add(mesh(new T3.CylinderGeometry(.028, .04, .16, 6), M.stem, x, y, -.40));
      torso.add(mesh(new T3.SphereGeometry(.10 + R.range(0, .05), 9, 6, 0, 6.28, 0, Math.PI / 2), M.cap, x, y + .10, -.40, 1, .7, 1));
    }
  }
}

/* ------------------------------------------------------------- NÖVEDÉKEK -- */
function addGrowths(g, torso, head, G, R, mossTone, own) {
  for (const kind of G.growths) {
    if (kind === 'glowShroom') {
      const n = 1 + R.int(0, 2);
      for (let i = 0; i < n; i++) {
        const mg = new T3.Group();
        const onHead = R.chance(.3);
        mg.position.set(R.range(-.38, .38), onHead ? .30 : R.range(1.25, 2.0), onHead ? -.06 : -.34);
        mg.scale.setScalar(R.range(.6, 1.15)); mg.rotation.set(R.range(-.5, .5), R.range(0, 6.28), R.range(-.5, .5));
        mg.add(mesh(new T3.CylinderGeometry(.035, .05, .22, 6), M.stem, 0, .11, 0));
        mg.add(mesh(new T3.SphereGeometry(.15, 10, 7, 0, 6.28, 0, Math.PI / 2), M.glowCap, 0, .24, 0, 1, .72, 1));
        const sp = new T3.Sprite(new T3.SpriteMaterial({ map: GLOW, color: 0x7fe2ff, transparent: true, opacity: .7, depthWrite: false, blending: T3.AdditiveBlending }));
        sp.scale.setScalar(.6); sp.position.y = .24; mg.add(sp); enableBloom(sp);
        (onHead ? head : torso).add(mg);
      }
    } else if (kind === 'pustule') {
      const pm = own(std({ color: 0xb6c95a, emissive: 0x7e9a2e, emissiveIntensity: .35, roughness: .45 }));
      const pus = [], n = 4 + R.int(0, 4);
      for (let i = 0; i < n; i++) {
        const a = R.range(0, 6.28), r = R.range(.05, .24);
        const py = R.range(1.20, 2.0), pz = -.22 - R.range(0, .26);
        pus.push({ geo: new T3.IcosahedronGeometry(r, 1), x: Math.cos(a) * .46, y: py, z: pz, sy: .84 });
        pus.push({ geo: new T3.ConeGeometry(r * .3, r * .6, 5), x: Math.cos(a) * .46, y: py - r * .8, z: pz, rx: Math.PI });
      }
      torso.add(mesh(mergeGeos(pus), pm, 0, 0, 0));
    } else if (kind === 'crystal') {
      const cl = [], n = 5 + R.int(0, 4);
      for (let i = 0; i < n; i++) {
        const a = R.range(0, 6.28), rr = R.range(.16, .34);
        cl.push({ geo: gradTint(new T3.OctahedronGeometry(.11 + R.range(0, .09), 0), 0x5a626e, 0xffffff, -.15, .15), x: Math.cos(a) * rr, y: R.range(1.18, 2.05), z: -.12 - R.range(0, .30), sy: 1.6 + R.range(0, .9), rx: R.range(-.55, .15), rz: R.range(-.5, .5) });
      }
      torso.add(mesh(mergeGeos(cl), M.rockV, 0, 0, 0));
    } else if (kind === 'bark') {
      const pl = [], n = 4 + R.int(0, 3);
      for (let i = 0; i < n; i++) {
        const a = R.range(-1.2, 1.2);
        pl.push({ geo: jitter(new T3.BoxGeometry(.30, .42, .10, 2, 2, 1), .05, .04), x: Math.sin(a) * .52, y: R.range(1.15, 2.0), z: Math.cos(a) * .32 - .06, ry: -a, rz: R.range(-.3, .3) });
      }
      torso.add(mesh(gradTint(mergeGeos(pl), 0x3c2a1c, 0xffffff, 1.0, 2.2), M.woodDarkV, 0, 0, 0));
    } else if (kind === 'vine') {
      const vm = own(std({ color: 0x55692f, roughness: .95 }));
      for (let k = 0; k < 2 + R.int(0, 2); k++) {
        const pts = []; const bx = R.range(-.4, .4), bz = R.range(-.4, .1);
        for (let i = 0; i <= 6; i++) pts.push(new T3.Vector3(bx + Math.sin(i * .9) * .12, 2.05 - i * .24, bz + Math.cos(i * .7) * .10));
        const tube = new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3(pts), 14, .022, 5, false), vm);
        tube.castShadow = true; torso.add(tube);
      }
    } else if (kind === 'shelf') {
      const sh = [], n = 2 + R.int(0, 3);
      for (let i = 0; i < n; i++) {
        const a = R.range(-1.4, 1.4);
        sh.push({ geo: new T3.CylinderGeometry(R.range(.13, .24), R.range(.10, .19), .05, 9, 1, false, 0, Math.PI), x: Math.sin(a) * .50, y: R.range(1.2, 2.05), z: Math.cos(a) * .36 - .05, ry: -a + Math.PI, rz: R.range(-.25, .25) });
      }
      torso.add(mesh(gradTint(mergeGeos(sh), 0x6b5a3c, 0xffffff, 1.1, 2.2), M.woodDarkV, 0, 0, 0));
    } else if (kind === 'lichen') {
      const lc = [], n = 4 + R.int(0, 4);
      for (let i = 0; i < n; i++) { const a = R.range(0, 6.28), r = R.range(.12, .2); lc.push({ geo: jitter(new T3.IcosahedronGeometry(r, 0), r * .3, r * .2), x: Math.cos(a) * .38, y: R.range(1.2, 2.05), z: Math.sin(a) * .30 - .06, sx: 1.2, sy: .55, sz: 1.2 }); }
      torso.add(mesh(mergeGeos(lc), M.lichen, 0, 0, 0));
    }
  }
}

