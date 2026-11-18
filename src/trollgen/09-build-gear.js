/* ------------------------------------------------------------- FELSZERELÉS -- */
function addGear(g, torso, head, arms, elbows, G, R, own) {
  const dye = own(std({ color: hsl(R.range(10, 45), R.range(.15, .4), R.range(.18, .30)), roughness: 1 }));
  for (const item of G.gear) {
    if (item === 'loincloth') {
      torso.add(mesh(new T3.CylinderGeometry(.42, .52, .36, 9), dye, 0, .98, 0));
      const f = mesh(jitter(new T3.BoxGeometry(.34, .44, .05, 2, 2, 1), .04, .03), dye, 0, .82, .40); f.rotation.x = .12; torso.add(f);
    } else if (item === 'belt') {
      const b = mesh(new T3.TorusGeometry(.46, .045, 5, 14), M.leather, 0, 1.14, 0, 1, 1, .92); b.rotation.x = Math.PI / 2; torso.add(b);
      torso.add(mesh(new T3.BoxGeometry(.13, .13, .05), M.gold, 0, 1.14, .44));
      torso.add(mesh(new T3.SphereGeometry(.13, 8, 7), M.leather, .38, 1.02, .30, 1, 1.2, .7));
    } else if (item === 'pauldron') {
      const s = R.chance(.5) ? 1 : -1;
      const p = mesh(jitter(new T3.SphereGeometry(.36, 9, 6, 0, 6.28, 0, Math.PI / 2), .04, .03), R.chance(.5) ? M.wood : M.rock, s * .60, 2.02, -.02);
      p.rotation.z = -s * .25; torso.add(p);
      const st = []; for (let i = 0; i < 3; i++) st.push({ geo: new T3.ConeGeometry(.042, .16, 5), x: s * (.48 + i * .09), y: 2.18, z: -.10 + i * .09, rz: -s * .3 });
      torso.add(mesh(mergeGeos(st), M.tusk, 0, 0, 0));
      const strap = mesh(new T3.BoxGeometry(.09, .78, .04), M.leather, s * .20, 1.68, .40); strap.rotation.z = s * .5; torso.add(strap);
    } else if (item === 'bracers') {
      ['L', 'R'].forEach(k => {
        elbows[k].add(mesh(new T3.CylinderGeometry(.145, .16, .20, 8), M.leather, 0, -.30, .02));
        const t2 = mesh(new T3.TorusGeometry(.15, .018, 5, 10), M.rope, 0, -.20, .02); t2.rotation.x = Math.PI / 2; elbows[k].add(t2);
      });
    } else if (item === 'necklace') {
      const bead = [];
      for (let i = -3; i <= 3; i++) {
        const x = i * .10, y = 2.06 - Math.abs(i) * .035, z = .30 - Math.abs(i) * .045;
        if (Math.abs(i) === 1 || Math.abs(i) === 3) bead.push({ geo: new T3.ConeGeometry(.032, .12, 4), x, y: y - .09, z, rx: Math.PI });
        else bead.push({ geo: new T3.SphereGeometry(.035, 6, 5), x, y, z });
      }
      torso.add(mesh(mergeGeos(bead), M.tuskV, 0, 0, 0));
    } else if (item === 'noseRing') {
      const r = mesh(new T3.TorusGeometry(.075, .016, 6, 14), M.gold, 0, -.14, .46); r.rotation.y = Math.PI / 2; head.add(r);
    } else if (item === 'armband') {
      const s = R.chance(.5) ? 'L' : 'R';
      const ab = mesh(new T3.TorusGeometry(.175, .028, 5, 11), M.gold, 0, -.26, 0); ab.rotation.x = Math.PI / 2; arms[s].add(ab);
    } else if (item === 'bandage') {
      const wrapMat = own(std({ color: 0xb6ac92, roughness: 1 }));
      const k = R.chance(.5) ? 'L' : 'R';
      for (let i = 0; i < 4; i++) { const t = mesh(new T3.TorusGeometry(.145, .026, 5, 11), wrapMat, 0, -.14 - i * .08, .02); t.rotation.x = Math.PI / 2 + R.range(-.2, .2); elbows[k].add(t); }
    } else if (item === 'warpaint') {
      const pm = own(std({ color: R.pick([0xd8dee8, 0xc23a2a, 0x2a2f3a, 0xe0b23a]), roughness: 1 }));
      for (let i = 0; i < 4; i++) { const b = mesh(new T3.BoxGeometry(.032, .24, .02), pm, -.27 + i * .18, .02, .27); b.rotation.z = R.range(-.15, .15); b.rotation.x = .12; head.add(b); }
      const ch = mesh(new T3.BoxGeometry(.44, .05, .02), pm, 0, 1.62, .44); ch.rotation.z = R.range(-.3, .3); torso.add(ch);
    } else if (item === 'trophy') {
      const sk = new T3.Group(); sk.position.set(R.range(-.28, .28), 1.06, .44); sk.rotation.set(.3, R.range(-.5, .5), R.range(-.4, .4)); sk.scale.setScalar(.55);
      sk.add(mesh(jitter(new T3.IcosahedronGeometry(.22, 1), .02, .02), M.tusk, 0, 0, 0, 1, .9, 1.05));
      sk.add(mesh(new T3.SphereGeometry(.07, 6, 5), M.mouth, -.09, .02, .19));
      sk.add(mesh(new T3.SphereGeometry(.07, 6, 5), M.mouth, .09, .02, .19));
      sk.add(mesh(new T3.BoxGeometry(.20, .05, .02), M.tusk, 0, -.16, .18));
      torso.add(sk);
    } else if (item === 'backSpikes') {
      const sp = [];
      for (let i = 0; i < 5; i++) sp.push({ geo: new T3.ConeGeometry(.052, .28, 5), x: R.range(-.32, .32), y: R.range(1.3, 2.05), z: -.48, rx: -1.2 });
      torso.add(mesh(mergeGeos(sp), M.rockV, 0, 0, 0));
    }
  }
}

