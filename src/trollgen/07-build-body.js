/* ============================================================================
   4) BUILD — a genomból THREE.Group
   ========================================================================== */
function build(G) {
  const R = RNG(hashStr(String(G.seed)) ^ 0x9e3779b9);
  const g = new T3.Group();
  const P = EL[G.el] || null;

  /* ---- per-troll anyagok (disposeMonster ezeket dobja el) ---- */
  const bodySkin = std({ color: G.skin, bumpMap: SKIN_N, bumpScale: .018, vertexColors: true });
  /* tokens/elements.css: "Status tint: multiply troll material color by --status-<e>;
     emissive parts keep their own glow." — ezért SZORZUNK, nem cserélünk színt. */
  if (P) { bodySkin.color.multiply(new T3.Color(P.status)).multiplyScalar(1.35);
           bodySkin.emissive = new T3.Color(P.core); bodySkin.emissiveIntensity = P.emInt * .28; }
  const eyeM = new T3.MeshStandardMaterial({ color: new T3.Color(P ? P.glow : G.eyeColor).multiplyScalar(.35), emissive: new T3.Color(P ? P.glow : G.eyeColor), emissiveIntensity: .95, roughness: .4 });
  const mossTone = std({ color: hsl(R.range(85, 130), R.range(.22, .40), R.range(.30, .45)), roughness: .92, map: MOSS_T, bumpMap: MOSS_T, bumpScale: .06, vertexColors: true });
  const perMat = [bodySkin, eyeM, mossTone];
  const own = (m) => { perMat.push(m); return m; };

  const tint = (geo, yMin, yMax) => { gradTint(geo, G.skinDeep, 0xffffff, yMin, yMax); mottleTint(geo, G.mottle, .55, R.next); return geo; };
  const sc = G.scale;
  /* MOHA-AKKUMULÁCIÓ paraméterek — a genom moss-arányából, seedelt folt-eltolással */
  const MREL = mossRel(G.skin, mossTone.color.getHex());
  const MSX = R.range(0, 40), MSZ = R.range(0, 40);
  const mossPass = (geo, covMul, thickMul) => G.moss < .05 ? geo : mossify(geo, {
    rel: MREL, cov: Math.min(.95, G.moss * (covMul === undefined ? 1 : covMul)),
    thick: .05 * (thickMul === undefined ? 1 : thickMul) * (.6 + G.moss * .8),
    flat: .34 - G.moss * .12, scale: 2.4, sx: MSX, sz: MSZ });

  /* ---------------------------------------------------------------- LÁBAK -- */
  const legs = {}, knees = {}, ankles = {};
  if (!G.wraith) {
    [-1, 1].forEach(sd => {
      const K = sd < 0 ? 'L' : 'R';
      const th = G.legThick * (1 + (sd > 0 ? G.asym : -G.asym) * .3);
      /* CSÍPŐ */
      const hip = new T3.Group();
      hip.position.set(sd * .26 * G.torsoW, .95, 0);
      hip.scale.set(th, 1 + (G.toad ? -.16 : 0), th);
      /* csípő-gömb: a törzs és a comb közti hézagot kitölti, a pivotra ül -> forgatásnál sem nyílik szét */
      hip.add(mesh(mossPass(jitter(new T3.IcosahedronGeometry(.255, 0), .022, .018), .6, .7), bodySkin, 0, 0, 0, 1, .95, 1));
      hip.add(mesh(tint(new T3.CylinderGeometry(.245, .195, .50, 8), -.55, .05), bodySkin, 0, -.24, 0));   // comb (a gömbbe lóg)

      /* TÉRD */
      const knee = new T3.Group(); knee.position.set(0, -.46, 0); hip.add(knee);
      knee.add(mesh(jitter(new T3.IcosahedronGeometry(.195, 0), .026, .02), bodySkin, 0, 0, .01));          // térdkalács
      knee.add(mesh(tint(new T3.CylinderGeometry(.185, .135, .46, 8), -.52, .04), bodySkin, 0, -.22, .02)); // lábszár
      if (G.moss > .35) knee.add(mesh(jitter(new T3.IcosahedronGeometry(.15, 0), .03, .03), mossTone, sd * .05, .02, .10));

      /* BOKA + LÁBFEJ */
      const ank = new T3.Group(); ank.position.set(0, -.44, .02); knee.add(ank);
      ank.add(mesh(jitter(new T3.IcosahedronGeometry(.155, 0), .02, .018), bodySkin, 0, 0, 0));
      ank.add(mesh(tint(jitter(new T3.IcosahedronGeometry(.18, 0), .024, .02), -.14, .10), bodySkin, 0, -.04, .15, 1.45, .52, 1.85));
      const toes = []; [-1, 0, 1].forEach(i => toes.push({ geo: new T3.ConeGeometry(G.toad ? .085 : .058, G.toad ? .22 : .17, 5), x: i * (G.toad ? .115 : .095), y: -.05, z: .32, rx: 1.25, sy: G.toad ? .5 : 1 }));
      ank.add(mesh(mergeGeos(toes), M.tusk, 0, 0, 0));

      g.add(hip); legs[K] = hip; knees[K] = knee; ankles[K] = ank;
    });
  } else {
    /* LIDÉRC: nincs láb — rongyos, lefelé futó szellem-uszály */
    const cloak = own(std({ color: 0x14283a, emissive: new T3.Color(P ? P.core : dsHex('--rune-deep', 0x16414f)), emissiveIntensity: .35, roughness: 1 }));
    const rags = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * 6.283 + R.range(-.25, .25), r = R.range(.10, .34);
      rags.push({ geo: jitter(new T3.ConeGeometry(R.range(.055, .115), R.range(.7, 1.5), 4), .08, .06), x: Math.cos(a) * r, y: R.range(.55, 1.0), z: Math.sin(a) * r * .8, rx: Math.PI + R.range(-.22, .22), rz: R.range(-.28, .28) });
    }
    rags.push({ geo: jitter(new T3.CylinderGeometry(.30, .56, 1.25, 9), .06, .05), y: 1.42 });      // fő köpeny (fent keskeny, lent bő)
    g.add(mesh(gradTint(mergeGeos(rags), 0x08141e, 0xffffff, .1, 1.9), cloak, 0, 0, 0));
    legs.L = new T3.Group(); legs.R = new T3.Group(); g.add(legs.L); g.add(legs.R);
    knees.L = new T3.Group(); knees.R = new T3.Group(); legs.L.add(knees.L); legs.R.add(knees.R);
    ankles.L = new T3.Group(); ankles.R = new T3.Group();
  }

  /* ---------------------------------------------------------------- TÖRZS --
     ÍZÜLET-LÁNC VALÓDI PIVOTOKKAL. Minden ízület két csoport: a `*J` pivot a
     forgásközéppont magasságában ül, a hozzá tartozó offset-csoport visszatolja
     az origót — így az alább írt Y-értékek továbbra is VILÁG-magasságok, de a
     forgás az anatómiai ízületnél történik, nem a talajnál.
         pelvisJ (y .95  — csípő)  : medence-billenés / -fordulás
         spineJ  (y 1.30 — derék)  : dőlés + gerinc-ellenrotáció
     A karok és a fej a `torso`-ban lógnak, tehát a gerinccel EGYÜTT mozognak.
     (Korábban a gyökér alatt ültek: a törzs fordult, a kar/fej nem — ettől
     vált szét oldalnézetben a sziluett.) A lábak a gyökér alatt maradnak,
     hogy a medence billenése ne emelje meg a talpakat. */
  const pelvisJ = new T3.Group(); pelvisJ.position.y = .95; g.add(pelvisJ);
  const pelvisIn = new T3.Group(); pelvisIn.position.y = -.95; pelvisJ.add(pelvisIn);
  const spineJ = new T3.Group(); spineJ.position.y = 1.30; spineJ.rotation.x = G.lean; pelvisIn.add(spineJ);
  const torso = new T3.Group(); torso.position.y = -1.30; spineJ.add(torso);

  /* medence — a derék bekötése, hogy a has ne közvetlenül a combon üljön.
     A medence-csoportban marad: nem örökli a gerinc dőlését, így a csípő
     a combfejeken ül akkor is, amikor a troll erősen előredől. */
  const pelvGeo = jitter(new T3.IcosahedronGeometry(.36, 1), .03, .022);
  gradTint(pelvGeo, G.skinDeep, 0xffffff, -.4, .4);
  pelvisIn.add(mesh(mossPass(pelvGeo, .5, .7), bodySkin, 0, 1.02, 0, 1.12 * G.torsoW, .88, .96));
  /* derék-áthidalás: a medence és a has közti hézagot tölti ki, a gerinc-pivotra
     ül, így hajláskor sem nyílik rés (a has a spineJ-vel fordul, ez nem) */
  pelvisIn.add(mesh(mossPass(jitter(new T3.IcosahedronGeometry(.30, 1), .026, .02), .5, .7), bodySkin, 0, 1.26, .01, 1.02 * G.torsoW, .78, .92));

  /* has — lejjebb és keskenyebben, hogy a váll domináljon */
  const bellyGeo = jitter(new T3.IcosahedronGeometry(.48, 1), .03, .024);
  gradTint(bellyGeo, G.skinDeep, 0xffffff, -.5, .5, 1.0, 'z');
  mottleTint(bellyGeo, G.mottle, .38, R.next);
  torso.add(mesh(mossPass(bellyGeo, .7, .9), bodySkin, 0, 1.38 + G.bellySag * .25, G.toad ? .12 : .02, 1.02 * G.torsoW, 1.0 + G.bellySag, .88 + (G.toad ? .3 : 0)));

  /* világos has-lap: value-kontraszt, ami BÁRMELY elem-tint alatt megtartja a formát */
  const paleMat = own(std({ color: G.skinPale, roughness: .88, vertexColors: true }));
  torso.add(mesh(radialTint(new T3.SphereGeometry(.38, 11, 8), 0xffffff, 0xcfc6ae, .46), paleMat, 0, 1.32, .28, 1.0 * G.torsoW, .95, .55));

  /* MELLKAS — szélesebb, mint a has: ez a fenyegető sziluett kulcsa */
  const chestGeo = jitter(new T3.IcosahedronGeometry(.46, 1), .034, .024);
  gradTint(chestGeo, G.skinDeep, 0xffffff, -.5, .5, 1.0, 'z');
  mottleTint(chestGeo, G.mottle, .42, R.next);
  torso.add(mesh(mossPass(chestGeo, 1.15, 1.15), bodySkin, 0, 1.84, -.05 - G.hunch * .3, 1.20 * G.shoulderW, .88 + G.hunch, .90));
  /* trapéz-púp a nyak mögött (nem nyeli el a fejet) */
  torso.add(mesh(mossPass(jitter(new T3.IcosahedronGeometry(.28, 1), .04, .03), 1.3, 1.3), bodySkin, 0, 1.98 + G.hunch * .3, -.26, 1.55 * G.shoulderW, .52 + G.hunch, .8));
  /* vállgumók: a kar tövét kitöltik, nincs rés */
  [-1, 1].forEach(s2 => torso.add(mesh(mossPass(jitter(new T3.IcosahedronGeometry(.235, 1), .03, .025), 1.35, 1.35), bodySkin, s2 * .55 * G.shoulderW, 1.92, -.02, 1.05, .95, 1.0)));
  /* NYAK — látszik, hogy a fej ne a mellkasból nőjön ki */
  torso.add(mesh(new T3.CylinderGeometry(.155, .225, .34, 8), bodySkin, 0, 2.14 + G.neckLen * .5, .0));

  /* moha-kéreg a háton/vállon, a moss-arány szerint */
  if (G.moss > .35) {
    const crust = [];
    const n = 2 + Math.round(G.moss * 3);
    for (let i = 0; i < n; i++) {
      const a = R.range(0, 6.28), rr = R.range(.16, .30);
      crust.push({ geo: jitter(new T3.IcosahedronGeometry(rr, 0), rr * .3, rr * .22), x: Math.cos(a) * .38 * G.shoulderW, y: R.range(1.15, 2.05), z: -.26 - R.range(0, .28), sy: .68 });
    }
    torso.add(mesh(gradTint(mergeGeos(crust), 0x6a8064, 0xffffff, 1.1, 2.1), mossTone, 0, 0, 0));
  }

  /* ---------------------------------------------------------------- KAROK -- */
  const arms = {}, elbows = {}, fists = {};
  [-1, 1].forEach(sd => {
    const K = sd < 0 ? 'L' : 'R', mir = sd < 0 ? -1 : 1;
    const th = G.armThick * (1 + (sd > 0 ? G.asym : -G.asym) * .35);
    /* VÁLL */
    const arm = new T3.Group();
    arm.position.set(sd * (.52 * G.shoulderW + .09), 1.90, -.01);
    arm.scale.set(th, G.armLen, th);
    arm.add(mesh(mossPass(jitter(new T3.IcosahedronGeometry(.225, 0), .026, .02), 1.25, 1.15), bodySkin, 0, 0, 0));   // deltoid (moha ül a vállon) — kitölti a váll-hézagot
    arm.add(mesh(gradTint(new T3.CylinderGeometry(.175, .14, .48, 8), G.skinDeep, 0xffffff, -.5, .05), bodySkin, 0, -.24, 0));

    /* KÖNYÖK */
    const elb = new T3.Group(); elb.position.set(0, -.46, 0); arm.add(elb);
    elb.add(mesh(jitter(new T3.IcosahedronGeometry(.16, 0), .022, .018), bodySkin, 0, 0, 0));
    elb.add(mesh(gradTint(new T3.CylinderGeometry(.155, .12, .46, 8), G.skinDeep, 0xffffff, -.5, .05), bodySkin, 0, -.22, .02));
    if (G.moss > .3) elb.add(mesh(jitter(new T3.IcosahedronGeometry(.13, 0), .03, .03), mossTone, 0, -.02, -.09));

    /* ÖKÖL — a könyök gyereke, így a hajlítással együtt mozog */
    const fist = new T3.Group(); fist.position.set(0, -.46, .03); elb.add(fist);
    fist.add(mesh(jitter(new T3.IcosahedronGeometry(.155, 0), .03, .028), bodySkin, 0, 0, 0, 1.05, .95, 1.15));
    const hasHand = !(G.wounds.indexOf('stumpArm') >= 0 && sd > 0);
    if (hasHand) {
      /* MAROK EGY FÜGGŐLEGES NYÉL KÖRÉ.
         Korábban a három ujj oldalra legyeződve, x mentén sorakozott és az yz-síkban
         hajlott — a fegyver nyélie viszont y irányú, tehát MERŐLEGES volt az ujjak
         hajlására: a bunkó nem a marokban ült, hanem oda volt ragasztva a bütyökhöz.
         Most az ujjak a NYÉL MENTÉN (y) sorakoznak egymás alatt, és az xz-síkban
         zárnak rá — a hüvelyk felülről fogózik. */
      const HX = 0, HZ = .12;                                  // a nyél tengelye a marokban
      const palm = mesh(jitter(new T3.IcosahedronGeometry(.115, 0), .02, .018), bodySkin, HX - mir * .085, -.06, HZ - .02, .9, 1.5, 1.15);
      fist.add(palm);
      const fing = [];
      for (let i = 0; i < 3; i++) {
        const fy = .03 - i * .085;
        fing.push({ geo: new T3.CylinderGeometry(.036, .030, .155, 5), x: HX - mir * .095, y: fy, z: HZ - .050, rz: mir * 1.20 });   // alsó perc: a tenyértől előre
        fing.push({ geo: new T3.SphereGeometry(.033, 5, 4),            x: HX + mir * .010, y: fy, z: HZ + .040 });                     // bütyök a nyél elülső oldalán
        fing.push({ geo: new T3.CylinderGeometry(.030, .024, .125, 5), x: HX + mir * .080, y: fy, z: HZ + .015, rz: mir * 2.05 });   // felső perc: átfordul, zárja a marokot
      }
      fing.push({ geo: new T3.CylinderGeometry(.038, .030, .17, 5), x: HX - mir * .050, y: .10, z: HZ + .015, rx: -.55, rz: mir * .80 });   // hüvelyk felülről
      fist.add(mesh(gradTint(mergeGeos(fing), G.skinDeep, 0xffffff, -.26, .08), bodySkin, 0, 0, 0));
      const claws = [];
      for (let i = 0; i < 3; i++) claws.push({ geo: new T3.ConeGeometry(.022, .09, 4), x: HX + mir * .132, y: .03 - i * .085, z: HZ + .010, rz: mir * 2.35 });
      fist.add(mesh(mergeGeos(claws), M.tusk, 0, 0, 0));
    } else {
      fist.add(mesh(new T3.CylinderGeometry(.14, .12, .13, 8), M.cloth, 0, -.05, 0));
      const wr = mesh(new T3.TorusGeometry(.13, .024, 5, 10), M.cloth, 0, -.11, 0); wr.rotation.x = Math.PI / 2; fist.add(wr);
    }
    /* nyugalmi póz: kar kissé előre, könyök behajlítva — nem lóg élettelenül */
    arm.rotation.x = .34; elb.rotation.x = -.42;
    /* A KAR A TÖRZS GYEREKE — a vállgumó (torso, y1.92) és a kar-pivot (y1.90)
       ugyanazt a transzformációt örökli, tehát a váll soha nem nyílik szét. */
    torso.add(arm); arms[K] = arm; elbows[K] = elb; fists[K] = fist;
  });

  /* ------------------------------------------------------------------ FEJ -- */
  const head = new T3.Group();
  head.position.set(0, 2.50 + G.neckLen, .05);
  head.scale.setScalar(G.headScale);
  /* A FEJ A TÖRZS GYEREKE (ref: Claude-of-Duty rig.js — a Neck a Spine2 alatt lóg).
     Korábban a `g` alatt ült, ezért a fej nem örökölte a törzs dőlését/csavarodását:
     járás közben a test fordult, a fej nem — ettől érződött szétesőnek a mozgás. */
  torso.add(head);

  if (G.wraith) buildWraithHead(head, G, R, bodySkin, eyeM, own, P);
  else buildHead(head, G, R, bodySkin, paleMat, mossTone, eyeM, own, mossPass);

  /* állkapocs külön Group -> nyitható (üvöltés / támadás) */
  const jaw = head.userData.jaw || new T3.Group();
  const eyes = head.userData.eyes || [];

  /* ------------------------------------------------- SZARVAK / TARAJ / stb -- */
  if (!G.wraith) addCrest(g, torso, G, R, mossTone);
  addHorns(head, G, R, own);
  addGrowths(g, torso, head, G, R, mossTone, own);
  if (!G.wraith) addGear(g, torso, head, arms, elbows, G, R, own);
  const weapon = addWeapon(fists, G, R, own);
  addWounds(g, torso, head, arms, elbows, G, R, own);
  if (P) addElementLayer(g, torso, head, elbows, G, P, R, own);
  const tierFx = addTier(g, torso, head, G, R, own);

  /* vertexColors-biztonsági pass (a színattribútum nélküli mesh-ek fehéret kapnak) */
  g.traverse(o => {
    if (o.isMesh && (o.material === bodySkin || o.material === mossTone || o.material === paleMat) && !o.geometry.attributes.color) {
      const n = o.geometry.attributes.position.count;
      o.geometry.setAttribute('color', new T3.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    }
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });

  g.scale.setScalar(sc);

  return {
    g, legs, knees, ankles, arms, elbows, fists, head, jaw, eyes, weapon, tierFx,
    torso: spineJ, pelvis: pelvisJ, torsoIn: torso,
    bodySkin, eyeMat: eyeM, mossMat: mossTone, _mats: perMat,
    genome: G, scale: sc,
    bodyR: .80 * sc, bodyCY: 1.45 * sc, headCY: (2.50 + G.neckLen) * sc, headR: .46 * sc,
    stuckArrows: [],
    /* rugó-állapotok a másodlagos mozgáshoz (anim.secondary hajtja) */
    _spr: { hy: { x: 0, v: 0 }, hx: { x: 0, v: 0 }, jaw: { x: 0, v: 0 }, wz: { x: 0, v: 0 }, gut: { x: 0, v: 0 } },
  };
}

