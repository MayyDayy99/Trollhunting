/* ============================================================================
   6) ANIMÁCIÓ — járás / támadás / halál (a demóhoz; a játék sajátját is bírja)
   ========================================================================== */
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
/* egyoldalas, sima lebeny — a térd/boka görbékhez (ref: Claude-of-Duty clips.js `lobe`).
   A régi Math.max(0, sin) éles törést adott a nulla-átmenetnél; a hatványozott
   változat lágyan indul és lágyan zár, ezért a lépés nem "kattan". */
const lobe = (x, k) => { const s = Math.sin(x); return s > 0 ? Math.pow(s, k || 1.4) : 0; };

/* A JÁRÁS-KONSTANSOK a genomból (ref: Claude-of-Duty clips.js WALK/RUN/CROUCH táblák).
   Egy tengely: 0 = fürge/könnyű, 1 = nehéz/tömeges. Minden érték e mentén interpolál,
   így a kaszt tömege a JÁRÁSBÓL is olvasható, nem csak a sziluettből. */
function gaitFor(G) {
  const h = G.caste === 'brute' ? 1
    : G.caste === 'scout' ? 0
      : clamp01(((G.torsoW || 1) - .82) / .58) * .55 + (G.rocky ? .3 : 0) + (G.toad ? .2 : 0);
  const L = (a, b) => a + (b - a) * clamp01(h);
  return {
    thigh:      L(.62, .40),   thighBias: L(-.03, .05),
    kneeBase:   L(.10, .20),   knee:      L(1.05, .78),  kneeStance: L(.10, .26),
    ankle:      L(.36, .26),
    armRest:    L(.30, .42),   armSwing:  L(.52, .30),   elbow: L(.58, .40),
    sway:       L(.030, .085), bob:       L(.034, .050), bobBias: L(-.030, -.046),
    pelvisRoll: L(.055, .105), pelvisYaw: L(.070, .045),
    spineYaw:   L(.105, .060), spineRoll: L(.045, .085),
    lean:       L(.10, .05),
    limp:       (G.asym || 0) * .55,
  };
}
const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerpN = (a, b, t) => a + (b - a) * t;
/* MAROK-TÁBLA fegyverenként: nyugalmi / felhúzási / becsapódási csúkló-szög.
   Rövid, egykezes fegyver nagyot csuklik (ostorcsapás); a hosszú kétkezes
   (buzogány, fatörzs, lándzsa) alig — azt a VÁLL viszi, nem a csúkló, különben
   a fegyver vége akkora ívet ver le, hogy leváltnak látszik. */
const WGRIP = {
  none:    { rest: 0,    wind: -.55,  hit:  .40 },
  daggers: { rest: 0,    wind: -.60,  hit:  .50 },
  boulder: { rest: 0,    wind: -.35,  hit:  .30 },
  shield:  { rest: 0,    wind: -.30,  hit:  .25 },
  club:    { rest: -.55, wind: -1.30, hit: 1.40 },
  axe:     { rest: -.55, wind: -1.30, hit: 1.40 },
  flail:   { rest: -.45, wind: -1.15, hit: 1.20 },
  staff:   { rest: 0,    wind: -.75,  hit:  .80 },
  spear:   { rest: 0,    wind: -.40,  hit:  .45 },
  maul:    { rest: -.12, wind: -.60,  hit:  .55 },
  trunk:   { rest: -.10, wind: -.45,  hit:  .40 },
};
const grip = (G) => WGRIP[G.weapon] || WGRIP.none;const wristRest = (G) => grip(G).rest;

/* ===== TÁMADÁS-STÍLUSOK ===================================================
   Nem mindenki ugyanazt az előrehajolós mozdulatot csinálja: a stílus a fegyverből
   és a kasztból sorsolódik (seed-stabilan, a genomba mentve).
     overhead — függőleges lesújtás      sweep    — vízszintes körbevágás
     backhand — fonák, a másik irányból    thrust   — döfés, nagy belépéssel
     slam     — kétkezes földre csapás     claw     — váltott karmú marcangolás
     bite     — fegyvertelen, fejjel előre harapás
   Minden mező [felhúzás, becsapódás] pár; a nyugalmi érték a `ra()`-ból jön.
   p=medence · s=gerinc · a/e=jobb váll,könyök · l/lE=bal · h=fej
   root=belépés-szorzó · jaw=állkapocs · wri=csúkló-amplitúdó (0 = a fegyver nem csuklik) */