/* ---------------------------------------------------------------- FEGYVER -- */
function addWeapon(fists, G, R, own) {
  const kind = G.weapon; if (kind === 'none') return null;
  const wear = G.weaponWear;
  const W = new T3.Group();
  const R_ = fists.R, L_ = fists.L;
  if (!R_) return null;

  const lash = (parent, y, r) => { const t = mesh(new T3.TorusGeometry(r, .022, 5, 10), M.cloth, 0, y, 0); t.rotation.x = Math.PI / 2; parent.add(t); };

  if (kind === 'club') {
    W.position.set(.19, -.04, .14); W.rotation.set(1.11, 0, -.48);
    const haft = mesh(new T3.CylinderGeometry(.055, .085, .95, 7), M.wood, 0, .30, 0); W.add(haft);
    haft.add(mesh(new T3.SphereGeometry(.075, 7, 6), M.woodDark, 0, -.50, 0));
    const hd = new T3.Group(); hd.position.set(0, .62, 0); haft.add(hd);
    hd.add(mesh(jitter(new T3.IcosahedronGeometry(.21, 1), .055, .05), M.woodDark, 0, 0, 0, 1, 1.15, 1));
    hd.add(mesh(mergeGeos([
      { geo: new T3.ConeGeometry(.055, .19, 5), x: .18, y: .06, z: .02, rz: -1.2 },
      { geo: new T3.ConeGeometry(.055, .19, 5), x: -.15, y: 0, z: .09, rz: 1.1, rx: .5 },
      { geo: new T3.ConeGeometry(.055, .19, 5), x: .02, y: .09, z: -.16, rx: -1.2 },
      { geo: new T3.ConeGeometry(.05, .16, 5), x: -.02, y: -.10, z: .14, rx: 1.3 },
    ]), M.tusk, 0, 0, 0));
    if (wear > .4) hd.add(mesh(new T3.SphereGeometry(.11, 7, 6), M.moss, -.07, .10, .07, 1, .7, 1));
    lash(haft, -.26, .080); lash(haft, -.34, .084);
  } else if (kind === 'maul') {
    W.position.set(.22, -.04, .14); W.rotation.set(.60, 0, -.44);   // a buzogányfej ELŐRE dől, kinyúlva a törzs mellé
    const haft = mesh(new T3.CylinderGeometry(.085, .11, 1.35, 7), M.woodDark, 0, .45, 0); W.add(haft);
    const hd = mesh(jitter(new T3.IcosahedronGeometry(.36, 1), .09, .08), M.rockV, 0, .78, 0);
    gradTint(hd.geometry, 0x646d7c, 0xffffff, -.4, .4); haft.add(hd);
    hd.add(mesh(mergeGeos([{ geo: new T3.ConeGeometry(.07, .22, 5), x: .30, y: .04, rz: -1.4 }, { geo: new T3.ConeGeometry(.07, .22, 5), x: -.30, y: -.04, rz: 1.4 }]), M.tusk, 0, 0, 0));
    lash(haft, .52, .11); lash(haft, -.30, .10);
  } else if (kind === 'daggers') {
    [L_, R_].forEach((f, i) => {
      const d = new T3.Group(); d.position.set(i ? -.10 : .10, -.04, .16); d.rotation.set(.53, 0, i ? .22 : -.22);
      d.add(mesh(new T3.CylinderGeometry(.028, .034, .18, 6), M.leather, 0, -.07, 0));
      const bl = mesh(new T3.ConeGeometry(.055, .44, 4), M.tusk, 0, .24, 0, 1, 1, .22); d.add(bl);
      d.add(mesh(new T3.BoxGeometry(.13, .022, .04), M.woodDark, 0, .02, 0));
      f.add(d);
    });
    return W;
  } else if (kind === 'spear') {
    W.position.set(.16, -.04, .14); W.rotation.set(.90, 0, -.24);   // a lándzsa ELŐRESZEGEZVE
    const haft = mesh(new T3.CylinderGeometry(.036, .046, 1.9, 7), M.wood, 0, .55, 0); W.add(haft);
    const tip = mesh(new T3.ConeGeometry(.075, .34, 4), M.tusk, 0, 1.10, 0, 1, 1, .38); haft.add(tip);
    for (let i = 0; i < 3; i++) { const fe = mesh(new T3.ConeGeometry(.03, .14, 4), M.feather, R.range(-.05, .05), .82 - i * .06, R.range(-.05, .05)); fe.rotation.x = R.range(.5, 1.2); haft.add(fe); }
    lash(haft, .92, .05);
  } else if (kind === 'axe') {
    W.position.set(.19, -.04, .14); W.rotation.set(1.11, 0, -.48);
    const haft = mesh(new T3.CylinderGeometry(.05, .07, 1.0, 7), M.wood, 0, .32, 0); W.add(haft);
    const bladeMat = own(std({ color: 0x8b93a2, roughness: .6, metalness: .2, flatShading: true }));
    const blade = mesh(jitter(new T3.BoxGeometry(.10, .40, .34, 1, 2, 2), .04, .03), bladeMat, .17, .66, 0);
    blade.rotation.z = -.16; haft.add(blade);
    haft.add(mesh(new T3.BoxGeometry(.07, .16, .10), M.rock, -.09, .60, 0));
    lash(haft, .50, .075);
  } else if (kind === 'staff') {
    W.position.set(.26, -.04, .14); W.rotation.set(.20, 0, -.16);   // a bot majdnem FÜGGŐLEGESEN áll a marokban
    const staffMat = own(new T3.MeshStandardMaterial({ color: 0x16414f, emissive: 0x36c5ff, emissiveIntensity: 1.5, roughness: .5, flatShading: true }));
    const haft = mesh(new T3.CylinderGeometry(.042, .055, 1.5, 7), M.wood, 0, .48, 0); W.add(haft);
    const upper = mesh(new T3.CylinderGeometry(.034, .042, .55, 7), M.wood, .05, 1.0, .03); upper.rotation.z = .16; haft.add(upper);
    const crystal = mesh(new T3.OctahedronGeometry(.19, 0), staffMat, .05, .38, 0); upper.add(crystal); enableBloom(crystal);
    crystal.add(mesh(new T3.OctahedronGeometry(.09, 0), staffMat, 0, 0, 0, 1, 2.1, 1));
    crystal.add(mesh(new T3.OctahedronGeometry(.075, 0), staffMat, .11, -.09, .02, 1, 1.5, 1));
    const sp = new T3.Sprite(new T3.SpriteMaterial({ map: GLOW, color: 0x9fe3ff, transparent: true, opacity: .8, depthWrite: false, blending: T3.AdditiveBlending }));
    sp.scale.setScalar(.9); crystal.add(sp); enableBloom(sp);
    haft.add(mesh(new T3.SphereGeometry(.07, 7, 6), M.moss, 0, .10, 0, 1, .6, 1));
    haft.add(mesh(new T3.ConeGeometry(.05, .13, 6), M.tusk, 0, -.78, 0));
    W.userData.crystal = crystal;
  } else if (kind === 'flail') {
    W.position.set(.19, -.04, .14); W.rotation.set(1.01, 0, -.46);
    const haft = mesh(new T3.CylinderGeometry(.045, .06, .62, 7), M.wood, 0, .2, 0); W.add(haft);
    /* a lánc a nyél végétől a golyóig ÉR — korábban rövidebb volt, ezért a
       tüskés golyó szabadon lógó, levált tárgynak látszott */
    const ch = []; for (let i = 0; i < 9; i++) ch.push({ geo: new T3.TorusGeometry(.040, .014, 4, 8), y: .34 + i * .066, rx: i % 2 ? 0 : Math.PI / 2 });
    haft.add(mesh(mergeGeos(ch), M.metal, 0, 0, 0));
    const ball = mesh(jitter(new T3.IcosahedronGeometry(.19, 0), .04, .04), M.rock, 0, 1.02, 0); haft.add(ball);
    const sp = []; for (let i = 0; i < 6; i++) { const a = R.range(0, 6.28), b = R.range(-1, 1); sp.push({ geo: new T3.ConeGeometry(.035, .16, 4), x: Math.cos(a) * .17, y: b * .16, z: Math.sin(a) * .17, rx: -b * 1.2, rz: -Math.cos(a) * 1.3 }); }
    ball.add(mesh(mergeGeos(sp), M.tusk, 0, 0, 0));
  } else if (kind === 'trunk') {
    W.position.set(.24, -.04, .14); W.rotation.set(.73, .10, -.50);
    /* A nagy kétkezes törzs a VÁLLON pihen (pozitív x-dőlés), nem a has előtt
       keresztben — így a sziluett tiszta marad, és a csapás a válltól indul. */
    const tr = mesh(jitter(new T3.CylinderGeometry(.13, .20, 1.30, 8), .04, .035), M.woodDark, 0, .48, 0); W.add(tr);
    for (let i = 0; i < 4; i++) { const br = mesh(new T3.CylinderGeometry(.033, .05, .28, 5), M.woodDark, R.range(-.18, .18), R.range(.2, 1.0), R.range(-.18, .18)); br.rotation.set(R.range(-1, 1), 0, R.range(-1, 1)); tr.add(br); }
    tr.add(mesh(new T3.SphereGeometry(.17, 8, 6), M.moss, .08, .60, .07, 1, .6, 1));
  } else if (kind === 'boulder') {
    W.position.set(.06, .02, .30); W.rotation.set(0, 0, 0);
    const b = mesh(jitter(new T3.DodecahedronGeometry(.30, 0), .09, .08), M.rockV, 0, 0, 0);
    gradTint(b.geometry, 0x5b6474, 0xffffff, -.4, .4); W.add(b);
    b.add(mesh(new T3.SphereGeometry(.14, 8, 6), M.moss, .07, .21, .04, 1.2, .5, 1.2));
  } else if (kind === 'shield') {
    const sh = new T3.Group(); sh.position.set(0, -.06, .16); sh.rotation.set(-.2, 0, .2);
    sh.add(mesh(jitter(new T3.CylinderGeometry(.36, .36, .08, 8), .04, .02), M.woodDark, 0, 0, 0));
    sh.add(mesh(new T3.SphereGeometry(.11, 8, 6), M.metal, 0, 0, .08));
    for (let i = 0; i < 5; i++) { const n = mesh(new T3.SphereGeometry(.03, 5, 4), M.metal, Math.cos(i * 1.26) * .27, Math.sin(i * 1.26) * .27, .06); sh.add(n); }
    L_.add(sh);
    return W;
  }
  R_.add(W);
  return W;
}

/* ------------------------------------------------------------- SÉRÜLÉSEK -- */
function addWounds(g, torso, head, arms, elbows, G, R, own) {
  for (const w of G.wounds) {
    if (w === 'scars') {
      const n = 1 + R.int(0, 2);
      for (let i = 0; i < n; i++) {
        const y = R.range(1.25, 2.0), x = R.range(-.32, .32);
        const s = mesh(new T3.CylinderGeometry(.016, .016, R.range(.22, .45), 5), M.scar, x, y, .42);
        s.rotation.z = R.range(-1, 1); s.rotation.x = .2; s.castShadow = false; torso.add(s);
        for (let k = 0; k < 4; k++) { const st = mesh(new T3.BoxGeometry(.07, .012, .012), M.scar, x + R.range(-.08, .08), y - .12 + k * .06, .43); st.rotation.z = -.85; st.castShadow = false; torso.add(st); }
      }
    } else if (w === 'missingEye') {
      const s = R.chance(.5) ? -1 : 1;
      const patch = mesh(jitter(new T3.IcosahedronGeometry(.11, 0), .02, .02), M.cloth, s * .15, .05, .31, 1, 1, .5);
      head.add(patch);
      const strap = mesh(new T3.TorusGeometry(.30, .015, 5, 14), M.cloth, 0, .06, .02); strap.rotation.y = Math.PI / 2; strap.rotation.z = .3; head.add(strap);
    } else if (w === 'patches') {
      const bald = own(std({ color: G.skinDeep, roughness: 1 }));
      for (let i = 0; i < 3; i++) torso.add(mesh(jitter(new T3.IcosahedronGeometry(R.range(.10, .18), 0), .03, .02), bald, R.range(-.38, .38), R.range(1.2, 1.95), R.range(.28, .42), 1, 1, .35));
    } else if (w === 'oldArrows') {
      const n = 1 + R.int(0, 2);
      for (let i = 0; i < n; i++) {
        const a = R.range(-1.1, 1.1), tgt = R.chance(.25) ? head : torso;
        const arr = makeStubArrow();
        arr.position.set(Math.sin(a) * .44, tgt === head ? R.range(-.1, .2) : R.range(1.25, 1.98), Math.cos(a) * .38);
        arr.rotation.set(R.range(-.4, .4), -a, R.range(-.3, .3));
        tgt.add(arr);
      }
    } else if (w === 'stumpArm') {
      /* a kéz már nem épült meg (lásd fist) — ide csak vér/kötés-gyűrű kell */
      const b = mesh(new T3.TorusGeometry(.145, .03, 5, 11), own(std({ color: 0x8a2f22, roughness: 1 })), 0, -.40, .02);
      b.rotation.x = Math.PI / 2; elbows.R.add(b);
    }
  }
  /* kor: fakó zuzmó-lepedék az öregeken */
  if (G.age > .7) {
    const lc = [];
    for (let i = 0; i < 5; i++) { const a = R.range(0, 6.28); lc.push({ geo: jitter(new T3.IcosahedronGeometry(R.range(.08, .15), 0), .03, .02), x: Math.cos(a) * .42, y: R.range(1.15, 2.05), z: Math.sin(a) * .34, sy: .5 }); }
    torso.add(mesh(mergeGeos(lc), M.lichen, 0, 0, 0));
  }
}