const ATK = {
  overhead: { pY: [.34, -.30], pZ: [.07, -.06], sY: [.46, -.40], sX: [-.34, .42], sZ: [-.10, .12],
              aX: [-1.95, 1.10], aZ: [-.26, .52], eX: [-1.90, -.30],
              lX: [-.52, 1.05], lZ: [.30, -.14], lE: [-1.15, -.28],
              hX: [-.26, .30], root: 1, jaw: .60, wri: 1 },
  sweep:    { pY: [.74, -.68], pZ: [.10, -.10], sY: [.88, -.80], sX: [-.16, .10], sZ: [-.06, .06],
              aX: [-.34, .26], aZ: [-.95, 1.18], eX: [-1.55, -.55],
              lX: [-.30, .62], lZ: [.88, -.36], lE: [-1.20, -.40],
              hX: [-.12, .14], root: .65, jaw: .45, wri: .6 },
  backhand: { pY: [-.64, .72], pZ: [-.08, .10], sY: [-.76, .86], sX: [-.12, .16], sZ: [.06, -.08],
              aX: [-.24, .36], aZ: [1.08, -.88], eX: [-1.70, -.45],
              lX: [.56, -.36], lZ: [-.36, .82], lE: [-.45, -1.20],
              hX: [-.10, .18], root: .55, jaw: .40, wri: .6 },
  thrust:   { pY: [.30, -.18], pZ: [.05, -.03], sY: [.34, -.22], sX: [-.28, .30], sZ: [-.05, .04],
              aX: [-.78, 1.02], aZ: [-.05, .04], eX: [-2.05, -.06],
              lX: [.12, -.58], lZ: [.20, .30], lE: [-.80, -1.35],
              hX: [-.18, .22], root: 1.55, jaw: .35, wri: .35 },
  slam:     { pY: [0, 0], pZ: [0, 0], sY: [0, 0], sX: [-.54, .64], sZ: [0, 0],
              aX: [-2.35, 1.25], aZ: [-.16, .30], eX: [-1.55, -.20],
              lX: [-2.35, 1.25], lZ: [.16, -.30], lE: [-1.55, -.20],
              hX: [-.42, .44], root: .45, jaw: .80, wri: 1 },
  claw:     { pY: [.44, -.42], pZ: [.06, -.06], sY: [.52, -.50], sX: [-.30, .40], sZ: [-.10, .14],
              aX: [-1.55, 1.30], aZ: [-.55, .78], eX: [-1.35, -.55],
              lX: [.82, -.72], lZ: [.55, -.30], lE: [-.55, -1.30],
              hX: [-.30, .36], root: .90, jaw: .90, wri: .5 },
  bite:     { pY: [.10, -.08], pZ: [0, 0], sY: [.12, -.10], sX: [-.46, .80], sZ: [0, 0],
              aX: [-.85, -.30], aZ: [-.42, -.58], eX: [-.55, -.95],
              lX: [-.85, -.30], lZ: [.42, .58], lE: [-.55, -.95],
              hX: [-.55, .64], root: 1.70, jaw: 1.5, wri: 0 },
};
const ATK_POOL = (g) => {
  const w = g.weapon;
  if (w === 'spear')   return [['thrust', 6], ['sweep', 2], ['overhead', 1]];
  if (w === 'daggers') return [['thrust', 4], ['claw', 4], ['sweep', 2]];
  if (w === 'staff')   return [['thrust', 3], ['overhead', 3], ['sweep', 2]];
  if (w === 'maul' || w === 'trunk' || w === 'boulder') return [['overhead', 5], ['slam', 4], ['sweep', 1]];
  if (w === 'axe')     return [['overhead', 5], ['sweep', 4], ['backhand', 2]];
  if (w === 'club' || w === 'flail') return [['overhead', 4], ['sweep', 4], ['backhand', 3]];
  if (w === 'shield')  return [['slam', 4], ['thrust', 3]];
  if (g.caste === 'brute') return [['slam', 5], ['overhead', 2], ['claw', 2]];
  return [['claw', 5], ['bite', 4], ['slam', 1]];
};