function makeStubArrow(el) {
  const A = ARROW_EL[el] || ARROW_EL.base;
  const a = new T3.Group();
  const shaft = mesh(new T3.CylinderGeometry(.012, .014, .46, 6), M.arrowWood, 0, .23, 0); a.add(shaft);
  a.add(mesh(new T3.TorusGeometry(.017, .005, 4, 9), std({ color: A.band, roughness: .6 }), 0, .30, 0)).rotation.x = Math.PI / 2;
  const fm = std({ color: A.feather, roughness: .85, side: T3.DoubleSide });
  [0, 1, 2].forEach(i => { const f = mesh(new T3.PlaneGeometry(.115, .05), fm, 0, .41, 0); f.rotation.y = i * (Math.PI * 2 / 3); f.rotation.x = .1; a.add(f); });
  a.add(mesh(new T3.CylinderGeometry(.013, .010, .02, 6), M.tusk, 0, .455, 0));
  a.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return a;
}

/* ------------------------------------------------------- ELEM — MÉLY RÉTEG -- */
function addElementLayer(g, torso, head, arms, G, P, R, own) {   // arms = könyök-Group-ok
  if (G.el === 'ice') {
    const iceMat = own(new T3.MeshStandardMaterial({ color: P.status, emissive: P.core, emissiveIntensity: .45, roughness: .25, metalness: .1, flatShading: true, transparent: true, opacity: .88 }));   // --status-ice / --el-ice-core
    const shards = [], n = 9 + R.int(0, 6);
    for (let i = 0; i < n; i++) {
      const a = R.range(0, 6.28), r = R.range(.26, .40);
      shards.push({ geo: new T3.OctahedronGeometry(R.range(.07, .17), 0), x: Math.cos(a) * r, y: R.range(1.10, 2.10), z: Math.sin(a) * r * .8, sy: R.range(1.3, 2.4), rx: R.range(-.6, .6), rz: R.range(-.6, .6) });
    }
    torso.add(mesh(mergeGeos(shards), iceMat, 0, 0, 0));
    const ic = []; for (let i = 0; i < 4; i++) ic.push({ geo: new T3.ConeGeometry(.028, R.range(.12, .24), 4), x: R.range(-.18, .18), y: -.24, z: R.range(.22, .38), rx: Math.PI });
    head.add(mesh(mergeGeos(ic), iceMat, 0, 0, 0));
    ['L', 'R'].forEach(k => arms[k].add(mesh(new T3.OctahedronGeometry(.115, 0), iceMat, 0, -.20, .06, 1, 1.5, 1)));
  } else if (G.el === 'fire') {
    const crackMat = own(new T3.MeshBasicMaterial({ color: P.mid, transparent: true, opacity: .95, depthWrite: false, blending: T3.AdditiveBlending }));   // --el-fire-mid
    const cr = [], n = 12 + R.int(0, 8);
    for (let i = 0; i < n; i++) {
      const a = R.range(-1.5, 1.5);                       // főleg elöl/oldalt, a látható felületen
      cr.push({ geo: new T3.BoxGeometry(.024, R.range(.12, .30), .024), x: Math.sin(a) * .44, y: R.range(1.10, 2.05), z: Math.cos(a) * .38, ry: -a, rz: R.range(-.5, .5) });
    }
    const cm = mesh(mergeGeos(cr), crackMat, 0, 0, 0); cm.castShadow = false; torso.add(cm); enableBloom(cm);
    for (let i = 0; i < 4; i++) {
      const sp = new T3.Sprite(new T3.SpriteMaterial({ map: GLOW, color: P.glow, transparent: true, opacity: .55, depthWrite: false, blending: T3.AdditiveBlending }));   // --el-fire-glow
      sp.scale.setScalar(R.range(.4, .8)); sp.position.set(R.range(-.42, .42), R.range(1.3, 2.1), R.range(-.3, .3)); torso.add(sp); enableBloom(sp);
    }
    const emb = own(std({ color: P.deep, emissive: P.core, emissiveIntensity: .8, roughness: .9 }));   // --el-fire-deep (korom) + --el-fire-core
    head.add(mesh(jitter(new T3.IcosahedronGeometry(.16, 0), .04, .03), emb, R.range(-.2, .2), .22, -.14, 1.2, .5, 1));
  } else if (G.el === 'poison') {
    const gm = own(std({ color: P.mid, emissive: P.core, emissiveIntensity: .5, roughness: .35 }));   // --el-poison-mid / -core
    const bl = [], n = 7 + R.int(0, 5);
    for (let i = 0; i < n; i++) {
      const a = R.range(0, 6.28), r = R.range(.05, .17);
      const by = R.range(1.15, 2.05);
      bl.push({ geo: new T3.IcosahedronGeometry(r, 1), x: Math.cos(a) * .46, y: by, z: Math.sin(a) * .40, sy: .9 });
      bl.push({ geo: new T3.ConeGeometry(r * .35, r * .9, 5), x: Math.cos(a) * .46, y: by - r, z: Math.sin(a) * .40, rx: Math.PI });
    }
    torso.add(mesh(mergeGeos(bl), gm, 0, 0, 0));
    head.add(mesh(new T3.SphereGeometry(.06, 6, 5), gm, R.range(-.1, .1), -.30, .34, 1, 1.6, 1));
  } else if (G.el === 'lightning') {
    const arcMat = own(new T3.MeshBasicMaterial({ color: P.mid, transparent: true, opacity: .9, depthWrite: false, blending: T3.AdditiveBlending }));   // --el-lightning-mid: a kék-fehér ív-test
    const rods = [], n = 5 + R.int(0, 4);
    for (let i = 0; i < n; i++) {
      const a = R.range(0, 6.28);
      rods.push({ geo: new T3.CylinderGeometry(.014, .008, R.range(.22, .5), 4), x: Math.cos(a) * .46, y: R.range(1.15, 2.10), z: Math.sin(a) * .38, rz: R.range(-1.2, 1.2), rx: R.range(-.8, .8) });
    }
    const rm = mesh(mergeGeos(rods), arcMat, 0, 0, 0); rm.castShadow = false; torso.add(rm); enableBloom(rm);
    const orb = new T3.Group(); orb.position.y = 1.75; torso.add(orb);
    const shardMat = own(std({ color: P.deep, emissive: P.core, emissiveIntensity: 1.4, roughness: .5 }));   // --el-lightning-deep / -core (ibolya)
    for (let i = 0; i < 3; i++) { const s = mesh(new T3.OctahedronGeometry(.075, 0), shardMat, Math.cos(i * 2.1) * .62, R.range(-.2, .35), Math.sin(i * 2.1) * .5, 1, 1.6, 1); orb.add(s); enableBloom(s); }
    g.userData.orbit = orb;
  }
  /* közös: elem-aura */
  const aura = new T3.Sprite(new T3.SpriteMaterial({ map: GLOW, color: P.light, transparent: true, opacity: .5, depthWrite: false, blending: T3.AdditiveBlending }));   // --el-<e>-light
  aura.scale.setScalar(2.6); aura.position.y = 1.5; g.add(aura); g.userData.elAura = aura;
}

/* ------------------------------------------------------- ELIT / RITKA-BOSS -- */
function addTier(g, torso, head, G, R, own) {
  if (G.tier === 'normal') return null;
  const gold = G.tier === 'boss';
  const fx = {};
  /* izzó rúna-billog a mellkason */
  const runeMat = own(new T3.MeshBasicMaterial({ color: gold ? 0xffd27a : 0x7fe2ff, transparent: true, opacity: .95, depthWrite: false, blending: T3.AdditiveBlending }));
  const rune = [];
  for (let i = 0; i < (gold ? 7 : 4); i++) {
    const a = (i / (gold ? 7 : 4)) * 6.28;
    rune.push({ geo: new T3.BoxGeometry(.032, .10, .015), x: Math.cos(a) * .17, y: 1.70 + Math.sin(a) * .15, z: .43, rz: a });
  }
  const rm = mesh(mergeGeos(rune), runeMat, 0, 0, 0); rm.castShadow = false; torso.add(rm); enableBloom(rm);

  /* csont-korona */
  const crown = [];
  const cn = gold ? 9 : 5;
  for (let i = 0; i < cn; i++) {
    const a = -1.5 + i * (3.0 / (cn - 1));
    crown.push({ geo: new T3.ConeGeometry(.038, .20 + Math.sin(i) * .10, 5), x: Math.sin(a) * .32, y: .34, z: Math.cos(a) * .22 - .06, rx: -.25 + Math.cos(a) * .2, rz: Math.sin(a) * .7 });
  }
  head.add(mesh(mergeGeos(crown), gold ? M.tuskV : M.tuskV, 0, 0, 0));

  /* aura */
  const aura = new T3.Sprite(new T3.SpriteMaterial({ map: GLOW, color: gold ? 0xffd27a : 0x9fd8ff, transparent: true, opacity: gold ? .5 : .3, depthWrite: false, blending: T3.AdditiveBlending }));
  aura.material.opacity = gold ? .28 : .18;
  aura.scale.setScalar(gold ? 3.6 : 2.8); aura.position.y = 1.55; g.add(aura);
  fx.aura = aura;

  if (gold) {
    /* háti totem: koponyákkal teleaggatott póznázsák */
    const tot = new T3.Group(); tot.position.set(-.1, 1.45, -.54); tot.rotation.z = .18; torso.add(tot);
    tot.add(mesh(new T3.CylinderGeometry(.045, .055, 1.5, 6), M.woodDark, 0, .5, 0));
    for (let i = 0; i < 3; i++) {
      const s = new T3.Group(); s.position.set(R.range(-.16, .16), .95 - i * .30, R.range(-.08, .08)); s.scale.setScalar(.4);
      s.add(mesh(jitter(new T3.IcosahedronGeometry(.24, 1), .02, .02), M.tusk, 0, 0, 0));
      s.add(mesh(new T3.SphereGeometry(.08, 6, 5), M.mouth, -.10, .02, .20));
      s.add(mesh(new T3.SphereGeometry(.08, 6, 5), M.mouth, .10, .02, .20));
      tot.add(s);
    }
    const pl = [];
    for (let i = 0; i < 6; i++) { const a = R.range(-1.3, 1.3); pl.push({ geo: jitter(new T3.IcosahedronGeometry(.30, 1), .06, .05), x: Math.sin(a) * .56, y: R.range(1.2, 2.05), z: Math.cos(a) * .36, sy: .5, ry: -a }); }
    torso.add(mesh(gradTint(mergeGeos(pl), 0x6d7787, 0xffffff, 1.1, 2.2), M.rockV, 0, 0, 0));
  }
  return fx;
}