const anim = {
  /* nyugalmi póz-konstansok (a reset és minden anim erre tér vissza) */
  REST: { arm: .34, elbow: -.42, leg: 0, knee: .06 },

  idle(m, t) {
    const G = m.genome, b = Math.sin(t * 1.5) * .022;
    /* a medence és a gyökér nyugalomban — a járás írta eltolást visszaengedjük */
    m.g.position.x = 0; m.g.rotation.y = 0; m.g.rotation.z = 0; m.g.position.z = 0;
    m.pelvis.rotation.z = Math.sin(t * .31) * .014;
    m.pelvis.rotation.y = Math.sin(t * .26) * .020;
    m.torso.rotation.x = G.lean + Math.sin(t * 1.5) * .02;
    m.torso.rotation.y = Math.sin(t * .37) * .04 - m.pelvis.rotation.y;
    m.torso.rotation.z = -m.pelvis.rotation.z * 1.2;
    m.torso.position.y = 1.30 + b;
    /* a fej a törzs gyereke -> a tekintet-kitartáshoz a törzs csavarodását ki kell vonni */
    m.head.rotation.y = Math.sin(t * .43) * .28 - (m.pelvis.rotation.y + m.torso.rotation.y) * .7;
    m.head.rotation.x = Math.sin(t * .7) * .06 - G.lean * .5;
    m.head.rotation.z = -m.torso.rotation.z * .8;
    if (m.fists) { const wr = wristRest(G); m.fists.L.rotation.set(wr, 0, 0); m.fists.R.rotation.set(wr, 0, 0); }
    ['L', 'R'].forEach((k, i) => {
      const ph = t * 1.5 + i * .5;
      m.arms[k].rotation.x = .34 + Math.sin(ph) * .05;
      m.arms[k].rotation.z = (k === 'L' ? .09 : -.09) + Math.sin(ph * .7) * .02;
      m.elbows[k].rotation.x = -.42 - Math.sin(ph) * .06;
      if (m.legs[k].rotation) { m.legs[k].rotation.x = 0; }
      if (m.knees[k]) m.knees[k].rotation.x = .06;
      if (m.ankles[k]) m.ankles[k].rotation.x = -.04;
    });
    if (m.jaw) m.jaw.rotation.x = Math.max(0, Math.sin(t * .8) - .93) * 3;
    m.g.position.y = G.wraith ? .35 + Math.sin(t * 1.1) * .12 : 0;
    m.pelvis.position.y = .95;
    if (m.g.userData.orbit) m.g.userData.orbit.rotation.y = t * 1.4;
  },

  walk(m, t, speedK) {
    const G = m.genome, sp = speedK || 1;
    if (G.wraith) {
      m.g.position.y = .35 + Math.sin(t * 2.2) * .14;
      m.arms.L.rotation.x = .25 + Math.sin(t * 2) * .18; m.arms.R.rotation.x = .25 - Math.sin(t * 2) * .18;
      m.elbows.L.rotation.x = -.5 - Math.sin(t * 2) * .18; m.elbows.R.rotation.x = -.5 + Math.sin(t * 2) * .18;
      m.head.rotation.x = Math.sin(t * 2) * .05; m.torso.rotation.z = Math.sin(t * 1.3) * .05;
      return;
    }
    /* ====================================================================
       JÁRÁS — összehangolt lánc (ref: Claude-of-Duty src/ai/clips.js `gait`).
       A rétegek fázisviszonya adja az "egy test" érzetet:
         medence : 2 bólintás/lépés + oldalsó súlyáthelyezés + dőlés a
                   TÁMASZKODÓ láb felé + előre forduló lendítő-csípő
         gerinc  : a medencével SZEMBE csavarodik (ellenrotáció)
         fej     : a mellkas csavarodását kioltja -> a tekintet előre marad
         karok   : ELLENOLDALI a lábbal (bal kar előre <-> bal láb hátra)
       ==================================================================== */
    const K = m._gait || (m._gait = gaitFor(G));
    const ph = t * (4 + 3 * sp);
    const s1 = Math.sin(ph), cph = Math.cos(ph), c2 = Math.cos(2 * ph);

    /* --- LÁB: fél ciklus eltolással; a sántítás (G.asym) oldalanként más amplitúdó --- */
    [['L', 0, 1], ['R', Math.PI, -1]].forEach(([k, o, sd]) => {
      const a = ph + o, amp = 1 + sd * K.limp;
      m.legs[k].rotation.x = Math.sin(a) * K.thigh * amp + K.thighBias;
      /* a térd a LENDÍTŐ fázisban hajlik erősen, támaszkodáskor csak enyhén ruganyozik */
      m.knees[k].rotation.x = K.kneeBase
        + lobe(-Math.sin(a - .55), 1.5) * K.knee * amp
        + lobe(-Math.sin(a + 2.59), 2) * K.kneeStance;
      /* a boka az elrugaszkodáskor feszül (a comb fázisához képest eltolva) */
      m.ankles[k].rotation.x = -.06 - lobe(Math.sin(a + .4), 1.2) * K.ankle;
    });

    /* --- MEDENCE = a gyökér (a lábak és a törzs is ezt öröklik) --- */
    m.g.position.y = K.bobBias + c2 * K.bob;      // két bólintás lépésenként (nem |sin| -> nincs törés)
    m.g.position.x = -cph * K.sway;               // a súly a támaszkodó láb fölé csúszik
    m.g.rotation.z = 0; m.g.rotation.y = 0; m.g.position.z = 0;
    m.pelvis.position.y = .95;
    m.pelvis.rotation.z = cph * K.pelvisRoll;     // a csípő a lendítő oldalon leesik
    m.pelvis.rotation.y = -cph * K.pelvisYaw;     // a lendítő csípő előre fordul
    m.torso.position.y = 1.30;

    /* --- GERINC: ellenrotáció a medencére; a végzett világ-szögből kivonjuk a gyökérét --- */
    m.torso.rotation.y = cph * K.spineYaw - m.pelvis.rotation.y;
    m.torso.rotation.z = -cph * K.spineRoll - m.pelvis.rotation.z;
    m.torso.rotation.x = G.lean + K.lean * sp + Math.abs(s1) * .03;

    /* --- FEJ: a mellkas mozgásának kioltása; 20% marad -> finoman vezet, nem szögvas --- */
    const chestY = m.pelvis.rotation.y + m.torso.rotation.y;
    const chestZ = m.pelvis.rotation.z + m.torso.rotation.z;
    m.head.rotation.y = -chestY * .78;
    m.head.rotation.z = -chestZ * .85;
    m.head.rotation.x = -(G.lean + K.lean * sp) * .55 - c2 * .02;

    /* --- KAR: ELLENOLDALI (bal kar előre, amikor a bal láb hátra) --- */
    m.arms.L.rotation.x = K.armRest - s1 * K.armSwing;
    m.arms.R.rotation.x = K.armRest + s1 * K.armSwing;
    m.arms.L.rotation.z = .10 + cph * .035;
    m.arms.R.rotation.z = -.10 + cph * .035;
    /* a könyök akkor pumpál, amikor az adott kar ELŐRE lendül */
    m.elbows.L.rotation.x = -.50 - lobe(s1, 1.3) * K.elbow;
    m.elbows.R.rotation.x = -.50 - lobe(-s1, 1.3) * K.elbow;
    /* CSÚKLÓ: a kéz és a fegyver késve követi a könyököt (a súly lendül a marokban).
       Fegyveres trollon a nyugalmi csúkló-szög negatívabb: a nyél hátrafelé,
       az alkar vonalában lóg, nem keresztben a has előtt. */
    if (m.fists) {
      const wr = wristRest(G);
      m.fists.L.rotation.x = wr - s1 * .16; m.fists.L.rotation.z = 0;
      m.fists.R.rotation.x = wr + s1 * .16; m.fists.R.rotation.z = 0;
    }

    if (m.jaw) m.jaw.rotation.x = .05 + Math.abs(c2) * .04;
  },

  /* u: 0..1 — TÁMADÁS mint KINETIKUS LÁNC.
     Egy ütés attól olvasódik erősnek, hogy a lánc PROXIMÁLISTÓL DISZTÁLIS felé
     indul: előbb a medence fordul, utána a gerinc, majd a váll, a könyök, végül
     a csukló csattan. Minden láncszem UGYANAZT a lendület-görbét kapja, csak
     egyre KÉSŐBB — ez az `swingAt(u, delay)`. A fegyver a csuklón lóg, tehát
     automatikusan ő érkezik utoljára: hátramarad a felhúzásban, és a becsapódás
     pillanatában előre pördül. */
  attack(m, u) {
    const G = m.genome;
    const A = ATK[G.atk] || ATK.overhead;
    const heavy = G.caste === 'brute' || G.weapon === 'maul' || G.weapon === 'trunk' || G.weapon === 'boulder';
    /* IDŐZÍTÉS — a csapás ereje az IDŐARÁNYOKBÓL jön, nem a szögekből:
       lassú felhúzás → MEGÁLLÁS a holtponton (anticipáció) → nagyon gyors,
       GYORSULÓ csapás → tartott becsapódás visszapattanással → lazító visszaállás.
       Korábban a csapás lassult a találat előtt (easeOut) és nem volt sem holtpont,
       sem tartás — ezért érződött "legyintve", nem lesújtva. */
    const K0 = heavy ? .42 : .36,      // a felhúzás vége
          K1 = heavy ? .52 : .44,      // a holtponti megállás vége
          K2 = heavy ? .60 : .53,      // BECSAPÓDÁS
          K3 = heavy ? .74 : .68;      // a tartott becsapódás vége
    const swingAt = (x) => {
      const v = u - x;
      if (v <= 0) return 0;
      if (v < K0) return -easeInOut(v / K0);                                   // 0 -> -1 (felhúzás)
      if (v < K1) return -1;                                                    // HOLTPONT
      if (v < K2) return -1 + 2 * Math.pow((v - K1) / (K2 - K1), 1.55);         // -1 -> +1, gyorsulva
      if (v < K3) return 1 - .16 * Math.sin(((v - K2) / (K3 - K2)) * Math.PI);  // tartás + visszapattanás
      return 1 - easeInOut(Math.min(1, (v - K3) / (Math.max(K3 + .06, 1 - x) - K3)));   // +1 -> 0, a k\u00e9sleltet\u00e9ssel R\u00d6VID\u00cdTVE, hogy minden \u00edz\u00fclet a klip v\u00e9g\u00e9re \u00e9rjen nyugalomba
    };
    /* a lánc késleltetései — a fegyver (csukló) 4 lépcsővel a medence mögött */
    const DW = .125;                                    // a csukló (= a fegyver) késése
    const sPelv = swingAt(0), sSpine = swingAt(.035), sArm = swingAt(.065),
          sElb = swingAt(.095), sWri = swingAt(DW);
    /* s in [-1,1] -> NYUGALOM-HORGONYZOTT leképezés.
       Kritikus: s=0 a NYUGALMI pózt adja, nem a felhúzás és a becsapódás felezőjét —
       különben a klip első képkockáján az egész kar odaugrik egy fél-lendített pózba,
       a végén pedig visszaugrik. (a = felhúzási szélsőérték, b = becsapódási.) */
    const ra = (s, rest, a, b) => s < 0 ? rest + (-s) * (a - rest) : rest + s * (b - rest);

    /* --- GYÖKÉR: a járás ringását kioltjuk, helyette BELÉPÉS és BECSAPÓDÁS-JOLT.
       A test reakciója a FEGYVER érkezéséhez van kötve (K2 + csukló-késés), nem a
       medence fázisához — különben a troll megrándul, miközben a bunkó még a feje
       fölött van. --- */
    const HIT = K2 + DW, HEND = K3 + DW;
    m.g.position.x *= .82; m.g.rotation.y = 0; m.g.rotation.z = 0;
    const step = Math.max(0, 1 - Math.abs(u - HIT) / .17);            // éles lökés a találat körül
    const jolt = (u > HIT && u < HEND) ? Math.sin(((u - HIT) / (HEND - HIT)) * Math.PI) : 0;
    m.g.position.z = easeOutCubic(step) * (heavy ? .34 : .22) * A.root;   // előrelép az ütésbe (a döfés nagyot, a körbevágás alig)
    /* GUGGOLÁS: a MEDENCE süllyed, nem a gyökér. A lábak a gyökér gyerekei, ezért a
       gyökér süllyesztése a talpakat a föld alá vitte volna; a medence ejtésével a
       felsőtest megy le, a talp a földön marad (a térdhajlítás alább adja a többit). */
    const squat = Math.max(0, -sPelv) * .10 + jolt * (heavy ? .11 : .07);
    m.g.position.y = 0;
    m.pelvis.position.y = .95 - squat;

    /* --- MEDENCE: a lánc kezdete; elfordul a felhúzáskor, átfordul a csapásban --- */
    m.pelvis.rotation.y = ra(sPelv, 0, A.pY[0], A.pY[1]);
    m.pelvis.rotation.z = ra(sPelv, 0, A.pZ[0], A.pZ[1]);

    /* --- GERINC: a medencén TÚL fordul (nagyobb amplitúdó), és előrebukik a becsapódásra --- */
    m.torso.rotation.y = ra(sSpine, 0, A.sY[0], A.sY[1]) - m.pelvis.rotation.y;
    m.torso.rotation.x = G.lean + ra(sSpine, 0, A.sX[0], A.sX[1]);
    m.torso.rotation.z = ra(sSpine, 0, A.sZ[0], A.sZ[1]) - m.pelvis.rotation.z;
    m.torso.position.y = 1.30;

    /* --- VÁLL / KÖNYÖK / CSUKLÓ: egyre későbbi fázis -> ostorcsapás-érzet.
       A szögek a STÍLUS-táblából jönnek, így egy döfés tényleg döfés, egy körbevágás
       tényleg vízszintes — nem mindenki ugyanazt az előrehajolós mozdulatot csinálja. --- */
    m.arms.R.rotation.x = ra(sArm, .34, A.aX[0] * (heavy ? 1.08 : 1), A.aX[1]);
    m.arms.R.rotation.z = ra(sArm, -.09, A.aZ[0], A.aZ[1]);
    m.elbows.R.rotation.x = ra(sElb, -.42, A.eX[0], A.eX[1]);
    m.arms.L.rotation.x = ra(sArm, .34, A.lX[0], A.lX[1]);
    m.arms.L.rotation.z = ra(sArm, .09, A.lZ[0], A.lZ[1]);
    m.elbows.L.rotation.x = ra(sElb, -.42, A.lE[0], A.lE[1]);
    if (m.fists) {
      /* A fegyver a marokban HÁTRAMARAD a felhúzásnál, majd ÁTPÖRDÜL a becsapódáskor.
         Az amplitúdó fegyverenként (WGRIP) ÉS stílusonként (A.wri) más. */
      const gr = grip(G), wr = wristRest(G), k = A.wri;
      m.fists.R.rotation.x = ra(sWri, wr, wr + (gr.wind - wr) * k, wr + (gr.hit - wr) * k);
      m.fists.R.rotation.z = 0;
      m.fists.L.rotation.x = ra(sWri, 0, -.30 * k, .25 * k); m.fists.L.rotation.z = 0;
    }

    /* --- FEJ: a célponton marad (a törzs fordulását kioltja), majd rábólint az ütésre --- */
    const chestY = m.pelvis.rotation.y + m.torso.rotation.y;
    m.head.rotation.y = -chestY * .62;
    m.head.rotation.x = ra(sSpine, 0, A.hX[0], A.hX[1]) - G.lean * .45;
    m.head.rotation.z = -(m.pelvis.rotation.z + m.torso.rotation.z) * .6;

    /* --- LÁB: hátsó láb tolja, elülső fogadja a súlyt --- */
    if (m.knees.L) {
      m.legs.L.rotation.x = ra(sPelv, 0, -.22, .30); m.legs.R.rotation.x = ra(sPelv, 0, .26, -.34);
      m.knees.L.rotation.x = .06 + Math.max(0, -sPelv) * .30 + step * .18;
      m.knees.R.rotation.x = .06 + Math.max(0, sPelv) * .34 + step * .12;
      if (m.ankles.L) { m.ankles.L.rotation.x = -.06 - Math.max(0, sPelv) * .16; m.ankles.R.rotation.x = -.06 - Math.max(0, -sPelv) * .16; }
    }
    /* --- ÁLLKAPOCS: kinyílik a felhúzásra, becsattan az ütésre --- */
    if (m.jaw) m.jaw.rotation.x = Math.max(0, -sPelv) * .60 + jolt * .26;
  },

  DEATHS: ['topple', 'crumple', 'backflip', 'faceplant', 'spin', 'kneel', 'dissolve', 'shatter', 'burst'],

  death(m, k, style) {
    const G = m.genome, g = m.g, p = g.position, S = m.scale;
    p.x *= .9;   // a járásból maradt oldalsó súlyáthelyezés kifut, nem ragad be a hullába
    const L = (a, b, t) => lerpN(a, b, t);
    const hasLegs = !!m.knees.L && !G.wraith;
    if (m.eyeMat) m.eyeMat.emissiveIntensity = Math.max(0, .95 * (1 - k / 1.1));
    /* közös: a végtagok elernyednek — a könyök/térd is */
    const limp = (t) => {
      m.elbows.L.rotation.x = L(-.42, -.12, t); m.elbows.R.rotation.x = L(-.42, -.16, t);
      if (hasLegs) { m.knees.L.rotation.x = L(.06, .55, t); m.knees.R.rotation.x = L(.06, .40, t); }
    };
    switch (style) {
      case 'topple': {
        const f = easeOutCubic(Math.min(1, k / .9));
        const settle = k > .9 ? Math.sin((k - .9) * 16) * .07 * Math.exp(-(k - .9) * 6) : 0;
        g.rotation.x = L(0, 1.55, f) + settle; g.rotation.z = L(0, .3, f); p.y = -.05 * f;
        m.head.rotation.x = L(0, .9, Math.min(1, k / .6));
        m.arms.L.rotation.x = L(.34, 1.7, f); m.arms.L.rotation.z = L(.09, .5, f);
        m.arms.R.rotation.x = L(.34, 1.7, f); m.arms.R.rotation.z = L(-.09, -.5, f);
        limp(f);
        if (hasLegs) { m.legs.L.rotation.x = L(0, -.35, f); m.legs.R.rotation.x = L(0, -.45, f); }
        return k > 2.2;
      }
      case 'crumple': {
        const r = easeOutCubic(Math.min(1, k / 1.0)); p.y = -r * .62 * S;
        if (hasLegs) { m.legs.L.rotation.x = L(0, .55, r); m.legs.R.rotation.x = L(0, .5, r);
                       m.knees.L.rotation.x = L(.06, 2.0, r); m.knees.R.rotation.x = L(.06, 1.9, r); }
        g.rotation.x = L(0, .95, r);
        m.head.rotation.x = L(0, 1.1, Math.min(1, k / .8));
        m.arms.L.rotation.x = L(.34, 1.9, r); m.arms.R.rotation.x = L(.34, 2.0, r);
        m.elbows.L.rotation.x = L(-.42, -.9, r); m.elbows.R.rotation.x = L(-.42, -1.0, r);
        const flat = Math.min(1, Math.max(0, (k - .9) / .5)); g.scale.set(S, S * (1 - flat * .28), S);
        return k > 2.2;
      }
      case 'backflip': {                                   // fejlövés: hanyatt vágódik
        const f = easeOutCubic(Math.min(1, k / .85));
        g.rotation.x = L(0, -1.75, f); p.y = Math.sin(Math.min(1, k / .85) * Math.PI) * .5 * S - .05 * f;
        p.z = -f * .9 * S;
        m.arms.L.rotation.x = L(.34, -2.0, f); m.arms.R.rotation.x = L(.34, -2.2, f);
        m.arms.L.rotation.z = L(.09, .8, f); m.arms.R.rotation.z = L(-.09, -.8, f);
        m.elbows.L.rotation.x = L(-.42, -.05, f); m.elbows.R.rotation.x = L(-.42, -.08, f);
        if (hasLegs) { m.legs.L.rotation.x = L(0, .9, f); m.legs.R.rotation.x = L(0, 1.1, f);
                       m.knees.L.rotation.x = L(.06, .8, f); m.knees.R.rotation.x = L(.06, .6, f); }
        m.head.rotation.x = L(0, -.8, f);
        return k > 2.2;
      }
      case 'faceplant': {
        const f = easeOutCubic(Math.min(1, k / .7));
        g.rotation.x = L(0, -1.62, f); p.y = -.04 * f; p.z = f * .5 * S;
        m.arms.L.rotation.x = L(.34, -.35, f); m.arms.R.rotation.x = L(.34, -.45, f);
        m.elbows.L.rotation.x = L(-.42, -.9, f); m.elbows.R.rotation.x = L(-.42, -.8, f);
        if (hasLegs) { m.legs.L.rotation.x = L(0, .45, f); m.legs.R.rotation.x = L(0, .3, f);
                       m.knees.L.rotation.x = L(.06, .5, f); m.knees.R.rotation.x = L(.06, .7, f); }
        m.head.rotation.x = L(0, -.35, f);
        return k > 2.2;
      }
      case 'spin': {
        const f = easeOutCubic(Math.min(1, k / 1.15));
        g.rotation.y = f * 7.4;
        g.rotation.x = L(0, 1.5, easeOutCubic(Math.min(1, Math.max(0, (k - .35) / .8))));
        p.y = -.05 * f;
        m.arms.L.rotation.z = L(.09, 1.5, f); m.arms.R.rotation.z = L(-.09, -1.5, f);
        m.arms.L.rotation.x = L(.34, .05, f); m.arms.R.rotation.x = L(.34, .05, f);
        limp(f);
        return k > 2.3;
      }
      case 'kneel': {                                      // térdre rogy, majd oldalra dől
        const a = easeOutCubic(Math.min(1, k / .55));
        if (hasLegs) { m.legs.L.rotation.x = L(0, .55, a); m.legs.R.rotation.x = L(0, .15, a);
                       m.knees.L.rotation.x = L(.06, 2.1, a); m.knees.R.rotation.x = L(.06, .8, a); }
        p.y = -a * .46 * S;
        m.torso.rotation.x = L(G.lean, G.lean + .5, a);
        m.head.rotation.x = L(0, .7, a);
        m.arms.L.rotation.x = L(.34, 1.4, a); m.arms.R.rotation.x = L(.34, 1.3, a);
        m.elbows.L.rotation.x = L(-.42, -.2, a); m.elbows.R.rotation.x = L(-.42, -.25, a);
        if (k > .8) { const b = easeOutCubic(Math.min(1, (k - .8) / .7)); g.rotation.z = L(0, 1.35, b); p.y = -a * .46 * S - b * .18 * S; }
        return k > 2.4;
      }
      case 'dissolve': {
        const r = Math.min(1, k / 1.4); p.y = r * 1.5 * S; g.rotation.y += .022;
        m.arms.L.rotation.x = L(.34, -.9, r); m.arms.R.rotation.x = L(.34, -1.0, r);
        m.elbows.L.rotation.x = L(-.42, -.1, r); m.elbows.R.rotation.x = L(-.42, -.15, r);
        g.scale.set(S * (1 + r * .35), S * (1 - r * .9), S * (1 + r * .35));
        return k > 1.9;
      }
      case 'shatter': {
        if (k < .35) { g.scale.setScalar(S * (1 + Math.sin(k * 40) * .02)); return false; }
        const r = Math.min(1, (k - .35) / .55);
        g.scale.set(S * (1 + r * .2), S * (1 - r), S * (1 + r * .2));
        g.rotation.z = r * .4;
        return k > 1.2;
      }
      case 'burst': {
        const r = Math.min(1, k / .9), blow = easeOutCubic(r);
        m.head.position.y = L(m.head.position.y, 3.6, .16); m.head.rotation.x += .16; m.head.rotation.z += .12;
        m.arms.L.rotation.z = L(.09, 1.6, blow); m.arms.R.rotation.z = L(-.09, -1.6, blow);
        m.elbows.L.rotation.x = L(-.42, .3, blow); m.elbows.R.rotation.x = L(-.42, .25, blow);
        if (hasLegs) { m.legs.L.rotation.z = L(0, .9, blow); m.legs.R.rotation.z = L(0, -.9, blow); }
        g.rotation.y += .07;
        g.scale.setScalar(Math.max(.0001, S * (1 - blow * .95)));
        return k > 1.3;
      }
    }
    return k > 2.2;
  },

  pickDeath(G, el, headshot, R) {
    const r = R || Math.random;
    if (G.wraith) return 'dissolve';
    if (el === 'ice') return 'shatter';
    if (el === 'fire') return r() < .5 ? 'burst' : 'crumple';
    if (el === 'lightning') return r() < .5 ? 'spin' : 'backflip';
    if (headshot) return r() < .6 ? 'backflip' : 'spin';
    if (G.rocky) return r() < .5 ? 'shatter' : 'topple';
    const pool = ['topple', 'crumple', 'faceplant', 'kneel', 'spin'];
    return pool[(r() * pool.length) | 0];
  },

  /* MÁSODLAGOS MOZGÁS — a pózra ÜL RÁ: fej-késés, fegyver-lengés, has-rezgés.
     ref: threejs-procedural-animation (rugó-követés, dt-alapú, vágott delta). */
  secondary(m, dt) {
    dt = Math.min(.05, dt);
    const S = m._spr;
    /* a fej a MELLKAS fordulását késve követi (a rugó hibája = a késés) */
    const chestY = m.pelvis.rotation.y + m.torso.rotation.y;
    m.head.rotation.y += springStep(S.hy, chestY, 90, .55, dt) - chestY;
    m.head.rotation.x += springStep(S.hx, m.torso.rotation.x * .35, 110, .6, dt) - m.torso.rotation.x * .35;
    /* az állkapocs a fej gyorsulására csattan */
    if (m.jaw) m.jaw.rotation.x = Math.max(0, m.jaw.rotation.x + springStep(S.jaw, m.head.rotation.x * .25, 140, .35, dt) * .5);
    /* a fegyver a csuklóban utánleng */
    if (m.weapon) m.weapon.rotation.z = (m.weapon.userData.baseZ !== undefined ? m.weapon.userData.baseZ : (m.weapon.userData.baseZ = m.weapon.rotation.z))
      + springStep(S.wz, -m.arms.R.rotation.x * .16, 70, .5, dt);
    /* a has a függőleges mozgásra rezeg */
    const gy = springStep(S.gut, m.g.position.y * -1.6, 130, .42, dt);
    m.torso.position.y = 1.30 + gy * .18;
  },

  reset(m) {
    const G = m.genome, S = m.scale, RE = this.REST;
    m.g.rotation.set(0, 0, 0); m.g.position.set(0, 0, 0); m.g.scale.setScalar(S);
    if (m.pelvis) { m.pelvis.rotation.set(0, 0, 0); m.pelvis.position.y = .95; }
    if (m.fists) { const wr = wristRest(G); m.fists.L.rotation.set(wr, 0, 0); m.fists.R.rotation.set(wr, 0, 0); }
    m.torso.rotation.set(G.lean, 0, 0); m.torso.position.y = 1.30;
    m.head.rotation.set(0, 0, 0); m.head.position.y = 2.50 + G.neckLen;
    ['L', 'R'].forEach(k => {
      m.arms[k].rotation.set(RE.arm, 0, k === 'L' ? .09 : -.09);
      m.elbows[k].rotation.set(RE.elbow, 0, 0);
      if (m.legs[k]) m.legs[k].rotation.set(0, 0, 0);
      if (m.knees[k]) m.knees[k].rotation.set(RE.knee, 0, 0);
      if (m.ankles[k]) m.ankles[k].rotation.set(-.04, 0, 0);
    });
    if (m.jaw) m.jaw.rotation.x = 0;
    if (m._spr) Object.keys(m._spr).forEach(k => { m._spr[k].x = 0; m._spr[k].v = 0; });
    if (m.eyeMat) m.eyeMat.emissiveIntensity = .95;
  },
};