/* --------------------------------------------------------- LIDÉRC-FEJ ----- */
function buildWraithHead(head, G, R, bodySkin, eyeM, own, P) {
  const boneMat = own(std({ color: 0xdfd3bb, roughness: .55 }));
  const hoodMat = own(std({ color: 0x14283a, emissive: new T3.Color(P ? P.core : dsHex('--rune-deep', 0x16414f)), emissiveIntensity: .4, roughness: 1 }));
  /* csuklya: rongyos kúp + torus-keret */
  head.add(mesh(jitter(new T3.ConeGeometry(.34, .58, 7), .055, .035), hoodMat, 0, .14, -.14, 1.1, 1, 1.15));
  const hood = mesh(new T3.TorusGeometry(.26, .062, 6, 12), hoodMat, 0, .02, .10); hood.rotation.x = -.16; head.add(hood);
  /* csont-maszk */
  const skull = mesh(jitter(new T3.IcosahedronGeometry(.24, 1), .015, .012), boneMat, 0, -.01, .13, 1, 1.15, .8); head.add(skull);
  head.add(mesh(new T3.SphereGeometry(.10, 7, 6), own(new T3.MeshBasicMaterial({ color: 0x05080d })), 0, -.15, .26, 1.35, .85, .6)); // üres szájüreg
  const teeth = [];
  for (let i = -2; i <= 2; i++) teeth.push({ geo: new T3.BoxGeometry(.028, .07, .02), x: i * .052, y: -.13, z: .31 });
  head.add(mesh(mergeGeos(teeth), boneMat, 0, 0, 0));
  /* szemek: mély üregek + izzó pont */
  const eyes = [];
  const lay = eyeLayout(G.eyeCount === 1 ? 1 : (G.eyeCount >= 3 ? 3 : 2));
  lay.forEach(pt => {
    head.add(mesh(new T3.SphereGeometry(G.eyeSize * 2.0 * pt.s, 8, 7), own(new T3.MeshBasicMaterial({ color: 0x03060a })), pt.x * .86, pt.y + .02, pt.z * .78 + .06, 1, 1.25, .5));
    const e = mesh(new T3.SphereGeometry(G.eyeSize * .9 * pt.s, 8, 7), eyeM, pt.x * .86, pt.y + .02, pt.z * .78 + .09); head.add(e); eyes.push(e); enableBloom(e);
    const sp = new T3.Sprite(new T3.SpriteMaterial({ map: GLOW, color: eyeM.emissive.getHex(), transparent: true, opacity: .8, depthWrite: false, blending: T3.AdditiveBlending }));
    sp.scale.setScalar(G.eyeSize * 6.5); sp.position.set(pt.x * .86, pt.y + .02, pt.z * .78 + .13); head.add(sp); enableBloom(sp);
  });
  head.userData.eyes = eyes;
  head.userData.jaw = new T3.Group(); head.add(head.userData.jaw);
  /* belső mag-ragyogás */
  const core = new T3.Sprite(new T3.SpriteMaterial({ map: GLOW, color: P ? P.light : dsHex('--cyan', 0x7fe2ff), transparent: true, opacity: .55, depthWrite: false, blending: T3.AdditiveBlending }));
  core.scale.setScalar(1.15); core.material.opacity = .38; core.position.set(0, -.9, 0); head.add(core);
}

